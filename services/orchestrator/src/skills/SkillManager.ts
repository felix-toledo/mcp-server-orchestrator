/**
 * knowledge-store/005-skills — a Skill is now a real, user-managed entity
 * fetched from knowledge-store (`KnowledgeStoreClient.listSkills`), not a
 * `.md` file read off this service's own filesystem at startup. This class
 * no longer owns any I/O — it's built fresh per request in
 * `graphRuntime.ts` from whatever `listSkills()` returns, same lifecycle
 * `AgentRegistry` already uses for `Agent`.
 */
export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  instructions: string;
}

export class SkillManager {
  private readonly byName: Map<string, SkillSummary>;

  constructor(skills: SkillSummary[]) {
    this.byName = new Map(skills.map((skill) => [skill.name, skill]));
  }

  /**
   * Resolves a list of skill names (as the `SkillRouter` selected them) to
   * their combined instructions. Unknown names are ignored with a warning
   * — never fatal, matching the fail-open pattern used everywhere else a
   * router's own output gets trusted.
   */
  resolve(skillNames: string[]): string {
    if (!skillNames.length) return '';

    const parts: string[] = [];
    for (const name of skillNames) {
      const skill = this.byName.get(name);
      if (!skill) {
        console.warn(`⚠️  Skill desconocida: "${name}". Skills cargadas: [${[...this.byName.keys()].join(', ')}]`);
        continue;
      }
      parts.push(skill.instructions);
    }

    return parts.join('\n\n');
  }

  /** Every skill currently available to this graph run. */
  list(): SkillSummary[] {
    return [...this.byName.values()];
  }
}
