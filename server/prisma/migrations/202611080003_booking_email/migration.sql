-- CreateTable
CREATE TABLE "booking_emails" (
    "id" TEXT NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstAttemptAt" TIMESTAMPTZ(6),
    "lease" TEXT,
    "claimedAt" TIMESTAMPTZ(6),
    "providerId" TEXT,
    "lastError" TEXT,
    "sentAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "booking_emails_bookingId_key" ON "booking_emails"("bookingId");

-- CreateIndex
CREATE INDEX "booking_emails_status_nextAttemptAt_idx" ON "booking_emails"("status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "booking_emails" ADD CONSTRAINT "booking_emails_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

