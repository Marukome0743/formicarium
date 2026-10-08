self.onmessage = (event: MessageEvent<{ type?: string }>) => {
  if (event.data?.type !== 'run') return;
  self.postMessage({ type: 'formicarium-test-cpu-ready' });
  while (true) {
    /* Real CPU-bound execution; only Worker termination can release it. */
  }
};
