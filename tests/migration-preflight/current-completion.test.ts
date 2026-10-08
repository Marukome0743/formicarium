import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import {
  acquireCurrentLock,
  assertActualSite,
  assertCurrentCoverage,
  assertCurrentIdentity,
  assertPassingTestOutput,
  assertSeals,
  type CurrentCompletionInput,
  currentCompletionCommands,
  executeCurrentSequence,
  prepareActualSite,
  prepareCurrentInput,
  verifyCurrentCompletion,
  writeCurrentPreparedInput,
} from '../../scripts/migration-preflight/current-completion.js';
import { FIRST_PARTY_JS, sha256 } from '../../scripts/package/stage-package.js';

const digest = 'a'.repeat(64);
function fixture(): CurrentCompletionInput {
  const currentSource = [{ path: '/fixture/source.js', sha256: digest }];
  return {
    schemaVersion: 1,
    kind: 'current-completed-units-input',
    root: '/fixture',
    candidate: { path: '/fixture/candidate.json', sha256: digest },
    sourceIdentity: digest,
    packSha256: digest,
    currentSource,
    currentSourceIdentity: sha256(JSON.stringify(currentSource)),
    consumer: '/independent',
    guest: { path: '/fixture/aube', sha256: digest },
    actualSite: {
      path: '/fixture/site',
      files: [{ path: '/fixture/site/manifest.json', sha256: digest }],
      sha256: digest,
    },
    historicalVerification: {
      path: '/fixture/historical.json',
      sha256: digest,
    },
    historicalFiles: [{ path: '/fixture/historical.json', sha256: digest }],
    retained: {
      verifier: { path: '/fixture/verifier.mjs', sha256: digest },
      binding: { path: '/fixture/binding.json', sha256: digest },
      reportSha256: digest,
    },
  };
}
function coverage() {
  return {
    passed: true,
    threshold: 80,
    candidateSha256: digest,
    lines: {
      total: FIRST_PARTY_JS.length,
      covered: FIRST_PARTY_JS.length,
      skipped: 0,
      pct: 100,
    },
    files: FIRST_PARTY_JS.map((path) => ({ path, lines: { '1': 1 } })),
  };
}
async function scratch(run: (root: string) => Promise<void>) {
  const parent = resolve(
    '.artifacts/migration-preflight/current-completion-tests',
  );
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(resolve(parent, 'case-'));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test('current command scope retains public API, U1, U2, real installed/Worker consumers and probe/aube regressions without U3 acceptance', () => {
  const commands = currentCompletionCommands(
    '/fixture',
    '/fixture/coverage',
    fixture(),
  );
  const text = JSON.stringify(commands);
  for (const required of [
    'migration-preflight-unit',
    'migration-session-unit',
    'migration-session-browser',
    'migration-install-unit',
    'migration-install-browser',
    'test-consumer',
    'tests/node/probe.test.js',
    'tests/node/aube-1645.test.js',
    'tests/browser/probe.spec.ts',
    'tests/browser/aube-1645.spec.ts',
    'coverage-session-node-preload.mjs',
  ])
    assert.ok(text.includes(required), required);
  assert.equal(commands[0]!.args.at(-1), '--retained-evidence');
  assert.ok(!text.includes('measure.js'));
  for (const command of commands.filter(
    (row) => row.args.includes('test') && row.executable !== 'mise',
  )) {
    assert.ok(command.args.includes('--workers=1'));
    assert.ok(command.args.includes('--retries=0'));
  }
  assert.equal(commands.at(-1)!.args.at(-1), fixture().candidate.path);
});
test('real distribution site input is mandatory and cannot seal missing or empty directories', async () =>
  scratch(async (root) => {
    await assert.rejects(
      prepareActualSite(root, undefined),
      /U2_ACTUAL_SITE required/,
    );
    await assert.rejects(
      prepareActualSite(root, ''),
      /U2_ACTUAL_SITE required/,
    );
    await assert.rejects(
      prepareActualSite(root, resolve(root, 'missing')),
      /ENOENT/,
    );
    await assert.rejects(prepareActualSite(root, root), /nonempty/);
    await assert.rejects(assertActualSite(root, undefined), /missing/);
  }));
test('real distribution sealing includes nested files and detects altered bytes, omitted files and added files', async () =>
  scratch(async (root) => {
    await mkdir(resolve(root, 'assets'));
    const path = resolve(root, 'assets/guest.elf');
    await writeFile(path, 'fixed real fixture bytes');
    await writeFile(resolve(root, 'manifest.json'), '{"version":1}');
    const site = await prepareActualSite(root, root);
    assert.equal(site.files.length, 2);
    assert.equal(site.sha256, sha256(JSON.stringify(site.files)));
    await assertActualSite(root, site);
    await writeFile(path, 'changed');
    await assert.rejects(assertActualSite(root, site), /changed/);
    await writeFile(path, 'fixed real fixture bytes');
    await writeFile(resolve(root, 'unexpected.json'), '{}');
    await assert.rejects(assertActualSite(root, site), /inventory changed/);
    await rm(resolve(root, 'unexpected.json'));
    await rm(path);
    await assert.rejects(assertActualSite(root, site), /ENOENT/);
  }));
test('all current distributed JS including new install paths stay in the coverage denominator', () => {
  const report = coverage();
  assert.equal(report.files.length, 21);
  assert.doesNotThrow(() => assertCurrentCoverage(report, fixture()));
  report.files = report.files.filter((row) => !row.path.includes('install'));
  assert.throws(
    () => assertCurrentCoverage(report, fixture()),
    /whole-distribution/,
  );
});
test('current identity rejects altered source inventory, candidate source and tarball independently', () => {
  const input = fixture();
  const candidate = { sourceIdentity: digest, tarball: { sha256: digest } };
  assert.doesNotThrow(() =>
    assertCurrentIdentity(input, candidate, input.currentSource),
  );
  assert.throws(() =>
    assertCurrentIdentity(
      input,
      { ...candidate, sourceIdentity: 'b'.repeat(64) },
      input.currentSource,
    ),
  );
  assert.throws(() =>
    assertCurrentIdentity(
      input,
      { ...candidate, tarball: { sha256: 'b'.repeat(64) } },
      input.currentSource,
    ),
  );
  assert.throws(() =>
    assertCurrentIdentity(input, candidate, [
      { ...input.currentSource[0]!, sha256: 'b'.repeat(64) },
    ]),
  );
});
test('raw immutable prerequisite must exist, remain unchanged and cannot have duplicate paths', async () =>
  scratch(async (root) => {
    const path = resolve(root, 'proof.json');
    await writeFile(path, 'real bytes');
    const row = { path, sha256: sha256(await readFile(path)) };
    await assertSeals([row]);
    await assert.rejects(assertSeals([row, row]), /duplicate/);
    await writeFile(path, 'altered bytes');
    await assert.rejects(assertSeals([row]), /changed/);
    await rm(path);
    await assert.rejects(assertSeals([row]), /ENOENT/);
  }));
test('child failure prevents every later required command without automatic retry', async () => {
  const commands = currentCompletionCommands(
    '/fixture',
    '/fixture/coverage',
    fixture(),
  );
  const calls: number[] = [];
  await assert.rejects(
    executeCurrentSequence(commands, async (_command, index) => {
      calls.push(index);
      if (index === 2) throw Error('actual child failure');
      return { synthetic: true };
    }),
    /actual child failure/,
  );
  assert.deepEqual(calls, [0, 1, 2]);
});
test('synthetic success sequencing returns fixture observations only, never an accepted proof', async () => {
  const result = await executeCurrentSequence(
    currentCompletionCommands('/fixture', '/fixture/coverage', fixture()),
    async () => ({ synthetic: true }),
  );
  assert.ok(result.every((row) => row.synthetic));
  assert.ok(
    result.every(
      (row) =>
        !Object.hasOwn(row, 'verified') &&
        !Object.hasOwn(row, 'acceptancePassed'),
    ),
  );
});
test('duplicate lock fails and cannot delete the existing owner lock', async () =>
  scratch(async (root) => {
    const release = await acquireCurrentLock(root);
    await assert.rejects(acquireCurrentLock(root), /EEXIST/);
    assert.equal(
      await readFile(
        resolve(root, '.artifacts/migration-preflight/current-completion.lock'),
        'utf8',
      ),
      '',
    );
    await release();
    const next = await acquireCurrentLock(root);
    await next();
  }));
test('positive real test summary is required; zero, skipped, cancelled, failed and empty runs fail closed', () => {
  const tap = '# pass 55\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  assert.doesNotThrow(() => assertPassingTestOutput(tap));
  assert.doesNotThrow(() => assertPassingTestOutput('  9 passed (38.9s)\n'));
  for (const raw of [
    '',
    tap.replace('pass 55', 'pass 0'),
    tap.replace('skipped 0', 'skipped 1'),
    tap.replace('fail 0', 'fail 1'),
    tap.replace('cancelled 0', 'cancelled 1'),
    '1 passed 1 skipped',
    '1 passed 1 flaky',
    tap + 'ok 1 # SKIP unavailable',
  ])
    assert.throws(() => assertPassingTestOutput(raw));
});
test('observed Node24 spec summary is accepted only with positive pass and all failure/skip/cancel/TODO fields zero', () => {
  const spec =
    '✔ completed result checks (1.2ms)\nℹ tests 35\nℹ suites 0\nℹ pass 35\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 549.907\n';
  assert.doesNotThrow(() => assertPassingTestOutput(spec));
  for (const field of ['fail', 'cancelled', 'skipped', 'todo']) {
    const invalid = spec.replace(`ℹ ${field} 0`, `ℹ ${field} 1`);
    assert.throws(() => assertPassingTestOutput(invalid));
    assert.throws(() =>
      assertPassingTestOutput(invalid + '9 passed (38.9s)\n'),
    );
  }
  assert.throws(() =>
    assertPassingTestOutput(spec.replace('ℹ pass 35', 'ℹ pass 0')),
  );
  assert.throws(() =>
    assertPassingTestOutput(spec.replace('ℹ skipped 0\n', '')),
  );
});
test('fresh coverage rejects zero counters, omitted files, skipped and below80 rather than importing history', () => {
  for (const change of [
    { lines: { total: 0, covered: 0, skipped: 0, pct: 100 } },
    { lines: { total: 21, covered: 0, skipped: 0, pct: 0 } },
    { lines: { total: 21, covered: 21, skipped: 1, pct: 100 } },
    { lines: { total: 21, covered: 16, skipped: 0, pct: 76.19 } },
    { candidateSha256: 'b'.repeat(64) },
    { files: [] },
  ])
    assert.throws(() =>
      assertCurrentCoverage({ ...coverage(), ...change }, fixture()),
    );
});
test('checkpoint rejects changed prepared input before treating any report as successful', async () =>
  scratch(async (root) => {
    const path = resolve(root, 'input.json');
    await writeFile(path, JSON.stringify(fixture()));
    await assert.rejects(
      verifyCurrentCompletion(
        path,
        'b'.repeat(64),
        resolve(root, 'missing-report.json'),
        digest,
      ),
      /changed/,
    );
  }));
test('historical-only or synthetic report cannot satisfy the short current checkpoint', async () =>
  scratch(async (root) => {
    const input = resolve(root, 'input.json');
    const report = resolve(root, 'report.json');
    await writeFile(input, JSON.stringify(fixture()));
    await writeFile(
      report,
      JSON.stringify({
        verified: true,
        retainedEvidenceVerified: true,
        currentSourceVerified: false,
      }),
    );
    await assert.rejects(
      verifyCurrentCompletion(
        input,
        sha256(await readFile(input)),
        report,
        sha256(await readFile(report)),
      ),
      /historical\/synthetic/,
    );
  }));
test('checkpoint rejects altered real-report bytes before reading source or raw proof', async () =>
  scratch(async (root) => {
    const input = resolve(root, 'input.json');
    const report = resolve(root, 'report.json');
    await writeFile(input, JSON.stringify(fixture()));
    await writeFile(report, '{"verified":true}');
    const reportSHA = sha256(await readFile(report));
    await writeFile(report, '{"verified":true,"extra":1}');
    await assert.rejects(
      verifyCurrentCompletion(
        input,
        sha256(await readFile(input)),
        report,
        reportSHA,
      ),
      /changed/,
    );
  }));
test('prepared input requires every parameter before reading candidate or source', async () => {
  const options = {
    root: '/fixture',
    candidate: '/candidate',
    consumer: '/consumer',
    guest: '/guest',
    historical: '/history',
    binding: '/binding',
    verifier: '/verifier',
    reportSha256: digest,
  };
  for (const key of Object.keys(options) as (keyof typeof options)[])
    await assert.rejects(
      prepareCurrentInput({ ...options, [key]: '' }),
      /required/,
    );
});
test('prepared input writing refuses collisions and destinations outside its project artifact boundary', async () =>
  scratch(async (root) => {
    const input = { ...fixture(), root };
    const directory = resolve(root, '.artifacts/migration-preflight');
    await mkdir(directory, { recursive: true });
    const out = resolve(directory, 'input.json');
    const written = await writeCurrentPreparedInput(out, input);
    assert.equal(written.sha256, sha256(await readFile(out)));
    await assert.rejects(writeCurrentPreparedInput(out, input), /EEXIST/);
    await assert.rejects(
      writeCurrentPreparedInput(resolve(root, 'input.json'), input),
      /project-local/,
    );
  }));
