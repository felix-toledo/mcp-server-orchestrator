import { CopilotClient, approveAll } from '@github/copilot-sdk';
import type { MCPServerConfig } from '@github/copilot-sdk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ILlmProvider, LlmMessage, LlmResponse, LlmToolDefinition } from './ILlmProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Formato estándar de mcp_config.json (compatible con Claude Desktop / VS Code)
interface McpConfigEntry {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
  type?: string;
}

interface McpConfig {
  mcpServers: Record<string, McpConfigEntry>;
}

/**
 * Proveedor de LLM que usa el GitHub Copilot SDK.
 * A diferencia de OpenAI/Gemini, Copilot gestiona su propio agent loop interno,
 * incluyendo el uso de herramientas vía MCP servers. Por eso `generateResponse`
 * devuelve siempre finishReason: 'stop' (sin toolCalls expuestas al Orchestrator).
 */
export class CopilotProvider implements ILlmProvider {
  private githubToken: string;
  private model: string;
  private client: CopilotClient | null = null;

  constructor(githubToken: string, model: string = 'gpt-4.1') {
    this.githubToken = githubToken;
    this.model = model;
  }

  getName(): string {
    return 'copilot';
  }

  private async getClient(): Promise<CopilotClient> {
    if (!this.client) {
      console.log('🔑 [Copilot] Iniciando cliente (primera vez)...');
      this.client = new CopilotClient({
        env: { COPILOT_GITHUB_TOKEN: this.githubToken },
      });
      await this.client.start();
      console.log('✅ [Copilot] Cliente listo y reutilizable.');
    }
    return this.client;
  }

  async generateResponse(
    messages: LlmMessage[],
    _tools?: LlmToolDefinition[],
  ): Promise<LlmResponse> {
    // Copilot gestiona herramientas vía MCP internamente; _tools se ignora.
    const client = await this.getClient();

    try {
      const mcpServers = this.loadMcpServers();

      // Extraer el mensaje de sistema para inyectarlo como contexto adicional
      const systemMessage = messages.find((m) => m.role === 'system');

      // Encontrar el índice del último mensaje de usuario
      let lastUserIdx = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          lastUserIdx = i;
          break;
        }
      }

      const lastUserMessage = lastUserIdx >= 0 ? messages[lastUserIdx] : null;

      // Historial de conversación previo (excluyendo system y el último user)
      const historyMessages = messages
        .slice(0, lastUserIdx >= 0 ? lastUserIdx : messages.length)
        .filter((m) => m.role !== 'system');

      const session = await client.createSession({
        model: this.model,
        onPermissionRequest: approveAll,
        mcpServers: Object.keys(mcpServers).length > 0 ? mcpServers : undefined,
        hooks: {
          onSessionStart: async () => {
            if (historyMessages.length === 0) return undefined;
            const history = historyMessages
              .map((m) => {
                const role = m.role === 'assistant' ? 'Assistant' : 'User';
                return `${role}: ${m.content ?? ''}`;
              })
              .join('\n');
            return { additionalContext: `Previous conversation:\n${history}` };
          },
        },
      });

      try {
        // Armar el prompt con las instrucciones del sistema y skills al frente,
        // seguido del mensaje del usuario. Esto garantiza que el LLM las respete.
        const userContent = lastUserMessage?.content ?? '';
        const promptParts: string[] = [];

        if (systemMessage?.content) {
          promptParts.push(`[INSTRUCCIONES DEL SISTEMA — seguir estrictamente]\n${systemMessage.content}\n[FIN DE INSTRUCCIONES]`);
        }

        promptParts.push(userContent);

        const prompt = promptParts.join('\n\n');
        console.log(`📤 [Copilot] Enviando prompt (${prompt.length} chars)...`);
        const response = await session.sendAndWait({ prompt });

        const content = (response as any)?.data?.content ?? null;
        console.log(`📥 [Copilot] Respuesta recibida:`, content ? content.slice(0, 300) + (content.length > 300 ? '...' : '') : '(null)');

        return {
          content,
          finishReason: 'stop',
          assistantMessage: {
            role: 'assistant',
            content,
          },
        };
      } finally {
        await session.disconnect();
      }
    } catch (error) {
      // Si el cliente falla de forma irrecuperable, resetearlo para que se reinicie en el próximo request
      console.error('❌ [Copilot] Error en generateResponse, reseteando cliente:', error);
      this.client = null;
      throw error;
    }
  }

  /**
   * Lee mcp_config.json y convierte las entradas al formato requerido por el Copilot SDK.
   * Servidores stdio → type: 'local'; servidores con url → type: 'http'.
   */
  private loadMcpServers(): Record<string, MCPServerConfig> {
    try {
      // mcp_config.json está en services/orchestrator/ (2 niveles arriba de src/llm/)
      const configPath = join(__dirname, '../../mcp_config.json');
      const raw = readFileSync(configPath, 'utf-8');
      const config: McpConfig = JSON.parse(raw);

      const result: Record<string, MCPServerConfig> = {};

      for (const [name, server] of Object.entries(config.mcpServers)) {
        if (server.url) {
          // Servidor HTTP/SSE
          result[name] = {
            type: 'http',
            url: server.url,
            headers: server.headers ?? {},
            tools: ['*'],
          };
        } else if (server.command) {
          // Servidor local (stdio)
          result[name] = {
            type: 'local',
            command: server.command,
            args: server.args ?? [],
            env: server.env ?? {},
            tools: ['*'],
          };
        }
      }

      return result;
    } catch {
      console.warn('⚠️ CopilotProvider: no se pudo cargar mcp_config.json, funcionará sin MCP.');
      return {};
    }
  }
}
