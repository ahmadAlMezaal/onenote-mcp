import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { SERVER_VERSION } from '@/index.js';

describe('SERVER_VERSION', () => {
  it('matches the version in package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    expect(SERVER_VERSION).toBe(pkg.version);
  });
});
