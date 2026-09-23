-- AlterTable
ALTER TABLE "Team" DROP COLUMN "workingDirectories";

-- AlterTable
ALTER TABLE "TelegramLink" ADD COLUMN "allowedUsernames" JSONB NOT NULL DEFAULT '[]';
