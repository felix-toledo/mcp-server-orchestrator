import type { PrismaClient } from '@prisma/client';
import type { VoiceProfileStorage } from '../voiceProfile/voiceProfileStorage.js';
import type { UserService } from './userService.js';

export interface VoiceProfileSummary {
  id: string;
  status: 'NOT_TRAINED' | 'TRAINED';
  enrollmentAudioPath: string | null;
  currentSessionId: string | null;
  trainedAt: Date | null;
}

function toSummary(profile: {
  id: string;
  status: string;
  enrollmentAudioPath: string | null;
  currentSessionId: string | null;
  trainedAt: Date | null;
}): VoiceProfileSummary {
  return {
    id: profile.id,
    status: profile.status as VoiceProfileSummary['status'],
    enrollmentAudioPath: profile.enrollmentAudioPath,
    currentSessionId: profile.currentSessionId,
    trainedAt: profile.trainedAt,
  };
}

export class VoiceProfileService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userService: UserService,
    private readonly storage: VoiceProfileStorage,
  ) {}

  /** GET /voice-profile — spec §5.3, read on voice-assistant startup and by the frontend. */
  async get(): Promise<VoiceProfileSummary | null> {
    const profile = await this.prisma.voiceProfile.findFirst();
    return profile ? toSummary(profile) : null;
  }

  /**
   * POST /voice-profile/enroll — spec §5.3. Writes the raw sample to disk
   * (§5.2), then upserts the row with `status: TRAINED`. `chatId`-style
   * fields (`currentSessionId`) are left untouched on a re-enrollment, same
   * "rotating doesn't reset the binding" behavior TelegramLinkService.upsert
   * already establishes.
   */
  async enroll(fileBuffer: Buffer, originalName: string): Promise<VoiceProfileSummary> {
    const user = await this.userService.getCurrent();
    if (!user) {
      throw new Error('Cannot enroll a voice profile before onboarding');
    }

    const { path } = await this.storage.write(fileBuffer, originalName);
    const trainedAt = new Date();
    const profile = await this.prisma.voiceProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, status: 'TRAINED', enrollmentAudioPath: path, trainedAt },
      update: { status: 'TRAINED', enrollmentAudioPath: path, trainedAt },
    });
    return toSummary(profile);
  }

  /** PATCH /voice-profile — spec §5.3, the §4 shared-session pointer. */
  async updateCurrentSession(currentSessionId: string): Promise<VoiceProfileSummary> {
    const existing = await this.prisma.voiceProfile.findFirst();
    if (!existing) {
      throw new Error('No voice profile configured yet');
    }

    const profile = await this.prisma.voiceProfile.update({
      where: { id: existing.id },
      data: { currentSessionId },
    });
    return toSummary(profile);
  }

  /** DELETE /voice-profile — spec §5.3, the re-train flow (§6 Default #5). */
  async reset(): Promise<void> {
    const existing = await this.prisma.voiceProfile.findFirst();
    if (!existing) {
      return;
    }

    await this.prisma.voiceProfile.update({
      where: { id: existing.id },
      data: { status: 'NOT_TRAINED', enrollmentAudioPath: null, trainedAt: null },
    });
  }
}
