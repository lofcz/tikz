export const TIKZ_MAX_SOURCE = 12_000;
const aborted = () => new DOMException('TikZ rendering aborted', 'AbortError');

/** A lazy, reusable worker. TeX never runs on the UI thread. */
export function createTikzRenderer(options) {
  const { assetBaseUrl, timeoutMs = 30_000, loadTimeoutMs = 60_000,
    maxQueue = 8, maxSourceLength = TIKZ_MAX_SOURCE, maxOutputBytes = 4_000_000 } = options ?? {};
  if (!assetBaseUrl) throw new TypeError('TikZ assetBaseUrl is required');
  for (const [name, value] of Object.entries({ timeoutMs, loadTimeoutMs, maxQueue, maxSourceLength, maxOutputBytes }))
    if (!Number.isSafeInteger(value) || value < (name === 'maxQueue' ? 0 : 1)) throw new TypeError(`Invalid TikZ ${name}`);
  let worker, ready = false, active, disposed = false;
  const queue = [];
  function stop() { worker?.terminate(); worker = undefined; ready = false; }
  function finish(error, image) {
    const job = active; if (!job) return;
    active = undefined; clearTimeout(job.timer); job.signal?.removeEventListener('abort', job.abort);
    if (error) { stop(); job.reject(error); } else job.resolve(image);
    pump();
  }
  function execute() {
    if (!active) return;
    clearTimeout(active.timer);
    active.timer = setTimeout(() => finish(new Error('TikZ execution timed out; simplify or split the picture.')), timeoutMs);
    worker.postMessage({ source: active.source, maxOutputBytes });
  }
  function pump() {
    if (active || disposed || !queue.length) return;
    active = queue.shift(); clearTimeout(active.timer);
    if (ready) { execute(); return; }
    active.timer = setTimeout(() => finish(new Error('TikZ runtime loading timed out.')), loadTimeoutMs);
    try {
      worker = new Worker(new URL('dist/browser-worker.js', new URL(assetBaseUrl, location.href)), { type: 'module', name: 'tikz' });
      worker.onmessage = ({ data }) => {
        if (data.ready) { ready = true; execute(); }
        else if (data.error) finish(new Error(data.error));
        else if (data.image) finish(undefined, data.image);
      };
      worker.onerror = event => { event.preventDefault(); finish(new Error(event.message || 'TikZ worker failed')); };
      worker.onmessageerror = () => finish(new Error('Invalid TikZ worker response'));
    } catch (error) { finish(error); }
  }
  return {
    render(source, { signal } = {}) {
      if (disposed) return Promise.reject(new Error('TikZ renderer disposed'));
      if (signal?.aborted) return Promise.reject(aborted());
      if (typeof source !== 'string' || !source.trim() || source.length > maxSourceLength)
        return Promise.reject(new Error(`TikZ: use 1–${maxSourceLength.toLocaleString('en-US')} characters.`));
      if (active && queue.length >= maxQueue) return Promise.reject(new Error('TikZ renderer busy; retry shortly.'));
      return new Promise((resolve, reject) => {
        const job = { source, signal, resolve, reject, timer: undefined, abort: undefined };
        const remove = error => {
          if (active === job) { finish(error); return; }
          const index = queue.indexOf(job); if (index < 0) return;
          queue.splice(index, 1); clearTimeout(job.timer); signal?.removeEventListener('abort', job.abort); reject(error);
        };
        job.abort = () => remove(aborted());
        signal?.addEventListener('abort', job.abort, { once: true });
        job.timer = setTimeout(() => remove(new Error('TikZ queue wait timed out')), loadTimeoutMs + timeoutMs);
        queue.push(job); pump();
      });
    },
    dispose() {
      disposed = true;
      finish(new Error('TikZ renderer disposed')); stop();
      for (const job of queue.splice(0)) { clearTimeout(job.timer); job.signal?.removeEventListener('abort', job.abort); job.reject(new Error('TikZ renderer disposed')); }
    },
  };
}
