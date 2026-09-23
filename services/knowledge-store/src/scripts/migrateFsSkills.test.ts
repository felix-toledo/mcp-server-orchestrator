import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseFsSkills } from './migrateFsSkills.js';

describe('parseFsSkills (knowledge-store/005-skills AC4)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'alma-skills-fixture-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns [] instead of throwing when the folder does not exist', async () => {
    await expect(parseFsSkills(path.join(dir, 'does-not-exist'))).resolves.toEqual([]);
  });

  it('returns [] for an existing but empty folder', async () => {
    await expect(parseFsSkills(dir)).resolves.toEqual([]);
  });

  it('parses a .md file into name/description/instructions', async () => {
    await writeFile(
      path.join(dir, 'tono-formal.md'),
      '# Tono formal\n\nUsar cuando el usuario pida un tono formal.\n\nEscribí en tercera persona.',
    );

    const skills = await parseFsSkills(dir);

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('tono-formal');
    expect(skills[0].description).toBe('Tono formal');
    expect(skills[0].instructions).toContain('Escribí en tercera persona.');
  });

  it('ignores non-.md files', async () => {
    await writeFile(path.join(dir, 'notes.txt'), 'not a skill');
    await writeFile(path.join(dir, 'real-skill.md'), 'Contenido real');

    const skills = await parseFsSkills(dir);

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('real-skill');
  });

  it('falls back to a placeholder description for an empty file', async () => {
    await writeFile(path.join(dir, 'vacio.md'), '');
    const skills = await parseFsSkills(dir);
    expect(skills[0].description).toMatch(/sin descripción/);
  });
});
