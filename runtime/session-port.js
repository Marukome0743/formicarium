import { invalid } from './errors.js';
const ports = new WeakMap();
export function bindSessionPort(session, port) {
    ports.set(session, Object.freeze(port));
}
export function sessionPort(session) {
    const port = ports.get(session);
    invalid(port !== undefined, 'session belongs to another package or is forged');
    return port;
}
//# sourceMappingURL=session-port.js.map