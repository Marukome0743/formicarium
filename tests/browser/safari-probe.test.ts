// The probe page in real Safari through safaridriver (W3C WebDriver over HTTP,
// no extra dependency). Playwright's WebKit is a separate WebKit build, so this
// is the check against the Safari that ships with macOS. It runs one session at
// a time with no retries, like the Playwright suites.
// Requires: bun run build, the probe guests in dist/guests, and
// `safaridriver --port <port>` already running (FORMICARIUM_SAFARIDRIVER).
import assert from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { after, before, test } from 'node:test';

const driver = process.env.FORMICARIUM_SAFARIDRIVER ?? 'http://127.0.0.1:4444';
const port = Number(process.env.FORMICARIUM_PORT ?? 8787);
const origin = `http://127.0.0.1:${port}`;
/** The same per-run limit as the Playwright probe test. */
const RUN_TIMEOUT_MS = 10 * 60 * 1000;
const CHECKS = [
  'tokio-timer',
  'unix-stream-pair',
  'rayon',
  'mutex-condvar',
  'fs-basic',
  'fs-hardlink',
  'fs-symlink',
  'fs-flock',
];

interface PageResult {
  exitCode?: number;
  error?: string;
}

let server: ChildProcess;
let session: string;

async function webdriver(method: string, path: string, body?: unknown) {
  const response = await fetch(`${driver}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const reply = (await response.json()) as { value: unknown };
  if (!response.ok)
    throw new Error(`WebDriver ${method} ${path}: ${JSON.stringify(reply)}`);
  return reply.value;
}

const run = (script: string) =>
  webdriver('POST', `/session/${session}/execute/sync`, { script, args: [] });

function probeUrl(args: string[] = []) {
  const query = new URLSearchParams({ guest: 'probe' });
  for (const arg of args) query.append('arg', arg);
  return `/web/index.html?${query}`;
}

/** Open the page and wait until it records a result, as the Playwright test does. */
async function runPage(path: string) {
  await webdriver('POST', `/session/${session}/url`, { url: origin + path });
  const deadline = Date.now() + RUN_TIMEOUT_MS;
  for (;;) {
    const result = (await run(
      'return window.formicariumResult ?? null',
    )) as PageResult | null;
    if (result) {
      const streams = (await run(
        'return window.formicariumDiagnostics ?? { stdout: "", stderr: "" }',
      )) as { stdout: string; stderr: string };
      const output = (await run(
        'return document.getElementById("output")?.textContent ?? ""',
      )) as string;
      return { result, streams, output };
    }
    if (Date.now() > deadline)
      throw new Error(`no result within ${RUN_TIMEOUT_MS} ms: ${path}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

before(async () => {
  server = spawn(
    process.execPath,
    ['scripts/serve.js', '--port', String(port)],
    { stdio: 'inherit' },
  );
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(`${origin}/web/index.html`)).ok) break;
    } catch {}
    if (attempt > 100) throw new Error('the page server did not start');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  // safaridriver may still be starting when the test does.
  for (let attempt = 0; ; attempt++) {
    try {
      const status = (await (await fetch(`${driver}/status`)).json()) as {
        value?: { ready?: boolean };
      };
      if (status.value?.ready) break;
    } catch {}
    if (attempt > 100) throw new Error(`safaridriver is not ready: ${driver}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const created = (await webdriver('POST', '/session', {
    capabilities: { alwaysMatch: { browserName: 'safari' } },
  })) as { sessionId: string; capabilities: Record<string, unknown> };
  session = created.sessionId;
  console.log(
    `Safari ${created.capabilities.browserVersion} on ${created.capabilities.platformName}`,
  );
});

after(async () => {
  if (session) await webdriver('DELETE', `/session/${session}`).catch(() => {});
  if (server && server.exitCode === null) {
    server.kill();
    await once(server, 'exit');
  }
});

test('the page is crossOriginIsolated in Safari', async () => {
  await webdriver('POST', `/session/${session}/url`, {
    url: `${origin}/web/index.html?guest=hello`,
  });
  assert.equal(await run('return crossOriginIsolated'), true);
});

test('the hello guest starts and exits 0 in Safari', async () => {
  const { result, streams } = await runPage(
    '/web/index.html?guest=hello&arg=from-safari',
  );
  assert.equal(result.error, undefined);
  assert.equal(result.exitCode, 0);
  assert.match(streams.stdout, /arg: from-safari/);
});

test('a guest exit code of 3 reaches the page in Safari', async () => {
  const { result, streams } = await runPage('/web/index.html?guest=exit3');
  assert.equal(result.exitCode, 3);
  assert.match(streams.stderr, /exiting with status 3/);
});

test('every probe item passes in Safari', async () => {
  const { result, output } = await runPage(probeUrl());
  assert.equal(result.error, undefined);
  for (const name of CHECKS)
    assert.ok(output.includes(`PASS ${name}\n`), `item ${name}`);
  assert.ok(!output.includes('FAIL '));
  assert.equal(result.exitCode, 0);
});

for (const item of ['futex-deadline', 'madvise-dontneed', 'page-fault-race'])
  test(`probe regression item ${item} passes in Safari`, async () => {
    const { result, streams } = await runPage(probeUrl([item]));
    assert.equal(result.error, undefined);
    assert.equal(streams.stdout.trim(), `PASS ${item}`);
    assert.equal(result.exitCode, 0);
  });
