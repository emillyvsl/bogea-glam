ALTER TABLE "bookings" ADD COLUMN "protocol" TEXT;
CREATE UNIQUE INDEX "bookings_protocol_key" ON "bookings"("protocol");
UPDATE "bookings" SET "protocol" = 'BG-' || upper(substr(md5(random()::text || clock_timestamp()::text || id::text),1,24)) WHERE "status" IN ('Confirmado','Em atendimento','Concluído');