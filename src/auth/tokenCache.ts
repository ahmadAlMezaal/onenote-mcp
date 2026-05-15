import { mkdir, readFile, writeFile, chmod, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ICachePlugin, TokenCacheContext } from '@azure/msal-node';
import { getTokenCachePath } from '../config.js';

const FILE_MODE = 0o600;
const DIR_MODE = 0o700;

const ensureSecureFile = async (path: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true, mode: DIR_MODE });
  try {
    await stat(path);
    await chmod(path, FILE_MODE);
  } catch {
    // File doesn't exist yet — it'll be created with FILE_MODE on write.
  }
};

const readCacheFile = async (path: string): Promise<string> => {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw err;
  }
};

const writeCacheFile = async (path: string, contents: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true, mode: DIR_MODE });
  await writeFile(path, contents, { encoding: 'utf8', mode: FILE_MODE });
  await chmod(path, FILE_MODE);
};

export const createFileCachePlugin = (
  path: string = getTokenCachePath(),
): ICachePlugin => ({
  beforeCacheAccess: async (context: TokenCacheContext): Promise<void> => {
    await ensureSecureFile(path);
    const data = await readCacheFile(path);
    if (data.length > 0) {
      context.tokenCache.deserialize(data);
    }
  },
  afterCacheAccess: async (context: TokenCacheContext): Promise<void> => {
    if (context.cacheHasChanged) {
      await writeCacheFile(path, context.tokenCache.serialize());
    }
  },
});
