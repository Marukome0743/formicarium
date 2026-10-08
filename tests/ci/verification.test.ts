import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  createBundle,
  validatePayloadInventory,
} from '../../scripts/ci/bundle.js';
import {
  bootstrapCoreSource,
  CORE_BUNDLE_PATH,
  CORE_PUBLIC_BASE,
  validateCoreBundle,
} from '../../scripts/ci/core-source.js';
import {
  createFreshResultsDirectory,
  hash,
  type InputManifest,
  parseTestSummary,
  provisionPreparedResolver,
  REQUIRED_CHECKS,
  safePath,
  validateChecks,
  validateCoverage,
  validateManifest,
  validateWorkflow,
  verifyPins,
} from '../../scripts/ci/verification.js';

test('prepared owner resolver preserves pinned modules and refuses reuse or drift', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'ci-prepared-resolver-'));
  const prefix = '.artifacts/ci-candidate/inputs/resolver/';
  const out = resolve(root, 'fresh-coverage');
  const bytes = Buffer.from('export const marker = 42;');
  const pins = ['manifest.js', 'fixtures.js', 'resolver.js'].map((name) => ({
    path: prefix + name,
    bytes: bytes.length,
    sha256: hash(bytes),
  }));
  try {
    for (const pin of pins) {
      await mkdir(resolve(root, pin.path, '..'), { recursive: true });
      await writeFile(resolve(root, pin.path), bytes);
    }
    const destination = await provisionPreparedResolver(root, pins, out);
    assert.deepEqual(
      await readFile(resolve(destination, 'manifest.js')),
      bytes,
    );
    assert.deepEqual(
      await readFile(resolve(destination, 'fixtures.js')),
      bytes,
    );
    assert.deepEqual(
      await readFile(resolve(destination, 'resolver.js')),
      bytes,
    );
    await assert.rejects(
      provisionPreparedResolver(root, pins.slice(1), resolve(root, 'missing')),
      /module inventory/,
    );
    await assert.rejects(provisionPreparedResolver(root, pins, out), {
      code: 'EEXIST',
    });
    await writeFile(resolve(root, pins[0]!.path), Buffer.alloc(bytes.length));
    await assert.rejects(
      provisionPreparedResolver(root, pins, resolve(root, 'other')),
      /input bytes differ/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('supplemental core source binds digest, exact HEAD and fixed public prerequisite', async () => {
  const expected = 'c'.repeat(40);
  const bytes = Buffer.from(
    `# v2 git bundle\n-${CORE_PUBLIC_BASE} prerequisite\n${expected} HEAD\n\nPACK fixture`,
  );
  validateCoreBundle(bytes, hash(bytes), expected);
  assert.throws(
    () => validateCoreBundle(bytes, hash(bytes), 'd'.repeat(40)),
    /HEAD/,
  );
  const corrupt = Buffer.from(bytes);
  corrupt[corrupt.length - 1] = corrupt[corrupt.length - 1]! ^ 1;
  assert.throws(
    () => validateCoreBundle(corrupt, hash(bytes), expected),
    /digest/,
  );
  const hostile = Buffer.from(
    bytes.toString().replace(' HEAD', ' https://host.invalid/ref'),
  );
  assert.throws(
    () => validateCoreBundle(hostile, hash(hostile), expected),
    /HEAD/,
  );
  const root = await mkdtemp(resolve(tmpdir(), 'ci-core-bundle-'));
  try {
    await mkdir(resolve(root, '.artifacts/ci-candidate'), { recursive: true });
    await writeFile(resolve(root, CORE_BUNDLE_PATH), bytes);
    await writeFile(
      resolve(root, 'blink.lock'),
      `url=https://github.com/aletheia-works/blink.git\ncommit=${expected}\nupstream_url=https://github.com/jart/blink.git\nupstream_commit=${'e'.repeat(40)}\n`,
    );
    const input = manifest();
    input.files.push({
      path: CORE_BUNDLE_PATH,
      bytes: bytes.length,
      sha256: hash(bytes),
    });
    const calls: string[][] = [];
    await bootstrapCoreSource(root, input, async (_id, args) => {
      calls.push(args);
    });
    assert.ok(
      calls.some(
        (args) =>
          args.includes('verify') &&
          args.includes(resolve(root, CORE_BUNDLE_PATH)),
      ),
    );
    assert.ok(
      calls.some(
        (args) => args.includes('fetch') && args.includes(CORE_PUBLIC_BASE),
      ),
    );
    assert.ok(calls.some((args) => args.includes('diff')));
    input.files = input.files.filter((row) => row.path !== CORE_BUNDLE_PATH);
    const before = calls.length;
    await bootstrapCoreSource(root, input, async (_id, args) => {
      calls.push(args);
    });
    assert.equal(calls.length, before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fresh results creation supports a clean checkout and refuses reuse', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'ci-fresh-results-'));
  const output = resolve(root, '.artifacts/ci-results');
  try {
    await createFreshResultsDirectory(output);
    await writeFile(resolve(output, 'original.txt'), 'preserved');
    await assert.rejects(createFreshResultsDirectory(output), {
      code: 'EEXIST',
    });
    assert.equal(
      await readFile(resolve(output, 'original.txt'), 'utf8'),
      'preserved',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

const context = {
  repository: 'Marukome0743/formicarium',
  commit: 'a'.repeat(40),
  event: 'push',
  ref: 'refs/heads/codex/verify/u4',
};
const ownerPin = {
  path: 'terrarium/packages/terrarium/src/session.ts',
  sha256: 'b'.repeat(64),
};
const paths = [
  ownerPin.path,
  'terrarium/web/terminal.mjs',
  'candidate.tgz',
  'candidate.json',
  'assets/blink.wasm',
  'assets/blink.mjs',
  'assets/build-info.json',
  'dist/guests/probe',
  'dist/guests/aube',
  'dist/guests/pitchfork',
  '.artifacts/ci-candidate/provenance/aube.json',
  '.artifacts/ci-candidate/provenance/pitchfork.json',
  'fixtures/baseline/aube-1645.native.txt',
  'fixtures/baseline/pitchfork-basic.native.txt',
];
const manifest = (): InputManifest => ({
  schemaVersion: 1,
  repository: context.repository,
  sourceCommit: context.commit,
  sourceFiles: [
    { path: 'scripts/ci/run.ts', bytes: 1, sha256: 'b'.repeat(64) },
  ],
  files: paths.map((path) => ({ path, bytes: 1, sha256: 'b'.repeat(64) })),
  tarball: 'candidate.tgz',
  packageManifest: 'candidate.json',
  packageRoot: 'consumer/node_modules/package',
  site: 'site',
  terrarium: 'terrarium',
  coreCommit: 'c'.repeat(40),
  guests: { aube: 'v2.7.0', pitchfork: 'v2.30.1' },
  owner: {
    baselineCommit: 'd'.repeat(40),
    integrationSourceIdentity: hash(JSON.stringify([ownerPin])),
  },
});

test('missing terrarium terminal module is rejected before coverage preparation', () => {
  const input = manifest();
  validateManifest(input, context);
  input.files = input.files.filter(
    (row) => row.path !== `${input.terrarium}/web/terminal.mjs`,
  );
  assert.throws(
    () => validateManifest(input, context),
    /required input missing: terrarium\/web\/terminal\.mjs/,
  );
});
test('reviewed same-source manifest requires complete core guest fixture supply', () => {
  validateManifest(manifest(), context);
  for (const mutate of [
    (m: InputManifest) => m.files.pop(),
    (m: InputManifest) => m.files.push(m.files[0]),
    (m: InputManifest) => {
      m.guests.pitchfork = 'v2.30.0';
    },
    (m: InputManifest) => {
      m.sourceCommit = 'f'.repeat(40);
    },
  ]) {
    const m = manifest();
    mutate(m);
    assert.throws(() => validateManifest(m, context));
  }
});
test('untrusted event repository branch and unsafe relative paths are rejected', () => {
  for (const changed of [
    { event: 'pull_request_target' },
    { repository: 'stranger/formicarium' },
    { ref: 'refs/tags/v0.1.0' },
  ])
    assert.throws(() =>
      validateManifest(manifest(), { ...context, ...changed }),
    );
  for (const path of [
    '/tmp/input',
    '../input',
    'foo/../bar',
    'foo\\bar',
    'foo//bar',
  ])
    assert.throws(() => safePath(path));
});
test('actual bytes and regular ancestors are checked without accepting same-size drift', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'formicarium-ci-pin-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'dir'));
  await writeFile(resolve(root, 'dir/file'), 'yes');
  const pins = [{ path: 'dir/file', bytes: 3, sha256: hash('yes') }];
  await verifyPins(root, pins);
  await writeFile(resolve(root, 'dir/file'), 'bad');
  await assert.rejects(verifyPins(root, pins), /bytes differ/);
  await writeFile(resolve(root, 'dir/file'), 'yes');
  await symlink(resolve(root, 'dir'), resolve(root, 'link'));
  await assert.rejects(
    verifyPins(root, [{ ...pins[0], path: 'link/file' }]),
    /symlink/,
  );
});
test('missing duplicate nonzero timeout skip and unmeasured required checks fail closed', () => {
  const checks = REQUIRED_CHECKS.map((id) => ({
    id,
    exitCode: 0,
    timedOut: false,
    skipped: 0,
    passed: 1,
    command: ['node', 'test'],
  }));
  validateChecks(checks);
  assert.throws(() => validateChecks(checks.slice(1)));
  assert.throws(() => validateChecks([...checks.slice(1), checks[1]]));
  for (const patch of [
    { exitCode: 1 },
    { exitCode: null },
    { timedOut: true },
    { skipped: 1 },
    { passed: 0 },
  ])
    assert.throws(() =>
      validateChecks(
        checks.map((row, index) => (index ? row : { ...row, ...patch })),
      ),
    );
});
test('fixed24 and fresh realm receipts bind to same-pack full U1 realm inventory', () => {
  const files = Array.from({ length: 24 }, (_, index) => `file${index}`);
  const report = {
    passed: true,
    fixedInventory: files,
    lines: { total: 1801, covered: 1450, pct: 80.51, skipped: 0 },
    freshReceipts: [
      { realm: 'node-host', executionIdentity: 'seal', generation: 'fresh' },
      ...['chromium', 'firefox', 'webkit'].flatMap((project) =>
        Array.from({ length: 15 }, () => ({
          realm: 'browser-host',
          project,
          executionIdentity: 'seal',
          generation: 'fresh',
        })),
      ),
    ],
    executionIdentity: 'seal',
    generation: 'fresh',
    componentImport: {
      originalTarballSha256: 'pack',
      originalRealmNames: ['node-host', 'worker'],
    },
  };
  const expected = {
    files,
    tarballSha256: 'pack',
    u1Realms: ['node-host', 'worker'],
  };
  validateCoverage(report, expected);
  for (const mutate of [
    (r: typeof report) => {
      r.lines.pct = 79.99;
    },
    (r: typeof report) => {
      r.lines.skipped = 1;
    },
    (r: typeof report) => {
      r.fixedInventory.pop();
    },
    (r: typeof report) => {
      r.freshReceipts[0].executionIdentity = 'old';
    },
    (r: typeof report) => {
      r.componentImport.originalRealmNames.pop();
    },
    (r: typeof report) => {
      r.componentImport.originalTarballSha256 = 'other';
    },
  ]) {
    const r = structuredClone(report);
    mutate(r);
    assert.throws(() => validateCoverage(r, expected));
  }
});
test('payload inventory rejects extra unknown files and nonregular members', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'formicarium-ci-input-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(resolve(root, 'known'), 'data');
  await validatePayloadInventory(root, ['known']);
  await writeFile(resolve(root, 'unknown'), 'bad');
  await assert.rejects(validatePayloadInventory(root, ['known']), /unknown/);
  await rm(resolve(root, 'unknown'));
  await symlink(resolve(root, 'known'), resolve(root, 'link'));
  await assert.rejects(validatePayloadInventory(root, ['known']), /nonregular/);
});
test('checked workflow remains read-only verification without publication credentials', async () => {
  const workflow = await readFile(
    new URL('../../.github/workflows/verify.yml', import.meta.url),
    'utf8',
  );
  validateWorkflow(workflow);
  for (const unsafe of [
    'id-token: write',
    'contents: write',
    'npm publish',
    'pull_request_target',
    'NPM_TOKEN',
    'secrets.TOKEN',
  ])
    assert.throws(() => validateWorkflow(`${workflow}\n${unsafe}`));
});

test('bundle producer binds actual owner bytes before validating the manifest', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'ci-bundle-'));
  try {
    const original = manifest();
    original.tarball = '.artifacts/ci-candidate/candidate.tgz';
    original.packageManifest = '.artifacts/ci-candidate/candidate.json';
    original.terrarium = '.artifacts/ci-candidate/terrarium';
    const inputPaths = paths.map((path) =>
      path === 'candidate.tgz'
        ? original.tarball
        : path === 'candidate.json'
          ? original.packageManifest
          : path === ownerPin.path
            ? `${original.terrarium}/packages/terrarium/src/session.ts`
            : path === 'terrarium/web/terminal.mjs'
              ? `${original.terrarium}/web/terminal.mjs`
              : path,
    );
    const source = resolve(root, 'input');
    await writeFile(source, 'real bytes');
    await writeFile(resolve(root, 'source.ts'), 'source');
    original.owner.integrationSourceIdentity = hash(
      JSON.stringify([
        { path: inputPaths[0], sha256: hash(Buffer.from('real bytes')) },
      ]),
    );
    const { files: _files, sourceFiles: _sourceFiles, ...metadata } = original;
    const result = await createBundle(
      {
        manifest: metadata,
        sourcePaths: ['source.ts'],
        inputs: inputPaths.map((path) => ({ source, path })),
      },
      resolve(root, 'bundle'),
      root,
    );
    assert.equal(result.files, inputPaths.length);
    assert.equal(
      result.manifest.files[0].sha256,
      hash(Buffer.from('real bytes')),
    );
    await verifyPins(resolve(root, 'bundle/payload'), result.manifest.files);
    await validatePayloadInventory(resolve(root, 'bundle/payload'), inputPaths);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('summary parsing reads Bun stderr and rejects absent or incomplete accounting', () => {
  assert.deepEqual(parseTestSummary('bun test v1.4.2', ' 1 pass\n 0 fail\n'), {
    passed: 1,
    skipped: 0,
  });
  assert.deepEqual(parseTestSummary('', ' 2 pass\n 1 skip\n 0 fail\n'), {
    passed: 2,
    skipped: 1,
  });
  assert.deepEqual(parseTestSummary('# pass 4\n# skipped 0\n', ''), {
    passed: 4,
    skipped: 0,
  });
  assert.deepEqual(parseTestSummary(' 3 passed (1s)\n', ''), {
    passed: 3,
    skipped: 0,
  });
  assert.throws(() => parseTestSummary('bun test v1.4.2', ''), /recognized/);
  assert.throws(() => parseTestSummary('# pass 4\n', ''), /skip accounting/);
});
