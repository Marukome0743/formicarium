import assert from 'node:assert/strict';
import fsPromises, {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import type { TestContext } from 'node:test';
import test from 'node:test';
import type {
  OwnerAcceptanceInput,
  Reference,
} from '../../scripts/terrarium/acceptance.js';
import { acceptOwnerResult } from '../../scripts/terrarium/acceptance.js';
import { sha256 } from '../../scripts/terrarium/evidence.js';

async function fixture(t: TestContext) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'u3-acceptance-')));
  t.after(() => rm(base, { recursive: true, force: true }));
  const root = join(base, 'owner'),
    record = join(
      root,
      'aidlc/spaces/default/intents/261008-formicarium-integration-2',
    );
  await mkdir(record, { recursive: true });
  await mkdir(join(root, 'packages/terrarium'), { recursive: true });
  const refs = {} as OwnerAcceptanceInput['references'];
  async function raw(path: string, value: string): Promise<Reference> {
    const full = join(root, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, value);
    return { path, sha256: sha256(value) };
  }
  async function ref(name: keyof typeof refs, value: unknown) {
    refs[name] = await raw(
      `${relative(root, record)}/${name}.json`,
      JSON.stringify(value),
    );
  }
  const sources = [];
  for (let i = 0; i < 78; i++) {
    const path = `source/${i}.ts`;
    await raw(path, `source${i}`);
    sources.push({
      path,
      size: `source${i}`.length,
      sha256: sha256(`source${i}`),
    });
  }
  const sourceInventorySha256 = sha256(JSON.stringify(sources));
  await ref('sourceStart', {
    files: sources,
    inventorySha256: sourceInventorySha256,
  });
  await ref('sourceEnd', {
    files: sources,
    inventorySha256: sourceInventorySha256,
  });
  const inputs = [];
  for (let i = 0; i < 16; i++) {
    await raw(`.vendor/formicarium-inputs-integration-2/${i}`, 'input');
    inputs.push({ path: String(i), size: 5, sha256: sha256('input') });
  }
  const identity = {
    root: join(root, '.vendor/formicarium-inputs-integration-2'),
    normalizedDescriptorSha256: sha256('descriptor'),
    files: inputs,
  };
  const inputIdentity = await raw(
    `${relative(root, record)}/input-identity.json`,
    JSON.stringify(identity),
  );
  await ref('input', {
    source: inputIdentity.path,
    sha256: inputIdentity.sha256,
    identity,
  });
  const candidatePins: string[] = [];
  for (const [name, count] of [
    ['formicarium', 69],
    ['legacy', 22],
  ] as const) {
    const inventory = [];
    for (let i = 0; i < count; i++) {
      const path =
        i === count - 2
          ? 'LICENSE'
          : i === count - 1
            ? 'index.html'
            : String(i).padStart(3, '0');
      await raw(`.vendor/site-${name}-integration-2-bt/${path}`, 'candidate');
      inventory.push({
        path,
        kind: 'file',
        size: 9,
        digest: sha256('candidate'),
      });
    }
    const inventorySha256 = sha256(JSON.stringify(inventory));
    candidatePins.push(inventorySha256);
    const snapshot = {
      destination: `.vendor/site-${name}-integration-2-bt`,
      inventory,
      inventorySha256,
      stable: true,
    };
    await ref(`${name}Start`, snapshot);
    await ref(`${name}End`, snapshot);
    await ref(`${name}Stats`, {
      expected: name === 'formicarium' ? 45 : 34,
      skipped: name === 'formicarium' ? 0 : 2,
      unexpected: 0,
      flaky: 0,
      duration: 1,
    });
  }
  const body = '## Review\n\n**Verdict:** READY\n';
  const receiptPath =
    '.aidlc-engine/reviews/code-generation/stage/826a9a551ecd3d72/1.json';
  refs.receipt = await raw(
    `${relative(root, record)}/${receiptPath}`,
    JSON.stringify({
      version: 1,
      stage: 'code-generation',
      unit: null,
      attempt: '826a9a551ecd3d72',
      iteration: 1,
      reviewer: 'aidlc-architecture-reviewer-agent',
      verdict: 'READY',
      request_id: 'review:00ea057e81e3a59480e2c2297b99eeb6',
      source_fingerprint:
        '5fba77e90f0bbc0c52724e6ed63ddb68c813654bc98800c74bc1ccb9734ab53a',
      artifact_fingerprint: `sha256:${sha256('artifacts')}`,
      findings: [{ status: 'Resolved' }],
      body,
    }),
  );
  refs.review = await raw(`${relative(root, record)}/review.md`, body);
  const audit =
    `**Event**: REVIEW_COMPLETED\n**Stage**: code-generation\n**Verdict**: READY\n**Request Id**: review:00ea057e81e3a59480e2c2297b99eeb6\n**Source Fingerprint**: 5fba77e90f0bbc0c52724e6ed63ddb68c813654bc98800c74bc1ccb9734ab53a\n**Review Record**: ${receiptPath}\n**Review Record Digest**: sha256:${refs.receipt.sha256}\n**Artifact Fingerprint**: sha256:${sha256('artifacts')}\n` +
    ['code-generation', 'build-and-test']
      .flatMap((stage) =>
        ['GATE_APPROVED', 'STAGE_COMPLETED'].map(
          (event) =>
            `\n---\n\n**Event**: ${event}\n**Stage**: ${stage}\n**User Input**: Approve\n`,
        ),
      )
      .join('');
  refs.audit = await raw(`${relative(root, record)}/audit.md`, audit);
  const checks = [];
  for (let i = 0; i < 15; i++) {
    await raw(`${relative(root, record)}/${i}.log`, 'passed');
    checks.push({
      name: `test${i}`,
      command: ['node', 'test'],
      cwd: i === 0 ? join(root, 'packages/terrarium') : root,
      exit: 0,
      log: `${i}.log`,
      logSha256: sha256('passed'),
      started: '2026-10-08T00:00:00Z',
      finished: '2026-10-08T00:01:00Z',
    });
  }
  await ref('checks', checks);
  const input: OwnerAcceptanceInput = {
    ownerRoot: root,
    ownerRecord: record,
    intent: '261008-formicarium-integration-2',
    out: join(base, 'out'),
    references: refs,
    pins: {
      sourceInventorySha256,
      inputDescriptorSha256: identity.normalizedDescriptorSha256,
      formicariumInventorySha256: candidatePins[0]!,
      legacyInventorySha256: candidatePins[1]!,
    },
  };
  return { input, root, raw, ref, sources, checks };
}
async function absent(out: string) {
  await assert.rejects(readFile(join(out, 'acceptance.json')), {
    code: 'ENOENT',
  });
}

type AuditAppendInput = OwnerAcceptanceInput & {
  auditSnapshot: { path: string; sha256: string; bytes: number };
};
const auditSession = '01a11ad9-a464-7820-8271-eea92cff180f';
function appendEvent(
  title: string,
  event: string,
  fields: string,
  timestamp = '2026-10-09T11:17:43Z',
) {
  return `\n## ${title}\n**Timestamp**: ${timestamp}\n**Event**: ${event}\n${fields}\n\n---\n`;
}
const humanAppend = () =>
  appendEvent('Human Turn', 'HUMAN_TURN', `**Session**: ${auditSession}`);
async function appendFixture(t: TestContext) {
  const f = await fixture(t);
  const path = join(f.root, f.input.references.audit.path);
  const original = await readFile(path);
  const snapshot = join(dirname(f.root), 'pinned-audit.md');
  await writeFile(snapshot, original, { flag: 'wx' });
  const input: AuditAppendInput = {
    ...f.input,
    auditSnapshot: {
      path: snapshot,
      sha256: f.input.references.audit.sha256,
      bytes: original.length,
    },
  };
  return { ...f, input, path, original, snapshot };
}

test('pinned audit snapshot accepts bounded benign append without repinning approval', async (t) => {
  const f = await appendFixture(t);
  const suffix =
    humanAppend() +
    appendEvent(
      'Guardrail Loaded',
      'GUARDRAIL_LOADED',
      '**Scope**: all\n**Path**: .codex/aidlc-rules/\n**Rule count**: 7',
    ) +
    appendEvent(
      'Health Check',
      'HEALTH_CHECKED',
      '**Request**: /aidlc --doctor\n**Details**: 60 passed, 1 failed',
    ) +
    appendEvent(
      'Session Resume',
      'SESSION_RESUMED',
      `**Source**: resume\n**Session**: ${auditSession}`,
    );
  await writeFile(f.path, Buffer.concat([f.original, Buffer.from(suffix)]));
  const pin = f.input.references.audit.sha256;
  const result = await acceptOwnerResult(f.input);
  assert.equal(f.input.references.audit.sha256, pin);
  assert.equal(sha256(await readFile(f.snapshot)), pin);
  assert.match(result.status, /historical observations; no checks executed/);
  const saved = await Promise.all(
    result.references.map(async (r) =>
      readFile(join(f.input.out, r.localPath)),
    ),
  );
  assert(
    saved.some((b) => b.equals(f.original)),
    'immutable approval snapshot must be captured',
  );
  assert(
    saved.some((b) =>
      b.equals(Buffer.concat([f.original, Buffer.from(suffix)])),
    ),
    'current audit bytes must be captured separately',
  );
});

test('audit append refuses old prefix mutation or removal with unchanged original pin', async (t) => {
  for (const mutation of ['changed', 'shortened']) {
    const f = await appendFixture(t);
    const bytes =
      mutation === 'shortened'
        ? f.original.subarray(0, -2)
        : Buffer.from(f.original);
    if (mutation === 'changed') bytes[0] = bytes[0] === 42 ? 43 : 42;
    const changed = Buffer.concat([bytes, Buffer.from(humanAppend())]);
    assert.equal(
      changed.subarray(0, f.original.length).equals(f.original),
      false,
      'negative fixture must differ from the pinned prefix',
    );
    await writeFile(f.path, changed);
    await assert.rejects(acceptOwnerResult(f.input), /audit prefix/);
    await absent(f.input.out);
  }
});

test('audit append grammar rejects transitions and malformed fields before output', async (t) => {
  const suffixes = [
    appendEvent(
      'Gate Approved',
      'GATE_APPROVED',
      '**Stage**: code-generation\n**User Input**: Approve',
    ),
    appendEvent(
      'Review Revoked',
      'REVIEW_REVOKED',
      '**Stage**: code-generation',
    ),
    appendEvent('Unknown', 'UNKNOWN', '**Value**: 1'),
    humanAppend().replace(
      `**Session**: ${auditSession}`,
      `**Session**: ${auditSession}\n**Session**: ${auditSession}`,
    ),
    humanAppend().replace(`**Session**: ${auditSession}`, ''),
    humanAppend().replace(
      `**Session**: ${auditSession}`,
      '**Session**: invalid',
    ),
    humanAppend().replace('2026-10-09T11:17:43Z', 'invalid'),
    humanAppend() + humanAppend().replace('2026-10-09', '2026-10-08'),
    humanAppend().replace('\n\n---\n', '\n'),
    humanAppend().replace('## Human Turn', '## Health Check'),
    humanAppend().replace('\n\n---', '\nfree text\n\n---'),
    humanAppend().replace('\n\n---', '\n**Unknown**: value\n\n---'),
    `${humanAppend()}\0`,
  ];
  for (const suffix of suffixes) {
    const f = await appendFixture(t);
    await writeFile(f.path, Buffer.concat([f.original, Buffer.from(suffix)]));
    await assert.rejects(acceptOwnerResult(f.input), /audit append/);
    await absent(f.input.out);
  }
  const f = await appendFixture(t);
  await writeFile(f.path, Buffer.concat([f.original, Buffer.from([0xff])]));
  await assert.rejects(
    acceptOwnerResult(f.input),
    /audit append.*UTF|audit.*encoding/,
  );
  await absent(f.input.out);
});

test('audit append caps byte volume and event count', async (t) => {
  for (const suffix of [
    humanAppend().repeat(257),
    ' '.repeat(256 * 1024 + 1),
  ]) {
    const f = await appendFixture(t);
    await writeFile(f.path, Buffer.concat([f.original, Buffer.from(suffix)]));
    await assert.rejects(acceptOwnerResult(f.input), /audit append.*limit/);
    await absent(f.input.out);
  }
});

test('audit snapshot cannot be repinned substituted or followed through symlink', async (t) => {
  for (const mutation of ['bytes', 'pin', 'size', 'symlink']) {
    const f = await appendFixture(t);
    if (mutation === 'bytes')
      await writeFile(
        f.snapshot,
        Buffer.concat([f.original, Buffer.from(humanAppend())]),
      );
    if (mutation === 'pin')
      f.input.auditSnapshot.sha256 = sha256('replacement');
    if (mutation === 'size') f.input.auditSnapshot.bytes++;
    if (mutation === 'symlink') {
      await rm(f.snapshot);
      await symlink(f.path, f.snapshot);
    }
    await writeFile(
      f.path,
      Buffer.concat([f.original, Buffer.from(humanAppend())]),
    );
    await assert.rejects(acceptOwnerResult(f.input), /audit snapshot/);
    await absent(f.input.out);
  }
});
test('pinned owner observations are captured without claiming fresh execution; output is exclusive', async (t) => {
  const f = await fixture(t);
  const result = await acceptOwnerResult(f.input);
  assert.match(result.status, /historical observations; no checks executed/);
  for (const ref of result.references)
    assert.equal(
      sha256(await readFile(join(f.input.out, ref.localPath))),
      ref.sha256,
    );
  await assert.rejects(acceptOwnerResult(f.input), { code: 'EEXIST' });
});
test('audit append during a later log read fails before output without a timed race', {
  concurrency: false,
}, async (t) => {
  const f = await appendFixture(t);
  await writeFile(
    f.path,
    Buffer.concat([f.original, Buffer.from(humanAppend())]),
  );
  const originalRead = fsPromises.readFile;
  const trigger = join(
    f.root,
    dirname(f.input.references.checks.path),
    '0.log',
  );
  let changed = false;
  fsPromises.readFile = (async (...args: Parameters<typeof originalRead>) => {
    const value = await originalRead(...args);
    if (!changed && String(args[0]) === trigger) {
      changed = true;
      await writeFile(
        f.path,
        Buffer.concat([
          f.original,
          Buffer.from(humanAppend()),
          Buffer.from(humanAppend()),
        ]),
      );
    }
    return value;
  }) as typeof originalRead;
  syncBuiltinESMExports();
  try {
    await assert.rejects(
      acceptOwnerResult(f.input),
      /reference drift during acceptance/,
    );
    assert.equal(
      changed,
      true,
      'the deterministic mutation must actually occur',
    );
    await absent(f.input.out);
  } finally {
    fsPromises.readFile = originalRead;
    syncBuiltinESMExports();
  }
});
test('missing and same-length changed source bytes fail before output', async (t) => {
  for (const mutation of ['missing', 'changed']) {
    const f = await fixture(t);
    if (mutation === 'missing') await rm(join(f.root, 'source/0.ts'));
    else await writeFile(join(f.root, 'source/0.ts'), 'SOURCE0');
    await assert.rejects(
      acceptOwnerResult(f.input),
      mutation === 'missing' ? /ENOENT/ : /file differs: source\/0.ts/,
    );
    await absent(f.input.out);
  }
  for (const mutation of ['missing', 'changed', 'extra']) {
    const f = await fixture(t);
    const root = join(f.root, '.vendor/formicarium-inputs-integration-2');
    if (mutation === 'missing') await rm(join(root, '0'));
    else
      await writeFile(
        join(root, mutation === 'extra' ? 'extra' : '0'),
        'INPUT',
      );
    await assert.rejects(
      acceptOwnerResult(f.input),
      mutation === 'missing'
        ? /ENOENT/
        : mutation === 'extra'
          ? /input extra entries/
          : /file differs: 0/,
    );
    await absent(f.input.out);
  }
});
test('fixed source set rejects omitted or duplicate entries despite locally repinned snapshots', async (t) => {
  for (const duplicate of [false, true]) {
    const f = await fixture(t);
    const rows = duplicate
      ? [...f.sources.slice(1), f.sources[1]!]
      : f.sources.slice(1);
    const snapshot = {
      files: rows,
      inventorySha256: sha256(JSON.stringify(rows)),
    };
    await f.ref('sourceStart', snapshot);
    await f.ref('sourceEnd', snapshot);
    f.input.pins.sourceInventorySha256 = snapshot.inventorySha256;
    await assert.rejects(acceptOwnerResult(f.input), /count or duplicate/);
    await absent(f.input.out);
  }
});
test('path traversal and source symlink cannot borrow matching bytes outside owner root', async (t) => {
  const f = await fixture(t);
  f.input.references.sourceStart.path = '../escape';
  await assert.rejects(acceptOwnerResult(f.input), /unsafe path/);
  await absent(f.input.out);
  const g = await fixture(t);
  await rm(join(g.root, 'source/0.ts'));
  await symlink(join(g.root, 'source/1.ts'), join(g.root, 'source/0.ts'));
  await assert.rejects(acceptOwnerResult(g.input), /symlink/);
  await absent(g.input.out);
});
test('candidate extra files, missing files and escaping symlink fail exact inventory', async (t) => {
  for (const mutation of ['extra', 'missing', 'symlink']) {
    const f = await fixture(t);
    const dir = join(f.root, '.vendor/site-formicarium-integration-2-bt');
    if (mutation === 'extra') await writeFile(join(dir, 'extra'), 'candidate');
    else {
      await rm(join(dir, '000'));
      if (mutation === 'symlink')
        await symlink(join(f.root, 'source/0.ts'), join(dir, '000'));
    }
    await assert.rejects(
      acceptOwnerResult(f.input),
      mutation === 'symlink'
        ? /candidate symlink escapes root/
        : /candidate inventory differs/,
    );
    await absent(f.input.out);
  }
  for (const name of ['formicarium', 'legacy']) {
    for (const mutation of ['bytes', 'kind']) {
      const f = await fixture(t);
      const path = join(f.root, `.vendor/site-${name}-integration-2-bt`, '000');
      if (mutation === 'bytes') await writeFile(path, 'CANDIDATE');
      else {
        await rm(path);
        await mkdir(path);
      }
      await assert.rejects(
        acceptOwnerResult(f.input),
        /candidate inventory differs/,
      );
      await absent(f.input.out);
    }
  }
});
test('READY text alone and omitted stage approval cannot satisfy official receipt and audit', async (t) => {
  const f = await fixture(t);
  await f.ref('receipt', { verdict: 'READY' });
  await assert.rejects(acceptOwnerResult(f.input), /official READY/);
  await absent(f.input.out);
  const g = await fixture(t);
  const text = await readFile(
    join(g.root, g.input.references.audit.path),
    'utf8',
  );
  g.input.references.audit = await g.raw(
    g.input.references.audit.path,
    text.replace('**Event**: GATE_APPROVED', '**Event**: QUESTION_ANSWERED'),
  );
  await assert.rejects(acceptOwnerResult(g.input), /approval absent/);
  await absent(g.input.out);
});
test('failed command, changed log and unpinned reference reject historical success', async (t) => {
  for (const mutation of [
    'failure',
    'log',
    'reference',
    'escape',
    'cwd-symlink',
    'missing-command',
    'duplicate-command',
    'checks-pin',
  ]) {
    const f = await fixture(t);
    if (mutation === 'missing-command' || mutation === 'duplicate-command') {
      const checks =
        mutation === 'missing-command'
          ? f.checks.slice(1)
          : [f.checks[0]!, ...f.checks.slice(0, 14)];
      await f.ref('checks', checks);
    } else if (mutation === 'checks-pin') {
      await writeFile(join(f.root, f.input.references.checks.path), '[]');
    } else if (mutation === 'failure' || mutation === 'escape') {
      if (mutation === 'failure') f.checks[0]!.exit = 1;
      else f.checks[0]!.cwd = dirname(f.root);
      await f.ref('checks', f.checks);
    } else if (mutation === 'cwd-symlink') {
      await rm(join(f.root, 'packages/terrarium'), { recursive: true });
      await symlink(dirname(f.root), join(f.root, 'packages/terrarium'));
    } else if (mutation === 'log')
      await writeFile(
        join(f.root, dirname(f.input.references.checks.path), '0.log'),
        'FAILED',
      );
    else
      await writeFile(
        join(f.root, f.input.references.formicariumStats.path),
        '{}',
      );
    await assert.rejects(
      acceptOwnerResult(f.input),
      mutation === 'missing-command' || mutation === 'duplicate-command'
        ? /command set differs/
        : mutation === 'failure' || mutation === 'escape'
          ? /command failed or unbound/
          : mutation === 'cwd-symlink'
            ? /symlink refused/
            : /reference digest differs/,
    );
    await absent(f.input.out);
  }
});
