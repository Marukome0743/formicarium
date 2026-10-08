import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
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
function bridgedCounter() {
    const realm = createRealm(layout, 'host');
    const counters = new Int32Array(realm.buffer);
    const bridge = runInNewContext(bridgeSource(layout) + '\nglobalThis.__coverage__;', {
        __coverageCounters: counters,
    });
    const file = structuredClone(metadata[0]);
    bridge[file.path] = file;
    const row = layout[0];
    return { realm, counters, file, key: row.keys[0], index: row.offset };
}
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
//# sourceMappingURL=coverage.test.js.map