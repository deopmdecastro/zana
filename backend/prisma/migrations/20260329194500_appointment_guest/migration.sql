-- Allow appointments without a registered user (guest booking).
ALTER TABLE "Appointment" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "guestName" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "guestEmail" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "guestPhone" TEXT;
