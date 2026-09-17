import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { KnowledgeStoreClient } from '../http/knowledgeStoreClient.js';

const SearchKnowledgeEntriesInputSchema = z.object({
  query: z.string().min(1).describe('Text to search the vault for, semantically'),
  limit: z.number().int().min(1).max(5).optional().describe('Max results to return, default 5'),
});

type SearchKnowledgeEntriesInput = z.infer<typeof SearchKnowledgeEntriesInputSchema>;

export function registerSearchKnowledgeEntriesTool(server: McpServer, knowledgeStoreClient: KnowledgeStoreClient): void {
  server.registerTool(
    'searchKnowledgeEntries',
    {
      title: 'Search Knowledge Entries',
      description: "Semantically searches the user's ALMA vault for notes related to a given text.",
      inputSchema: SearchKnowledgeEntriesInputSchema.shape,
    },
    async (input: SearchKnowledgeEntriesInput): Promise<CallToolResult> => {
      const validatedInput = SearchKnowledgeEntriesInputSchema.parse(input);

      try {
        const results = await knowledgeStoreClient.searchKnowledgeEntries(validatedInput.query, validatedInput.limit);
        return {
          content: [{ type: 'text', text: JSON.stringify(results) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `No pude buscar en la bóveda: ${error instanceof Error ? error.message : 'error desconocido'}`,
            },
          ],
        };
      }
    },
  );
}
