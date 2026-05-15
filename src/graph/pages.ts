import { graphRequest, paginate } from './client.js';
import type { Page } from './types.js';

const PAGE_SELECT =
  'id,title,createdDateTime,lastModifiedDateTime,contentUrl,parentSection,parentNotebook,links';

const PAGE_EXPAND =
  'parentSection($select=id,displayName),parentNotebook($select=id,displayName)';

export interface SearchPagesOptions {
  query: string;
  limit?: number;
}

export async function searchPages(options: SearchPagesOptions): Promise<Page[]> {
  const { query, limit = 25 } = options;
  // Graph's $search on /me/onenote/pages does a server-side full-text match on
  // page title + content. Quoting the term keeps it safe across odata.
  const escaped = query.replace(/"/g, '\\"');
  const top = Math.max(1, Math.min(limit, 100));
  const pages = await paginate<Page>('/me/onenote/pages', {
    query: {
      $search: `"${escaped}"`,
      $select: PAGE_SELECT,
      $expand: PAGE_EXPAND,
      $top: top,
    },
  });
  // $top is a page size, not a total cap — paginate follows nextLinks until exhausted.
  return pages.slice(0, limit);
}

export async function getPage(pageId: string): Promise<Page> {
  return graphRequest<Page>(`/me/onenote/pages/${encodeURIComponent(pageId)}`, {
    query: {
      $select: PAGE_SELECT,
      $expand: PAGE_EXPAND,
    },
  });
}

export async function getPageContent(pageId: string): Promise<string> {
  return graphRequest<string>(`/me/onenote/pages/${encodeURIComponent(pageId)}/content`, {
    accept: 'text/html',
    parse: 'text',
  });
}

export interface CreatePageOptions {
  sectionId: string;
  /** Full HTML document including <html><head><title>…</title></head><body>…</body></html>. */
  html: string;
}

export async function createPage(options: CreatePageOptions): Promise<Page> {
  const { sectionId, html } = options;
  return graphRequest<Page>(
    `/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/xhtml+xml' },
      body: html,
    },
  );
}

export async function deletePage(pageId: string): Promise<void> {
  await graphRequest<void>(`/me/onenote/pages/${encodeURIComponent(pageId)}`, {
    method: 'DELETE',
    parse: 'none',
  });
}
