#!/usr/bin/env node
import { login, logout } from './auth/index.js';
import { runServer, SERVER_VERSION } from './index.js';

const HELP = `onenote-mcp v${SERVER_VERSION}

Usage:
  onenote-mcp                Run the MCP server over stdio (default).
  onenote-mcp login          Sign in via Microsoft device-code flow and
                             cache the refresh token at
                             ~/.config/onenote-mcp/tokens.json.
  onenote-mcp logout         Remove cached tokens and sign out.
  onenote-mcp --help         Show this help.
  onenote-mcp --version      Print the version.

Environment:
  ONENOTE_MCP_CLIENT_ID      (required) Application (client) ID of your
                             Microsoft Entra app registration.
  ONENOTE_MCP_TENANT_ID      (optional) Tenant ID; defaults to /common
                             which works for personal + work accounts.
  XDG_CONFIG_HOME            (optional) Override the config directory.
`;

function fail(message: string, exitCode = 1): never {
  process.stderr.write(`error: ${message}\n`);
  process.exit(exitCode);
}

async function cmdLogin(): Promise<void> {
  const account = await login(({ message }) => {
    process.stdout.write(`${message}\n`);
  });
  process.stdout.write(`\nSigned in as ${account.username}.\n`);
}

async function cmdLogout(): Promise<void> {
  await logout();
  process.stdout.write('Signed out. Cached tokens removed.\n');
}

async function main(): Promise<void> {
  const [, , subcommand, ...rest] = process.argv;

  if (rest.length > 0) {
    fail(`unexpected arguments: ${rest.join(' ')}`);
  }

  switch (subcommand) {
    case undefined:
    case 'serve':
      await runServer();
      return;
    case 'login':
      await cmdLogin();
      return;
    case 'logout':
      await cmdLogout();
      return;
    case '-h':
    case '--help':
    case 'help':
      process.stdout.write(HELP);
      return;
    case '-v':
    case '--version':
      process.stdout.write(`${SERVER_VERSION}\n`);
      return;
    default:
      fail(`unknown subcommand: ${subcommand}\n\n${HELP}`);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  fail(message);
});
