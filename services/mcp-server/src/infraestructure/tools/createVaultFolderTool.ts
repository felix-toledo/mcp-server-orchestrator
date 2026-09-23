import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { KnowledgeStoreClient } from '../http/knowledgeStoreClient.js';

const CreateVaultFolderInputSchema = z.object({
  path: z.string().min(1).describe('Folder path to create in the vault, e.g. "proyectos/tfg" — creates missing ancestors too'),
});

type CreateVaultFolderInput = z.infer<typeof CreateVaultFolderInputSchema>;

export function registerCreateVaultFolderTool(server: McpServer, knowledgeStoreClient: KnowledgeStoreClient): void {
  server.registerTool(
    'createVaultFolder',
    {
      title: 'Create Vault Folder',
      description: "Creates an empty folder in the user's ALMA vault (and any missing ancestor folders), indexed for search.",
      inputSchema: CreateVaultFolderInputSchema.shape,
    },
    async (input: CreateVaultFolderInput): Promise<CallToolResult> => {
      const validatedInput = CreateVaultFolderInputSchema.parse(input);

      try {
        const folder = await knowledgeStoreClient.createVaultFolder(validatedInput.path);
        return {
          content: [{ type: 'text', text: `Carpeta "${folder.path}" creada.` }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `No pude crear la carpeta: ${error instanceof Error ? error.message : 'error desconocido'}`,
            },
          ],
        };
      }
    },
  );
}
