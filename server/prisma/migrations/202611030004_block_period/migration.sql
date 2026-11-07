ALTER TABLE "blocks" ADD COLUMN "end_date" DATE;
UPDATE "blocks" SET "end_date" = "date";
ALTER TABLE "blocks" ALTER COLUMN "end_date" SET NOT NULL;
CREATE INDEX "blocks_date_end_date_idx" ON "blocks"("date", "end_date");
