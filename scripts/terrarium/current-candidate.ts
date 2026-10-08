import {
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  type DistributionInput,
  stageDistribution,
} from '../guest-distribution/stage.js';
import {
  directoryIdentity,
  sha256,
  verifyInstalledPackage,
} from './evidence.js';

export type FilePin = { path: string; size: number; sha256: string };
export type CurrentCandidateInput = {
  out: string;
  ownerRoot: string;
  ownerSources: FilePin[];
  ownerSourceReference: { path: string; sha256: string };
  ownerSourceInventorySha256: string;
  tarball: string;
  tarballSha256: string;
  packageManifest: string;
  packageManifestSha256: string;
  stagedPackage: string;
  guestSite: string;
  guestSiteSha256: string;
  toolsReference: { path: string; sha256: string };
  licenseReference: { size: number; sha256: string };
  bundle?: { path: string; sha256: string };
  resolverRoot: string;
  resolverFiles: FilePin[];
  pitchfork: {
    normalizedInfo: string;
    normalizedInfoSha256: string;
    rawInfo: string;
    rawInfoSha256: string;
    buildLog: string;
    buildLogSha256: string;
    guest: string;
    guestSha256: string;
  };
};
const PITCHFORK_COMMIT = '1054549e85470b08d9507e2c82c850959a4b3914';
const PITCHFORK_GUEST =
  'f30395a418e526e939350cc87e03d43c92d1aa0a0b0b104130761a8b8daa841e';
const CORE_COMMIT = 'a882fb2f3df14115b7e46f6812fb296eef5934d7';
const TARBALL =
  'dfcc3e6384b5ed14ddefbccd4806b9f1be2d858129e74216f116668142571f6d';
const SOURCE_INVENTORY =
  'b70c328cf9d309a18a6dc06eccde0817b0c3a78bf6f7b513ea4cb159beee2f99';
const RESOLVERS = ['fixtures.js', 'manifest.js', 'resolver.js'];
const ADDITIONAL_BUILD_INPUTS: FilePin[] = [
  {
    path: 'packages/terrarium/scripts/gen-css.ts',
    size: 831,
    sha256: 'ddb4b51592c89de7cd6d2ec3db07dcfc35e7fb57ae25bd2c9b9099431e6de42e',
  },
  {
    path: 'packages/terrarium/node_modules/@xterm/xterm/css/xterm.css',
    size: 7112,
    sha256: '854a7c0fb70e8b1a083c16797ab827299fb18744f5ad34f227b48337e33293c6',
  },
];

export function validateCurrentPackageManifest(manifest: {
  blinkCommit?: string;
  blinkSourceDirty?: boolean;
}) {
  if (
    manifest.blinkCommit !== CORE_COMMIT ||
    manifest.blinkSourceDirty !== false
  )
    throw new Error('current core identity differs');
}
export function currentTools(
  original: Record<
    string,
    { default?: string; fixture?: string; cwd?: string }
  >,
) {
  if (
    Object.keys(original).sort().join(',') !== 'aube,pitchfork' ||
    original.aube?.default !== 'v2.7.0' ||
    original.aube.fixture !== 'aube-local-deps' ||
    original.aube.cwd !== '/work/app' ||
    original.pitchfork?.default !== 'v2.30.0' ||
    original.pitchfork.fixture !== 'pitchfork-basic' ||
    original.pitchfork.cwd !== '/work/app'
  )
    throw new Error('pinned tools contract differs');
  return {
    ...original,
    pitchfork: { ...original.pitchfork, default: 'v2.30.1' },
  };
}
export function validateCurrentPitchforkProvenance(
  normalized: {
    tool?: string;
    ref?: string;
    source?: { commit?: string };
    provenanceKind?: string;
    evidence?: { guestSha256?: string; rawBuildInfoSha256?: string };
  },
  raw: string,
  pins: { guestSha256: string; rawInfoSha256: string },
) {
  if (
    pins.guestSha256 !== PITCHFORK_GUEST ||
    normalized.tool !== 'pitchfork' ||
    normalized.ref !== 'v2.30.1' ||
    normalized.source?.commit !== PITCHFORK_COMMIT ||
    normalized.provenanceKind !== 'observed-local-build' ||
    normalized.evidence?.guestSha256 !== PITCHFORK_GUEST ||
    normalized.evidence?.rawBuildInfoSha256 !== pins.rawInfoSha256 ||
    !raw.includes(PITCHFORK_COMMIT) ||
    !raw.includes('v2.30.1')
  )
    throw new Error('pitchfork provenance differs');
}

function safePath(path: string) {
  if (
    !path ||
    path.includes('\\') ||
    path.includes('\0') ||
    path.split('/').some((p) => !p || p === '.' || p === '..')
  )
    throw new Error('unsafe relative input path');
  return path;
}
async function regular(path: string) {
  if (!(await lstat(path)).isFile() || (await realpath(path)) !== resolve(path))
    throw new Error(`noncanonical or special input: ${path}`);
  return readFile(path);
}
async function pinned(path: string, expected: string) {
  const bytes = await regular(path);
  if (!/^[a-f0-9]{64}$/.test(expected) || sha256(bytes) !== expected)
    throw new Error(`input digest differs: ${path}`);
  return bytes;
}
export async function verifyCurrentFilePins(
  root: string,
  pins: FilePin[],
  count: number,
) {
  if (pins.length !== count || new Set(pins.map((p) => p.path)).size !== count)
    throw new Error('input inventory count or duplicate differs');
  for (const pin of pins) {
    const path = join(root, safePath(pin.path));
    const bytes = await pinned(path, pin.sha256);
    if (!Number.isSafeInteger(pin.size) || pin.size !== bytes.length)
      throw new Error(`input size differs: ${pin.path}`);
  }
}
/** Read-only validation precedes every local transaction and never repins evidence. */
export async function validateCurrentInputs(input: CurrentCandidateInput) {
  const owner = await realpath(input.ownerRoot);
  if (
    owner !== resolve(input.ownerRoot) ||
    input.ownerSourceInventorySha256 !== SOURCE_INVENTORY
  )
    throw new Error('owner identity differs');
  if (
    input.ownerSourceReference.sha256 !==
    '0336a05fda6ef2ce4990da6690014a8779c7bff922d35b03262ecb57a465a442'
  )
    throw new Error('owner source reference pin differs');
  const sourceReference = JSON.parse(
    (
      await pinned(
        input.ownerSourceReference.path,
        input.ownerSourceReference.sha256,
      )
    ).toString(),
  );
  if (
    sourceReference.inventorySha256 !== SOURCE_INVENTORY ||
    JSON.stringify(sourceReference.files) !== JSON.stringify(input.ownerSources)
  )
    throw new Error('owner source inventory differs');
  await verifyCurrentFilePins(owner, input.ownerSources, 78);
  await verifyCurrentFilePins(owner, ADDITIONAL_BUILD_INPUTS, 2);
  await verifyCurrentFilePins(
    owner,
    [{ path: 'LICENSE', ...input.licenseReference }],
    1,
  );
  if (input.tarballSha256 !== TARBALL)
    throw new Error('current tarball identity differs');
  await pinned(input.tarball, input.tarballSha256);
  const manifestBytes = await pinned(
    input.packageManifest,
    input.packageManifestSha256,
  );
  const manifest = JSON.parse(manifestBytes.toString());
  validateCurrentPackageManifest(manifest);
  const pack = await verifyInstalledPackage({
    packageRoot: input.stagedPackage,
    manifestPath: input.packageManifest,
    tarballPath: input.tarball,
  });
  const guest = await directoryIdentity(input.guestSite);
  if (guest.sha256 !== input.guestSiteSha256 || guest.files.length !== 10)
    throw new Error('guest site inventory differs');
  if (
    input.toolsReference.sha256 !==
    '64a712e6ed381694d69cb434bba07b5f5e49daf13a7238709e039b3f2e96cae4'
  )
    throw new Error('original tools reference pin differs');
  currentTools(
    JSON.parse(
      (
        await pinned(input.toolsReference.path, input.toolsReference.sha256)
      ).toString(),
    ),
  );
  await verifyCurrentFilePins(input.resolverRoot, input.resolverFiles, 3);
  if (
    input.resolverFiles
      .map((p) => p.path)
      .sort()
      .join(',') !== RESOLVERS.join(',')
  )
    throw new Error('resolver inventory differs');
  const p = input.pitchfork;
  const normalized = JSON.parse(
    (await pinned(p.normalizedInfo, p.normalizedInfoSha256)).toString(),
  );
  const raw = (await pinned(p.rawInfo, p.rawInfoSha256)).toString();
  await pinned(p.buildLog, p.buildLogSha256);
  await pinned(p.guest, p.guestSha256);
  validateCurrentPitchforkProvenance(normalized, raw, p);
  const stored = guest.files.find(
    (f) => resolve(input.guestSite, f.path) === resolve(p.normalizedInfo),
  );
  if (!stored || stored.sha256 !== p.normalizedInfoSha256)
    throw new Error('normalized provenance outside supplied site');
  return { pack, guest, owner };
}
async function save(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}
export function currentCandidatePaths(
  input: Pick<CurrentCandidateInput, 'out'>,
) {
  const root = resolve(input.out);
  return {
    root,
    terrarium: join(root, 'terrarium'),
    consumer: join(root, 'consumer'),
    inputs: join(root, 'inputs'),
    siteRoot: join(root, 'site'),
    browserWebRoot: join(root, 'site/web'),
  };
}
export function currentTerminalOracle(original: string) {
  if (
    original.split('v2.30.0').length !== 3 ||
    original.split('pitchfork 2.30.0\\n').length !== 2
  )
    throw new Error('copied terminal oracle count differs');
  return original
    .replaceAll('v2.30.0', 'v2.30.1')
    .replace('pitchfork 2.30.0\\n', 'pitchfork 2.30.1\\n');
}
export async function createCurrentRoot(ownerRoot: string, out: string) {
  const owner = await realpath(ownerRoot),
    root = resolve(out);
  if (
    root === owner ||
    root.startsWith(`${owner}${sep}`) ||
    (await realpath(dirname(root))) !== dirname(root)
  )
    throw new Error('output must be canonical and outside external owner');
  await mkdir(root);
}
/** Create an isolated owner copy. The main session installs and bundles afterwards. */
export async function prepareCurrentCandidate(input: CurrentCandidateInput) {
  const verified = await validateCurrentInputs(input),
    paths = currentCandidatePaths(input);
  await createCurrentRoot(verified.owner, paths.root);
  await mkdir(paths.consumer);
  await save(join(paths.consumer, 'package.json'), {
    private: true,
    type: 'module',
  });
  const captured = [];
  for (const pin of input.ownerSources) {
    const source = join(verified.owner, pin.path),
      target = join(paths.terrarium, pin.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await pinned(source, pin.sha256), { flag: 'wx' });
    captured.push(pin);
  }
  const generator = ADDITIONAL_BUILD_INPUTS[0]!;
  const generatorTarget = join(paths.terrarium, generator.path);
  await mkdir(dirname(generatorTarget), { recursive: true });
  await writeFile(
    generatorTarget,
    await pinned(join(verified.owner, generator.path), generator.sha256),
    { flag: 'wx' },
  );
  await writeFile(
    join(paths.terrarium, 'LICENSE'),
    await pinned(
      join(verified.owner, 'LICENSE'),
      input.licenseReference.sha256,
    ),
    { flag: 'wx' },
  );
  const specPath = join(
    paths.terrarium,
    'packages/terrarium/e2e/formicarium-terminal.spec.ts',
  );
  const original = await readFile(specPath, 'utf8');
  const updated = currentTerminalOracle(original);
  await writeFile(specPath, updated);
  const catalogue = JSON.parse(
    await regular(join(input.guestSite, 'dist/builds.json')).then((bytes) =>
      bytes.toString(),
    ),
  ) as DistributionInput['manifest'];
  const originalToolsBytes = await pinned(
    input.toolsReference.path,
    input.toolsReference.sha256,
  );
  const tools = currentTools(JSON.parse(originalToolsBytes.toString()));
  const builds = [];
  for (const [tool, refs] of Object.entries(catalogue.builds ?? {})) {
    for (const [ref, build] of Object.entries(refs)) {
      if (build.schemaVersion !== 1 || !build.guest || !build.buildInfo)
        throw new Error(
          'current guest catalogue requires complete schema1 assets',
        );
      builds.push({
        tool,
        ref,
        guestPath: join(input.guestSite, safePath(build.guest.url)),
        buildInfoPath: join(input.guestSite, safePath(build.buildInfo.url)),
        fixturePaths: Object.fromEntries(
          Object.entries(build.fixtures ?? {}).map(([name, asset]) => [
            name,
            join(input.guestSite, safePath(asset.url)),
          ]),
        ),
      });
    }
  }
  await stageDistribution(
    { existingRoot: input.guestSite, tools, manifest: catalogue, builds },
    join(paths.root, 'guest-site'),
  );
  const newGuest = await directoryIdentity(join(paths.root, 'guest-site'));
  if (
    newGuest.files.length !== 11 ||
    !newGuest.files.some((file) => file.path === 'tools.json') ||
    !verified.guest.files.every((original) => {
      const generated = newGuest.files.find(
        (file) => file.path === original.path,
      );
      return (
        generated?.size === original.size &&
        generated.sha256 === original.sha256
      );
    })
  )
    throw new Error(
      'fresh producer immutable assets differ from verified original supplier',
    );
  const files: FilePin[] = [];
  async function inputFile(source: string, path: string) {
    const bytes = await regular(source),
      target = join(paths.inputs, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: 'wx' });
    files.push({ path, size: bytes.length, sha256: sha256(bytes) });
  }
  await inputFile(input.tarball, 'package.tgz');
  await inputFile(input.packageManifest, 'package-manifest.json');
  for (const pin of input.resolverFiles)
    await inputFile(join(input.resolverRoot, pin.path), `resolver/${pin.path}`);
  for (const pin of newGuest.files)
    await inputFile(
      join(paths.root, 'guest-site', pin.path),
      `guests/${pin.path}`,
    );
  const descriptor = {
    schemaVersion: 1,
    files,
    tarball: 'package.tgz',
    packageManifest: 'package-manifest.json',
    resolver: 'resolver',
    guestSite: 'guests',
  };
  const descriptorPath = join(
    paths.terrarium,
    'integration/formicarium-inputs.json',
  );
  await mkdir(dirname(descriptorPath), { recursive: true });
  await writeFile(descriptorPath, `${JSON.stringify(descriptor, null, 2)}\n`);
  const supplier = await import(
    pathToFileURL(join(verified.owner, 'scripts/prepare-formicarium.mjs')).href
  );
  const inputIdentity = await supplier.verifyInputs(paths.inputs, descriptor);
  await validateCurrentInputs(input);
  const record = {
    schemaVersion: 1,
    paths,
    inputIdentity,
    ownerSources: captured,
    sourceInventorySha256: input.ownerSourceInventorySha256,
    additionalReadOnlyBuildInputs: ADDITIONAL_BUILD_INPUTS,
    additionalAssemblyInput: { path: 'LICENSE', ...input.licenseReference },
    mainGeneratorRequired: {
      cwd: join(paths.terrarium, 'packages/terrarium'),
      command: 'bun run gen',
      ordering:
        'after main npm install and stage dependency links, before main Bun bundle',
      observedByHelper: false,
    },
    terminalOracle: {
      originalSha256: sha256(original),
      copiedSha256: sha256(updated),
      replacements: 3,
    },
    tools: {
      reference: input.toolsReference,
      originalSha256: sha256(originalToolsBytes),
      transformation: 'pitchfork.default v2.30.0 -> v2.30.1 only',
      generatedSha256: newGuest.files.find(
        (file) => file.path === 'tools.json',
      )!.sha256,
    },
    pack: verified.pack,
    originalGuest: verified.guest,
    guest: newGuest,
    scope: 'local current candidate; external approval remains historical',
  };
  await save(join(paths.root, 'preparation.json'), record);
  return record;
}
/** Dependencies remain read-only; only the current installed package is selected locally. */
async function linkDependencies(
  owner: string,
  local: string,
  packageRoot: string,
) {
  await mkdir(local, { recursive: true });
  const dependencies = [];
  for (const entry of await readdir(owner, { withFileTypes: true })) {
    if (entry.name === '.bin') continue;
    if (entry.name.startsWith('@')) {
      const sourceScope = await realpath(join(owner, entry.name));
      if (!(await lstat(sourceScope)).isDirectory())
        throw new Error('dependency scope must be a directory');
      const localScope = join(local, entry.name);
      await mkdir(localScope, { recursive: true });
      if ((await realpath(localScope)) !== resolve(localScope))
        throw new Error('local dependency scope alias refused');
      for (const name of await readdir(sourceScope)) {
        if (entry.name === '@aletheia-works' && name === 'formicarium')
          continue;
        const target = await realpath(join(sourceScope, name));
        await symlink(target, join(local, entry.name, name));
        dependencies.push({ path: `${entry.name}/${name}`, target });
      }
    } else {
      const target = await realpath(join(owner, entry.name));
      await symlink(target, join(local, entry.name));
      dependencies.push({ path: entry.name, target });
    }
  }
  await mkdir(join(local, '@aletheia-works'), { recursive: true });
  await symlink(packageRoot, join(local, '@aletheia-works/formicarium'));
  return dependencies;
}
export async function prepareCurrentDependencies(input: CurrentCandidateInput) {
  const verified = await validateCurrentInputs(input),
    paths = currentCandidatePaths(input);
  const packageRoot = join(
    paths.consumer,
    'node_modules/@aletheia-works/formicarium',
  );
  await verifyInstalledPackage({
    packageRoot,
    manifestPath: input.packageManifest,
    tarballPath: input.tarball,
  });
  if ((await realpath(paths.terrarium)) !== paths.terrarium)
    throw new Error('prepared local root alias refused');
  const dependencies = await linkDependencies(
    join(verified.owner, 'packages/terrarium/node_modules'),
    join(paths.terrarium, 'packages/terrarium/node_modules'),
    packageRoot,
  );
  await save(join(paths.root, 'dependencies.json'), {
    dependencies,
    packageRoot,
  });
  return {
    dependencies,
    packageRoot,
    mainGeneratorRequired: {
      cwd: join(paths.terrarium, 'packages/terrarium'),
      command: 'bun run gen',
    },
  };
}
export async function copyCurrentBundle(
  root: string,
  bundle: { path: string; sha256: string },
  destination: string,
) {
  const source = resolve(bundle.path);
  if (!source.startsWith(`${resolve(root)}${sep}`))
    throw new Error('built bundle outside local candidate');
  const bytes = await pinned(source, bundle.sha256);
  await writeFile(destination, bytes);
  if (sha256(await regular(destination)) !== bundle.sha256)
    throw new Error('assembled bundle digest differs');
}
export async function stageCurrentCandidate(input: CurrentCandidateInput) {
  const verified = await validateCurrentInputs(input),
    paths = currentCandidatePaths(input);
  if (
    (await realpath(paths.root)) !== paths.root ||
    (await realpath(paths.terrarium)) !== paths.terrarium ||
    (await realpath(paths.consumer)) !== paths.consumer
  )
    throw new Error('prepared local root alias refused');
  const preparation = JSON.parse(
    await readFile(join(paths.root, 'preparation.json'), 'utf8'),
  );
  if (
    JSON.stringify(preparation.paths) !== JSON.stringify(paths) ||
    preparation.pack.tarballSha256 !== input.tarballSha256
  )
    throw new Error('prepared candidate identity differs');
  const packageRoot = join(
    paths.consumer,
    'node_modules/@aletheia-works/formicarium',
  );
  await verifyInstalledPackage({
    packageRoot,
    manifestPath: input.packageManifest,
    tarballPath: input.tarball,
  });
  const supplier = await import(
    pathToFileURL(join(verified.owner, 'scripts/prepare-formicarium.mjs')).href
  );
  const descriptor = JSON.parse(
    await readFile(
      join(paths.terrarium, 'integration/formicarium-inputs.json'),
      'utf8',
    ),
  );
  const fixedInputIdentity = await supplier.verifyInputs(
    paths.inputs,
    descriptor,
  );
  const { dependencies, packageRoot: linkedPackageRoot } = JSON.parse(
    await readFile(join(paths.root, 'dependencies.json'), 'utf8'),
  );
  if (
    linkedPackageRoot !== packageRoot ||
    (await realpath(
      join(
        paths.terrarium,
        'packages/terrarium/node_modules/@aletheia-works/formicarium',
      ),
    )) !== (await realpath(packageRoot))
  )
    throw new Error('current dependency package binding differs');
  await verifyCurrentFilePins(
    paths.terrarium,
    input.ownerSources.filter((pin) => pin.path.startsWith('web/')),
    input.ownerSources.filter((pin) => pin.path.startsWith('web/')).length,
  );
  await verifyCurrentFilePins(
    paths.terrarium,
    [{ path: 'LICENSE', ...input.licenseReference }],
    1,
  );
  if (!input.bundle) throw new Error('main-built pinned bundle is required');
  const bundle = input.bundle;
  if (!resolve(bundle.path).startsWith(`${paths.root}${sep}`))
    throw new Error('built bundle outside local candidate');
  await pinned(bundle.path, bundle.sha256);
  try {
    await lstat(paths.siteRoot);
    throw new Error('assembled site output already exists');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const stager = await import(
    pathToFileURL(join(verified.owner, 'scripts/assemble-candidate.mjs')).href
  );
  const result = await stager.assembleCandidate({
    destination: paths.siteRoot,
    sourceRoot: paths.terrarium,
    mode: 'formicarium',
    version: 'u3-current-v9-local',
    protectedPaths: [verified.owner, paths.inputs, paths.consumer, bundle.path],
    bundle: async (work: string) =>
      copyCurrentBundle(paths.root, bundle, join(work, 'web/terrarium.mjs')),
    inputs: {
      packageRoot,
      packageManifest: join(paths.inputs, 'package-manifest.json'),
      guestSite: join(paths.inputs, 'guests'),
      resolverRoot: join(paths.inputs, 'resolver'),
      fixedInputIdentity,
    },
  });
  await validateCurrentInputs(input);
  await save(join(paths.root, 'staging.json'), {
    result,
    dependencies,
    packageRoot,
    paths,
    bundle,
    assembly:
      'formal owner assembleCandidate with explicit local sourceRoot/inputs and main-built bundle callback; no default owner build',
    acceptance: 'not yet measured; main bundle and tests required',
  });
  return { packageRoot, paths, result };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [operation, inputPath] = process.argv.slice(2);
  if (
    !inputPath ||
    (operation !== 'prepare' &&
      operation !== 'dependencies' &&
      operation !== 'stage')
  )
    throw new Error(
      'usage: current-candidate.js prepare|dependencies|stage <input-json>',
    );
  const input = JSON.parse(await readFile(inputPath, 'utf8'));
  console.log(
    JSON.stringify(
      await (operation === 'prepare'
        ? prepareCurrentCandidate(input)
        : operation === 'dependencies'
          ? prepareCurrentDependencies(input)
          : stageCurrentCandidate(input)),
    ),
  );
}
