import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, open, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { consumerInput } from '../../tests/migration-session/consumer-input.js';
import { FIRST_PARTY_JS, PACKAGE_FILES, sha256, } from '../package/stage-package.js';
import { INSTALL_REALMS } from './coverage.js';
import { summarizeInstallTrials } from './measure.js';
import { installSourceInventory } from './stage.js';
import { requireInstallActualSite } from './ci-inputs.js';
export function isInstallTestCommand(command) {
    return command.args.includes('--test') ||
        (command.args.includes('test') && command.args.some((arg) => /(?:^|\/)@playwright\/test\/cli\.js$/.test(arg))) ||
        command.args.some((arg) => [
            'test-light', 'test-consumer', 'migration-session-unit',
            'migration-install-unit', 'migration-session-browser', 'migration-install-browser',
        ].includes(arg));
}
/** Require observed, complete test summaries, not just a successful process exit. */
export function assertInstallTestOutput(raw) {
    const normalized = raw.replace(/\u001b\[[0-9;]*m/g, '').replace(/^ℹ /gm, '# ');
    if (/\b[1-9]\d* (?:skipped|failed|flaky|interrupted|did not run)\b|# (?:skip|skipped|fail|cancelled|todo) [1-9]\d*|# (?:SKIP|TODO)\b|^not ok\b/m.test(normalized))
        throw Error('U3 test failures/skips/TODO/incomplete results refused');
    const counts = (field) => [...normalized.matchAll(new RegExp(`^# ${field} (\\d+)\\s*$`, 'gm'))].map((row) => Number(row[1]));
    const passes = counts('pass');
    const tests = counts('tests');
    if (passes.length) {
        if (tests.length !== passes.length || passes.some((n) => n <= 0) || tests.some((n, i) => n !== passes[i]) ||
            ['fail', 'cancelled', 'skipped', 'todo'].some((field) => {
                const rows = counts(field);
                return rows.length !== passes.length || rows.some((n) => n !== 0);
            }))
            throw Error('U3 positive complete test summary with no skips required');
    }
    else if (!/\b[1-9]\d* passed\b/.test(normalized))
        throw Error('U3 positive real test summary required');
}
export async function verifyInstallCommandLog(command, execution) {
    const bytes = await readFile(execution.rawLogPath);
    if (execution.exitCode !== 0 || sha256(bytes) !== execution.rawLogSha256)
        throw Error('U3 retained command log/exit differs');
    if (isInstallTestCommand(command))
        assertInstallTestOutput(bytes.toString('utf8'));
}
export async function checkInstallCandidate(path, root) {
    const candidate = JSON.parse(await readFile(path, 'utf8'));
    const sourceFiles = await installSourceInventory(root);
    if (candidate.unit !== 'u3-install' ||
        candidate.version !== '0.3.0' ||
        candidate.provisional !== true ||
        !/^[a-f0-9]{40}$/.test(candidate.sourceCommit))
        throw Error('current U3 candidate identity missing');
    if (JSON.stringify(candidate.sourceFiles) !== JSON.stringify(sourceFiles) ||
        candidate.sourceIdentity !== sha256(JSON.stringify(sourceFiles)))
        throw Error('current U3 source differs from candidate');
    if (JSON.stringify([...candidate.distributionInventory].sort()) !==
        JSON.stringify([...FIRST_PARTY_JS].sort()) ||
        JSON.stringify(candidate.files.map((row) => row.path).sort()) !== JSON.stringify([...PACKAGE_FILES].sort()) ||
        FIRST_PARTY_JS.length !== 21)
        throw Error('current U3 complete21JS/package inventory differs');
    if (sha256(await readFile(candidate.tarball.path)) !== candidate.tarball.sha256)
        throw Error('current U3 tarball changed');
    return candidate;
}
export function installCompletionCommands(root, coverage, measurement) {
    const node = process.execPath;
    const playwright = resolve(root, 'node_modules/@playwright/test/cli.js');
    const command = (args, cwd = root) => ({
        executable: node,
        args,
        cwd,
    });
    const task = (name) => ({
        executable: 'mise',
        args: ['run', name],
        cwd: root,
    });
    const test = (paths) => command(['--test', '--test-concurrency=1', ...paths]);
    return [
        task('build'),
        task('typecheck'),
        task('test-light'),
        test([
            'tests/migration-install/acceptance.test.js',
            'tests/migration-session/ci.test.js',
        ]),
        task('migration-session-unit'),
        task('migration-install-unit'),
        task('migration-session-browser'),
        task('migration-install-browser'),
        task('test-consumer'),
        test([
            'tests/node/build.test.js',
            'tests/node/probe.test.js',
            'tests/node/aube-1645.test.js',
        ]),
        command([
            playwright,
            'test',
            'tests/browser/probe.spec.ts',
            'tests/browser/aube-1645.spec.ts',
            '--workers=1',
            '--retries=0',
        ]),
        command(['scripts/migration-install/coverage.js', 'prepare', coverage]),
        command([
            '--import',
            resolve(coverage, 'coverage-node-preload.mjs'),
            '--test',
            '--test-reporter=tap',
            '--test-isolation=none',
            ...[
                'errors',
                'validation',
                'state',
                'lifecycle',
                'protocol',
                'core',
                'guest-io',
                'worker-execution',
                'public',
                'node-api',
                'node-worker',
                'consumer',
            ].map((name) => resolve(coverage, `tests/package/${name}.test.js`)),
        ]),
        command([
            '--import',
            resolve(coverage, 'coverage-session-node-preload.mjs'),
            '--test',
            '--test-reporter=tap',
            '--test-isolation=none',
            ...[
                'guest-validation',
                'fixture',
                'reservation',
                'public',
                'consumer',
            ].map((name) => resolve(coverage, `tests/migration-session/${name}.test.js`)),
            ...[
                'catalog',
                'transfer',
                'archive',
                'lifecycle',
                'public',
                'consumer',
                'hash-regression',
            ].map((name) => resolve(coverage, `tests/migration-install/${name}.test.js`)),
        ]),
        command([
            playwright,
            'test',
            'browser-api.spec',
            'browser-worker.spec',
            'browser-broker.spec',
            'consumer.spec',
            '--config',
            'playwright.coverage.config.mjs',
            '--workers=1',
            '--retries=0',
            '--output',
            resolve(coverage, 'browser-results/package'),
        ], resolve(coverage, 'tests/package')),
        command([
            playwright,
            'test',
            '--config',
            'playwright.coverage.config.mjs',
            '--workers=1',
            '--retries=0',
            '--output',
            resolve(coverage, 'browser-results/session'),
        ], resolve(coverage, 'tests/migration-session')),
        command([
            playwright,
            'test',
            '--config',
            'playwright.coverage.config.mjs',
            '--workers=1',
            '--retries=0',
            '--output',
            resolve(coverage, 'browser-results/install'),
        ], resolve(coverage, 'tests/migration-install')),
        command([
            'scripts/migration-install/coverage.js',
            'report',
            coverage,
            resolve(coverage, 'browser-results'),
            resolve(process.env.FORMICARIUM_CANDIDATE ?? ''),
        ]),
        command(['scripts/migration-install/measure.js', measurement]),
    ];
}
/** A real child exit plus retained raw output, with no shell or automatic retry. */
export async function executeInstallCommand(command, logPath, options = {}) {
    const output = createWriteStream(logPath, { flags: 'wx' });
    const startedAt = new Date().toISOString();
    try {
        await new Promise((done, reject) => {
            const child = spawn(command.executable, command.args, {
                cwd: command.cwd,
                env: process.env,
                shell: false,
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            output.once('error', (error) => {
                child.kill('SIGTERM');
                reject(error);
            });
            child.stdout.on('data', (chunk) => {
                if (options.forwardOutput !== false)
                    process.stdout.write(chunk);
                output.write(chunk);
            });
            child.stderr.on('data', (chunk) => {
                if (options.forwardOutput !== false)
                    process.stderr.write(chunk);
                output.write(chunk);
            });
            child.once('error', reject);
            child.once('close', (code, signal) => code === 0 && !signal
                ? done()
                : reject(Error(`U3 command failed (${signal ?? code}): ${command.args.join(' ')}`)));
        });
    }
    finally {
        await new Promise((done, reject) => {
            output.once('error', reject);
            output.end(done);
        });
    }
    const execution = {
        startedAt,
        finishedAt: new Date().toISOString(),
        rawLogPath: logPath,
        rawLogSha256: sha256(await readFile(logPath)),
        exitCode: 0,
    };
    await verifyInstallCommandLog(command, execution);
    return execution;
}
export async function runInstallCompletion(options = {}) {
    const root = resolve(options.root ?? process.cwd());
    const actualSite = await requireInstallActualSite(root);
    const candidatePath = process.env.FORMICARIUM_CANDIDATE;
    if (!candidatePath ||
        !process.env.FORMICARIUM_CONSUMER ||
        !process.env.FORMICARIUM_SESSION_GUEST)
        throw Error('U3 completion current candidate/independentconsumer/fixedguest inputs required');
    const candidate = await checkInstallCandidate(candidatePath, root);
    const input = await consumerInput();
    const localOnly = process.env.FORMICARIUM_INSTALL_LOCAL_ONLY === '1';
    const ciPath = process.env.FORMICARIUM_INSTALL_CI_EVIDENCE;
    const ciDigest = process.env.FORMICARIUM_INSTALL_CI_SHA256;
    let ci = null;
    if (ciPath && ciDigest) {
        const bytes = await readFile(ciPath);
        if (sha256(bytes) !== ciDigest)
            throw Error('U3 independent CI evidence hash differs');
        ci = JSON.parse(bytes.toString('utf8'));
        if (ci?.recordKind !== 'observed-ci-summary' ||
            ci.unit !== 'u3-install' ||
            ci.conclusion !== 'success' ||
            ci.sourceIdentity !== candidate.sourceIdentity ||
            ci.candidateSha256 !== candidate.tarball.sha256 ||
            ci.sourceCommit !== candidate.sourceCommit)
            throw Error('U3 same-source/same-pack independent CI evidence differs');
    }
    if (!localOnly && !ci)
        throw Error('new U3 signed same-candidate CI evidence required; explicit local mode is provisional only');
    const scratch = resolve(root, '.artifacts/migration-install');
    await mkdir(scratch, { recursive: true });
    const lockPath = resolve(scratch, 'completion.lock');
    const lock = await open(lockPath, 'wx');
    const output = resolve(scratch, `completion-${randomUUID()}`);
    await mkdir(output);
    const coverage = resolve(output, 'coverage');
    const measurement = resolve(output, 'measurement');
    const observed = [];
    try {
        for (const [index, command] of installCompletionCommands(root, coverage, measurement).entries()) {
            let execution;
            if (options.execute) {
                execution = await options.execute(command);
                await verifyInstallCommandLog(command, execution);
            }
            else
                execution = await executeInstallCommand(command, resolve(output, `command-${index + 1}.log`));
            observed.push({
                ...command,
                ...execution,
                recordKind: 'observed-command-summary',
            });
        }
        await checkInstallCandidate(candidatePath, root);
        await requireInstallActualSite(root);
        const coverageReport = JSON.parse(await readFile(resolve(coverage, 'coverage-report.json'), 'utf8'));
        const measured = JSON.parse(await readFile(resolve(measurement, 'measurement-report.json'), 'utf8'));
        if (!coverageReport.passed ||
            coverageReport.threshold !== 80 ||
            coverageReport.files.length !== 21 ||
            coverageReport.candidateSha256 !== candidate.tarball.sha256)
            throw Error('U3 current21JS/rawrealms coverage acceptance failed');
        if (measured.unit !== 'u3-install' ||
            measured.passed !== true ||
            measured.thresholdMs !== 3000 ||
            measured.trialCount !== 36 ||
            measured.sourceIdentity !== candidate.sourceIdentity ||
            measured.candidateSha256 !== candidate.tarball.sha256)
            throw Error('U3 formal36 samecandidate evidence failed');
        summarizeInstallTrials(measured.trials);
        const report = {
            schemaVersion: 1,
            unit: 'u3-install',
            provisional: true,
            status: localOnly ? 'local-provisional' : 'verified-with-ci',
            assembledAt: new Date().toISOString(),
            candidatePath: resolve(candidatePath),
            candidateSha256: candidate.tarball.sha256,
            sourceCommit: candidate.sourceCommit,
            sourceCommitKind: candidate.sourceCommitKind,
            sourceIdentity: candidate.sourceIdentity,
            sourceFiles: candidate.sourceFiles,
            distributionInventory: FIRST_PARTY_JS,
            installedPackage: input.packageRoot,
            actualSite,
            localPassed: true,
            acceptancePassed: !localOnly && ci !== null,
            ci,
            blockers: ci ? [] : ['new U3 signed CI not independently verified'],
            coverageReport: resolve(coverage, 'coverage-report.json'),
            expectedFreshRealms: INSTALL_REALMS,
            measurementReport: resolve(measurement, 'measurement-report.json'),
            commands: observed,
            realSafari: '未検証',
            laterUnits: 'U4 command/B1未受入',
        };
        const path = resolve(output, localOnly ? 'local-provisional-report.json' : 'completion-report.json');
        await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, {
            flag: 'wx',
        });
        console.log(path);
        return path;
    }
    catch (error) {
        await writeFile(resolve(output, 'incomplete.json'), `${JSON.stringify({ unit: 'u3-install', status: 'incomplete', observedCommands: observed, failure: error instanceof Error ? error.message : String(error) }, null, 2)}\n`, { flag: 'wx' });
        throw error;
    }
    finally {
        await lock.close();
        await rm(lockPath, { force: true });
    }
}
if (process.argv[1] &&
    pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
    await runInstallCompletion();
//# sourceMappingURL=completion.js.map