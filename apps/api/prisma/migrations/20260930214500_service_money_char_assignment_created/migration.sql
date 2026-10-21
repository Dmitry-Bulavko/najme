-- Align service price currency with Char(3) money convention; assignment created_at (#74 review).
ALTER TABLE "services" ALTER COLUMN "price_currency" TYPE CHAR(3);
ALTER TABLE "service_staff_assignments" ADD COLUMN "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
