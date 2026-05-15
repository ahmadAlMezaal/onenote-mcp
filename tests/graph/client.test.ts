import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GraphError, graphRequest, paginate } from '../../src/graph/client.js';

vi.mock('../../src/auth/index.js', () => ({
  getAccessToken: vi.fn(async () => 'fake-access-token'),
}));

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('graphRequest', () => {
  it('sends Authorization header and parses JSON', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ value: [{ id: 'a' }] }));
    const result = await graphRequest<{ value: { id: string }[] }>('/me/onenote/notebooks');
    expect(result.value[0]?.id).toBe('a');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://graph.microsoft.com/v1.0/me/onenote/notebooks');
    expect((init as RequestInit).method).toBe('GET');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer fake-access-token',
      Accept: 'application/json',
    });
  });

  it('appends query params and skips undefined values', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    await graphRequest('/x', { query: { $top: 5, foo: undefined, $search: '"hi"' } });
    const [url] = fetchMock.mock.calls[0]!;
    const parsed = new URL(String(url));
    expect(parsed.searchParams.get('$top')).toBe('5');
    expect(parsed.searchParams.has('foo')).toBe(false);
    expect(parsed.searchParams.get('$search')).toBe('"hi"');
  });

  it('returns text when parse=text', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('<html>hi</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    );
    const html = await graphRequest<string>('/me/onenote/pages/p1/content', {
      accept: 'text/html',
      parse: 'text',
    });
    expect(html).toBe('<html>hi</html>');
  });

  it('returns undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const result = await graphRequest('/me/onenote/pages/p1', {
      method: 'DELETE',
      parse: 'none',
    });
    expect(result).toBeUndefined();
  });

  it('retries on 429 then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response('{"error":{"code":"TooManyRequests","message":"slow down"}}', {
          status: 429,
          headers: { 'Retry-After': '0', 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await graphRequest<{ ok: boolean }>('/x');
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws a shaped GraphError on a non-retryable error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: 'NotFound', message: 'no such page' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    await expect(graphRequest('/me/onenote/pages/missing')).rejects.toMatchObject({
      name: 'GraphError',
      status: 404,
      code: 'NotFound',
      message: 'no such page',
    });
  });

  it('GraphError survives non-JSON error bodies', async () => {
    fetchMock.mockResolvedValueOnce(new Response('plain text error', { status: 400 }));
    const err = await graphRequest('/x').catch((e) => e as GraphError);
    expect(err).toBeInstanceOf(GraphError);
    expect(err.status).toBe(400);
    expect(err.message).toContain('plain text error');
  });
});

describe('paginate', () => {
  it('follows @odata.nextLink until exhausted', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          value: [{ id: '1' }, { id: '2' }],
          '@odata.nextLink': 'https://graph.microsoft.com/v1.0/x?$skiptoken=abc',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ value: [{ id: '3' }] }));

    const results = await paginate<{ id: string }>('/x');
    expect(results.map((r) => r.id)).toEqual(['1', '2', '3']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
