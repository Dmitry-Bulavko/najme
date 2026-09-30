-- CreateEnum
CREATE TYPE "custom_field_type" AS ENUM ('TEXT', 'NUMBER', 'SELECT');

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "staff_member_id" UUID;

-- CreateTable
CREATE TABLE "staff_members" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "photo_key" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "buffer_before_minutes" INTEGER NOT NULL DEFAULT 0,
    "buffer_after_minutes" INTEGER NOT NULL DEFAULT 0,
    "price_amount" INTEGER NOT NULL,
    "price_currency" TEXT NOT NULL DEFAULT 'EUR',
    "min_booking_notice_minutes" INTEGER,
    "booking_horizon_days" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_staff_assignments" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "staff_member_id" UUID NOT NULL,

    CONSTRAINT "service_staff_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_custom_field_definitions" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "custom_field_type" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_members_business_id_idx" ON "staff_members"("business_id");

-- CreateIndex
CREATE INDEX "services_business_id_idx" ON "services"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_staff_assignments_service_id_staff_member_id_key" ON "service_staff_assignments"("service_id", "staff_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_custom_field_definitions_service_id_key_key" ON "service_custom_field_definitions"("service_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_staff_member_id_key" ON "memberships"("staff_member_id");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_staff_member_id_fkey" FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_staff_assignments" ADD CONSTRAINT "service_staff_assignments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_staff_assignments" ADD CONSTRAINT "service_staff_assignments_staff_member_id_fkey" FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_custom_field_definitions" ADD CONSTRAINT "service_custom_field_definitions_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma cannot express CHECKs; keep in sync with docs/architecture/data-model.md.
ALTER TABLE "services"
  ADD CONSTRAINT "services_duration_minutes_check"
  CHECK ("duration_minutes" > 0);

ALTER TABLE "services"
  ADD CONSTRAINT "services_buffer_before_minutes_check"
  CHECK ("buffer_before_minutes" >= 0);

ALTER TABLE "services"
  ADD CONSTRAINT "services_buffer_after_minutes_check"
  CHECK ("buffer_after_minutes" >= 0);

ALTER TABLE "services"
  ADD CONSTRAINT "services_price_amount_check"
  CHECK ("price_amount" >= 0);
