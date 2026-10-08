import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { Worker } from 'node:worker_threads';
import { bridgeSource, counterLayout, createRealm, mergeRealms, } from '../../scripts/package/coverage.js';
import { FIRST_PARTY_JS } from '../../scripts/package/stage-package.js';
const { createInstrumenter } = createRequire(import.meta.url)('istanbul-lib-instrument');
const metadata = FIRST_PARTY_JS.map((path) => {
    const instrumenter = createInstrumenter({ esModules: true });
    instrumenter.instrumentSync('export const value = 1;\nexport function unused() {\n return 2;\n}\n', path);
    return instrumenter.lastFileCoverage();
});
const layout = counterLayout(metadata);
const register = (realm) => {
    Atomics.store(new Int32Array(realm.buffer), 0, 1);
    return realm;
};
test('coverage fixed21 inventory includes all unimported files at zero', () => {
    const result = mergeRealms(metadata, layout, [register(createRealm(layout, 'host'))], ['host']);
    assert.equal(result.map.files().length, 21);
    assert.ok(result.map.files().includes('runtime/guest-validation.js'));
    assert.ok(result.map.files().includes('runtime/session-port.js'));
    for (const name of [
        'install',
        'install-catalog',
        'install-transfer',
        'install-archive',
        'install-lifecycle',
    ])
        assert.ok(result.map.files().includes(`runtime/${name}.js`));
    assert.equal(result.lines.pct, 0);
    assert.equal(result.passed, false);
});
test('coverage refuses incomplete inventory instead of shrinking denominator', () => {
    assert.throws(() => mergeRealms(metadata.slice(1), layout, [], []), /inventory/);
});
test('coverage missing required realm fails even when other realm has counters', () => {
    assert.throws(() => mergeRealms(metadata, layout, [register(createRealm(layout, 'host'))], ['host', 'worker']), /missing coverage realm/);
});
test('coverage unregistered and duplicate realms fail', () => {
    const realm = createRealm(layout, 'worker');
    assert.throws(() => mergeRealms(metadata, layout, [realm], ['worker']), /missing coverage realm/);
    register(realm);
    assert.throws(() => mergeRealms(metadata, layout, [realm, realm], ['worker']), /duplicate/);
});
test('coverage line union aggregates statement counters across realm boundaries', () => {
    const a = register(createRealm(layout, 'host'));
    const b = register(createRealm(layout, 'worker'));
    for (const row of layout)
        for (let index = 0; index < row.keys.length; index++) {
            Atomics.store(new Int32Array(index % 2 ? a.buffer : b.buffer), row.offset + index, 1);
        }
    const result = mergeRealms(metadata, layout, [a, b], ['host', 'worker']);
    assert.equal(result.lines.pct, 100);
    assert.equal(result.passed, true);
});
test('coverage proxy bridge guards fixed statement map and bootstrap registration', () => {
    const source = bridgeSource(layout);
    assert.match(source, /coverage statement map mismatch/);
    assert.match(source, /unexpected coverage file/);
    assert.match(source, /Atomics.store\(globalThis.__coverageCounters,0,1\)/);
});
function bridgedCounter(atomics, initialValue = 0) {
    const realm = createRealm(layout, 'host');
    const counters = new Int32Array(realm.buffer);
    Atomics.store(counters, layout[0].offset, initialValue);
    const bridge = runInNewContext(bridgeSource(layout) + '\nglobalThis.__coverage__;', {
        __coverageCounters: counters,
        ...(atomics ? { Atomics: atomics } : {}),
    });
    const file = structuredClone(metadata[0]);
    bridge[file.path] = file;
    const row = layout[0];
    return { realm, counters, file, key: row.keys[0], index: row.offset };
}
test('single-writer bridge preserves every published count without Atomic loads on repeated getter increments', () => {
    let loads = 0;
    const writes = [];
    const observedAtomics = {
        load(counters, index) {
            loads++;
            return Atomics.load(counters, index);
        },
        store(counters, index, value) {
            writes.push({ index, value });
            return Atomics.store(counters, index, value);
        },
    };
    const { counters, file, key, index } = bridgedCounter(observedAtomics);
    const initialLoads = loads;
    for (let count = 1; count <= 2048; count++) {
        file.s[key]++;
        assert.equal(counters[index], count);
    }
    assert.equal(file.s[key], 2048);
    assert.deepEqual(writes.filter((write) => write.index === index).map((write) => write.value), Array.from({ length: 2048 }, (_, i) => i + 1), 'every setter still publishes its exact count through Atomics.store');
    assert.equal(loads - initialLoads, 0, 'repeated getters must use the single-writer realm value');
});
test('actual counter bridge saturates at MAX_INT32 before signed overflow', () => {
    const { counters, file, key, index } = bridgedCounter();
    file.s[key] = 2147483646;
    assert.equal(counters[index], 2147483646);
    file.s[key]++;
    assert.equal(counters[index], 2147483647);
    file.s[key]++;
    assert.equal(counters[index], 2147483647);
    assert.equal(file.s[key], 2147483647);
});
test('repeated increments and huge safe counts cannot wrap saturated counters negative or zero', () => {
    const { counters, file, key, index } = bridgedCounter();
    file.s[key] = 2147483647;
    for (let repeat = 0; repeat < 1000; repeat++)
        file.s[key]++;
    assert.equal(counters[index], 2147483647);
    file.s[key] = Number.MAX_SAFE_INTEGER;
    assert.equal(counters[index], 2147483647);
});
test('actual counter bridge preserves unexecuted zero and ordinary positive counts', () => {
    const { counters, file, key, index } = bridgedCounter();
    assert.equal(file.s[key], 0);
    file.s[key] = 0;
    assert.equal(counters[index], 0);
    file.s[key]++;
    assert.equal(counters[index], 1);
    file.s[key] = 42;
    assert.equal(counters[index], 42);
    file.s[key] = 0;
    assert.equal(counters[index], 0);
});
test('actual counter bridge rejects negative fractional unsafe and nonnumeric writes without altering counts', () => {
    const { counters, file, key, index } = bridgedCounter();
    file.s[key] = 7;
    for (const value of [
        -1,
        -2147483648,
        0.5,
        NaN,
        Infinity,
        -Infinity,
        Number.MAX_SAFE_INTEGER + 1,
        '1',
        1n,
        null,
        undefined,
    ]) {
        assert.throws(() => Reflect.set(file.s, key, value), /nonnegative safe integer/);
        assert.equal(counters[index], 7);
    }
});
test('saturated statement counts merge with zero realms without changing covered lines or denominator', () => {
    const { realm, file, key } = bridgedCounter();
    const zero = register(createRealm(layout, 'unexecuted-worker'));
    file.s[key] = 2147483648;
    const saturated = mergeRealms(metadata, layout, [realm, zero], ['host', 'unexecuted-worker']);
    file.s[key] = 1;
    const once = mergeRealms(metadata, layout, [realm, zero], ['host', 'unexecuted-worker']);
    assert.equal(saturated.map.files().length, 21);
    assert.equal(saturated.map.fileCoverageFor(file.path).s[key], 2147483647);
    assert.deepEqual(saturated.lines, once.lines);
    assert.equal(saturated.lines.total, once.lines.total);
    assert.ok(saturated.lines.covered > 0);
    assert.ok(saturated.lines.pct < 80);
    assert.equal(saturated.passed, false);
});
test('aggregate refuses negative raw counters even if every other statement would pass coverage', () => {
    const realm = register(createRealm(layout, 'host'));
    const counters = new Int32Array(realm.buffer);
    for (const row of layout)
        for (let index = 0; index < row.keys.length; index++)
            Atomics.store(counters, row.offset + index, 1);
    assert.equal(mergeRealms(metadata, layout, [realm], ['host']).passed, true);
    for (const invalid of [-1, -2147483648, -739875136]) {
        Atomics.store(counters, layout[0].offset, invalid);
        assert.throws(() => mergeRealms(metadata, layout, [realm], ['host']), /negative coverage counter/);
    }
});
test('single-writer getter initializes from a nonzero published counter and keeps rejected writes unchanged', () => {
    const { counters, file, key, index } = bridgedCounter(undefined, 37);
    assert.equal(file.s[key], 37);
    file.s[key]++;
    assert.equal(file.s[key], 38);
    assert.equal(Atomics.load(counters, index), 38);
    for (const invalid of [
        -1,
        NaN,
        Infinity,
        0.5,
        Number.MAX_SAFE_INTEGER + 1,
        '39',
    ]) {
        assert.throws(() => Reflect.set(file.s, key, invalid), /nonnegative safe integer/);
        assert.equal(file.s[key], 38);
        assert.equal(Atomics.load(counters, index), 38);
    }
});
test('single-writer bridge matches the former atomic read/write count sequence including saturation and resets', () => {
    const actual = bridgedCounter();
    const former = new Int32Array(new SharedArrayBuffer(4));
    const sequence = [
        0,
        7,
        'increment',
        'increment',
        0,
        2147483646,
        'increment',
        'increment',
        'increment',
        Number.MAX_SAFE_INTEGER,
        12,
        'increment',
    ];
    const actualCounts = [], formerCounts = [];
    for (const operation of sequence) {
        if (operation === 'increment')
            actual.file.s[actual.key]++;
        else
            actual.file.s[actual.key] = operation;
        const value = operation === 'increment' ? Atomics.load(former, 0) + 1 : operation;
        Atomics.store(former, 0, Math.min(value, 2147483647));
        actualCounts.push(Atomics.load(actual.counters, actual.index));
        formerCounts.push(Atomics.load(former, 0));
        assert.equal(actual.file.s[actual.key], Atomics.load(former, 0));
    }
    assert.deepEqual(actualCounts, formerCounts);
});
test('separate single-writer realms never share their cached value or shared buffer', () => {
    const first = bridgedCounter();
    const second = bridgedCounter();
    assert.notEqual(first.realm.buffer, second.realm.buffer);
    first.file.s[first.key] = 11;
    second.file.s[second.key] = 29;
    for (let index = 0; index < 100; index++)
        first.file.s[first.key]++;
    assert.equal(first.file.s[first.key], 111);
    assert.equal(second.file.s[second.key], 29);
    assert.equal(Atomics.load(first.counters, first.index), 111);
    assert.equal(Atomics.load(second.counters, second.index), 29);
});
test('host sees every final atomic publication after terminating the single writer Worker', async () => {
    const realm = createRealm(layout, 'worker');
    const counters = new Int32Array(realm.buffer);
    const control = new SharedArrayBuffer(4);
    const file = structuredClone(metadata[0]);
    const key = layout[0].keys[0], index = layout[0].offset;
    const worker = new Worker(`
const {parentPort,workerData}=require('node:worker_threads');
globalThis.__coverageCounters=new Int32Array(workerData.buffer);
${bridgeSource(layout)}
const file=workerData.file;globalThis.__coverage__[file.path]=file;
for(let count=0;count<4096;count++)file.s[workerData.key]++;
parentPort.postMessage('published');
Atomics.wait(new Int32Array(workerData.control),0,0);
`, {
        eval: true,
        execArgv: [],
        workerData: { buffer: realm.buffer, control, file, key },
    });
    try {
        const [message] = await once(worker, 'message');
        assert.equal(message, 'published');
        assert.equal(Atomics.load(counters, 0), 1);
        assert.equal(Atomics.load(counters, layout[0].registeredOffset), 1);
        assert.equal(Atomics.load(counters, index), 4096);
        await worker.terminate();
        assert.equal(Atomics.load(counters, index), 4096);
        const merged = mergeRealms(metadata, layout, [realm], ['worker']);
        assert.equal(merged.map.fileCoverageFor(file.path).s[key], 4096);
        assert.equal(merged.map.files().length, 21);
        assert.equal(merged.passed, false);
    }
    finally {
        await worker.terminate();
    }
});
//# sourceMappingURL=coverage.test.js.map