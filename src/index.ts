import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAllTools } from './tools/index.js';

// Read from package.json so the reported version can't drift from the release.
// `../package.json` resolves to the package root from both src/ and dist/.
const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

export const SERVER_NAME = 'onenote-mcp';
export const SERVER_VERSION = version;

export const createServer = (): McpServer => {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });
  registerAllTools(server);
  return server;
};

export const runServer = async (): Promise<void> => {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
};
