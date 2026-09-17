import { homedir } from 'node:os';
import { join } from 'node:path';

export function resolveVaultPath(): string {
  return join(homedir(), 'Documents', 'alma', 'vault');
}
