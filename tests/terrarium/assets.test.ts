import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import test from 'node:test';
import { PACKAGE_FILES } from '../../scripts/package/stage-package.js';
import {
  directoryIdentity,
  sha256,
  verifyInstalledPackage,
} from '../../scripts/terrarium/evidence.js';
import { validateBaselineCommit } from '../../scripts/terrarium/prepare.js';

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'u3-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const packageRoot = join(root, 'package');
  await mkdir(packageRoot);
  for (const path of PACKAGE_FILES) {
    const filename = join(packageRoot, path);
    await mkdir(join(filename, '..'), { recursive: true });
    await writeFile(filename, 'export {};');
  }
  const manifestPath = join(root, 'manifest.json');
  await writeFile(
    manifestPath,
    JSON.stringify({
      package: '@aletheia-works/formicarium',
      version: '0.1.0-rc.1',
      blinkSourceDirty: false,
      files: PACKAGE_FILES.map((path) => ({
        path,
        sha256: sha256('export {};'),
      })),
    }),
  );
  const tarballPath = join(root, 'pack.tgz');
  await writeFile(tarballPath, 'pack');
  return { root, packageRoot, manifestPath, tarballPath };
}
test('installed bytes and tarball identity remain local pack evidence', async (t) => {
  const f = await fixture(t),
    identity = await verifyInstalledPackage(f);
  assert.equal(identity.tarballSha256, sha256('pack'));
  assert.match(identity.status, /published RC acceptance unverified/);
});
test('changed installed file fails exact supply digest', async (t) => {
  const f = await fixture(t);
  await writeFile(
    join(f.packageRoot, 'runtime/web/package-worker.js'),
    'changed',
  );
  await assert.rejects(verifyInstalledPackage(f), /installed package changed/);
});
test('candidate identity contains every file and changes for same-length replacement', async (t) => {
  const f = await fixture(t);
  const before = await directoryIdentity(f.packageRoot);
  await writeFile(
    join(f.packageRoot, 'runtime/web/package-worker.js'),
    'export{ };',
  );
  const after = await directoryIdentity(f.packageRoot);
  assert.notEqual(before.sha256, after.sha256);
  assert.equal(before.files.length, PACKAGE_FILES.length);
});
test('candidate symlinks cannot hide bytes outside the supply root', async (t) => {
  const f = await fixture(t);
  await symlink(f.tarballPath, join(f.packageRoot, 'alias'));
  await assert.rejects(
    directoryIdentity(f.packageRoot),
    /special file refused/,
  );
});
test('missing installed worker fails rather than producing success evidence', async (t) => {
  const f = await fixture(t);
  await rm(join(f.packageRoot, 'runtime/web/package-worker.js'));
  await assert.rejects(verifyInstalledPackage(f), { code: 'ENOENT' });
});

test('integration baseline preserves the observed current repository revision', () => {
  const observed = '0aa94fde1e33230efb96e8763f0fa811ce1cdd80';
  assert.equal(validateBaselineCommit(observed), observed);
});

test('integration baseline rejects missing, abbreviated and malformed provenance', () => {
  for (const value of [
    undefined,
    '',
    '0aa94fde',
    'g'.repeat(40),
    'a'.repeat(41),
  ])
    assert.throws(() => validateBaselineCommit(value), /observed full SHA/);
});
