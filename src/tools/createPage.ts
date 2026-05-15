import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createPage } from '../graph/pages.js';
import { htmlToOneNotePage, markdownToOneNoteHtml } from '../markdown.js';

const inputSchema = {
  sectionId: z.string().min(1).describe('Section ID to create the page in.'),
  title: z.string().min(1).describe('Page title (used in the <title> element).'),
  content: z.string().min(1).describe('Page body. Format is determined by the `format` field.'),
  format: z
    .enum(['markdown', 'html'])
    .default('markdown')
    .describe(
      'Content format. "markdown" (default) is converted to HTML; "html" is sent directly (wrapped if it is a body fragment).',
    ),
};

export function register(server: McpServer): void {
  server.registerTool(
    'create_page',
    {
      title: 'Create Page',
      description:
        'Creates a new OneNote page in the given section. Accepts Markdown (default) or HTML; converts MD to HTML internally.',
      inputSchema,
    },
    async ({ sectionId, title, content, format }) => {
      const html =
        format === 'html'
          ? htmlToOneNotePage(content, title)
          : markdownToOneNoteHtml(content, title);
      const page = await createPage({ sectionId, html });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                id: page.id,
                title: page.title,
                createdDateTime: page.createdDateTime,
                webUrl: page.links?.oneNoteWebUrl?.href,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
