import { expect, test } from '@playwright/test';

const pitchforkRef = process.env.U3_PITCHFORK_REF ?? 'v2.30.0';
if (!['v2.30.0', 'v2.30.1'].includes(pitchforkRef))
  throw new Error('unsupported explicit U3 pitchfork ref');
const pitchforkVersion =
  pitchforkRef === 'v2.30.1' ? 'pitchfork 2.30.1\n' : 'pitchfork 2.30.0\n';

for (const [tool, ref, version] of [
  ['aube', 'v2.7.0', '2.7.0 linux-x64 (2026-10-07)\n'],
  ['pitchfork', pitchforkRef, pitchforkVersion],
]) {
  test(`actual terrarium uses installed pack and latest ${tool}`, async ({
    page,
  }) => {
    if (tool === 'pitchfork') test.setTimeout(600_000);
    await page.goto(
      `/element.html?${new URLSearchParams({ tool, ref, fixture: '' })}`,
    );
    await page.locator('terrarium-terminal').waitFor();
    const result = await page.evaluate(
      async ({ tool }) => {
        const terminal = document.querySelector(
          'terrarium-terminal',
        ) as HTMLElement & {
          ready: Promise<void>;
          run(command: string): Promise<{ exitCode: number; output: string }>;
          transcript: string;
        };
        const ready = await terminal.ready;
        const first = await terminal.run(`${tool} --version`);
        const pwd = await terminal.run('pwd');
        return { ready, first, pwd, transcript: terminal.transcript };
      },
      { tool },
    );
    expect(result.ready).toMatchObject({ tool, ref });
    expect(result.first).toMatchObject({ code: 0, output: version });
    expect(result.pwd.output).toBe('/work\n');
    expect(result.transcript!).toBe(`${version}/work\n`);
  });
}
