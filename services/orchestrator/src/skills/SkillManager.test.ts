import { describe, expect, it } from 'vitest';
import { SkillManager, type SkillSummary } from './SkillManager.js';

function skill(overrides: Partial<SkillSummary> = {}): SkillSummary {
  return {
    id: 's1',
    name: 'tono-formal',
    description: 'Usar cuando el usuario pida un tono formal.',
    instructions: 'Escribí en tercera persona.',
    ...overrides,
  };
}

describe('SkillManager', () => {
  describe('list', () => {
    it('returns every skill it was constructed with', () => {
      const manager = new SkillManager([skill(), skill({ id: 's2', name: 'otro' })]);
      expect(manager.list()).toHaveLength(2);
    });

    it('returns [] when constructed with no skills', () => {
      expect(new SkillManager([]).list()).toEqual([]);
    });
  });

  describe('resolve', () => {
    it('returns "" for an empty name list', () => {
      const manager = new SkillManager([skill()]);
      expect(manager.resolve([])).toBe('');
    });

    it('joins the instructions of every matched skill', () => {
      const manager = new SkillManager([
        skill({ name: 'a', instructions: 'instrucción A' }),
        skill({ name: 'b', instructions: 'instrucción B' }),
      ]);
      expect(manager.resolve(['a', 'b'])).toBe('instrucción A\n\ninstrucción B');
    });

    it('ignores an unknown skill name instead of throwing', () => {
      const manager = new SkillManager([skill({ name: 'a', instructions: 'instrucción A' })]);
      expect(manager.resolve(['a', 'no-existe'])).toBe('instrucción A');
    });
  });
});
