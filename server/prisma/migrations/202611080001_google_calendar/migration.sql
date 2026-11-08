-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "client_email" TEXT;

-- CreateTable
CREATE TABLE "google_calendar_connections" (
    "id" TEXT NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "googleAccountEmail" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "refreshTokenEncrypted" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "connectedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "google_calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_calendar_syncs" (
    "id" TEXT NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "connectionId" TEXT,
    "calendarId" TEXT,
    "googleEventId" TEXT,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "fingerprint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease" TEXT,
    "claimedAt" TIMESTAMPTZ(6),
    "lastError" TEXT,
    "syncedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "google_calendar_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_calendar_oauth_states" (
    "hash" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "google_calendar_oauth_states_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE INDEX "google_calendar_connections_professionalId_status_idx" ON "google_calendar_connections"("professionalId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "google_calendar_syncs_bookingId_key" ON "google_calendar_syncs"("bookingId");

-- CreateIndex
CREATE INDEX "google_calendar_syncs_status_nextAttemptAt_idx" ON "google_calendar_syncs"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "google_calendar_oauth_states_expiresAt_idx" ON "google_calendar_oauth_states"("expiresAt");

-- AddForeignKey
ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professionals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_calendar_syncs" ADD CONSTRAINT "google_calendar_syncs_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_calendar_syncs" ADD CONSTRAINT "google_calendar_syncs_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "google_calendar_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE UNIQUE INDEX "google_one_connected_professional" ON "google_calendar_connections" ("professionalId") WHERE "status" = 'CONNECTED';
