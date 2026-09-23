import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

/**
 * Writes the uploaded enrollment sample to disk — one file, not a folder of
 * notes (unlike vault/vaultRepository.ts). Single-user, single-`VoiceProfile`
 * system (spec §5.1's `@unique` on `userId`), so re-enrolling overwrites the
 * same fixed filename rather than accumulating stale samples.
 */
export class VoiceProfileStorage {
  constructor(private readonly storageRoot: string) {}

  async write(fileBuffer: Buffer, originalName: string): Promise<{ path: string }> {
    await mkdir(this.storageRoot, { recursive: true });
    const filename = `enrollment${extname(originalName) || '.wav'}`;
    const path = join(this.storageRoot, filename);
    await writeFile(path, fileBuffer);
    return { path };
  }
}
