-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "icon_key" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_translations" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "category_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "category_translations_category_id_locale_key" ON "category_translations"("category_id", "locale");

-- AddForeignKey
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the 10 initial categories (hard-coded UUID v7 ids). Idempotent for re-runs.
INSERT INTO "categories" ("id", "slug", "icon_key", "sort_order", "created_at", "updated_at")
VALUES
  ('01a0f2d0-ac73-737b-bf67-034ea979173c', 'transfer', NULL, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('01a0f2d0-ac74-7449-8db1-21e5f688523f', 'cleaning', NULL, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('01a0f2d0-ac74-7449-8db1-247c5195d741', 'dentist', NULL, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('01a0f2d0-ac74-7449-8db1-2a96d6a7e429', 'nails', NULL, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('01a0f2d0-ac74-7449-8db1-2e6495cd95bc', 'hair', NULL, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('01a0f2d0-ac74-7449-8db1-303a00ca3e75', 'massage', NULL, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('01a0f2d0-ac74-7449-8db1-35e015457584', 'beauty', NULL, 70, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('01a0f2d0-ac74-7449-8db1-38a87e840ebc', 'repair', NULL, 80, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('01a0f2d0-ac74-7449-8db1-3f4a6e99a791', 'babysitting', NULL, 90, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('01a0f2d0-ac74-7449-8db1-40ff64a3d5fd', 'tutoring', NULL, 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "category_translations" ("id", "category_id", "locale", "name")
VALUES
  -- transfer
  ('01a0f2d0-ac78-76bd-a5d0-77e51a95fed4', '01a0f2d0-ac73-737b-bf67-034ea979173c', 'en', 'Transfer'),
  ('01a0f2d0-ac78-76bd-a5d0-78df31214e74', '01a0f2d0-ac73-737b-bf67-034ea979173c', 'me', 'Transfer'),
  ('01a0f2d0-ac78-76bd-a5d0-7fb5c032c60c', '01a0f2d0-ac73-737b-bf67-034ea979173c', 'ru', 'Трансфер'),
  ('01a0f2d0-ac78-76bd-a5d0-80d3b2af0024', '01a0f2d0-ac73-737b-bf67-034ea979173c', 'tr', 'Transfer'),
  -- cleaning
  ('01a0f2d0-ac78-76bd-a5d0-846f2e115282', '01a0f2d0-ac74-7449-8db1-21e5f688523f', 'en', 'Cleaning'),
  ('01a0f2d0-ac78-76bd-a5d0-8a48aa965b14', '01a0f2d0-ac74-7449-8db1-21e5f688523f', 'me', 'Čišćenje'),
  ('01a0f2d0-ac78-76bd-a5d0-8cb74347dd74', '01a0f2d0-ac74-7449-8db1-21e5f688523f', 'ru', 'Клининг'),
  ('01a0f2d0-ac78-76bd-a5d0-90ea95e6e67d', '01a0f2d0-ac74-7449-8db1-21e5f688523f', 'tr', 'Temizlik'),
  -- dentist
  ('01a0f2d0-ac78-76bd-a5d0-95b3fb54b066', '01a0f2d0-ac74-7449-8db1-247c5195d741', 'en', 'Dentist'),
  ('01a0f2d0-ac78-76bd-a5d0-9b284a18c9a1', '01a0f2d0-ac74-7449-8db1-247c5195d741', 'me', 'Stomatolog'),
  ('01a0f2d0-ac78-76bd-a5d0-9e22f5e6067d', '01a0f2d0-ac74-7449-8db1-247c5195d741', 'ru', 'Стоматолог'),
  ('01a0f2d0-ac78-76bd-a5d0-a0dcb69cb810', '01a0f2d0-ac74-7449-8db1-247c5195d741', 'tr', 'Diş hekimi'),
  -- nails
  ('01a0f2d0-ac78-76bd-a5d0-a629a9f21d3a', '01a0f2d0-ac74-7449-8db1-2a96d6a7e429', 'en', 'Nails'),
  ('01a0f2d0-ac78-76bd-a5d0-a9429418f67a', '01a0f2d0-ac74-7449-8db1-2a96d6a7e429', 'me', 'Nokti'),
  ('01a0f2d0-ac78-76bd-a5d0-ae477c6c5593', '01a0f2d0-ac74-7449-8db1-2a96d6a7e429', 'ru', 'Ногти'),
  ('01a0f2d0-ac78-76bd-a5d0-b1e6d256452c', '01a0f2d0-ac74-7449-8db1-2a96d6a7e429', 'tr', 'Tırnak'),
  -- hair
  ('01a0f2d0-ac78-76bd-a5d0-b7d5c52a4fcc', '01a0f2d0-ac74-7449-8db1-2e6495cd95bc', 'en', 'Hair'),
  ('01a0f2d0-ac78-76bd-a5d0-bbb4dc1997b3', '01a0f2d0-ac74-7449-8db1-2e6495cd95bc', 'me', 'Frizerski'),
  ('01a0f2d0-ac78-76bd-a5d0-bd92f2dc2b96', '01a0f2d0-ac74-7449-8db1-2e6495cd95bc', 'ru', 'Парикмахерская'),
  ('01a0f2d0-ac78-76bd-a5d0-c25a110815e6', '01a0f2d0-ac74-7449-8db1-2e6495cd95bc', 'tr', 'Kuaför'),
  -- massage
  ('01a0f2d0-ac78-76bd-a5d0-c431c854a182', '01a0f2d0-ac74-7449-8db1-303a00ca3e75', 'en', 'Massage'),
  ('01a0f2d0-ac78-76bd-a5d0-c9f00d627417', '01a0f2d0-ac74-7449-8db1-303a00ca3e75', 'me', 'Masaža'),
  ('01a0f2d0-ac78-76bd-a5d0-cfd1155cc4a7', '01a0f2d0-ac74-7449-8db1-303a00ca3e75', 'ru', 'Массаж'),
  ('01a0f2d0-ac78-76bd-a5d0-d04c4656fc26', '01a0f2d0-ac74-7449-8db1-303a00ca3e75', 'tr', 'Masaj'),
  -- beauty
  ('01a0f2d0-ac78-76bd-a5d0-d6d8ec938a79', '01a0f2d0-ac74-7449-8db1-35e015457584', 'en', 'Beauty'),
  ('01a0f2d0-ac78-76bd-a5d0-daf5c4b0bab3', '01a0f2d0-ac74-7449-8db1-35e015457584', 'me', 'Ljepota'),
  ('01a0f2d0-ac78-76bd-a5d0-de80fe4e8204', '01a0f2d0-ac74-7449-8db1-35e015457584', 'ru', 'Красота'),
  ('01a0f2d0-ac78-76bd-a5d0-e36e5ee9ba47', '01a0f2d0-ac74-7449-8db1-35e015457584', 'tr', 'Güzellik'),
  -- repair
  ('01a0f2d0-ac78-76bd-a5d0-e591f23344b6', '01a0f2d0-ac74-7449-8db1-38a87e840ebc', 'en', 'Repair'),
  ('01a0f2d0-ac78-76bd-a5d0-e9b293cd9da9', '01a0f2d0-ac74-7449-8db1-38a87e840ebc', 'me', 'Popravke'),
  ('01a0f2d0-ac78-76bd-a5d0-eeb7d8286631', '01a0f2d0-ac74-7449-8db1-38a87e840ebc', 'ru', 'Ремонт'),
  ('01a0f2d0-ac78-76bd-a5d0-f00f52f954f7', '01a0f2d0-ac74-7449-8db1-38a87e840ebc', 'tr', 'Tamir'),
  -- babysitting
  ('01a0f2d0-ac78-76bd-a5d0-f76c659f2bd9', '01a0f2d0-ac74-7449-8db1-3f4a6e99a791', 'en', 'Babysitting'),
  ('01a0f2d0-ac78-76bd-a5d0-f84e2f36b9d9', '01a0f2d0-ac74-7449-8db1-3f4a6e99a791', 'me', 'Čuvanje djece'),
  ('01a0f2d0-ac78-76bd-a5d0-fe1fdc55fb4b', '01a0f2d0-ac74-7449-8db1-3f4a6e99a791', 'ru', 'Няня'),
  ('01a0f2d0-ac78-76bd-a5d1-00aafbd81628', '01a0f2d0-ac74-7449-8db1-3f4a6e99a791', 'tr', 'Bebek bakımı'),
  -- tutoring
  ('01a0f2d0-ac78-76bd-a5d1-04408813cd89', '01a0f2d0-ac74-7449-8db1-40ff64a3d5fd', 'en', 'Tutoring'),
  ('01a0f2d0-ac78-76bd-a5d1-096c75605d45', '01a0f2d0-ac74-7449-8db1-40ff64a3d5fd', 'me', 'Instrukcije'),
  ('01a0f2d0-ac78-76bd-a5d1-0d70310d8c3b', '01a0f2d0-ac74-7449-8db1-40ff64a3d5fd', 'ru', 'Репетиторство'),
  ('01a0f2d0-ac79-70bc-bfd7-9ead71b45f51', '01a0f2d0-ac74-7449-8db1-40ff64a3d5fd', 'tr', 'Özel ders')
ON CONFLICT ("id") DO NOTHING;
