import { homedir } from 'node:os';
import { join } from 'node:path';

/** Sibling folder to the vault (voice-assistant/001-wake-word-channel spec §5.2). */
export function resolveVoiceProfileStoragePath(): string {
  return join(homedir(), 'Documents', 'alma', 'voice-profile');
}
