-- CreateEnum
CREATE TYPE "city" AS ENUM ('ANDRIJEVICA', 'BAR', 'BERANE', 'BIJELO_POLJE', 'BUDVA', 'CETINJE', 'DANILOVGRAD', 'GUSINJE', 'HERCEG_NOVI', 'KOLASIN', 'KOTOR', 'MOJKOVAC', 'NIKSIC', 'PETNJICA', 'PLAV', 'PLJEVLJA', 'PLUZINE', 'PODGORICA', 'ROZAJE', 'SAVNIK', 'TIVAT', 'TUZI', 'ULCINJ', 'ZABLJAK', 'ZETA');

-- CreateEnum
CREATE TYPE "business_status" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "confirmation_mode" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "membership_role" AS ENUM ('OWNER', 'ADMIN', 'STAFF');

-- CreateTable
CREATE TABLE "businesses" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "description" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Podgorica',
    "city" "city" NOT NULL,
    "address" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "logo_key" TEXT,
    "cover_key" TEXT,
    "confirmation_mode" "confirmation_mode" NOT NULL DEFAULT 'AUTO',
    "cancellation_window_minutes" INTEGER NOT NULL DEFAULT 120,
    "min_booking_notice_minutes" INTEGER NOT NULL DEFAULT 60,
    "booking_horizon_days" INTEGER NOT NULL DEFAULT 60,
    "status" "business_status" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approved_at" TIMESTAMPTZ(3),
    "rejection_reason" TEXT,
    "reviewed_at" TIMESTAMPTZ(3),
    "reviewed_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "role" "membership_role" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "businesses_slug_key" ON "businesses"("slug");

-- CreateIndex
CREATE INDEX "businesses_status_category_id_city_idx" ON "businesses"("status", "category_id", "city");

-- CreateIndex
CREATE INDEX "memberships_business_id_idx" ON "memberships"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_business_id_key" ON "memberships"("user_id", "business_id");

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot express CHECKs; keep in sync with docs/architecture/data-model.md.
ALTER TABLE "businesses"
  ADD CONSTRAINT "businesses_cancellation_window_minutes_check"
  CHECK ("cancellation_window_minutes" >= 0);

ALTER TABLE "businesses"
  ADD CONSTRAINT "businesses_min_booking_notice_minutes_check"
  CHECK ("min_booking_notice_minutes" >= 0);

ALTER TABLE "businesses"
  ADD CONSTRAINT "businesses_booking_horizon_days_check"
  CHECK ("booking_horizon_days" BETWEEN 1 AND 365);
