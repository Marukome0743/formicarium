import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import test from 'node:test';
import {
  collectCommand,
  observeArtifact,
  unexecuted,
} from '../../scripts/release/collect.js';
import { fixture } from './fixtures.js';

const command = (root: string, args: string[], extra = {}) => ({
  checkId: 'fixture-check',
  candidate: undefined as never,
  executable: process.execPath,
  args,
  cwd: root,
  environment: 'non-secret fixture',
  timeoutMs: 1000,
  out: root,
  ...extra,
});
test('main observer records actual zero exit with stdout stderr digest', async (t) => {
  const f = await fixture(t);
  const row = await collectCommand(
    command(
      f.root,
      ['-e', 'process.stdout.write("ok");process.stderr.write("err")'],
      { candidate: f.c },
    ),
  );
  assert.equal(row.status, 'passed');
  assert.equal(row.termination, 'exit');
  await observeArtifact(
    `${f.root}/${row.stdoutArtifact}`,
    row.artifactDigests[row.stdoutArtifact!],
  );
});
test('nonzero process remains failed', async (t) => {
  const f = await fixture(t),
    row = await collectCommand(
      command(f.root, ['-e', 'process.exit(3)'], { candidate: f.c }),
    );
  assert.equal(row.exitCode, 3);
  assert.equal(row.termination, 'execution-failure');
});
test('deadline kills child and cannot count as success', async (t) => {
  const f = await fixture(t),
    row = await collectCommand(
      command(f.root, ['-e', 'setInterval(()=>{},1000)'], {
        candidate: f.c,
        timeoutMs: 30,
      }),
    );
  assert.equal(row.status, 'failed');
  assert.equal(row.termination, 'timeout');
});
for (const kind of ['timeout', 'aborted'] as const) {
  test(`observer ${kind} stops descendants with inherited pipes`, async (t) => {
    const f = await fixture(t);
    const controller = new AbortController();
    const pidFile = `${f.root}/grandchild.pid`;
    t.after(async () => {
      try {
        process.kill(Number(await readFile(pidFile, 'utf8')), 'SIGKILL');
      } catch {}
    });
    const script = `
      const {spawn} = require('node:child_process');
      const {writeFileSync} = require('node:fs');
      const child = spawn(process.execPath, ['-e',
        'process.stdout.write("grandchild");setTimeout(()=>{},2000)'],
        {stdio:['ignore',process.stdout,process.stderr]});
      writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
      process.stdout.write('parent\\n');
      process.stderr.write('diagnostic\\n');
      setInterval(()=>{},1000);
    `;
    const abortTimer =
      kind === 'aborted'
        ? setTimeout(() => controller.abort(), 500)
        : undefined;
    const started = performance.now();
    const row = await collectCommand(
      command(f.root, ['-e', script], {
        candidate: f.c,
        timeoutMs: kind === 'timeout' ? 500 : 5000,
        signal: controller.signal,
      }),
    );
    clearTimeout(abortTimer);
    assert.equal(row.status, 'failed');
    assert.equal(row.termination, kind);
    assert.ok(
      performance.now() - started < 1500,
      'settles before descendant natural exit',
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    const pid = Number(await readFile(pidFile, 'utf8'));
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    assert.match(
      await readFile(`${f.root}/${row.stdoutArtifact}`, 'utf8'),
      /grandchild/,
    );
    assert.match(
      await readFile(`${f.root}/${row.stderrArtifact}`, 'utf8'),
      /diagnostic/,
    );
    await observeArtifact(
      `${f.root}/${row.stdoutArtifact}`,
      row.artifactDigests[row.stdoutArtifact!],
    );
    await observeArtifact(
      `${f.root}/${row.stderrArtifact}`,
      row.artifactDigests[row.stderrArtifact!],
    );
  });
}
test('aborted command is never started', async (t) => {
  const f = await fixture(t),
    controller = new AbortController();
  controller.abort();
  const row = await collectCommand(
    command(f.root, ['-e', 'process.exit(0)'], {
      candidate: f.c,
      signal: controller.signal,
    }),
  );
  assert.equal(row.exitCode, null);
  assert.equal(row.termination, 'aborted');
});
test('missing executable reports init failure', async (t) => {
  const f = await fixture(t),
    row = await collectCommand(
      command(f.root, [], {
        candidate: f.c,
        executable: '/private/tmp/u4-no-such-executable',
      }),
    );
  assert.equal(row.status, 'failed');
  assert.equal(row.termination, 'init-failure');
});
test('missing or wrong artifact bytes are rejected', async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    observeArtifact(`${f.root}/stdout.txt`, 'a'.repeat(64)),
    /identity/,
  );
  await rm(`${f.root}/stdout.txt`);
  await assert.rejects(
    observeArtifact(`${f.root}/stdout.txt`, 'a'.repeat(64)),
    { code: 'ENOENT' },
  );
});
test('not-run and malformed argv configuration never imply execution', async (t) => {
  const f = await fixture(t);
  assert.equal(unexecuted('ci', f.c, 'no remote CI').status, 'unverified');
  await assert.rejects(
    collectCommand(command(f.root, [], { candidate: f.c, executable: 'node' })),
    /invalid command/,
  );
});
