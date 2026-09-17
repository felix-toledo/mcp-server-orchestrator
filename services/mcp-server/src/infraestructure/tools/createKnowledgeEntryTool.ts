import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { KnowledgeStoreClient } from '../http/knowledgeStoreClient.js';

const CreateKnowledgeEntryInputSchema = z.object({
  title: z.string().min(1).describe('Short title for the note'),
  content: z.string().min(1).describe('The note body, in Markdown'),
  tags: z.array(z.string()).optional().describe('Optional free-form tags'),
});

type CreateKnowledgeEntryInput = z.infer<typeof CreateKnowledgeEntryInputSchema>;

export function registerCreateKnowledgeEntryTool(server: McpServer, knowledgeStoreClient: KnowledgeStoreClient): void {
  server.registerTool(
    'createKnowledgeEntry',
    {
      title: 'Create Knowledge Entry',
      description: "Saves a new note to the user's ALMA vault as Markdown and indexes it for future retrieval.",
      inputSchema: CreateKnowledgeEntryInputSchema.shape,
    },
    async (input: CreateKnowledgeEntryInput): Promise<CallToolResult> => {
      const validatedInput = CreateKnowledgeEntryInputSchema.parse(input);

      try {
        const result = await knowledgeStoreClient.createKnowledgeEntry(validatedInput);
        return {
          content: [{ type: 'text', text: `Nota "${result.title}" guardada en ${result.path}.` }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `No pude guardar la nota: ${error instanceof Error ? error.message : 'error desconocido'}`,
            },
          ],
        };
      }
    },
  );
}
