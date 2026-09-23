import type { ILlmProvider } from '../llm/ILlmProvider.js';

export interface SkillRouterDecision {
  skills: string[];
  isComplex: boolean;
}

export interface AvailableSkill {
  name: string;
  description: string;
}

export interface SkillRouter {
  route(userMessage: string, availableSkills: AvailableSkill[]): Promise<SkillRouterDecision>;
}

function buildPrompt(userMessage: string, availableSkills: AvailableSkill[]): string {
  // knowledge-store/005-skills AC2 — match against each skill's own
  // description, not just its bare name (the name alone was a weak signal
  // for the router to decide relevance from).
  const skillsList =
    availableSkills.length > 0 ? availableSkills.map((s) => `${s.name}: ${s.description}`).join('\n') : '(ninguna disponible)';
  return `Analizá este mensaje de usuario y respondé ÚNICAMENTE con un objeto JSON, sin texto adicional, sin markdown, con esta forma exacta:
{"skills": string[], "isComplex": boolean}

- "skills": subconjunto (puede ser vacío) de los NOMBRES de estas skills disponibles que aplican a este mensaje, según su descripción:
${skillsList}
Nunca inventes un nombre que no esté en esa lista.
- "isComplex": true si resolver el mensaje requiere varios pasos encadenados o usar más de una herramienta en secuencia; false si es una respuesta directa o una única acción simple.

Mensaje del usuario:
"""
${userMessage}
"""`;
}

function parseDecision(raw: string | null): SkillRouterDecision {
  if (!raw) {
    return { skills: [], isComplex: false };
  }
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw) as Partial<SkillRouterDecision>;
    return {
      skills: Array.isArray(parsed.skills) ? parsed.skills.filter((s): s is string => typeof s === 'string') : [],
      isComplex: typeof parsed.isComplex === 'boolean' ? parsed.isComplex : false,
    };
  } catch {
    return { skills: [], isComplex: false };
  }
}

/**
 * Default SkillRouter (orchestrator/001-reasoning-pipeline §6.2) — a single
 * small/fast-model call producing both decisions at once, per spec AC2/AC5.
 * Never throws: a malformed/missing response degrades to "no skills, not
 * complex" rather than blocking the turn.
 */
export class DefaultSkillRouter implements SkillRouter {
  constructor(private readonly llmProvider: ILlmProvider) {}

  async route(userMessage: string, availableSkills: AvailableSkill[]): Promise<SkillRouterDecision> {
    try {
      const response = await this.llmProvider.generateResponse([
        { role: 'user', content: buildPrompt(userMessage, availableSkills) },
      ]);
      const decision = parseDecision(response.content);
      // Never trust a skill name the router invented outside the real list.
      const availableNames = new Set(availableSkills.map((s) => s.name));
      return { ...decision, skills: decision.skills.filter((s) => availableNames.has(s)) };
    } catch (error) {
      console.warn('⚠️ SkillRouter falló, sigo sin skills y como tarea simple:', error);
      return { skills: [], isComplex: false };
    }
  }
}
