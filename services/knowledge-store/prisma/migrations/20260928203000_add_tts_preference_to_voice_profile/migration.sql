-- CreateEnum
CREATE TYPE "public"."TtsEngine" AS ENUM ('KOKORO', 'ELEVENLABS');

-- AlterTable
ALTER TABLE "public"."VoiceProfile" ADD COLUMN     "ttsEngine" "public"."TtsEngine" NOT NULL DEFAULT 'KOKORO',
ADD COLUMN     "ttsVoiceId" TEXT;
