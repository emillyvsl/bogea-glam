CREATE TABLE "categories" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");
UPDATE "services" SET "category" = 'Sem categoria' WHERE trim("category") = '';
INSERT INTO "categories" ("name") SELECT DISTINCT "category" FROM "services";
ALTER TABLE "services" ADD CONSTRAINT "services_category_fkey" FOREIGN KEY ("category") REFERENCES "categories"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
