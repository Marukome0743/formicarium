import {
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from './evidence.js';

export interface Reference {
  path: string;
  sha256: string;
}
export interface OwnerAcceptanceInput {
  auditSnapshot?: { path: string; sha256: string; bytes: number };
  ownerRoot: string;
  ownerRecord: string;
  intent: '261008-formicarium-integration-2';
  out: string;
  references: Record<
    | 'receipt'
    | 'review'
    | 'audit'
    | 'sourceStart'
    | 'sourceEnd'
    | 'input'
    | 'checks'
    | 'formicariumStart'
    | 'formicariumEnd'
    | 'legacyStart'
    | 'legacyEnd'
    | 'formicariumStats'
    | 'legacyStats',
    Reference
  >;
  pins: {
    sourceInventorySha256: string;
    inputDescriptorSha256: string;
    formicariumInventorySha256: string;
    legacyInventorySha256: string;
  };
}
type FileRow = { path: string; size: number; sha256: string };
type Entry = {
  path: string;
  kind: 'file' | 'directory' | 'symlink';
  size?: number;
  digest?: string;
  target?: string;
};
const INTENT = '261008-formicarium-integration-2';
const REQUEST = 'review:00ea057e81e3a59480e2c2297b99eeb6';
const SOURCE =
  '5fba77e90f0bbc0c52724e6ed63ddb68c813654bc98800c74bc1ccb9734ab53a';
const RECEIPT =
  '.aidlc-engine/reviews/code-generation/stage/826a9a551ecd3d72/1.json';
function requireTrue(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function digest(value: string) {
  requireTrue(/^[a-f0-9]{64}$/.test(value), 'invalid digest');
  return value;
}
function safeRelative(path: string) {
  requireTrue(
    typeof path === 'string' &&
      path.length > 0 &&
      !isAbsolute(path) &&
      !path.includes('\\') &&
      path.split('/').every((p) => p && p !== '.' && p !== '..'),
    'unsafe path',
  );
  return path;
}
async function safePath(root: string, path: string) {
  const parts = safeRelative(path).split('/');
  let current = root;
  for (const part of parts) {
    current = join(current, part);
    requireTrue(!(await lstat(current)).isSymbolicLink(), 'symlink refused');
  }
  return current;
}
function unique(rows: { path: string }[], count: number) {
  requireTrue(
    Array.isArray(rows) &&
      rows.length === count &&
      new Set(rows.map((row) => safeRelative(row.path))).size === count,
    'inventory count or duplicate differs',
  );
}
async function files(root: string, rows: FileRow[], count: number) {
  unique(rows, count);
  for (const row of rows) {
    const path = await safePath(root, row.path);
    const stat = await lstat(path);
    const bytes = await readFile(path);
    requireTrue(
      stat.isFile() &&
        bytes.length === row.size &&
        sha256(bytes) === digest(row.sha256),
      `file differs: ${row.path}`,
    );
  }
}
async function inventory(root: string): Promise<Entry[]> {
  const rows: Entry[] = [];
  async function walk(prefix: string) {
    for (const name of (await readdir(join(root, prefix))).sort()) {
      const path = prefix ? `${prefix}/${name}` : name;
      const target = join(root, path);
      const stat = await lstat(target);
      if (stat.isDirectory()) {
        rows.push({ path, kind: 'directory' });
        await walk(path);
      } else if (stat.isFile()) {
        const bytes = await readFile(target);
        rows.push({
          path,
          kind: 'file',
          size: bytes.length,
          digest: sha256(bytes),
        });
      } else if (stat.isSymbolicLink()) {
        const link = await readlink(target);
        const resolved = await realpath(target);
        requireTrue(
          resolved.startsWith(`${root}${sep}`),
          'candidate symlink escapes root',
        );
        rows.push({ path, kind: 'symlink', target: link });
      } else throw new Error('candidate special file refused');
    }
  }
  await walk('');
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}
function events(text: string) {
  return text
    .split(/\n---\s*\n/)
    .map((block) =>
      Object.fromEntries(
        [...block.matchAll(/^\*\*([^*]+)\*\*:\s*(.*)$/gm)].map((match) => [
          match[1],
          match[2],
        ]),
      ),
    );
}

function auditText(bytes: Buffer) {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    requireTrue(!text.includes('\0'), 'audit append NUL refused');
    return text;
  } catch (error) {
    if (error instanceof TypeError)
      throw new Error('audit append UTF encoding invalid');
    throw error;
  }
}
function validateAppend(snapshot: Buffer, current: Buffer) {
  requireTrue(
    current.subarray(0, snapshot.length).equals(snapshot),
    'audit prefix differs',
  );
  const suffix = current.subarray(snapshot.length);
  requireTrue(suffix.length <= 256 * 1024, 'audit append byte limit exceeded');
  const old = auditText(snapshot);
  const text = auditText(suffix);
  if (!text.trim()) {
    requireTrue(suffix.length === 0, 'audit append empty block refused');
    return [];
  }
  requireTrue(/\n---\n\s*$/.test(text), 'audit append incomplete block');
  const blocks = text
    .split(/(?:^|\n)---\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  requireTrue(blocks.length <= 256, 'audit append event limit exceeded');
  const allowed: Record<string, { title: string; fields: string[] }> = {
    HUMAN_TURN: {
      title: 'Human Turn',
      fields: ['Timestamp', 'Event', 'Session'],
    },
    GUARDRAIL_LOADED: {
      title: 'Guardrail Loaded',
      fields: ['Timestamp', 'Event', 'Scope', 'Path', 'Rule count'],
    },
    HEALTH_CHECKED: {
      title: 'Health Check',
      fields: ['Timestamp', 'Event', 'Request', 'Details'],
    },
    SESSION_RESUMED: {
      title: 'Session Resume',
      fields: ['Timestamp', 'Event', 'Source', 'Session'],
    },
  };
  let previous = 0;
  for (const match of old.matchAll(/^\*\*Timestamp\*\*:\s*(.+)$/gm)) {
    const value = Date.parse(match[1]!);
    requireTrue(Number.isFinite(value), 'audit snapshot timestamp invalid');
    previous = value;
  }
  return blocks.map((block) => {
    const lines = block.split('\n').filter((line) => line !== '');
    const heading = lines.shift();
    const row: Record<string, string> = {};
    for (const line of lines) {
      const match = /^\*\*([^*]+)\*\*: (.+)$/.exec(line);
      requireTrue(
        match && !Object.hasOwn(row, match[1]!),
        'audit append field invalid or duplicate',
      );
      row[match[1]!] = match[2]!;
    }
    const definition = allowed[row.Event!];
    requireTrue(
      definition && heading === `## ${definition.title}`,
      'audit append event or heading refused',
    );
    requireTrue(
      JSON.stringify(Object.keys(row).sort()) ===
        JSON.stringify([...definition.fields].sort()),
      'audit append field set differs',
    );
    requireTrue(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(row.Timestamp!),
      'audit append timestamp invalid',
    );
    const timestamp = Date.parse(row.Timestamp!);
    requireTrue(
      Number.isFinite(timestamp) &&
        new Date(timestamp).toISOString().replace('.000Z', 'Z') ===
          row.Timestamp &&
        timestamp >= previous,
      'audit append timestamp order invalid',
    );
    previous = timestamp;
    if (row.Session)
      requireTrue(
        /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(row.Session),
        'audit append session invalid',
      );
    if (row.Event === 'GUARDRAIL_LOADED')
      requireTrue(
        row.Scope === 'all' &&
          row.Path === '.codex/aidlc-rules/' &&
          /^(0|[1-9]\d*)$/.test(row['Rule count']!),
        'audit append guardrail invalid',
      );
    if (row.Event === 'HEALTH_CHECKED')
      requireTrue(
        row.Request === '/aidlc --doctor' &&
          /^\d+ passed, \d+ failed$/.test(row.Details!),
        'audit append health invalid',
      );
    if (row.Event === 'SESSION_RESUMED')
      requireTrue(row.Source === 'resume', 'audit append resume invalid');
    return row;
  });
}

/** Consume pinned owner observations; never run or relabel their historical checks. */
export async function acceptOwnerResult(input: OwnerAcceptanceInput) {
  requireTrue(
    input.intent === INTENT &&
      isAbsolute(input.ownerRoot) &&
      isAbsolute(input.ownerRecord) &&
      isAbsolute(input.out),
    'owner identity invalid',
  );
  const root = resolve(input.ownerRoot);
  requireTrue((await realpath(root)) === root, 'owner root alias refused');
  requireTrue(
    input.ownerRecord === join(root, 'aidlc/spaces/default/intents', INTENT),
    'owner record differs',
  );
  requireTrue(
    !resolve(input.out).startsWith(`${root}${sep}`) &&
      resolve(input.out) !== root,
    'output overlaps owner',
  );
  await safePath(root, relative(root, input.ownerRecord));
  const captured = new Map<string, Buffer>();
  let auditSnapshot: Buffer | undefined;
  let auditCurrent: Buffer | undefined;
  let appendedEvents: Record<string, string>[] = [];
  if (input.auditSnapshot) {
    const ref = input.auditSnapshot;
    requireTrue(
      isAbsolute(ref.path) &&
        ref.path === resolve(ref.path) &&
        (await realpath(ref.path)) === ref.path,
      'audit snapshot path invalid',
    );
    const stat = await lstat(ref.path);
    requireTrue(
      stat.isFile() &&
        !stat.isSymbolicLink() &&
        stat.size <= 1024 * 1024 &&
        Number.isInteger(ref.bytes) &&
        stat.size === ref.bytes &&
        ref.sha256 === input.references.audit.sha256,
      'audit snapshot identity invalid',
    );
    auditSnapshot = await readFile(ref.path);
    requireTrue(
      auditSnapshot.length === ref.bytes &&
        sha256(auditSnapshot) === digest(ref.sha256),
      'audit snapshot digest differs',
    );
  }
  async function capture(ref: Reference) {
    const path = await safePath(root, ref.path);
    requireTrue((await lstat(path)).isFile(), 'reference not file');
    const audit =
      ref.path === input.references.audit.path && auditSnapshot !== undefined;
    if (audit)
      requireTrue(
        (await lstat(path)).size <= 2 * 1024 * 1024,
        'audit append current byte limit exceeded',
      );
    const bytes = await readFile(path);
    if (audit) {
      requireTrue(
        bytes.length <= 2 * 1024 * 1024,
        'audit append current byte limit exceeded',
      );
      appendedEvents = validateAppend(auditSnapshot!, bytes);
      auditCurrent = bytes;
      captured.set(ref.path, bytes);
      return auditSnapshot!;
    }
    requireTrue(
      sha256(bytes) === digest(ref.sha256),
      `reference digest differs: ${ref.path}`,
    );
    captured.set(ref.path, bytes);
    return bytes;
  }
  const names = [
    'receipt',
    'review',
    'audit',
    'sourceStart',
    'sourceEnd',
    'input',
    'checks',
    'formicariumStart',
    'formicariumEnd',
    'legacyStart',
    'legacyEnd',
    'formicariumStats',
    'legacyStats',
  ] as const;
  requireTrue(
    Object.keys(input.references).length === names.length &&
      new Set(names.map((name) => input.references[name]?.path)).size ===
        names.length,
    'reference set differs',
  );
  const raw = Object.fromEntries(
    await Promise.all(
      names.map(
        async (name) => [name, await capture(input.references[name])] as const,
      ),
    ),
  );
  const json = (name: (typeof names)[number]) =>
    JSON.parse(raw[name]!.toString());
  const receipt = json('receipt');
  requireTrue(
    input.references.receipt.path ===
      `${relative(root, input.ownerRecord)}/${RECEIPT}` &&
      receipt.version === 1 &&
      receipt.stage === 'code-generation' &&
      receipt.unit === null &&
      receipt.attempt === '826a9a551ecd3d72' &&
      receipt.iteration === 1 &&
      receipt.reviewer === 'aidlc-architecture-reviewer-agent' &&
      receipt.verdict === 'READY' &&
      receipt.request_id === REQUEST &&
      receipt.source_fingerprint === SOURCE &&
      receipt.findings.every(
        (finding: { status: string }) => finding.status === 'Resolved',
      ),
    'official READY receipt differs',
  );
  requireTrue(
    raw.review!.toString().trim() === receipt.body.trim(),
    'independent review body differs',
  );
  const audit = events(raw.audit!.toString());
  const reviewed = audit.findIndex(
    (e) =>
      e.Event === 'REVIEW_COMPLETED' &&
      e.Stage === 'code-generation' &&
      e['Request Id'] === REQUEST &&
      e.Verdict === 'READY' &&
      e['Source Fingerprint'] === SOURCE &&
      e['Review Record'] === RECEIPT &&
      e['Review Record Digest'] ===
        `sha256:${input.references.receipt.sha256}` &&
      e['Artifact Fingerprint'] === receipt.artifact_fingerprint,
  );
  requireTrue(reviewed >= 0, 'review registration absent');
  let cursor = reviewed;
  for (const stage of ['code-generation', 'build-and-test'])
    for (const event of ['GATE_APPROVED', 'STAGE_COMPLETED']) {
      const index = audit.findIndex(
        (e, i) =>
          i > cursor &&
          e.Event === event &&
          e.Stage === stage &&
          (event !== 'GATE_APPROVED' || e['User Input'] === 'Approve'),
      );
      requireTrue(index >= 0, 'matching stage approval absent');
      cursor = index;
    }
  const start = json('sourceStart'),
    end = json('sourceEnd');
  requireTrue(
    start.inventorySha256 === digest(input.pins.sourceInventorySha256) &&
      end.inventorySha256 === start.inventorySha256 &&
      JSON.stringify(start.files) === JSON.stringify(end.files) &&
      sha256(JSON.stringify(start.files)) === start.inventorySha256,
    'source collection differs',
  );
  await files(root, start.files, 78);
  const supplied = json('input');
  requireTrue(
    supplied.identity.normalizedDescriptorSha256 ===
      digest(input.pins.inputDescriptorSha256),
    'input descriptor differs',
  );
  const sourceBytes = await capture({
    path: supplied.source,
    sha256: supplied.sha256,
  });
  requireTrue(
    JSON.stringify(JSON.parse(sourceBytes.toString())) ===
      JSON.stringify(supplied.identity),
    'input identity reference differs',
  );
  const inputRoot = resolve(supplied.identity.root);
  requireTrue(
    inputRoot === join(root, '.vendor/formicarium-inputs-integration-2'),
    'input root differs',
  );
  await safePath(root, relative(root, inputRoot));
  await files(inputRoot, supplied.identity.files, 16);
  if (input.auditSnapshot)
    requireTrue(
      sha256(await readFile(input.auditSnapshot.path)) ===
        input.auditSnapshot.sha256,
      'audit snapshot drift during acceptance',
    );
  if (auditCurrent)
    requireTrue(
      (
        await readFile(await safePath(root, input.references.audit.path))
      ).equals(auditCurrent),
      'audit reference drift during acceptance',
    );
  requireTrue(
    (await inventory(inputRoot)).filter((row) => row.kind !== 'directory')
      .length === 16,
    'input extra entries',
  );
  for (const [name, count, pin] of [
    ['formicarium', 69, input.pins.formicariumInventorySha256],
    ['legacy', 22, input.pins.legacyInventorySha256],
  ] as const) {
    const before = json(`${name}Start`),
      after = json(`${name}End`);
    unique(after.inventory, count);
    requireTrue(
      before.inventorySha256 === digest(pin) &&
        after.inventorySha256 === pin &&
        sha256(JSON.stringify(after.inventory)) === pin &&
        JSON.stringify(before.inventory) === JSON.stringify(after.inventory) &&
        after.stable === true,
      'candidate snapshot differs',
    );
    requireTrue(
      after.destination === `.vendor/site-${name}-integration-2-bt`,
      'candidate destination differs',
    );
    const candidateRoot = await safePath(root, after.destination);
    const canonical = (rows: Entry[]) =>
      rows
        .map((row) => ({
          path: row.path,
          kind: row.kind,
          ...(row.kind === 'file'
            ? { size: row.size, digest: row.digest }
            : {}),
          ...(row.kind === 'symlink' ? { target: row.target } : {}),
        }))
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    requireTrue(
      JSON.stringify(canonical(await inventory(candidateRoot))) ===
        JSON.stringify(canonical(after.inventory)),
      'candidate inventory differs',
    );
    const stats = json(`${name}Stats`);
    requireTrue(
      stats.expected === (name === 'formicarium' ? 45 : 34) &&
        stats.skipped === (name === 'formicarium' ? 0 : 2) &&
        stats.unexpected === 0 &&
        stats.flaky === 0 &&
        Number.isFinite(stats.duration) &&
        stats.duration > 0,
      'browser stats differ',
    );
  }
  const checks = json('checks') as {
    name: string;
    command: string[];
    cwd: string;
    exit: number;
    log: string;
    logSha256: string;
    started: string;
    finished: string;
  }[];
  requireTrue(
    Array.isArray(checks) &&
      checks.length === 15 &&
      new Set(checks.map((c) => c.name)).size === 15 &&
      new Set(checks.map((c) => c.log)).size === 15,
    'command set differs',
  );
  for (const check of checks) {
    requireTrue(
      check.exit === 0 &&
        check.command.length > 0 &&
        check.command.every(
          (part) => typeof part === 'string' && part.length > 0,
        ) &&
        [root, join(root, 'packages/terrarium')].includes(check.cwd) &&
        Number.isFinite(Date.parse(check.started)) &&
        Date.parse(check.finished) >= Date.parse(check.started),
      'command failed or unbound',
    );
    const cwd =
      check.cwd === root
        ? root
        : await safePath(root, relative(root, check.cwd));
    requireTrue(
      (await lstat(cwd)).isDirectory() && (await realpath(cwd)) === cwd,
      'command cwd invalid',
    );
    await capture({
      path: join(
        dirname(input.references.checks.path),
        safeRelative(check.log),
      ),
      sha256: check.logSha256,
    });
  }
  for (const [path, bytes] of captured)
    requireTrue(
      sha256(await readFile(await safePath(root, path))) === sha256(bytes),
      'reference drift during acceptance',
    );
  await files(root, start.files, 78);
  await files(inputRoot, supplied.identity.files, 16);
  if (input.auditSnapshot) {
    const ref = input.auditSnapshot;
    requireTrue(
      (await realpath(ref.path)) === ref.path &&
        (await lstat(ref.path)).isFile() &&
        (await readFile(ref.path)).equals(auditSnapshot!),
      'audit snapshot drift during acceptance',
    );
  }
  if (auditCurrent)
    requireTrue(
      (
        await readFile(await safePath(root, input.references.audit.path))
      ).equals(auditCurrent),
      'audit reference drift during acceptance',
    );
  const out = resolve(input.out);
  const parent = dirname(out);
  requireTrue(
    (await realpath(parent)) === parent,
    'output parent alias refused',
  );
  await mkdir(out);
  try {
    await mkdir(join(out, 'references'));
    const references = [];
    let index = 0;
    for (const [path, bytes] of captured) {
      const local = `references/${index++}.raw`;
      await writeFile(join(out, local), bytes, { flag: 'wx' });
      requireTrue(
        sha256(await readFile(join(out, local))) === sha256(bytes),
        'capture differs',
      );
      references.push({
        ownerPath: path,
        localPath: local,
        sha256: sha256(bytes),
      });
    }
    if (auditSnapshot) {
      const localPath = `references/${index++}.raw`;
      await writeFile(join(out, localPath), auditSnapshot, { flag: 'wx' });
      requireTrue(
        (await readFile(join(out, localPath))).equals(auditSnapshot),
        'audit snapshot capture differs',
      );
      references.push({
        ownerPath: input.auditSnapshot!.path,
        localPath,
        sha256: sha256(auditSnapshot),
      });
    }
    const result = {
      version: 1,
      intent: INTENT,
      status:
        'accepted pinned external historical observations; no checks executed',
      pins: input.pins,
      references,
      ...(auditSnapshot && auditCurrent
        ? {
            auditVerification: {
              snapshotSha256: sha256(auditSnapshot),
              snapshotBytes: auditSnapshot.length,
              currentSha256: sha256(auditCurrent),
              currentBytes: auditCurrent.length,
              appendSha256: sha256(auditCurrent.subarray(auditSnapshot.length)),
              appendBytes: auditCurrent.length - auditSnapshot.length,
              appendedEvents,
              status:
                'unchanged pinned approval prefix with allowed non-approval append',
            },
          }
        : {}),
    };
    await writeFile(
      join(out, 'acceptance.json'),
      JSON.stringify(result, null, 2),
      { flag: 'wx' },
    );
    return result;
  } catch (error) {
    await rm(out, { recursive: true, force: true });
    throw error;
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const path = process.argv[2];
  requireTrue(path, 'acceptance input JSON required');
  await acceptOwnerResult(JSON.parse(await readFile(path, 'utf8')));
}
