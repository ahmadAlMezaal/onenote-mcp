import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFileCachePlugin } from '../src/auth/tokenCache.js';

const makeContext = (initial: string) => {
  let serialized = initial;
  return {
    cacheHasChanged: false,
    tokenCache: {
      deserialize: (data: string): void => {
        serialized = data;
      },
      serialize: (): string => serialized,
    },
    setSerialized: (value: string): void => {
      serialized = value;
    },
    getSerialized: (): string => serialized,
  };
};

describe('createFileCachePlugin', () => {
  let dir: string;
  let path: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'onenote-mcp-test-'));
    path = join(dir, 'nested', 'tokens.json');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes the cache file with mode 600', async () => {
    const plugin = createFileCachePlugin(path);
    const ctx = makeContext('{"hello":"world"}');
    ctx.cacheHasChanged = true;
    await plugin.afterCacheAccess(ctx as never);

    const stats = await stat(path);
    // Mask off file-type bits.
    expect(stats.mode & 0o777).toBe(0o600);
    expect(await readFile(path, 'utf8')).toBe('{"hello":"world"}');
  });

  it('round-trips through beforeCacheAccess', async () => {
    const plugin = createFileCachePlugin(path);
    const writeCtx = makeContext('{"token":"abc"}');
    writeCtx.cacheHasChanged = true;
    await plugin.afterCacheAccess(writeCtx as never);

    const readCtx = makeContext('');
    await plugin.beforeCacheAccess(readCtx as never);
    expect(readCtx.getSerialized()).toBe('{"token":"abc"}');
  });

  it('treats a missing cache file as empty', async () => {
    const plugin = createFileCachePlugin(path);
    const ctx = makeContext('preset');
    await plugin.beforeCacheAccess(ctx as never);
    // No deserialize call when file is missing — preset value remains.
    expect(ctx.getSerialized()).toBe('preset');
  });

  it('does not write when cacheHasChanged is false', async () => {
    const plugin = createFileCachePlugin(path);
    const ctx = makeContext('{"x":1}');
    ctx.cacheHasChanged = false;
    await plugin.afterCacheAccess(ctx as never);
    await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
