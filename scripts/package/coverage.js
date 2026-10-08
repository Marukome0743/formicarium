import { copyFile, cp, mkdir, readdir, readFile, writeFile, } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import coverageLibrary from 'istanbul-lib-coverage';
import { compiledTestConfig } from '../playwright-build-config.js';
import { FIRST_PARTY_JS, PACKAGE_FILES, sha256 } from './stage-package.js';
const { createCoverageMap } = coverageLibrary;
import instrumentLibrary from 'istanbul-lib-instrument';
const { createInstrumenter } = instrumentLibrary;
export function counterLayout(metadata) {
    let offset = 1;
    return metadata.map((file) => {
        const keys = Object.keys(file.s);
        const row = { path: file.path, registeredOffset: offset++, offset, keys };
        offset += keys.length;
        return row;
    });
}
export function createRealm(layout, name) {
    const last = layout.at(-1);
    const size = last.offset + last.keys.length;
    return { name, buffer: new SharedArrayBuffer(size * 4) };
}
export function bridgeSource(layout) {
    // Coverage needs zero/nonzero statements, not unbounded execution frequency.
    // Saturate raw signed Int32 counters before storage so hot SHA loops cannot
    // wrap into negative/zero counts. Never repair previously collected evidence.
    // A saturated count is a lower bound, not an exact execution frequency.
    return `globalThis.__coverage__=new Proxy({}, {set(object,key,file){
const row=${JSON.stringify(layout)}.find(row=>row.path===key);
if(!row)throw Error('unexpected coverage file');
if(JSON.stringify(Object.keys(file.s))!==JSON.stringify(row.keys))throw Error('coverage statement map mismatch');
Atomics.store(globalThis.__coverageCounters,row.registeredOffset,1);
for(let i=0;i<row.keys.length;i++){const index=row.offset+i;let latest=Atomics.load(globalThis.__coverageCounters,index);Object.defineProperty(file.s,row.keys[i],{enumerable:true,get(){return latest},set(value){if(!Number.isSafeInteger(value)||value<0)throw Error('coverage counter requires nonnegative safe integer');const bounded=Math.min(value,2147483647);Atomics.store(globalThis.__coverageCounters,index,bounded);latest=bounded}});}
object[key]=file;return true;}}); Atomics.store(globalThis.__coverageCounters,0,1);`;
}
export function mergeRealms(metadata, layout, realms, expectedNames) {
    if (metadata.length !== FIRST_PARTY_JS.length ||
        JSON.stringify(metadata.map((file) => file.path).sort()) !==
            JSON.stringify([...FIRST_PARTY_JS].sort()))
        throw new Error('coverage inventory differs');
    if (new Set(realms.map((realm) => realm.name)).size !== realms.length)
        throw new Error('duplicate coverage realm');
    for (const name of expectedNames) {
        const realm = realms.find((item) => item.name === name);
        if (!realm || Atomics.load(new Int32Array(realm.buffer), 0) !== 1)
            throw new Error(`missing coverage realm: ${name}`);
    }
    for (const realm of realms)
        if (Atomics.load(new Int32Array(realm.buffer), 0) !== 1)
            throw new Error(`unregistered coverage realm: ${realm.name}`);
    const map = createCoverageMap({});
    // Zero maps are registered first, including never-imported distribution files.
    for (const file of metadata)
        map.addFileCoverage(structuredClone(file));
    for (const realm of realms) {
        const counters = new Int32Array(realm.buffer);
        for (let index = 0; index < counters.length; index++)
            if (Atomics.load(counters, index) < 0)
                throw new Error(`negative coverage counter: ${realm.name}:${index}`);
        for (const file of metadata) {
            const row = layout.find((item) => item.path === file.path);
            const measured = structuredClone(file);
            measured.s = Object.fromEntries(row.keys.map((key, index) => [
                key,
                Atomics.load(counters, row.offset + index),
            ]));
            map.merge({ [file.path]: measured });
        }
    }
    const lines = map.getCoverageSummary().lines;
    return {
        map,
        lines,
        passed: typeof lines.pct === 'number' && lines.pct >= 80,
    };
}
/** Produce a separate instrumented copy; real archive bytes are never modified. */
export async function instrumentPackage({ source, out, }) {
    const metadata = [];
    const digests = [];
    for (const path of PACKAGE_FILES) {
        const destination = resolve(out, path);
        await mkdir(dirname(destination), { recursive: true });
        if (FIRST_PARTY_JS.includes(path)) {
            const bytes = await readFile(resolve(source, path));
            const instrumenter = createInstrumenter({
                esModules: true,
                compact: false,
                coverageGlobalScope: 'globalThis',
                coverageGlobalScopeFunc: false,
            });
            const text = instrumenter.instrumentSync(bytes.toString('utf8'), path);
            const file = instrumenter.lastFileCoverage();
            metadata.push(file);
            digests.push({
                path,
                sourceSha256: sha256(bytes),
                instrumentedSha256: sha256(text),
                statementMapSha256: sha256(JSON.stringify(file.statementMap)),
            });
            await writeFile(destination, text);
        }
        else
            await copyFile(resolve(source, path), destination);
    }
    const layout = counterLayout(metadata);
    const bridge = bridgeSource(layout);
    const workerSize = createRealm(layout, 'size').buffer.byteLength;
    await writeFile(resolve(out, 'coverage-node-worker.mjs'), `import {parentPort,workerData} from 'node:worker_threads';
globalThis.__coverageCounters=new Int32Array(workerData.buffer);${bridge}
const queue=[];const collect=value=>queue.push(value);parentPort.on('message',collect);
await import(workerData.target);parentPort.off('message',collect);for(const message of queue)parentPort.emit('message',message);`);
    await writeFile(resolve(out, 'coverage-browser-worker.mjs'), `const pending=[];const collect=event=>pending.push(event.data);self.addEventListener('message',collect);
self.addEventListener('message',async function bootstrap(event){if(event.data.type!=='coverage-bootstrap')return;self.removeEventListener('message',bootstrap);
globalThis.__coverageCounters=new Int32Array(event.data.buffer);${bridge}
const NativeWorker=globalThis.Worker;
globalThis.Worker=class extends NativeWorker {constructor(target,options){
const buffer=new SharedArrayBuffer(${workerSize});
super('/coverage-browser-worker.mjs',options);
this.addEventListener('message',event=>{if(event.data?.type==='coverage-descendant'){event.stopImmediatePropagation();self.postMessage(event.data);}});
self.postMessage({type:'coverage-descendant',buffer});
super.postMessage({type:'coverage-bootstrap',target:String(new URL(target,location.href)),buffer});}};
await import(event.data.target);self.removeEventListener('message',collect);
for(const data of pending)if(data.type!=='coverage-bootstrap')self.dispatchEvent(new MessageEvent('message',{data}));});`);
    await writeFile(resolve(out, 'coverage-metadata.json'), `${JSON.stringify({ metadata, layout, digests }, null, 2)}\n`);
    return { metadata, layout, digests, bridge };
}
export async function copySharedTestHelpers(root, out) {
    await cp(resolve(root, 'tests/shared'), resolve(out, 'tests/shared'), {
        recursive: true,
    });
}
export async function prepareCoverage({ source, out, root = fileURLToPath(new URL('../../', import.meta.url)), }) {
    const result = await instrumentPackage({ source, out });
    const size = createRealm(result.layout, 'size').buffer.byteLength;
    await cp(resolve(root, 'tests/package'), resolve(out, 'tests/package'), {
        recursive: true,
    });
    await copySharedTestHelpers(root, out);
    await cp(resolve(root, 'scripts/package'), resolve(out, 'scripts/package'), {
        recursive: true,
    });
    await cp(resolve(root, '.artifacts/u1-fixture'), resolve(out, '.artifacts/u1-fixture'), { recursive: true });
    await cp(resolve(root, 'dist/guests'), resolve(out, 'dist/guests'), {
        recursive: true,
    });
    await cp(resolve(source, 'assets'), resolve(out, 'dist/blink'), {
        recursive: true,
    });
    await cp(resolve(root, 'scripts/playwright-build-config.js'), resolve(out, 'scripts/playwright-build-config.js'));
    const configPath = resolve(out, 'tests/package/playwright.config.ts');
    await writeFile(configPath, compiledTestConfig(await readFile(configPath, 'utf8')));
    const nodePreload = `import {createRequire,syncBuiltinESMExports} from 'node:module';
import {writeFileSync} from 'node:fs';
const realms=[{name:'node-host',buffer:new SharedArrayBuffer(${size})}];
globalThis.__coverageCounters=new Int32Array(realms[0].buffer);${result.bridge}
const threads=createRequire(import.meta.url)('node:worker_threads');const Original=threads.Worker;
threads.Worker=class extends Original{constructor(target,options={}){if(options.workerData==='em-pthread'){super(target,{...options,execArgv:[]});return;}const realm={name:'node-worker-'+realms.length,buffer:new SharedArrayBuffer(${size})};realms.push(realm);super(new URL('./coverage-node-worker.mjs',import.meta.url),{...options,execArgv:[],workerData:{target:String(target),buffer:realm.buffer}});}};syncBuiltinESMExports();
process.on('exit',()=>writeFileSync(new URL('./coverage-node.json',import.meta.url),JSON.stringify(realms.map(realm=>({name:realm.name,counts:[...new Int32Array(realm.buffer)]})))));`;
    await writeFile(resolve(out, 'coverage-node-preload.mjs'), nodePreload);
    const browserInit = `const realms=[{name:'browser-host',buffer:new (typeof SharedArrayBuffer==='function'?SharedArrayBuffer:ArrayBuffer)(${size})}];
globalThis.__coverageRealms=realms;globalThis.__coverageCounters=new Int32Array(realms[0].buffer);${result.bridge}
const Original=globalThis.Worker;if(Original)globalThis.Worker=class extends Original{constructor(target,options){if(new URL(target,location.href).pathname.endsWith('/assets/blink.mjs')){super(target,options);return;}const realm={name:'browser-worker-'+realms.length,buffer:new SharedArrayBuffer(${size})};realms.push(realm);super('/coverage-browser-worker.mjs',options);
this.addEventListener('message',event=>{if(event.data?.type==='coverage-descendant'){event.stopImmediatePropagation();realms.push({name:'browser-worker-'+realms.length,buffer:event.data.buffer});}});
super.postMessage({type:'coverage-bootstrap',target:String(new URL(target,location.href)),buffer:realm.buffer});}};`;
    await writeFile(resolve(out, 'coverage-browser-init.js'), browserInit);
    for (const spec of [
        'browser-api.spec.js',
        'browser-worker.spec.js',
        'browser-broker.spec.js',
        'consumer.spec.js',
    ]) {
        const path = resolve(out, 'tests/package', spec);
        let text = await readFile(path, 'utf8');
        if (spec === 'consumer.spec.js') {
            const start = text.indexOf('const candidate =');
            const end = text.indexOf('const guest =');
            text = `${text.slice(0, start)}const packageRoot = ${JSON.stringify(out)};\n${text.slice(end)}`;
        }
        const hook = `test.beforeEach(async({context})=>context.addInitScript(await coverageRead(new URL('../../coverage-browser-init.js',import.meta.url),'utf8')));
test.afterEach(async({page},info)=>{const rows=await page.evaluate(()=>globalThis.__coverageRealms?.map(realm=>({name:realm.name,counts:[...new Int32Array(realm.buffer)]})));if(!rows)throw Error('missing browser page coverage');await coverageWrite(info.outputPath('coverage-realms.json'),JSON.stringify({project:info.project.name,title:info.title,rows}));});`;
        // Init registration precedes each original navigation hook.
        await writeFile(path, `import {readFile as coverageRead,writeFile as coverageWrite} from 'node:fs/promises';\n${text.replace('test.beforeEach(async ({ page })', `${hook}\ntest.beforeEach(async ({ page })`)}`);
    }
    const consumerPath = resolve(out, 'tests/package/consumer.test.js');
    let consumerText = await readFile(consumerPath, 'utf8');
    const start = consumerText.indexOf('const candidate =');
    const end = consumerText.indexOf('const { createSession }');
    consumerText = `${consumerText.slice(0, start)}const installed = ${JSON.stringify(out)};\n${consumerText.slice(end)}`;
    await writeFile(consumerPath, consumerText);
    return result;
}
export async function reportCoverage({ out, browserResults, candidatePath, session, }) {
    const { metadata, layout, digests } = JSON.parse(await readFile(resolve(out, 'coverage-metadata.json'), 'utf8'));
    const candidate = JSON.parse(await readFile(candidatePath, 'utf8'));
    for (const row of digests) {
        const expected = candidate.files.find((entry) => entry.path === row.path);
        if (!expected || expected.sha256 !== row.sourceSha256)
            throw new Error(`baseline source digest differs: ${row.path}`);
        if (sha256(await readFile(resolve(out, row.path))) !== row.instrumentedSha256)
            throw new Error(`instrumented digest differs: ${row.path}`);
        if (sha256(JSON.stringify(metadata.find((file) => file.path === row.path)?.statementMap)) !== row.statementMapSha256)
            throw new Error(`statement map differs: ${row.path}`);
    }
    const nodeRows = JSON.parse(await readFile(resolve(out, 'coverage-node.json'), 'utf8'));
    const realms = nodeRows.map((row) => ({
        name: row.name,
        buffer: Int32Array.from(row.counts).buffer,
    }));
    const inventory = JSON.parse(await readFile(new URL('./coverage-inventory.json', import.meta.url), 'utf8'));
    const expected = [
        'node-host',
        ...Array.from({ length: inventory.node.workers }, (_, index) => `node-worker-${index + 1}`),
    ];
    if (nodeRows.length !== inventory.node.workers + inventory.node.host)
        throw new Error('Node planned Worker realms were not all retained');
    if (session) {
        const rows = JSON.parse(await readFile(resolve(out, 'coverage-session-node.json'), 'utf8'));
        if (rows.length !== session.nodeWorkers + 1)
            throw Error('U2 planned Node Worker realms were not all retained');
        for (const row of rows)
            realms.push({
                name: `session:${row.name}`,
                buffer: Int32Array.from(row.counts).buffer,
            });
        expected.push('session:node-host', ...Array.from({ length: session.nodeWorkers }, (_, index) => `session:node-worker-${index + 1}`));
        for (const [title, workers] of Object.entries(session.browserCases)) {
            if (Object.hasOwn(inventory.browserCases, title))
                throw Error('U2 coverage case duplicates package case');
            inventory.browserCases[title] = workers;
        }
    }
    const files = [];
    async function scan(directory) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            const path = resolve(directory, entry.name);
            if (entry.isDirectory())
                await scan(path);
            else if (entry.name === 'coverage-realms.json')
                files.push(path);
        }
    }
    await scan(browserResults);
    const groups = new Map();
    for (const path of files) {
        const item = JSON.parse(await readFile(path, 'utf8'));
        const key = `${item.project}:${item.title}`;
        if (groups.has(key))
            throw new Error('duplicate browser coverage case');
        groups.set(key, item);
        for (const row of item.rows)
            realms.push({
                name: `${key}:${row.name}`,
                buffer: Int32Array.from(row.counts).buffer,
            });
    }
    for (const project of ['chromium', 'firefox', 'webkit']) {
        const cases = [...groups.values()].filter((item) => item.project === project);
        if (cases.length !== Object.keys(inventory.browserCases).length)
            throw new Error(`missing planned browser case: ${project}`);
        if (cases.reduce((sum, item) => sum + item.rows.length, 0) !==
            Object.values(inventory.browserCases).reduce((sum, workers) => sum + workers + 1, 0))
            throw new Error(`missing planned browser Worker realm: ${project}`);
        for (const [title, workers] of Object.entries(inventory.browserCases)) {
            const item = groups.get(`${project}:${title}`);
            if (!item || item.rows.length !== workers + 1)
                throw new Error(`missing planned case realm: ${project}:${title}`);
            expected.push(`${project}:${title}:browser-host`);
            for (let index = 1; index <= workers; index++)
                expected.push(`${project}:${title}:browser-worker-${index}`);
        }
    }
    const result = mergeRealms(metadata, layout, realms, expected);
    const report = {
        candidateSha256: candidate.tarball.sha256,
        threshold: 80,
        lines: result.lines,
        passed: result.passed,
        realmNames: realms.map((realm) => realm.name),
        digests,
        files: metadata.map((file) => ({
            path: file.path,
            lines: result.map.fileCoverageFor(file.path).getLineCoverage(),
        })),
        exclusions: {
            generatedBlink: 'third-party generated loader/wasm; separately verified by digest and real consumers',
            types: 'declarations; strict type fixtures',
            guests: 'external ELF/native oracle',
            development: 'scripts/tests; outside fixed product inventory',
        },
    };
    await writeFile(resolve(out, 'coverage-report.json'), `${JSON.stringify(report, null, 2)}\n`);
    if (!result.passed)
        throw new Error(`fixed inventory line coverage ${result.lines.pct}% is below 80%`);
    return report;
}
if (process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [command, first, second, third] = process.argv.slice(2);
    if (command === 'prepare' && first && second) {
        const result = await prepareCoverage({
            source: resolve(first),
            out: resolve(second),
        });
        console.log(JSON.stringify({
            files: result.metadata.length,
            digests: result.digests,
        }));
    }
    else if (command === 'report' && first && second && third) {
        const result = await reportCoverage({
            out: resolve(first),
            browserResults: resolve(second),
            candidatePath: resolve(third),
        });
        console.log(JSON.stringify({
            lines: result.lines,
            realms: result.realmNames.length,
            passed: result.passed,
        }));
    }
    else
        throw new Error('usage: coverage.js prepare <installed-package> <copy> | report <copy> <browser-results> <candidate-manifest>');
}
//# sourceMappingURL=coverage.js.map