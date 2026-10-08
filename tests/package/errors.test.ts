import assert from 'node:assert/strict';
import test from 'node:test';
import { errorCode, errorText, isRecord } from '../../runtime/contracts.js';
import {
  ERROR_CODES,
  ExecutionError,
  failure,
  invalid,
  safeCause,
} from '../../runtime/errors.js';

test('public ExecutionError retains its code and Error identity', () => {
  const error = new ExecutionError('TIMEOUT', 'Run timed out');
  assert.ok(error instanceof Error);
  assert.equal(error.name, 'ExecutionError');
  assert.equal(error.code, 'TIMEOUT');
});
test('ExecutionError copies stdout and stderr independently', () => {
  const bytes = Uint8Array.of(255);
  const error = failure('EXECUTION', 'failed', {
    stdout: bytes,
    stderr: bytes,
    runId: 'r1',
  });
  bytes[0] = 0;
  error.stdout[0] = 1;
  assert.deepEqual(error.stderr, Uint8Array.of(255));
  assert.equal(error.runId, 'r1');
});
test('missing error output is represented by empty byte arrays', () => {
  const error = failure('BUSY');
  assert.equal(error.stdout.length, 0);
  assert.equal(error.stderr.length, 0);
  assert.equal(Object.hasOwn(error, 'runId'), false);
});
test('unknown error code is rejected and published code inventory is immutable', () => {
  // @ts-expect-error Deliberately malformed input exercises the runtime guard.
  assert.throws(() => failure('OTHER'), TypeError);
  assert.equal(ERROR_CODES.length, 12);
  // @ts-expect-error Deliberately malformed input exercises the runtime guard.
  assert.throws(() => ERROR_CODES.push('OTHER'), TypeError);
});
test('local cause is preserved without automatic serialization', () => {
  const cause = { code: 'TIMEOUT' };
  assert.equal(failure('EXECUTION', 'cleanup failed', { cause }).cause, cause);
});
test('validation and safe causes contain fixed explanations', () => {
  assert.doesNotThrow(() => invalid(true, 'unused'));
  assert.throws(() => invalid(false, 'invalid'), { code: 'INVALID_INPUT' });
  assert.equal(safeCause('TIMEOUT').code, 'TIMEOUT');
  // @ts-expect-error Deliberately malformed input exercises the runtime guard.
  assert.equal(safeCause('secret env value').code, 'EXECUTION');
  assert.equal(
    // @ts-expect-error Deliberately malformed input exercises the runtime guard.
    JSON.stringify(safeCause('secret env value')).includes('secret'),
    false,
  );
});

test('error classification preserves Node errno and public execution codes', () => {
  assert.equal(
    errorCode(Object.assign(new Error('missing'), { code: 'ENOENT' })),
    'ENOENT',
  );
  assert.equal(errorCode(failure('ASSET_LOAD')), 'ASSET_LOAD');
});
test('unknown primitive failures do not invent an error code', () => {
  for (const value of [null, undefined, 'ENOENT', 404, false])
    assert.equal(errorCode(value), undefined);
});
test('malformed diagnostic code fields cannot become string classifications', () => {
  for (const value of [{}, { code: 404 }, { code: null }, { code: ['ENOENT'] }])
    assert.equal(errorCode(value), undefined);
});
test('a throwing diagnostic accessor is propagated instead of hiding its failure', () => {
  const cause = new Error('diagnostic accessor failed');
  const value = {
    get code() {
      throw cause;
    },
  };
  assert.throws(
    () => errorCode(value),
    (error) => error === cause,
  );
});
test('error text uses an Error message without appending stack or cause', () => {
  const error = new Error('asset unavailable', {
    cause: new Error('private cause'),
  });
  assert.equal(errorText(error), 'asset unavailable');
});
test('non Error rejections preserve their explicit textual diagnostics', () => {
  assert.equal(errorText(null), 'null');
  assert.equal(errorText(undefined), 'undefined');
  assert.equal(errorText(404), '404');
  assert.equal(errorText('cancelled'), 'cancelled');
});
test('failed diagnostic conversion is propagated without fabricating fallback text', () => {
  const cause = new Error('conversion failed');
  const value = {
    toString() {
      throw cause;
    },
  };
  assert.throws(
    () => errorText(value),
    (error) => error === cause,
  );
});
test('record boundary accepts object envelopes but excludes arrays and primitives', () => {
  assert.equal(isRecord({ type: 'run' }), true);
  assert.equal(isRecord(Object.create(null)), true);
  for (const value of [
    null,
    undefined,
    [],
    [{ type: 'run' }],
    'run',
    1,
    () => {},
  ])
    assert.equal(isRecord(value), false);
});
