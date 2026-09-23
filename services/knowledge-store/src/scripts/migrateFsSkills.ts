import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export interface ParsedFsSkill {
  name: string;
  description: string;
  instructions: string;
}

const DESCRIPTION_MAX_LENGTH = 200;
const NO_DESCRIPTION_FALLBACK = '(sin descripción — migrado automáticamente, completar a mano)';

function deriveDescription(body: string): string {
  const firstLine = body.split('\n').find((line) => line.trim().length > 0) ?? '';
  const trimmed = firstLine.replace(/^#+\s*/, '').trim();
  return trimmed ? trimmed.slice(0, DESCRIPTION_MAX_LENGTH) : NO_DESCRIPTION_FALLBACK;
}

/**
 * knowledge-store/005-skills AC4 — parses whatever `.md` files exist in
 * the legacy `services/orchestrator/skills/` folder into importable Skill
 * rows. No frontmatter/description exists in that format, so `description`
 * is a best-effort guess (the file's first non-empty line) — this is a
 * one-time migration aid, not a format anyone should keep writing skills
 * in going forward.
 */
export async function parseFsSkills(skillsDir: string): Promise<ParsedFsSkill[]> {
  let files: string[];
  try {
    files = await readdir(skillsDir);
  } catch {
    return []; // folder doesn't exist — nothing to migrate, not an error
  }

  const skills: ParsedFsSkill[] = [];
  for (const file of files.filter((f) => f.endsWith('.md'))) {
    const body = await readFile(path.join(skillsDir, file), 'utf-8');
    skills.push({ name: path.basename(file, '.md'), description: deriveDescription(body), instructions: body.trim() });
  }
  return skills;
}

async function main(): Promise<void> {
  const skillsDir = process.argv[2] ?? path.resolve(import.meta.dirname, '../../../orchestrator/skills');
  const baseUrl = process.env.KNOWLEDGE_STORE_URL || 'http://localhost:30025';

  const skills = await parseFsSkills(skillsDir);
  if (skills.length === 0) {
    console.log(`No .md skills found in ${skillsDir} — nothing to migrate.`);
    return;
  }

  for (const skill of skills) {
    const response = await fetch(`${baseUrl}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(skill),
    });
    if (!response.ok) {
      console.error(`❌ Failed to migrate "${skill.name}": ${response.status} ${await response.text()}`);
      continue;
    }
    console.log(`✅ Migrated "${skill.name}"`);
  }
}

// Only run when invoked directly (`tsx migrateFsSkills.ts`), not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exitCode = 1;
  });
}
