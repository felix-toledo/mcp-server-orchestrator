-- CreateEnum
CREATE TYPE "public"."VoiceProfileStatus" AS ENUM ('NOT_TRAINED', 'TRAINED');

-- CreateTable
CREATE TABLE "public"."VoiceProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."VoiceProfileStatus" NOT NULL DEFAULT 'NOT_TRAINED',
    "enrollmentAudioPath" TEXT,
    "currentSessionId" TEXT,
    "trainedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceProfile_userId_key" ON "public"."VoiceProfile"("userId");

-- AddForeignKey
ALTER TABLE "public"."VoiceProfile" ADD CONSTRAINT "VoiceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
