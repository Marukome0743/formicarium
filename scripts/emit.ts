import { cp, readFile, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { resolve } from 'node:path';

// Keep generated browser modules next to their sources so static URLs and
// package staging share the same layout. These outputs are ignored by SCM.
for (const directory of ['runtime', 'scripts', 'integration', 'tests']) {
  await cp(resolve('.build', directory), resolve(directory), {
    recursive: true,
    filter: (source) => !source.endsWith('.ts'),
  });
}
// Playwright loads the checked-in TypeScript configurations directly.

// This worker is registered as a classic script; do not add the ESM marker.
await writeFile(
  resolve('runtime/web/coi-sw.js'),
  stripTypeScriptTypes(
    await readFile(resolve('runtime/web/coi-sw.ts'), 'utf8'),
    { mode: 'strip' },
  ),
);
