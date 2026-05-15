import { mkdir, readFile, writeFile, chmod, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ICachePlugin, TokenCacheContext } from '@azure/msal-node';
import { getTokenCachePath } from '../config.js';

const FILE_MODE = 0o600;
const DIR_MODE = 0o700;

async function ensureSecureFile(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: DIR_MODE });
  try {
    await stat(path);
    await chmod(path, FILE_MODE);
  } catch {
    // File doesn't exist yet — it'll be created with FILE_MODE on write.
  }
}

async function readCacheFile(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw err;
  }
}

async function writeCacheFile(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: DIR_MODE });
  await writeFile(path, contents, { encoding: 'utf8', mode: FILE_MODE });
  await chmod(path, FILE_MODE);
}

export function createFileCachePlugin(path: string = getTokenCachePath()): ICachePlugin {
  return {
    async beforeCacheAccess(context: TokenCacheContext): Promise<void> {
      await ensureSecureFile(path);
      const data = await readCacheFile(path);
      if (data.length > 0) {
        context.tokenCache.deserialize(data);
      }
    },
    async afterCacheAccess(context: TokenCacheContext): Promise<void> {
      if (context.cacheHasChanged) {
        await writeCacheFile(path, context.tokenCache.serialize());
      }
    },
  };
}
