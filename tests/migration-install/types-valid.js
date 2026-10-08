import { createInstaller } from '@aletheia-works/formicarium';
const catalog = {
    schemaVersion: 1,
    catalogId: 'caller',
    defaults: { [entry.tool]: entry.versionOrName },
    entries: [entry],
    extension: true,
};
const installer = createInstaller(session, catalog);
const result = installer.install('tool@fixed', {
    signal: new AbortController().signal,
    onProgress(progress) {
        const total = progress.totalBytes;
        void total;
    },
});
void result;
//# sourceMappingURL=types-valid.js.map