import { prisma } from './prisma.js'

const ddl = [
  `
  CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT FALSE,
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
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT FALSE;`,
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
    "isApproved" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE
  );
  `,
  `ALTER TABLE IF EXISTS "Review" ADD COLUMN IF NOT EXISTS "isApproved" BOOLEAN NOT NULL DEFAULT FALSE;`,
  `CREATE INDEX IF NOT EXISTS "Review_productId_idx" ON "Review" ("productId");`,
  `CREATE INDEX IF NOT EXISTS "Review_isApproved_idx" ON "Review" ("isApproved");`,

  `
  CREATE TABLE IF NOT EXISTS "WishlistItem" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT,
    "productId" TEXT NOT NULL,
    "productName" TEXT,
    "productImage" TEXT,
    "productPrice" NUMERIC(12,2),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `ALTER TABLE IF EXISTS "WishlistItem" ADD COLUMN IF NOT EXISTS "userId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "WishlistItem_productId_idx" ON "WishlistItem" ("productId");`,
  `CREATE INDEX IF NOT EXISTS "WishlistItem_userId_idx" ON "WishlistItem" ("userId");`,

  `
  CREATE TABLE IF NOT EXISTS "PageView" (
    "id" TEXT PRIMARY KEY,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "userId" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE INDEX IF NOT EXISTS "PageView_createdAt_idx" ON "PageView" ("createdAt");`,
  `CREATE INDEX IF NOT EXISTS "PageView_path_idx" ON "PageView" ("path");`,
  `CREATE INDEX IF NOT EXISTS "PageView_userId_idx" ON "PageView" ("userId");`,

  `
  CREATE TABLE IF NOT EXISTS "ProductView" (
    "id" TEXT PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "ProductView_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE
  );
  `,
  `CREATE INDEX IF NOT EXISTS "ProductView_createdAt_idx" ON "ProductView" ("createdAt");`,
  `CREATE INDEX IF NOT EXISTS "ProductView_productId_idx" ON "ProductView" ("productId");`,

  `
  CREATE TABLE IF NOT EXISTS "SearchEvent" (
    "id" TEXT PRIMARY KEY,
    "query" TEXT NOT NULL,
    "queryNormalized" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE INDEX IF NOT EXISTS "SearchEvent_createdAt_idx" ON "SearchEvent" ("createdAt");`,
  `CREATE INDEX IF NOT EXISTS "SearchEvent_queryNormalized_idx" ON "SearchEvent" ("queryNormalized");`,
  `CREATE INDEX IF NOT EXISTS "SearchEvent_userId_idx" ON "SearchEvent" ("userId");`,

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

  `
  CREATE TABLE IF NOT EXISTS "SiteContent" (
    "key" TEXT PRIMARY KEY,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE INDEX IF NOT EXISTS "SiteContent_updatedAt_idx" ON "SiteContent" ("updatedAt");`,

  `
  CREATE TABLE IF NOT EXISTS "FaqItem" (
    "id" TEXT PRIMARY KEY,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE INDEX IF NOT EXISTS "FaqItem_isActive_idx" ON "FaqItem" ("isActive");`,
  `CREATE INDEX IF NOT EXISTS "FaqItem_order_idx" ON "FaqItem" ("order");`,
  `CREATE INDEX IF NOT EXISTS "FaqItem_createdAt_idx" ON "FaqItem" ("createdAt");`,

  `
  CREATE TABLE IF NOT EXISTS "InstagramPost" (
    "id" TEXT PRIMARY KEY,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE INDEX IF NOT EXISTS "InstagramPost_isActive_idx" ON "InstagramPost" ("isActive");`,
  `CREATE INDEX IF NOT EXISTS "InstagramPost_createdAt_idx" ON "InstagramPost" ("createdAt");`,

  `
  CREATE TABLE IF NOT EXISTS "Supplier" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE INDEX IF NOT EXISTS "Supplier_createdAt_idx" ON "Supplier" ("createdAt");`,
  `CREATE INDEX IF NOT EXISTS "Supplier_name_idx" ON "Supplier" ("name");`,

  `
  CREATE TABLE IF NOT EXISTS "Purchase" (
    "id" TEXT PRIMARY KEY,
    "supplierId" TEXT,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "purchasedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "notes" TEXT,
    "total" NUMERIC(12,2),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL
  );
  `,
  `CREATE INDEX IF NOT EXISTS "Purchase_createdAt_idx" ON "Purchase" ("createdAt");`,
  `CREATE INDEX IF NOT EXISTS "Purchase_purchasedAt_idx" ON "Purchase" ("purchasedAt");`,
  `CREATE INDEX IF NOT EXISTS "Purchase_status_idx" ON "Purchase" ("status");`,
  `CREATE INDEX IF NOT EXISTS "Purchase_supplierId_idx" ON "Purchase" ("supplierId");`,

  `
  CREATE TABLE IF NOT EXISTS "PurchaseItem" (
    "id" TEXT PRIMARY KEY,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "unitCost" NUMERIC(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE,
    CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL
  );
  `,
  `CREATE INDEX IF NOT EXISTS "PurchaseItem_purchaseId_idx" ON "PurchaseItem" ("purchaseId");`,
  `CREATE INDEX IF NOT EXISTS "PurchaseItem_productId_idx" ON "PurchaseItem" ("productId");`,

  `
  CREATE TABLE IF NOT EXISTS "InventoryMovement" (
    "id" TEXT PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "unitCost" NUMERIC(12,2),
    "purchaseId" TEXT,
    "actorId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE,
    CONSTRAINT "InventoryMovement_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL,
    CONSTRAINT "InventoryMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL
  );
  `,
  `CREATE INDEX IF NOT EXISTS "InventoryMovement_createdAt_idx" ON "InventoryMovement" ("createdAt");`,
  `CREATE INDEX IF NOT EXISTS "InventoryMovement_productId_idx" ON "InventoryMovement" ("productId");`,
  `CREATE INDEX IF NOT EXISTS "InventoryMovement_type_idx" ON "InventoryMovement" ("type");`,
  `CREATE INDEX IF NOT EXISTS "InventoryMovement_purchaseId_idx" ON "InventoryMovement" ("purchaseId");`,
  `CREATE INDEX IF NOT EXISTS "InventoryMovement_actorId_idx" ON "InventoryMovement" ("actorId");`,

  `
  CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT PRIMARY KEY,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt");`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_entityType_idx" ON "AuditLog" ("entityType");`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog" ("actorId");`,
]

export async function ensureSchema() {
  for (const statement of ddl) {
    // Static DDL, no user input.
    // eslint-disable-next-line no-await-in-loop
    await prisma.$executeRawUnsafe(statement)
  }
}
