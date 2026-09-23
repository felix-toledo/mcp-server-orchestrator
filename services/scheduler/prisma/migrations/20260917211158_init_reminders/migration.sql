-- CreateEnum
CREATE TYPE "public"."ReminderScheduleType" AS ENUM ('ONCE', 'RECURRING');

-- CreateEnum
CREATE TYPE "public"."ReminderDeliveryStatus" AS ENUM ('DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."Reminder" (
    "id" TEXT NOT NULL,
    "actionDescription" TEXT NOT NULL,
    "scheduleType" "public"."ReminderScheduleType" NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "cronExpression" TEXT,
    "pgBossJobName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastFiredAt" TIMESTAMP(3),
    "lastDeliveryStatus" "public"."ReminderDeliveryStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);
