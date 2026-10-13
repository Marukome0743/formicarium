import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import type { Realm } from '../../scripts/coverage-types.js';
import {
  bridgeSource,
  counterLayout,
  createRealm,
  mergeRealms,
} from '../../scripts/package/coverage.js';
import { FIRST_PARTY_JS } from '../../scripts/package/stage-package.js';

const { createInstrumenter } = createRequire(import.meta.url)(
  'istanbul-lib-instrument',
);
const metadata = FIRST_PARTY_JS.map((path) => {
  const instrumenter = createInstrumenter({ esModules: true });
  instrumenter.instrumentSync(
    'export const value = 1;\nexport function unused() {\n return 2;\n}\n',
    path,
  );
  return instrumenter.lastFileCoverage();
});
const layout = counterLayout(metadata);
const register = (realm: Realm) => {
  Atomics.store(new Int32Array(realm.buffer), 0, 1);
  return realm;
};

test('coverage fixed16 inventory includes all unimported files at zero', () => {
  const result = mergeRealms(
    metadata,
    layout,
    [register(createRealm(layout, 'host'))],
    ['host'],
  );
  assert.equal(result.map.files().length, 16);
  assert.ok(result.map.files().includes('runtime/guest-validation.js'));
  assert.ok(result.map.files().includes('runtime/session-port.js'));
  assert.equal(result.lines.pct, 0);
  assert.equal(result.passed, false);
});
test('coverage refuses incomplete inventory instead of shrinking denominator', () => {
  assert.throws(
    () => mergeRealms(metadata.slice(1), layout, [], []),
    /inventory/,
  );
});
test('coverage missing required realm fails even when other realm has counters', () => {
  assert.throws(
    () =>
      mergeRealms(
        metadata,
        layout,
        [register(createRealm(layout, 'host'))],
        ['host', 'worker'],
      ),
    /missing coverage realm/,
  );
});
test('coverage unregistered and duplicate realms fail', () => {
  const realm = createRealm(layout, 'worker');
  assert.throws(
    () => mergeRealms(metadata, layout, [realm], ['worker']),
    /missing coverage realm/,
  );
  register(realm);
  assert.throws(
    () => mergeRealms(metadata, layout, [realm, realm], ['worker']),
    /duplicate/,
  );
});
test('coverage line union aggregates statement counters across realm boundaries', () => {
  const a = register(createRealm(layout, 'host'));
  const b = register(createRealm(layout, 'worker'));
  for (const row of layout)
    for (let index = 0; index < row.keys.length; index++) {
      Atomics.store(
        new Int32Array(index % 2 ? a.buffer : b.buffer),
        row.offset + index,
        1,
      );
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
