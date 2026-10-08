import { readFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import type { ExecutionError } from '../../runtime/errors.js';
import { sha256 } from '../../scripts/package/stage-package.js';
import { serveDirectory } from './fixtures.js';

let server: Awaited<ReturnType<typeof serveDirectory>>;
const candidate = JSON.parse(
  await readFile(
    process.env.FORMICARIUM_CANDIDATE ??
      new URL('../../.artifacts/u1-package.manifest.json', import.meta.url),
    'utf8',
  ),
);
if (!process.env.FORMICARIUM_CONSUMER)
  throw new Error('FORMICARIUM_CONSUMER outside repository is required');
const root = await realpath(process.env.FORMICARIUM_CONSUMER);
const repository = await realpath(new URL('../../', import.meta.url));
if (root.startsWith(`${repository}/`))
  throw new Error('consumer is inside repository');
if (sha256(await readFile(candidate.tarball.path)) !== candidate.tarball.sha256)
  throw new Error('tarball identity differs');
const packageRoot = resolve(root, 'node_modules/@aletheia-works/formicarium');
for (const entry of candidate.files)
  if (sha256(await readFile(resolve(packageRoot, entry.path))) !== entry.sha256)
    throw new Error(`installed digest differs: ${entry.path}`);
const guest = [
  ...(await readFile(
    new URL('../../.artifacts/u1-fixture/guest', import.meta.url),
  )),
];
test.beforeAll(async () => {
  server = await serveDirectory(packageRoot);
});
test.afterAll(async () => {
  await server.close();
});
test.beforeEach(async ({ page }) => {
  await page.goto(server.url);
});

test('real installed browser archive normal and nonzero byte guest', async ({
  page,
}) => {
  const result = await page.evaluate(async (bytes) => {
    const { createSession } = await import('/runtime/web/api.js');
    const session = await createSession();
    try {
      const normal = await session.run({ guest: new Uint8Array(bytes) });
      const binary = await session.run({
        guest: new Uint8Array(bytes),
        args: ['bytes'],
      });
      return {
        normal: normal.exitCode,
        text: new TextDecoder().decode(normal.stdout),
        code: binary.exitCode,
        out: [...binary.stdout],
        err: [...binary.stderr],
      };
    } finally {
      await session.dispose();
    }
  }, guest);
  expect(result).toEqual({
    normal: 0,
    text: 'fixture-ok\n',
    code: 3,
    out: [0, 255, 128, 65, 10],
    err: [254, 0, 66, 10],
  });
});
test('real browser snapshot restores links/modes/deletion to next fresh core', async ({
  page,
}) => {
  const result = await page.evaluate(async (bytes) => {
    const { createSession } = await import('/runtime/web/api.js');
    const session = await createSession();
    try {
      const seed = await session.run({
        guest: new Uint8Array(bytes),
        args: ['seed'],
      });
      const entries = await session.listEntries('/work/kept');
      const verify = await session.run({
        guest: new Uint8Array(bytes),
        args: ['verify'],
      });
      return {
        seed: seed.exitCode,
        verify: verify.exitCode,
        entries: entries.map((entry) => ({
          ...entry,
          data: entry.type === 'file' ? [...entry.data] : undefined,
        })),
        data: [...(await session.readFile('/work/kept/a'))],
      };
    } finally {
      await session.dispose();
    }
  }, guest);
  expect(result.seed).toBe(0);
  expect(result.verify).toBe(0);
  expect(result.data).toEqual([9, 8]);
  const a = result.entries.find(
    (entry): entry is Extract<typeof entry, { type: 'file' }> =>
      entry.type === 'file' && entry.path.endsWith('/a'),
  )!;
  const b = result.entries.find(
    (entry): entry is Extract<typeof entry, { type: 'file' }> =>
      entry.type === 'file' && entry.path.endsWith('/b'),
  )!;
  expect(a.inodeId).toBe(b.inodeId);
  expect(a.mode & 0o777).toBe(0o640);
  expect(result.entries.find((entry) => entry.type === 'symlink')?.target).toBe(
    'a',
  );
});
for (const kind of ['timeout', 'abort'])
  test(`real browser CPU-bound ${kind} releases session for immediate run`, async ({
    page,
  }) => {
    const result = await page.evaluate(
      async ({ bytes, kind }) => {
        const { createSession } = await import('/runtime/web/api.js');
        const session = await createSession();
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const running = session.run({
            guest: new Uint8Array(bytes),
            args: ['spin'],
            timeoutMs: kind === 'timeout' ? 1500 : 600000,
            signal: controller.signal,
            onOutput: (chunk) => {
              if (
                kind === 'abort' &&
                new TextDecoder().decode(chunk.bytes).includes('spin-started')
              )
                controller.abort();
            },
          });
          let code: string | undefined;
          let started: boolean | undefined;
          try {
            await running;
          } catch (caught) {
            const error = caught as ExecutionError;
            code = error.code;
            started = new TextDecoder()
              .decode(error.stdout)
              .includes('spin-started');
          }
          return {
            code,
            started,
            next: (await session.run({ guest: new Uint8Array(bytes) }))
              .exitCode,
            entries: (await session.listEntries()).length,
          };
        } finally {
          clearTimeout(timer);
          await session.dispose();
        }
      },
      { bytes: guest, kind },
    );
    expect(result).toEqual({
      code: kind === 'timeout' ? 'TIMEOUT' : 'ABORTED',
      started: true,
      next: 0,
      entries: 0,
    });
  });
test('real browser pthread guest exits normally before next fresh run', async ({
  page,
}) => {
  const result = await page.evaluate(async (bytes) => {
    const { createSession } = await import('/runtime/web/api.js');
    const session = await createSession();
    try {
      const first = await session.run({
        guest: new Uint8Array(bytes),
        args: ['thread-exit'],
      });
      return {
        first: first.exitCode,
        out: new TextDecoder().decode(first.stdout),
        next: (await session.run({ guest: new Uint8Array(bytes) })).exitCode,
      };
    } finally {
      await session.dispose();
    }
  }, guest);
  expect(result.first).toBe(0);
  expect(result.out).toContain('child-finished');
  expect(result.next).toBe(0);
});

test('installed real loader mutation never executes unverified original URL bytes', async ({
  page,
}) => {
  const original = await readFile(resolve(packageRoot, 'assets/blink.mjs'));
  let reads = 0;
  const wrapper = `
    import { loadPackageCore, createCoreResourceOwner, bootstrapVerifiedBrowserCore } from '/runtime/core.js';
    import { runGuest } from '/runtime/guest-io.js';
    delete Atomics.waitAsync;
    self.onmessage = async ({data}) => {
      if (self.name === 'em-pthread') { self.onmessage = null; try { await bootstrapVerifiedBrowserCore(data.descriptor); } catch(caught) {const error = caught; self.postMessage({type:'mutation-child-error',error:String(error)}); } return; }
      const resources = createCoreResourceOwner({environment:'browser',bootstrapURL:new URL('/mutation-worker.mjs',location.href).href});
      let descriptor;
      const NativeWorker = globalThis.Worker;
      const children = [];
      globalThis.Worker = class extends NativeWorker {
        constructor(url,options) {
          super(url,options); children.push(this);
          this.addEventListener('error',event => self.postMessage({error:'child: '+event.message}));
          this.addEventListener('message',event => {if(event.data?.type === 'mutation-child-error') self.postMessage({error:event.data.error});});
          this.postMessage({type:'core-bootstrap',descriptor});
        }
      };
      let adapter;
      try {
        adapter = await loadPackageCore({assets: data.assets, resources:{allocate:async bytes => descriptor = await resources.allocate(bytes)}, readBytes: async url => {
          const response = await fetch(url); if (!response.ok) throw new Error('asset');
          return new Uint8Array(await response.arrayBuffer());
        }});
        const result = await runGuest({createModule: adapter.createModule, core: adapter.core, guestPath:'/guest/program', entries:[{path:'/guest/program',type:'file',data:new Uint8Array(data.guest),mode:493}], args:[], env:{}, cwd:'/work', snapshotRoots:['/work']});
        self.postMessage({code:result.exitCode,text:new TextDecoder().decode(result.stdout),marker:globalThis.__unverifiedLoaderMarker ?? 0});
      } catch (caught) { const error = caught; self.postMessage({error:String(error),code:error.code}); }
      finally { adapter?.core.cleanup(); for (const child of children) child.terminate(); globalThis.Worker = NativeWorker; await resources.dispose(); }
    };
  `;
  const mutationServer = await serveDirectory(packageRoot, {
    extraFiles: {
      '/mutation-worker.mjs': wrapper,
      '/mutation/blink.mjs': () =>
        ++reads === 1
          ? original
          : Buffer.concat([
              Buffer.from(
                'globalThis.__unverifiedLoaderMarker = (globalThis.__unverifiedLoaderMarker ?? 0) + 1;\n',
              ),
              original,
            ]),
    },
  });
  try {
    await page.goto(mutationServer.url);
    const result = await page.evaluate(async (guest) => {
      const worker = new Worker('/mutation-worker.mjs', { type: 'module' });
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await new Promise<{
          code: number;
          text: string;
          marker: number;
        }>((resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('mutation harness did not settle in 30s')),
            30000,
          );
          worker.onmessage = ({ data }) => resolve(data);
          worker.onerror = (event) => reject(new Error(event.message));
          worker.postMessage({
            guest,
            assets: {
              loaderURL: new URL('/mutation/blink.mjs', location.href).href,
              wasmURL: new URL('/assets/blink.wasm', location.href).href,
              buildInfoURL: new URL('/assets/build-info.json', location.href)
                .href,
              workerURL: new URL('/mutation-worker.mjs', location.href).href,
            },
          });
        });
      } finally {
        clearTimeout(timer);
        worker.terminate();
      }
    }, guest);
    expect(result.code).toBe(0);
    expect(result.text).toBe('fixture-ok\n');
    expect(
      result.marker,
      'changed original URL marker executed despite digest verification',
    ).toBe(0);
  } finally {
    await mutationServer.close();
  }
});

for (const allowBlob of [true, false])
  test(`verified browser loader obeys explicit CSP blob permission ${allowBlob}`, async ({
    page,
  }) => {
    const cspServer = await serveDirectory(packageRoot, {
      csp: `script-src 'self' ${allowBlob ? 'blob:' : ''} 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'`,
    });
    try {
      await page.goto(cspServer.url);
      const result = await page.evaluate(async (bytes) => {
        const created: string[] = [];
        const revoked: string[] = [];
        const create = URL.createObjectURL;
        const revoke = URL.revokeObjectURL;
        URL.createObjectURL = function (...args) {
          const url = create.apply(this, args);
          created.push(url);
          return url;
        };
        URL.revokeObjectURL = function (url) {
          revoked.push(url);
          return revoke.call(this, url);
        };
        const { createSession } = await import('/runtime/web/api.js');
        const session = await createSession();
        let result: { exit?: number; text?: string; error?: string };
        try {
          const run = await session.run({ guest: new Uint8Array(bytes) });
          result = {
            exit: run.exitCode,
            text: new TextDecoder().decode(run.stdout),
          };
        } catch (caught) {
          const error = caught as ExecutionError;
          result = { error: error.code };
        } finally {
          await session.dispose();
          URL.createObjectURL = create;
          URL.revokeObjectURL = revoke;
        }
        return { ...result, created, revoked };
      }, guest);
      if (allowBlob) {
        expect(result.exit).toBe(0);
        expect(result.text).toBe('fixture-ok\n');
      } else expect(result.error).toBe('ASSET_LOAD');
      expect(result.created).toHaveLength(1);
      expect(result.revoked).toEqual(result.created);
    } finally {
      await cspServer.close();
    }
  });

test('host releases every verified Blob after normal abort timeout and disposal', async ({
  page,
}) => {
  const result = await page.evaluate(async (bytes) => {
    const created: string[] = [];
    const revoked: string[] = [];
    const create = URL.createObjectURL;
    const revoke = URL.revokeObjectURL;
    URL.createObjectURL = function (...args) {
      const url = create.apply(this, args);
      created.push(url);
      return url;
    };
    URL.revokeObjectURL = function (url) {
      revoked.push(url);
      return revoke.call(this, url);
    };
    const { createSession } = await import('/runtime/web/api.js');
    const session = await createSession();
    const codes = [];
    try {
      codes.push(
        (await session.run({ guest: new Uint8Array(bytes) })).exitCode,
      );
      for (const kind of ['abort', 'timeout']) {
        const controller = new AbortController();
        try {
          await session.run({
            guest: new Uint8Array(bytes),
            args: ['spin'],
            timeoutMs: kind === 'timeout' ? 1500 : 600000,
            signal: controller.signal,
            onOutput: (chunk) => {
              if (
                kind === 'abort' &&
                new TextDecoder().decode(chunk.bytes).includes('spin-started')
              )
                controller.abort();
            },
          });
        } catch (caught) {
          const error = caught as ExecutionError;
          codes.push(error.code);
        }
      }
      codes.push(
        (await session.run({ guest: new Uint8Array(bytes) })).exitCode,
      );
      try {
        await session.run({
          guest: new Uint8Array(bytes),
          args: ['spin'],
          onOutput: (chunk) => {
            if (new TextDecoder().decode(chunk.bytes).includes('spin-started'))
              void session.dispose();
          },
        });
      } catch (caught) {
        const error = caught as ExecutionError;
        codes.push(error.code);
      }
    } finally {
      await session.dispose();
      URL.createObjectURL = create;
      URL.revokeObjectURL = revoke;
    }
    return { codes, created, revoked };
  }, guest);
  expect(result.codes).toEqual([0, 'ABORTED', 'TIMEOUT', 0, 'ABORTED']);
  expect(result.created).toHaveLength(5);
  expect(result.revoked).toEqual(result.created);
});

test('public removed nested cwd is recreated by real guest run', async ({
  page,
}) => {
  const result = await page.evaluate(async (bytes) => {
    const { createSession } = await import('/runtime/web/api.js');
    const session = await createSession({
      entries: [{ path: '/work/project/sub', type: 'dir', mode: 448 }],
    });
    try {
      await session.setCwd('/work/project/sub');
      await session.remove('/work/project');
      const run = await session.run({ guest: new Uint8Array(bytes) });
      const project = (await session.listEntries('/work')).find(
        (entry): entry is Extract<typeof entry, { type: 'dir' }> =>
          entry.type === 'dir' && entry.path === '/work/project',
      )!;
      const sub = (await session.listEntries('/work/project')).find(
        (entry): entry is Extract<typeof entry, { type: 'dir' }> =>
          entry.type === 'dir' && entry.path === '/work/project/sub',
      )!;
      return {
        exit: run.exitCode,
        text: new TextDecoder().decode(run.stdout),
        project: project.mode & 511,
        sub: sub.mode & 511,
      };
    } finally {
      await session.dispose();
    }
  }, guest);
  expect(result).toEqual({
    exit: 0,
    text: 'fixture-ok\n',
    project: 493,
    sub: 493,
  });
});

test('removed cwd snapshot rollback next-run and reset preserve seed state', async ({
  page,
}) => {
  const result = await page.evaluate(async (bytes) => {
    const { createSession } = await import('/runtime/web/api.js');
    const session = await createSession({
      entries: [
        { path: '/work/project/sub', type: 'dir', mode: 448 },
        {
          path: '/work/project/sub/input',
          type: 'file',
          inodeId: 'seed-input',
          mode: 416,
          data: Uint8Array.of(7, 8),
        },
      ],
    });
    try {
      await session.setCwd('/work/project/sub');
      await session.remove('/work/project');
      const controller = new AbortController();
      let aborted: string | undefined;
      try {
        await session.run({
          guest: new Uint8Array(bytes),
          args: ['spin'],
          signal: controller.signal,
          onOutput: (chunk) => {
            if (new TextDecoder().decode(chunk.bytes).includes('spin-started'))
              controller.abort();
          },
        });
      } catch (caught) {
        const error = caught as ExecutionError;
        aborted = error.code;
      }
      const uncommitted = !(await session.listEntries('/work')).some(
        (entry) => entry.path === '/work/project',
      );
      const first = (await session.run({ guest: new Uint8Array(bytes) }))
        .exitCode;
      const next = (await session.run({ guest: new Uint8Array(bytes) }))
        .exitCode;
      const restored =
        (await session.listEntries('/work/project')).find(
          (entry): entry is Extract<typeof entry, { type: 'dir' }> =>
            entry.type === 'dir' && entry.path === '/work/project/sub',
        )!.mode & 511;
      await session.reset();
      const reset =
        (await session.listEntries('/work/project')).find(
          (entry): entry is Extract<typeof entry, { type: 'dir' }> =>
            entry.type === 'dir' && entry.path === '/work/project/sub',
        )!.mode & 511;
      return {
        aborted,
        uncommitted,
        first,
        next,
        restored,
        reset,
        input: [...(await session.readFile('/work/project/sub/input'))],
      };
    } finally {
      await session.dispose();
    }
  }, guest);
  expect(result).toEqual({
    aborted: 'ABORTED',
    uncommitted: true,
    first: 0,
    next: 0,
    restored: 493,
    reset: 448,
    input: [7, 8],
  });
});
