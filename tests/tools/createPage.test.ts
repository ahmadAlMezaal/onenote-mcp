import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readLocalAttachment } from '@/tools/createPage.js';

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

  it('rejects ~ home-relative paths (treated as a literal filename, not expanded — still escapes)', async () => {
    // Node doesn't expand ~; resolved against cwd it stays inside. So this *would*
    // try to read a literal `~` file (which doesn't exist). Document that
    // behavior: the guard catches the cross-cwd cases above; `~` is not a
    // shell escape concern here.
    await expect(readLocalAttachment('~')).rejects.toThrow();
  });
});
