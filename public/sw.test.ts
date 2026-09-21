import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

type RequestLike = {
  method: string;
  mode: string;
  url: string;
};

type FetchEventLike = {
  request: RequestLike;
  respondWith: ReturnType<typeof vi.fn>;
};

type FetchListener = (event: FetchEventLike) => void;

function loadServiceWorker() {
  const listeners: Record<string, (event: unknown) => void> = {};
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    clone: vi.fn().mockReturnValue({}),
  });
  const cachesMock = {
    match: vi.fn().mockResolvedValue({}),
    open: vi.fn().mockResolvedValue({
      addAll: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
    }),
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true),
  };

  runInNewContext(readFileSync(new URL('./sw.js', import.meta.url), 'utf8'), {
    URL,
    fetch: fetchMock,
    caches: cachesMock,
    self: {
      location: { origin: 'https://financeiro.local' },
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn().mockResolvedValue(undefined) },
      addEventListener: (name: string, listener: (event: unknown) => void) => {
        listeners[name] = listener;
      },
    },
  });

  const fetchListener = listeners.fetch as FetchListener | undefined;
  if (!fetchListener) throw new Error('O service worker não registrou o evento fetch');

  return { fetchListener, fetchMock };
}

function dispatch(fetchListener: FetchListener, request: RequestLike) {
  const event: FetchEventLike = { request, respondWith: vi.fn() };
  fetchListener(event);
  return event;
}

describe('política de cache do service worker', () => {
  it('não intercepta requisições externas, incluindo APIs autenticadas', () => {
    const { fetchListener, fetchMock } = loadServiceWorker();
    const event = dispatch(fetchListener, {
      method: 'GET',
      mode: 'cors',
      url: 'https://projeto.supabase.co/rest/v1/receitas',
    });

    expect(event.respondWith).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('não intercepta endpoints locais que não sejam arquivos estáticos', () => {
    const { fetchListener } = loadServiceWorker();
    const event = dispatch(fetchListener, {
      method: 'GET',
      mode: 'cors',
      url: 'https://financeiro.local/api/receitas',
    });

    expect(event.respondWith).not.toHaveBeenCalled();
  });

  it('não intercepta requisições que alteram dados', () => {
    const { fetchListener } = loadServiceWorker();
    const event = dispatch(fetchListener, {
      method: 'POST',
      mode: 'cors',
      url: 'https://financeiro.local/_next/static/chunk.js',
    });

    expect(event.respondWith).not.toHaveBeenCalled();
  });

  it('intercepta somente os arquivos estáticos locais permitidos', () => {
    const { fetchListener } = loadServiceWorker();
    const event = dispatch(fetchListener, {
      method: 'GET',
      mode: 'cors',
      url: 'https://financeiro.local/_next/static/chunk.js',
    });

    expect(event.respondWith).toHaveBeenCalledOnce();
  });

  it('mantém navegação local com fallback offline', () => {
    const { fetchListener } = loadServiceWorker();
    const event = dispatch(fetchListener, {
      method: 'GET',
      mode: 'navigate',
      url: 'https://financeiro.local/',
    });

    expect(event.respondWith).toHaveBeenCalledOnce();
  });
});
