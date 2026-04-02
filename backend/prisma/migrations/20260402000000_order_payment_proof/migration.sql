-- Store optional payment proof (e.g. transfer receipt) for manual payments.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentProofUrl" TEXT;

