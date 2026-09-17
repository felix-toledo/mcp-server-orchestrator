import { afterEach, describe, expect, it, vi } from 'vitest';
import { LlmProviderFactory } from './LlmProviderFactory.js';

describe('LlmProviderFactory', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates an OpenAI provider when OPENAI_API_KEY is set', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const provider = LlmProviderFactory.create('openai');
    expect(provider.getName()).toBe('openai');
  });

  it('throws when OPENAI_API_KEY is missing', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(() => LlmProviderFactory.create('openai')).toThrow(/OPENAI_API_KEY/);
  });

  it('creates a DeepSeek provider (OpenAI-compatible) when DEEPSEEK_API_KEY is set', () => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'sk-test');
    const provider = LlmProviderFactory.create('deepseek');
    expect(provider.getName()).toBe('deepseek');
  });

  it('throws when DEEPSEEK_API_KEY is missing', () => {
    vi.stubEnv('DEEPSEEK_API_KEY', '');
    expect(() => LlmProviderFactory.create('deepseek')).toThrow(/DEEPSEEK_API_KEY/);
  });

  it('throws when GEMINI_API_KEY is missing', () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(() => LlmProviderFactory.create('gemini')).toThrow(/GEMINI_API_KEY/);
  });

  it('throws when COPILOT_GITHUB_TOKEN is missing', () => {
    vi.stubEnv('COPILOT_GITHUB_TOKEN', '');
    expect(() => LlmProviderFactory.create('copilot')).toThrow(/COPILOT_GITHUB_TOKEN/);
  });

  it('throws for an unknown provider name', () => {
    expect(() => LlmProviderFactory.create('unknown-llm')).toThrow(/no soportado/);
  });

  it('createDefault() falls back to openai when LLM_PROVIDER is unset', () => {
    vi.stubEnv('LLM_PROVIDER', '');
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const provider = LlmProviderFactory.createDefault();
    expect(provider.getName()).toBe('openai');
  });

  it('createDefault() honors LLM_PROVIDER when set', () => {
    vi.stubEnv('LLM_PROVIDER', 'deepseek');
    vi.stubEnv('DEEPSEEK_API_KEY', 'sk-test');
    const provider = LlmProviderFactory.createDefault();
    expect(provider.getName()).toBe('deepseek');
  });
});
