ALTER TABLE "bookings" ADD COLUMN "terms_accepted_at" TIMESTAMPTZ(6),
ADD COLUMN "terms_version" TEXT;
