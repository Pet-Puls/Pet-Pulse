import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function worker() {
  const handlers = new Map<string, (event: never) => void>();
  const cache = { add: vi.fn().mockResolvedValue(undefined), match: vi.fn() };
  const caches = { open: vi.fn().mockResolvedValue(cache), keys: vi.fn(), delete: vi.fn() };
  const fetch = vi.fn();
  const self = {
    registration: { scope: 'https://example.test/app/' },
    location: { origin: 'https://example.test' },
    addEventListener: (type: string, handler: (event: never) => void) => handlers.set(type, handler),
  };
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    self, caches, fetch, URL, Promise, Error,
  });
  return { handlers, cache, fetch };
}

describe('offline service worker', () => {
  it('caches only the static offline page during installation', async () => {
    const { handlers, cache } = worker();
    let task: Promise<void> | undefined;
    handlers.get('install')?.({ waitUntil: (promise: Promise<void>) => { task = promise; } } as never);
    await task;
    expect(cache.add).toHaveBeenCalledOnce();
    expect(cache.add).toHaveBeenCalledWith('https://example.test/app/offline.html');
  });

  it('uses the offline page for failed navigations but does not intercept API requests', async () => {
    const { handlers, cache, fetch } = worker();
    const fallback = { status: 200 };
    cache.match.mockResolvedValue(fallback);
    fetch.mockRejectedValue(new Error('offline'));
    const respondWith = vi.fn();
    const handler = handlers.get('fetch');
    handler?.({ request: { mode: 'cors', url: 'https://example.test/api/me' }, respondWith } as never);
    expect(respondWith).not.toHaveBeenCalled();
    handler?.({ request: { mode: 'navigate', url: 'https://example.test/app/workspace/pets' }, respondWith } as never);
    expect(await respondWith.mock.calls[0][0]).toBe(fallback);
    expect(cache.match).toHaveBeenCalledWith('https://example.test/app/offline.html');
  });
});
