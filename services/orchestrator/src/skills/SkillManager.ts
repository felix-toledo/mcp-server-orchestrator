import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carpeta de skills: services/orchestrator/skills/
// __dirname en dist es: services/orchestrator/dist/skills/ → subir 2 niveles = services/orchestrator/
const SKILLS_DIR = path.join(__dirname, '../../skills');

/**
 * Carga y resuelve skills desde archivos .md en la carpeta /skills.
 * El nombre del archivo (sin extensión) es el nombre de la skill.
 * El contenido del .md son las instrucciones que se inyectan en el system message.
 */
export class SkillManager {
  private skills: Map<string, string> = new Map();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (!fs.existsSync(SKILLS_DIR)) {
        console.warn(`⚠️ SkillManager: carpeta skills/ no encontrada en ${SKILLS_DIR}`);
        return;
      }

      const files = fs.readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.md'));
      for (const file of files) {
        const name = path.basename(file, '.md');
        const content = fs.readFileSync(path.join(SKILLS_DIR, file), 'utf-8').trim();
        this.skills.set(name, content);
      }

      console.log(`🎯 Skills disponibles: ${[...this.skills.keys()].join(', ') || '(ninguna)'}`);
    } catch (err) {
      console.warn(`⚠️ SkillManager: error al cargar skills - ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Resuelve una lista de nombres de skills a sus instrucciones combinadas.
   * Los nombres desconocidos se ignoran con un warning.
   */
  resolve(skillNames: string[]): string {
    if (!skillNames.length) return '';

    const parts: string[] = [];
    for (const name of skillNames) {
      const instructions = this.skills.get(name);
      if (!instructions) {
        console.warn(`⚠️  Skill desconocida: "${name}". Skills cargadas: [${[...this.skills.keys()].join(', ')}]`);
        continue;
      }
      console.log(`   ✅ Skill "${name}" cargada (${instructions.length} chars)`);
      parts.push(instructions);
    }

    return parts.join('\n\n');
  }

  /**
   * Devuelve la lista de skills disponibles.
   */
  list(): string[] {
    return [...this.skills.keys()];
  }
}

// Instancia singleton para reutilizar en toda la app
export const skillManager = new SkillManager();
