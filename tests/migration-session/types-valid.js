import { validateGuest, fixtureToFsEntries, runValidatedGuest, registerValidatedGuest, } from '@aletheia-works/formicarium';
const handle = validateGuest(new Uint8Array(), expected);
const entries = fixtureToFsEntries([
    {
        path: '/work/a',
        type: 'file',
        mode: 420,
        inodeId: 'a',
        data: new Uint8Array(),
    },
]);
const result = runValidatedGuest(session, handle, {
    args: ['--version'],
    signal: new AbortController().signal,
});
const registered = registerValidatedGuest(session, 'tool', handle, { signal: new AbortController().signal });
void entries;
void result;
void registered;
//# sourceMappingURL=types-valid.js.map