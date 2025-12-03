import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Registra la herramienta "hello_world" en el servidor MCP
 * Una herramienta simple que saluda con el nombre proporcionado
 *
 * @param server - Instancia del servidor MCP
 */
export function registerHelloWorldTool(server: McpServer): void {
  const HelloWorldInputSchema = z.object({
    name: z.string().optional().describe('Name to greet (optional)'),
  });

  type HelloWorldInput = z.infer<typeof HelloWorldInputSchema>;

  server.registerTool(
    'hello_world',
    {
      title: 'Hello World',
      description: 'A simple hello world tool that greets you by name',
      inputSchema: HelloWorldInputSchema.shape,
    },
    async (input: HelloWorldInput): Promise<CallToolResult> => {
      const validatedInput = HelloWorldInputSchema.parse(input);
      const { name } = validatedInput;
      const greeting = name ? `Hello ${name}!` : 'Hello World!';

      return {
        content: [
          {
            type: 'text',
            text: greeting,
          },
        ],
      };
    },
  );
}
