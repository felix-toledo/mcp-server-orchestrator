import { ILlmProvider } from './ILlmProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { GeminiProvider } from './GeminiProvider.js';

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

      case 'gemini': {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY no está configurado en las variables de entorno');
        }
        const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
        return new GeminiProvider(apiKey, model);
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
