import type { AvailableSkill, SkillRouter } from '../../skills/SkillRouter.js';
import type { PipelineState, PipelineStateUpdate } from '../state.js';

/** AC2 — the SkillRouter half of the parallel fan-out. */
export function createRunSkillRouterNode(deps: { skillRouter: SkillRouter; availableSkills: AvailableSkill[] }) {
  return async (state: PipelineState): Promise<PipelineStateUpdate> => {
    const lastUserMessage = [...state.messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage?.content) {
      return { skillsToUse: [], isComplex: false };
    }

    const decision = await deps.skillRouter.route(lastUserMessage.content, deps.availableSkills);
    return { skillsToUse: decision.skills, isComplex: decision.isComplex };
  };
}
