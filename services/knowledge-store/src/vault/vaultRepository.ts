import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export class VaultRepository {
  constructor(private readonly vaultRoot: string) {}

  async write(slugBase: string, fileContents: string): Promise<{ path: string }> {
    await mkdir(this.vaultRoot, { recursive: true });
    const path = this.resolveFreeFilename(slugBase);
    await writeFile(join(this.vaultRoot, path), fileContents, 'utf-8');
    return { path };
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

  private resolveFreeFilename(slugBase: string): string {
    let candidate = `${slugBase}.md`;
    let suffix = 2;
    while (existsSync(join(this.vaultRoot, candidate))) {
      candidate = `${slugBase}-${suffix}.md`;
      suffix += 1;
    }
    return candidate;
  }
}
