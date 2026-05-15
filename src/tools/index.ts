import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { register as registerListNotebooks } from './listNotebooks.js';
import { register as registerListSections } from './listSections.js';
import { register as registerSearchPages } from './searchPages.js';
import { register as registerReadPage } from './readPage.js';
import { register as registerCreatePage } from './createPage.js';
import { register as registerDeletePage } from './deletePage.js';

export const registerAllTools = (server: McpServer): void => {
  registerListNotebooks(server);
  registerListSections(server);
  registerSearchPages(server);
  registerReadPage(server);
  registerCreatePage(server);
  registerDeletePage(server);
};
