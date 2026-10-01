import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

vi.mock('../../src/graph/pages.js', () => ({
  createPage: vi.fn(),
}));

import { createPage } from '@/graph/pages.js';
import { readLocalAttachment, register } from '@/tools/createPage.js';

type ToolResult = { content: { type: string; text: string }[] };
type ToolHandler = (input: Record<string, unknown>) => Promise<ToolResult>;

const captureTool = (): { handler: ToolHandler; schema: z.ZodObject } => {
  let handler: ToolHandler | undefined;
  let shape: z.ZodRawShape | undefined;
  const mockServer = {
    registerTool: (_name: string, meta: { inputSchema: z.ZodRawShape }, cb: ToolHandler) => {
      shape = meta.inputSchema;
      handler = cb;
    },
  } as unknown as McpServer;
  register(mockServer);
  return { handler: handler!, schema: z.object(shape!) };
};

const baseInput = { sectionId: 'sec-1', title: 'T', content: 'body' };

describe('readLocalAttachment', () => {
  let dir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    dir = await mkdtemp(join(tmpdir(), 'onenote-mcp-attach-'));
    process.chdir(dir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(dir, { recursive: true, force: true });
  });

  it('reads a file inside cwd', async () => {
    await writeFile('inside.bin', Buffer.from([1, 2, 3]));
    const bytes = await readLocalAttachment('inside.bin');
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it('rejects relative path traversal (..)', async () => {
    await expect(readLocalAttachment('../escape.bin')).rejects.toThrow(
      /outside the working directory/,
    );
  });

  it('rejects absolute paths outside cwd', async () => {
    await expect(readLocalAttachment('/etc/passwd')).rejects.toThrow(
      /outside the working directory/,
    );
  });

  it('allows files whose names start with two dots (not a traversal)', async () => {
    await writeFile('..dotfile', Buffer.from([7, 8]));
    const bytes = await readLocalAttachment('..dotfile');
    expect(Array.from(bytes)).toEqual([7, 8]);
  });

  it('rejects a symlink inside cwd whose target escapes cwd', async () => {
    await writeFile(join(dir, 'secret-outside.bin'), Buffer.from([9]));
    const sandbox = join(dir, 'sandbox');
    await mkdir(sandbox);
    process.chdir(sandbox);
    await symlink(join(dir, 'secret-outside.bin'), join(sandbox, 'link.bin'));

    await expect(readLocalAttachment('link.bin')).rejects.toThrow(
      /outside the working directory/,
    );
  });

  it('still reads a symlink whose target stays inside cwd', async () => {
    await writeFile('target.bin', Buffer.from([4, 5]));
    await symlink(join(process.cwd(), 'target.bin'), join(process.cwd(), 'alias.bin'));

    const bytes = await readLocalAttachment('alias.bin');
    expect(Array.from(bytes)).toEqual([4, 5]);
  });

  it('rejects ~ home-relative paths (treated as a literal filename, not expanded — still escapes)', async () => {
    // Node doesn't expand ~; resolved against cwd it stays inside. So this *would*
    // try to read a literal `~` file (which doesn't exist). Document that
    // behavior: the guard catches the cross-cwd cases above; `~` is not a
    // shell escape concern here.
    await expect(readLocalAttachment('~')).rejects.toThrow();
  });
});

describe('create_page input schema', () => {
  const { schema } = captureTool();
  const parseAttachment = (attachment: Record<string, unknown>) =>
    schema.safeParse({ ...baseInput, attachments: [attachment] });

  it('defaults format to markdown', () => {
    const parsed = schema.parse(baseInput);
    expect(parsed.format).toBe('markdown');
  });

  it.each([
    ['data only', { name: 'img1', contentType: 'image/png', data: 'AQID' }],
    ['path only', { name: 'file.v2_final-1', contentType: 'application/pdf', path: 'a.pdf' }],
    ['padded base64', { name: 'x', contentType: 'text/plain', data: 'aGk=' }],
  ])('accepts an attachment with %s', (_label, attachment) => {
    expect(parseAttachment(attachment).success).toBe(true);
  });

  it.each([
    ['both path and data', { name: 'x', contentType: 'image/png', path: 'a.png', data: 'AQID' }],
    ['neither path nor data', { name: 'x', contentType: 'image/png' }],
    ['a name with spaces', { name: 'my image', contentType: 'image/png', data: 'AQID' }],
    ['a name with a slash', { name: '../x', contentType: 'image/png', data: 'AQID' }],
    ['a name with a colon', { name: 'name:x', contentType: 'image/png', data: 'AQID' }],
    ['an empty content type', { name: 'x', contentType: '', data: 'AQID' }],
    ['non-base64 data', { name: 'x', contentType: 'image/png', data: 'not base64!' }],
    ['unpadded base64 of the wrong length', { name: 'x', contentType: 'image/png', data: 'AQI' }],
    ['base64 with embedded whitespace', { name: 'x', contentType: 'image/png', data: 'AQ ID' }],
  ])('rejects an attachment with %s', (_label, attachment) => {
    expect(parseAttachment(attachment).success).toBe(false);
  });

  it('reports the exactly-one-of error on the path field', () => {
    const result = parseAttachment({ name: 'x', contentType: 'image/png' });
    expect(result.success).toBe(false);
    const issue = result.error!.issues[0]!;
    expect(issue.path).toEqual(['attachments', 0, 'path']);
    expect(issue.message).toMatch(/exactly one of `path` or `data`/);
  });
});

describe('create_page handler attachments', () => {
  let dir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    dir = await mkdtemp(join(tmpdir(), 'onenote-mcp-handler-'));
    process.chdir(dir);
    vi.mocked(createPage).mockReset();
    vi.mocked(createPage).mockResolvedValue({
      id: 'page-1',
      title: 'T',
      createdDateTime: '2024-01-01T00:00:00Z',
      links: { oneNoteWebUrl: { href: 'https://onenote.com/page-1' } },
    } as Awaited<ReturnType<typeof createPage>>);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(dir, { recursive: true, force: true });
  });

  it('decodes base64 data and loads path attachments, preserving order', async () => {
    await writeFile('doc.pdf', Buffer.from([10, 20, 30]));
    const { handler } = captureTool();

    const raw = await handler({
      ...baseInput,
      format: 'markdown',
      attachments: [
        { name: 'img1', contentType: 'image/png', data: Buffer.from([1, 2, 3, 255]).toString('base64') },
        { name: 'file1', contentType: 'application/pdf', path: 'doc.pdf' },
      ],
    });

    const call = vi.mocked(createPage).mock.calls[0]![0];
    expect(call.sectionId).toBe('sec-1');
    expect(call.attachments).toHaveLength(2);
    expect(call.attachments![0]!.name).toBe('img1');
    expect(call.attachments![0]!.contentType).toBe('image/png');
    expect(Array.from(call.attachments![0]!.data)).toEqual([1, 2, 3, 255]);
    expect(call.attachments![1]!.name).toBe('file1');
    expect(Array.from(call.attachments![1]!.data)).toEqual([10, 20, 30]);

    expect(JSON.parse(raw.content[0]!.text)).toEqual({
      id: 'page-1',
      title: 'T',
      createdDateTime: '2024-01-01T00:00:00Z',
      webUrl: 'https://onenote.com/page-1',
      attachmentCount: 2,
    });
  });

  it('passes no attachments when given an empty array', async () => {
    const { handler } = captureTool();
    const raw = await handler({ ...baseInput, format: 'markdown', attachments: [] });

    expect(vi.mocked(createPage).mock.calls[0]![0].attachments).toBeUndefined();
    expect(JSON.parse(raw.content[0]!.text).attachmentCount).toBe(0);
  });

  it('refuses to create the page when an attachment path escapes cwd', async () => {
    const { handler } = captureTool();

    await expect(
      handler({
        ...baseInput,
        format: 'markdown',
        attachments: [{ name: 'secret', contentType: 'text/plain', path: '../../etc/passwd' }],
      }),
    ).rejects.toThrow(/outside the working directory/);
    expect(createPage).not.toHaveBeenCalled();
  });

  it('sends HTML content through as a OneNote page document', async () => {
    const { handler } = captureTool();
    await handler({ ...baseInput, title: 'Doc', content: '<p>hi</p>', format: 'html' });

    const { html } = vi.mocked(createPage).mock.calls[0]![0];
    expect(html).toContain('<title>Doc</title>');
    expect(html).toContain('<p>hi</p>');
  });
});
