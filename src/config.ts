import { homedir } from 'node:os';
import { join } from 'node:path';

export const SCOPES = ['Notes.ReadWrite', 'offline_access'] as const;

export const AUTHORITY = 'https://login.microsoftonline.com/common';

export const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

export const CLIENT_ID_ENV = 'ONENOTE_MCP_CLIENT_ID';

export const TENANT_ID_ENV = 'ONENOTE_MCP_TENANT_ID';

const APP_DIR_NAME = 'onenote-mcp';

const TOKEN_CACHE_FILENAME = 'tokens.json';

export const getConfigDir = (): string => {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), '.config');
  return join(base, APP_DIR_NAME);
};

export const getTokenCachePath = (): string => join(getConfigDir(), TOKEN_CACHE_FILENAME);

export const getClientId = (): string => {
  const id = process.env[CLIENT_ID_ENV];
  if (!id || id.trim().length === 0) {
    throw new Error(
      `Missing ${CLIENT_ID_ENV}. Set it to the Application (client) ID of your Microsoft Entra app registration. See README for setup steps.`,
    );
  }
  return id.trim();
};

export const getAuthority = (): string => {
  const tenant = process.env[TENANT_ID_ENV]?.trim();
  if (tenant && tenant.length > 0) {
    return `https://login.microsoftonline.com/${tenant}`;
  }
  return AUTHORITY;
};
