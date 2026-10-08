import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  directoryIdentity,
  sha256,
  verifyInstalledPackage,
} from './evidence.js';

/** Repository provenance comes from the main session's observed revision. */
export function validateBaselineCommit(commit: unknown): string {
  if (typeof commit !== 'string' || !/^[a-f0-9]{40}$/.test(commit))
    throw new Error(
      'integration baseline commit requires an observed full SHA',
    );
  return commit;
}

/** Inventory-only preparation; stage/build/test commands remain main-owned. */
export async function prepareIntegration({
  out,
  site,
  terrarium,
  packageManifest,
  tarball,
  baselineCommit,
  packageRoot: suppliedPackageRoot,
}: {
  out: string;
  site: string;
  terrarium: string;
  packageManifest: string;
  tarball: string;
  baselineCommit: string;
  packageRoot?: string;
}) {
  const baseline = validateBaselineCommit(baselineCommit);
  const packageRoot =
    suppliedPackageRoot ??
    join(
      terrarium,
      'packages/terrarium/node_modules/@aletheia-works/formicarium',
    );
  const pack = await verifyInstalledPackage({
    packageRoot,
    manifestPath: packageManifest,
    tarballPath: tarball,
  });
  const candidate = await directoryIdentity(site);
  const sourcePaths = [
    'packages/terrarium/src/formicarium-session.ts',
    'packages/terrarium/src/catalog.ts',
    'packages/terrarium/src/terminal.ts',
    'web/terminal.mjs',
  ];
  const source = [];
  for (const path of sourcePaths)
    source.push({
      path,
      sha256: sha256(await readFile(join(terrarium, path))),
    });
  const identity = {
    schemaVersion: 1,
    pack,
    candidate,
    source,
    sourceIdentity: sha256(JSON.stringify(source)),
    baselineCommit: baseline,
    scope: 'existing terrarium adoption; no emulator-specific consumer code',
    unverified: [
      'published RC acceptance',
      'real GitHub Pages',
      'real Safari',
      'combined CI',
    ],
  };
  await mkdir(resolve(out));
  await writeFile(
    join(out, 'identity.json'),
    `${JSON.stringify(identity, null, 2)}\n`,
  );
  return identity;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [inputPath] = process.argv.slice(2);
  if (!inputPath) throw new Error('usage: prepare.js <input-json>');
  console.log(
    JSON.stringify(
      await prepareIntegration(JSON.parse(await readFile(inputPath, 'utf8'))),
    ),
  );
}
