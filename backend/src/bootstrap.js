import { prisma } from './prisma.js'

const ddl = [
  `
  CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Portugal',
    "newsletterOptIn" BOOLEAN NOT NULL DEFAULT FALSE,
    "orderUpdatesEmail" BOOLEAN NOT NULL DEFAULT TRUE,
    "passwordHash" TEXT NOT NULL,
    "passwordSalt" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User" ("email");`,
  `CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User" ("createdAt");`,

  // Backfill/upgrade existing local DBs created before these columns existed.
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;`,
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "addressLine1" TEXT;`,
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "addressLine2" TEXT;`,
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "city" TEXT;`,
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;`,
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'Portugal';`,
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "newsletterOptIn" BOOLEAN NOT NULL DEFAULT FALSE;`,
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "orderUpdatesEmail" BOOLEAN NOT NULL DEFAULT TRUE;`,

  `
  CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "usedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
  );
  `,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken" ("tokenHash");`,
  `CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken" ("userId");`,
  `CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken" ("expiresAt");`,
  `CREATE INDEX IF NOT EXISTS "PasswordResetToken_usedAt_idx" ON "PasswordResetToken" ("usedAt");`,

  `
  CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" NUMERIC(12,2) NOT NULL,
    "originalPrice" NUMERIC(12,2),
    "category" TEXT NOT NULL,
    "material" TEXT,
    "colors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "stock" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT FALSE,
    "isNew" BOOLEAN NOT NULL DEFAULT FALSE,
    "isBestseller" BOOLEAN NOT NULL DEFAULT FALSE,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE INDEX IF NOT EXISTS "Product_category_idx" ON "Product" ("category");`,
  `CREATE INDEX IF NOT EXISTS "Product_status_idx" ON "Product" ("status");`,

  `
  CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT PRIMARY KEY,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "shippingAddress" TEXT,
    "shippingCity" TEXT,
    "shippingPostalCode" TEXT,
    "shippingCountry" TEXT NOT NULL DEFAULT 'Portugal',
    "subtotal" NUMERIC(12,2),
    "shippingCost" NUMERIC(12,2) NOT NULL DEFAULT 0,
    "total" NUMERIC(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order" ("status");`,
  `CREATE INDEX IF NOT EXISTS "Order_customerEmail_idx" ON "Order" ("customerEmail");`,

  `
  CREATE TABLE IF NOT EXISTS "OrderItem" (
    "id" TEXT PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "productImage" TEXT,
    "price" NUMERIC(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "color" TEXT,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE,
    CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL
  );
  `,
  `CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem" ("orderId");`,
  `CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem" ("productId");`,

  `
  CREATE TABLE IF NOT EXISTS "Review" (
    "id" TEXT PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "authorName" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE
  );
  `,
  `CREATE INDEX IF NOT EXISTS "Review_productId_idx" ON "Review" ("productId");`,

  `
  CREATE TABLE IF NOT EXISTS "WishlistItem" (
    "id" TEXT PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "productName" TEXT,
    "productImage" TEXT,
    "productPrice" NUMERIC(12,2),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE INDEX IF NOT EXISTS "WishlistItem_productId_idx" ON "WishlistItem" ("productId");`,

  `
  CREATE TABLE IF NOT EXISTS "BlogPost" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "imageUrl" TEXT,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE INDEX IF NOT EXISTS "BlogPost_status_idx" ON "BlogPost" ("status");`,
  `CREATE INDEX IF NOT EXISTS "BlogPost_category_idx" ON "BlogPost" ("category");`,
]

export async function ensureSchema() {
  for (const statement of ddl) {
    // Static DDL, no user input.
    // eslint-disable-next-line no-await-in-loop
    await prisma.$executeRawUnsafe(statement)
  }
}
