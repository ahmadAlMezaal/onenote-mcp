import { marked } from 'marked';
import TurndownService from 'turndown';

marked.setOptions({ gfm: true, breaks: false });

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
});

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Convert Markdown into a full HTML document suitable for the OneNote
 * `POST /sections/{id}/pages` endpoint, which expects an XHTML page with
 * <html>, <head><title>…</title></head>, and <body>.
 */
export function markdownToOneNoteHtml(markdown: string, title: string): string {
  const bodyHtml = marked.parse(markdown, { async: false }) as string;
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html>
  <head>
    <title>${safeTitle}</title>
    <meta name="created" content="${new Date().toISOString()}" />
  </head>
  <body>
${bodyHtml}
  </body>
</html>`;
}

/**
 * Wrap raw HTML body content in a OneNote-compatible page document.
 * Idempotent: if `html` already contains <html>…</html>, returns it unchanged.
 */
export function htmlToOneNotePage(html: string, title: string): string {
  if (/<html[\s>]/i.test(html)) return html;
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html>
  <head>
    <title>${safeTitle}</title>
    <meta name="created" content="${new Date().toISOString()}" />
  </head>
  <body>
${html}
  </body>
</html>`;
}

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}
