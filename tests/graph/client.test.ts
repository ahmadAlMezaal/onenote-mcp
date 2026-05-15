import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GraphError, graphRequest, paginate } from '../../src/graph/client.js';
import { searchPages, updatePage } from '../../src/graph/pages.js';
import { createNotebook } from '../../src/graph/notebooks.js';
import { createSection } from '../../src/graph/sections.js';

vi.mock('../../src/auth/index.js', () => ({
  getAccessToken: vi.fn(async () => 'fake-access-token'),
}));

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

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

  it('returns undefined for an empty 200 body instead of throwing on JSON.parse', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await graphRequest('/me/onenote/whatever');
    expect(result).toBeUndefined();
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

describe('searchPages', () => {
  it('slices results down to the caller-supplied limit', async () => {
    // Graph's $top is a page size, not a total cap, so paginate may return more
    // than `limit` rows. searchPages should still respect the caller's limit.
    const makePage = (id: string) => ({ id, title: `t${id}` });
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          value: ['1', '2', '3'].map(makePage),
          '@odata.nextLink': 'https://graph.microsoft.com/v1.0/x?$skiptoken=a',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ value: ['4', '5'].map(makePage) }));

    const results = await searchPages({ query: 'hello', limit: 2 });
    expect(results.map((r) => r.id)).toEqual(['1', '2']);
  });
});

describe('updatePage', () => {
  it('PATCHes /content with a JSON command array', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await updatePage('page-123', [
      { target: 'body', action: 'append', content: '<p>hi</p>' },
      { target: '#abc', action: 'delete' },
    ]);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      'https://graph.microsoft.com/v1.0/me/onenote/pages/page-123/content',
    );
    expect((init as RequestInit).method).toBe('PATCH');
    expect((init as RequestInit).headers).toMatchObject({
      'Content-Type': 'application/json',
    });
    // Targets are sent without a leading `#`. The caller's `#abc` becomes `abc`.
    expect(JSON.parse((init as RequestInit).body as string)).toEqual([
      { target: 'body', action: 'append', content: '<p>hi</p>' },
      { target: 'abc', action: 'delete' },
    ]);
  });
});

describe('createNotebook', () => {
  it('POSTs displayName to /me/onenote/notebooks with $select shaping the response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'n1', displayName: 'My Book' }));
    const notebook = await createNotebook('My Book');
    expect(notebook.id).toBe('n1');

    const [url, init] = fetchMock.mock.calls[0]!;
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe('/v1.0/me/onenote/notebooks');
    expect(parsed.searchParams.get('$select')).toContain('isDefault');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      displayName: 'My Book',
    });
  });
});

describe('createSection', () => {
  it('POSTs displayName to the notebook sections endpoint with $select and $expand', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 's1', displayName: 'Work' }));
    const section = await createSection('nb-abc', 'Work');
    expect(section.id).toBe('s1');

    const [url, init] = fetchMock.mock.calls[0]!;
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe('/v1.0/me/onenote/notebooks/nb-abc/sections');
    expect(parsed.searchParams.get('$select')).toContain('parentNotebook');
    expect(parsed.searchParams.get('$expand')).toContain('parentNotebook');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ displayName: 'Work' });
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
