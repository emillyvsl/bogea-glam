-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "customer_id" INTEGER,
ADD COLUMN     "service_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "expires_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "professionals" ADD COLUMN     "all_services" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "hours" JSONB,
ADD COLUMN     "service_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "user_id" INTEGER;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "image" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "salon" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT 'Bogéa Glam',
    "address" TEXT NOT NULL DEFAULT '',
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "hours" JSONB NOT NULL,
    "reminder_hours" INTEGER NOT NULL DEFAULT 24,

    CONSTRAINT "salon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "start" INTEGER NOT NULL,
    "end" INTEGER NOT NULL,
    "professional_id" INTEGER,
    "reason" TEXT NOT NULL,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "checkout_url" TEXT,
    "transaction_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pendente',
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Na fila',
    "sid" TEXT,
    "error" TEXT,
    "claimed_at" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_transaction_id_key" ON "payments"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_booking_id_kind_key" ON "notifications"("booking_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "professionals_user_id_key" ON "professionals"("user_id");

-- AddForeignKey
ALTER TABLE "professionals" ADD CONSTRAINT "professionals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve service labels for existing appointments.
UPDATE "bookings" b SET "service_names" = ARRAY(SELECT s.name FROM services s WHERE s.id = ANY(b.service_ids) ORDER BY s.id);

UPDATE "services" SET "image" = CASE "name"
  WHEN 'Mechas loiras' THEN '/images/mechas.jpg'
  WHEN 'Escova' THEN '/images/escova.jpg'
  WHEN 'Tratamento capilar' THEN '/images/tratamento.jpg'
  WHEN 'Maquiagem express' THEN '/images/maquiagem.jpg'
  ELSE '' END;
