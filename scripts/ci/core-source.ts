import { lstat, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hash, type InputManifest } from './verification.js';

export const CORE_BUNDLE_PATH = '.artifacts/ci-candidate/core-source.bundle';
export const CORE_PUBLIC_BASE = '4b5c67d518b0504e13ccde7ba7823f9b6e467c4c';

export function validateCoreBundle(
  bytes: Buffer,
  expectedSha256: string,
  head: string,
) {
  if (hash(bytes) !== expectedSha256)
    throw Error('core bundle digest mismatch');
  const end = bytes.indexOf('\n\n');
  if (end < 0 || end > 4096) throw Error('invalid core bundle header');
  const lines = bytes.subarray(0, end).toString('utf8').split('\n');
  if (
    lines.length !== 3 ||
    lines[0] !== '# v2 git bundle' ||
    !lines[1]?.startsWith(`-${CORE_PUBLIC_BASE} `) ||
    lines[2] !== `${head} HEAD`
  )
    throw Error('unexpected core bundle HEAD or prerequisite');
}

// Only fixed public URLs and SHA refs are used; bundle header text is never executed.
export async function bootstrapCoreSource(
  root: string,
  manifest: InputManifest,
  command: (id: string, args: string[]) => Promise<unknown>,
) {
  const pin = manifest.files.find((row) => row.path === CORE_BUNDLE_PATH);
  if (!pin) return; // Existing public source-fetch path remains unchanged.
  const bundle = resolve(root, CORE_BUNDLE_PATH);
  const bytes = await readFile(bundle);
  if (bytes.length !== pin.bytes) throw Error('core bundle size mismatch');
  validateCoreBundle(bytes, pin.sha256, manifest.coreCommit);
  const lock = await readFile(resolve(root, 'blink.lock'), 'utf8');
  const field = (name: string) =>
    lock.match(new RegExp(`^${name}=(.+)$`, 'm'))?.[1];
  if (
    field('commit') !== manifest.coreCommit ||
    field('url') !== 'https://github.com/aletheia-works/blink.git' ||
    field('upstream_url') !== 'https://github.com/jart/blink.git' ||
    !/^[a-f0-9]{40}$/.test(field('upstream_commit') ?? '')
  )
    throw Error('core source lock mismatch');
  const dest = resolve(root, '.vendor/blink');
  const existing = await lstat(dest).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (existing) throw Error('fresh core source scratch required');
  await mkdir(dest, { recursive: true });
  const git = (id: string, args: string[]) =>
    command(id, ['git', '-c', 'core.hooksPath=/dev/null', '-C', dest, ...args]);
  await git('core-bundle-init', ['init', '--quiet']);
  await git('core-bundle-base', [
    'fetch',
    '--quiet',
    'https://github.com/aletheia-works/blink.git',
    CORE_PUBLIC_BASE,
  ]);
  await git('core-bundle-verify', ['bundle', 'verify', bundle]);
  await git('core-bundle-fetch', ['fetch', '--quiet', bundle, 'HEAD']);
  await git('core-bundle-head', [
    'cat-file',
    '-e',
    `${manifest.coreCommit}^{commit}`,
  ]);
  await git('core-bundle-upstream', [
    'fetch',
    '--quiet',
    'https://github.com/jart/blink.git',
    field('upstream_commit')!,
  ]);
  await git('core-bundle-diff', [
    'diff',
    '--stat',
    field('upstream_commit')!,
    manifest.coreCommit,
  ]);
  await git('core-bundle-origin', [
    'remote',
    'add',
    'origin',
    'https://github.com/aletheia-works/blink.git',
  ]);
}
