import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createSection } from '../graph/sections.js';

const inputSchema = {
  notebookId: z.string().min(1).describe('Notebook ID to create the section in.'),
  name: z
    .string()
    .min(1)
    .describe(
      "Display name for the new section. Microsoft Graph disallows the reserved characters ?*\\/:<>|&#'\"%~ and requires uniqueness within the notebook.",
    ),
};

export const register = (server: McpServer): void => {
  server.registerTool(
    'create_section',
    {
      title: 'Create Section',
      description: 'Creates a new section inside the given notebook.',
      inputSchema,
    },
    async ({ notebookId, name }) => {
      const section = await createSection(notebookId, name);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                id: section.id,
                name: section.displayName,
                notebook: section.parentNotebook?.displayName,
                notebookId: section.parentNotebook?.id,
                webUrl: section.links?.oneNoteWebUrl?.href,
                createdDateTime: section.createdDateTime,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
};
