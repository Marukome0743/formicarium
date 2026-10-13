import type { RunOptions, RunResult, Session } from '../types/index.js';
import type { GuestHandle } from './guest-validation.js';
import { invalid } from './errors.js';
export interface Reservation {
  readonly token: symbol;
  readonly epoch: number;
  readonly operationId: string;
  readonly signal: AbortSignal;
}
export interface BuiltinResult {
  kind: 'builtin';
  exitCode: number;
  stdout: Uint8Array;
  stderr: Uint8Array;
}
export interface SessionPort {
  acquire(kind: 'run' | 'install' | 'fs'): Promise<Reservation>;
  commitGuest(
    reservation: Reservation,
    tool: string,
    guest: GuestHandle,
  ): Promise<void>;
  runInstalled(
    reservation: Reservation,
    tool: string,
    args: readonly string[],
    options: Omit<RunOptions, 'guest' | 'args'>,
  ): Promise<RunResult>;
  builtin(
    reservation: Reservation,
    argv: readonly string[],
  ): Promise<BuiltinResult>;
  release(reservation: Reservation): Promise<void>;
}
const ports = new WeakMap<Session, SessionPort>();
export function bindSessionPort(session: Session, port: SessionPort): void {
  ports.set(session, Object.freeze(port));
}
export function sessionPort(session: Session): SessionPort {
  const port = ports.get(session);
  invalid(
    port !== undefined,
    'session belongs to another package or is forged',
  );
  return port;
}
