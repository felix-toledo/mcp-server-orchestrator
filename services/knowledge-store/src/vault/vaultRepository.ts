import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export class VaultRepository {
  constructor(private readonly vaultRoot: string) {}

  async write(folderPath: string | null, slugBase: string, fileContents: string): Promise<{ path: string }> {
    const dir = folderPath ? join(this.vaultRoot, folderPath) : this.vaultRoot;
    await mkdir(dir, { recursive: true });
    const filename = this.resolveFreeFilename(dir, slugBase);
    await writeFile(join(dir, filename), fileContents, 'utf-8');
    return { path: folderPath ? `${folderPath}/${filename}` : filename };
  }

  async read(path: string): Promise<string> {
    return readFile(join(this.vaultRoot, path), 'utf-8');
  }

  async overwrite(path: string, fileContents: string): Promise<void> {
    await writeFile(join(this.vaultRoot, path), fileContents, 'utf-8');
  }

  async delete(path: string): Promise<void> {
    await rm(join(this.vaultRoot, path), { force: true });
  }

  /** `mkdir -p` semantics (knowledge-store/004 AC1) — creates every missing ancestor. */
  async ensureFolder(path: string): Promise<void> {
    await mkdir(join(this.vaultRoot, path), { recursive: true });
  }

  /** Recursive delete (knowledge-store/004 AC7) — mirrors a real filesystem folder delete. */
  async deleteFolder(path: string): Promise<void> {
    await rm(join(this.vaultRoot, path), { recursive: true, force: true });
  }

  private resolveFreeFilename(dir: string, slugBase: string): string {
    let candidate = `${slugBase}.md`;
    let suffix = 2;
    while (existsSync(join(dir, candidate))) {
      candidate = `${slugBase}-${suffix}.md`;
      suffix += 1;
    }
    return candidate;
  }
}
