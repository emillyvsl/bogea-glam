CREATE TABLE "payment_events" (
 "id" TEXT NOT NULL,"key" TEXT NOT NULL,"order_id" TEXT NOT NULL,"transaction_id" TEXT,"slug" TEXT,"event" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'Pendente',"attempts" INTEGER NOT NULL DEFAULT 0,"next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "error" TEXT,"created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_events_key_key" ON "payment_events"("key");
CREATE INDEX "payment_events_status_next_attempt_at_idx" ON "payment_events"("status","next_attempt_at");