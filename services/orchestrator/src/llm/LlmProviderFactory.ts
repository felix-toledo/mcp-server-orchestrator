import { ILlmProvider } from './ILlmProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import { CopilotProvider } from './CopilotProvider.js';

/**
 * Factory para crear instancias de proveedores de LLM
 * Implementa el patrón Strategy permitiendo cambiar entre proveedores fácilmente
 */
export class LlmProviderFactory {
  /**
   * Crea una instancia del proveedor de LLM especificado
   * @param provider Nombre del proveedor ('openai', 'gemini', etc.)
   * @returns Instancia del proveedor de LLM
   */
  static create(provider: string): ILlmProvider {
    switch (provider.toLowerCase()) {
      case 'openai': {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new Error('OPENAI_API_KEY no está configurado en las variables de entorno');
        }
        const model = process.env.OPENAI_MODEL || 'gpt-4.1-nano';
        return new OpenAIProvider(apiKey, model);
      }

      case 'deepseek': {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
          throw new Error('DEEPSEEK_API_KEY no está configurado en las variables de entorno');
        }
        // DeepSeek expone una API compatible con OpenAI, reusamos el mismo provider
        const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
        const baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
        return new OpenAIProvider(apiKey, model, baseURL, 'deepseek');
      }

      case 'gemini': {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY no está configurado en las variables de entorno');
        }
        const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
        return new GeminiProvider(apiKey, model);
      }

      case 'copilot': {
        const token = process.env.COPILOT_GITHUB_TOKEN;
        if (!token) {
          throw new Error('COPILOT_GITHUB_TOKEN no está configurado en las variables de entorno');
        }
        const model = process.env.COPILOT_MODEL || 'gpt-4.1';
        return new CopilotProvider(token, model);
      }

      // Futuros proveedores:
      // case 'claude':
      //   return new ClaudeProvider(process.env.CLAUDE_API_KEY!);

      default:
        throw new Error(`Proveedor de LLM no soportado: ${provider}`);
    }
  }

  /**
   * Obtiene el proveedor por defecto desde las variables de entorno
   * o usa OpenAI como fallback
   */
  static createDefault(): ILlmProvider {
    const defaultProvider = process.env.LLM_PROVIDER || 'openai';
    return this.create(defaultProvider);
  }
}
