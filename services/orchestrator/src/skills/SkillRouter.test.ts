import { describe, expect, it, vi } from 'vitest';
import type { ILlmProvider, LlmResponse } from '../llm/ILlmProvider.js';
import { DefaultSkillRouter, type AvailableSkill } from './SkillRouter.js';

function fakeProvider(content: string | null): ILlmProvider {
  const response: LlmResponse = {
    content,
    finishReason: 'stop',
    assistantMessage: { role: 'assistant', content },
  };
  return { generateResponse: vi.fn().mockResolvedValue(response), getName: () => 'fake' };
}

function skill(name: string, description = 'una descripción'): AvailableSkill {
  return { name, description };
}

describe('DefaultSkillRouter', () => {
  it('parses a well-formed JSON decision', async () => {
    const provider = fakeProvider('{"skills": ["alma-frontend-convention"], "isComplex": true}');
    const router = new DefaultSkillRouter(provider);

    const decision = await router.route('cambiá el color del botón', [skill('alma-frontend-convention'), skill('otra-skill')]);

    expect(decision).toEqual({ skills: ['alma-frontend-convention'], isComplex: true });
  });

  it('AC2: includes each skill\'s description in the prompt, not just its name', async () => {
    const provider = fakeProvider('{"skills": [], "isComplex": false}');
    const router = new DefaultSkillRouter(provider);

    await router.route('mensaje', [skill('alma-frontend-convention', 'usar para cambios visuales en el frontend')]);

    const [messages] = vi.mocked(provider.generateResponse).mock.calls[0];
    expect(messages[0].content).toContain('usar para cambios visuales en el frontend');
  });

  it('strips any skill name the model invented outside the real list', async () => {
    const provider = fakeProvider('{"skills": ["no-existe", "alma-frontend-convention"], "isComplex": false}');
    const router = new DefaultSkillRouter(provider);

    const decision = await router.route('mensaje', [skill('alma-frontend-convention')]);

    expect(decision.skills).toEqual(['alma-frontend-convention']);
  });

  it('tolerates the model wrapping the JSON in prose/markdown', async () => {
    const provider = fakeProvider('Claro, acá está:\n```json\n{"skills": [], "isComplex": false}\n```');
    const router = new DefaultSkillRouter(provider);

    const decision = await router.route('mensaje', []);

    expect(decision).toEqual({ skills: [], isComplex: false });
  });

  it('degrades to no-skills/simple on malformed output', async () => {
    const provider = fakeProvider('esto no es JSON');
    const router = new DefaultSkillRouter(provider);

    await expect(router.route('mensaje', [])).resolves.toEqual({ skills: [], isComplex: false });
  });

  it('degrades to no-skills/simple when the provider call throws', async () => {
    const provider: ILlmProvider = { generateResponse: vi.fn().mockRejectedValue(new Error('down')), getName: () => 'fake' };
    const router = new DefaultSkillRouter(provider);

    await expect(router.route('mensaje', [])).resolves.toEqual({ skills: [], isComplex: false });
  });
});
