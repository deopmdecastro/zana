import { prisma } from './prisma.js'

const ddl = [
  // Enums (Postgres). Prisma binds parameters using these types, so they must exist even if
  // local tables were created with TEXT columns.
  `DO $$ BEGIN CREATE TYPE "ProductCategory" AS ENUM ('colares','brincos','pulseiras','aneis','conjuntos'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN CREATE TYPE "ProductMaterial" AS ENUM ('aco_inox','prata','dourado','rose_gold','perolas','cristais'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN CREATE TYPE "ProductStatus" AS ENUM ('active','inactive','out_of_stock'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN CREATE TYPE "OrderStatus" AS ENUM ('pending','confirmed','processing','shipped','delivered','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN CREATE TYPE "AppointmentStatus" AS ENUM ('pending','confirmed','cancelled','completed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN CREATE TYPE "PaymentMethod" AS ENUM ('mbway','transferencia','multibanco','paypal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN CREATE TYPE "CouponType" AS ENUM ('amount','percent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN CREATE TYPE "BlogCategory" AS ENUM ('tendencias','dicas','novidades','inspiracao'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN CREATE TYPE "BlogStatus" AS ENUM ('draft','published'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN CREATE TYPE "SupportTicketStatus" AS ENUM ('open','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN CREATE TYPE "SupportMessageAuthorType" AS ENUM ('customer','admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN CREATE TYPE "PurchaseStatus" AS ENUM ('draft','received','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN CREATE TYPE "InventoryMovementType" AS ENUM ('purchase','manual','order'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN CREATE TYPE "BlogCommentReplyAuthorType" AS ENUM ('customer','admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,

  `
  CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT FALSE,
    "isDeleted" BOOLEAN NOT NULL DEFAULT FALSE,
    "fullName" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Portugal',
    "newsletterOptIn" BOOLEAN NOT NULL DEFAULT FALSE,
    "orderUpdatesEmail" BOOLEAN NOT NULL DEFAULT TRUE,
    "pointsBalance" INTEGER NOT NULL DEFAULT 0,
    "passwordHash" TEXT NOT NULL,
    "passwordSalt" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User" ("email");`,
  `CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User" ("createdAt");`,

  `
  CREATE TABLE IF NOT EXISTS "UserAddress" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Portugal',
    "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "UserAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
  );
  `,
  `CREATE INDEX IF NOT EXISTS "UserAddress_userId_idx" ON "UserAddress" ("userId");`,
  `CREATE INDEX IF NOT EXISTS "UserAddress_isDefault_idx" ON "UserAddress" ("isDefault");`,
  `CREATE INDEX IF NOT EXISTS "UserAddress_createdAt_idx" ON "UserAddress" ("createdAt");`,

  // Backfill/upgrade older local DBs.
  `ALTER TABLE IF EXISTS "UserAddress" ADD COLUMN IF NOT EXISTS "label" TEXT;`,
  `ALTER TABLE IF EXISTS "UserAddress" ADD COLUMN IF NOT EXISTS "line1" TEXT;`,
  `ALTER TABLE IF EXISTS "UserAddress" ADD COLUMN IF NOT EXISTS "line2" TEXT;`,
  `ALTER TABLE IF EXISTS "UserAddress" ADD COLUMN IF NOT EXISTS "city" TEXT;`,
  `ALTER TABLE IF EXISTS "UserAddress" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;`,
  `ALTER TABLE IF EXISTS "UserAddress" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'Portugal';`,
  `ALTER TABLE IF EXISTS "UserAddress" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT FALSE;`,
  `ALTER TABLE IF EXISTS "UserAddress" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();`,
  `ALTER TABLE IF EXISTS "UserAddress" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();`,

  // Backfill/upgrade existing local DBs created before these columns existed.
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT FALSE;`,
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "isSeller" BOOLEAN NOT NULL DEFAULT FALSE;`,
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT FALSE;`,
  `CREATE INDEX IF NOT EXISTS "User_isDeleted_idx" ON "User" ("isDeleted");`,
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;`,
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "addressLine1" TEXT;`,
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "addressLine2" TEXT;`,
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "city" TEXT;`,
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;`,
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'Portugal';`,
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "newsletterOptIn" BOOLEAN NOT NULL DEFAULT FALSE;`,
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "orderUpdatesEmail" BOOLEAN NOT NULL DEFAULT TRUE;`,
  `ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "pointsBalance" INTEGER NOT NULL DEFAULT 0;`,

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
	    "acquisitionCost" NUMERIC(12,2),
	    "originalPrice" NUMERIC(12,2),
	    "category" "ProductCategory" NOT NULL,
	    "material" "ProductMaterial",
	    "colors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
	    "sizes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
	    "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
	    "videos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
	    "stock" INTEGER NOT NULL DEFAULT 0,
	    "freeShipping" BOOLEAN NOT NULL DEFAULT FALSE,
	    "isFeatured" BOOLEAN NOT NULL DEFAULT FALSE,
	    "isNew" BOOLEAN NOT NULL DEFAULT FALSE,
	    "isBestseller" BOOLEAN NOT NULL DEFAULT FALSE,
	    "status" "ProductStatus" NOT NULL DEFAULT 'active',
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
    "shippingMethodId" TEXT,
    "shippingMethodLabel" TEXT,
    "trackingCode" TEXT,
    "trackingUrl" TEXT,
    "trackingCarrier" TEXT,
    "subtotal" NUMERIC(12,2),
    "shippingCost" NUMERIC(12,2) NOT NULL DEFAULT 0,
    "total" NUMERIC(12,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "paymentMethod" "PaymentMethod",
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order" ("status");`,
  `CREATE INDEX IF NOT EXISTS "Order_customerEmail_idx" ON "Order" ("customerEmail");`,
  `CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order" ("createdAt");`,

  `DO $$ BEGIN CREATE TABLE IF NOT EXISTS "Coupon" (
    "id" TEXT PRIMARY KEY,
    "code" TEXT NOT NULL,
    "type" "CouponType" NOT NULL DEFAULT 'amount',
    "value" NUMERIC(12,2) NOT NULL,
    "description" TEXT,
    "maxUses" INTEGER DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "expiresAt" TIMESTAMPTZ,
    "minOrderSubtotal" NUMERIC(12,2),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  ); EXCEPTION WHEN duplicate_table THEN NULL; END $$;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_uq" ON "Coupon" ("code");`,
  `CREATE TABLE IF NOT EXISTS "SalesTarget" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMPTZ NOT NULL,
    "endAt" TIMESTAMPTZ NOT NULL,
    "goalAmount" NUMERIC(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS "SalesTarget_startAt_idx" ON "SalesTarget" ("startAt");`,
  `CREATE INDEX IF NOT EXISTS "SalesTarget_endAt_idx" ON "SalesTarget" ("endAt");`,
  `CREATE TABLE IF NOT EXISTS "CashClosure" (
    "id" TEXT PRIMARY KEY,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "endedAt" TIMESTAMPTZ,
    "openingBalance" NUMERIC(12,2) NOT NULL,
    "closingBalance" NUMERIC(12,2) NOT NULL,
    "totalSales" NUMERIC(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS "CashClosure_startedAt_idx" ON "CashClosure" ("startedAt");`,
  `CREATE INDEX IF NOT EXISTS "CashClosure_endedAt_idx" ON "CashClosure" ("endedAt");`,

	  `ALTER TABLE IF EXISTS "Product" ADD COLUMN IF NOT EXISTS "freeShipping" BOOLEAN NOT NULL DEFAULT FALSE;`,
	  `ALTER TABLE IF EXISTS "Product" ADD COLUMN IF NOT EXISTS "videos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];`,
    `ALTER TABLE IF EXISTS "Product" ADD COLUMN IF NOT EXISTS "acquisitionCost" NUMERIC(12,2);`,
    `ALTER TABLE IF EXISTS "Product" ADD COLUMN IF NOT EXISTS "sizes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];`,
  `ALTER TABLE IF EXISTS "Order" ADD COLUMN IF NOT EXISTS "shippingMethodId" TEXT;`,
  `ALTER TABLE IF EXISTS "Order" ADD COLUMN IF NOT EXISTS "shippingMethodLabel" TEXT;`,
  `ALTER TABLE IF EXISTS "Order" ADD COLUMN IF NOT EXISTS "trackingCode" TEXT;`,
  `ALTER TABLE IF EXISTS "Order" ADD COLUMN IF NOT EXISTS "trackingUrl" TEXT;`,
  `ALTER TABLE IF EXISTS "Order" ADD COLUMN IF NOT EXISTS "trackingCarrier" TEXT;`,
  `ALTER TABLE IF EXISTS "Order" ADD COLUMN IF NOT EXISTS "couponId" TEXT;`,
  `ALTER TABLE IF EXISTS "Order" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;`,
  `ALTER TABLE IF EXISTS "Order" ADD COLUMN IF NOT EXISTS "discountAmount" NUMERIC(12,2);`,
  `ALTER TABLE IF EXISTS "Order" ADD COLUMN IF NOT EXISTS "discountType" "CouponType";`,
  `ALTER TABLE IF EXISTS "Order" ADD COLUMN IF NOT EXISTS "pointsUsed" INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE IF EXISTS "Order" ADD COLUMN IF NOT EXISTS "pointsDiscount" NUMERIC(12,2) NOT NULL DEFAULT 0;`,
  `ALTER TABLE IF EXISTS "Order" ADD COLUMN IF NOT EXISTS "paymentProofUrl" TEXT;`,
  `ALTER TABLE IF EXISTS "Order" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'marketplace';`,

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
    "userId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "authorName" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT FALSE,
    "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "videos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE
  );
  `,
  `ALTER TABLE IF EXISTS "Review" ADD COLUMN IF NOT EXISTS "isApproved" BOOLEAN NOT NULL DEFAULT FALSE;`,
  `ALTER TABLE IF EXISTS "Review" ADD COLUMN IF NOT EXISTS "userId" TEXT;`,
  `ALTER TABLE IF EXISTS "Review" ADD COLUMN IF NOT EXISTS "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];`,
  `ALTER TABLE IF EXISTS "Review" ADD COLUMN IF NOT EXISTS "videos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];`,
  `ALTER TABLE IF EXISTS "Review" ADD COLUMN IF NOT EXISTS "pointsAwarded" INTEGER NOT NULL DEFAULT 0;`,
  `CREATE INDEX IF NOT EXISTS "Review_productId_idx" ON "Review" ("productId");`,
  `CREATE INDEX IF NOT EXISTS "Review_isApproved_idx" ON "Review" ("isApproved");`,
  `CREATE INDEX IF NOT EXISTS "Review_userId_idx" ON "Review" ("userId");`,

  `
  CREATE TABLE IF NOT EXISTS "Service" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "price" NUMERIC(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE INDEX IF NOT EXISTS "Service_isActive_idx" ON "Service" ("isActive");`,
  `CREATE INDEX IF NOT EXISTS "Service_createdAt_idx" ON "Service" ("createdAt");`,
  `ALTER TABLE IF EXISTS "Service" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;`,
  `ALTER TABLE IF EXISTS "Service" ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER NOT NULL DEFAULT 30;`,
  `ALTER TABLE IF EXISTS "Service" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE;`,

  `
  CREATE TABLE IF NOT EXISTS "StaffMember" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "availability" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE INDEX IF NOT EXISTS "StaffMember_isActive_idx" ON "StaffMember" ("isActive");`,
  `CREATE INDEX IF NOT EXISTS "StaffMember_createdAt_idx" ON "StaffMember" ("createdAt");`,
  `ALTER TABLE IF EXISTS "StaffMember" ADD COLUMN IF NOT EXISTS "availability" JSONB;`,
  `ALTER TABLE IF EXISTS "StaffMember" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE;`,

  `
  CREATE TABLE IF NOT EXISTS "StaffService" (
    "staffId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("staffId","serviceId"),
    CONSTRAINT "StaffService_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE CASCADE,
    CONSTRAINT "StaffService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE
  );
  `,
  `CREATE INDEX IF NOT EXISTS "StaffService_serviceId_idx" ON "StaffService" ("serviceId");`,
  `CREATE INDEX IF NOT EXISTS "StaffService_staffId_idx" ON "StaffService" ("staffId");`,
  `CREATE INDEX IF NOT EXISTS "StaffService_createdAt_idx" ON "StaffService" ("createdAt");`,

  `
  CREATE TABLE IF NOT EXISTS "Appointment" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT,
    "guestName" TEXT,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "serviceId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "endAt" TIMESTAMPTZ NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'pending',
    "observations" TEXT,
    "imageUrl" TEXT,
    "reminderSentAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Appointment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT,
    CONSTRAINT "Appointment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT
  );
  `,
  `CREATE INDEX IF NOT EXISTS "Appointment_userId_idx" ON "Appointment" ("userId");`,
  `CREATE INDEX IF NOT EXISTS "Appointment_serviceId_idx" ON "Appointment" ("serviceId");`,
  `CREATE INDEX IF NOT EXISTS "Appointment_staffId_startAt_idx" ON "Appointment" ("staffId","startAt");`,
  `CREATE INDEX IF NOT EXISTS "Appointment_status_idx" ON "Appointment" ("status");`,
  `CREATE INDEX IF NOT EXISTS "Appointment_startAt_idx" ON "Appointment" ("startAt");`,
  `ALTER TABLE IF EXISTS "Appointment" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMPTZ;`,
  `ALTER TABLE IF EXISTS "Appointment" ADD COLUMN IF NOT EXISTS "observations" TEXT;`,
  `ALTER TABLE IF EXISTS "Appointment" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;`,
  `ALTER TABLE IF EXISTS "Appointment" ADD COLUMN IF NOT EXISTS "guestName" TEXT;`,
  `ALTER TABLE IF EXISTS "Appointment" ADD COLUMN IF NOT EXISTS "guestEmail" TEXT;`,
  `ALTER TABLE IF EXISTS "Appointment" ADD COLUMN IF NOT EXISTS "guestPhone" TEXT;`,

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
		    "category" "BlogCategory",
		    "status" "BlogStatus" NOT NULL DEFAULT 'draft',
		    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
		  );
		  `,
	  `CREATE INDEX IF NOT EXISTS "BlogPost_status_idx" ON "BlogPost" ("status");`,
	  `CREATE INDEX IF NOT EXISTS "BlogPost_category_idx" ON "BlogPost" ("category");`,

	  `
		  CREATE TABLE IF NOT EXISTS "BlogComment" (
		    "id" TEXT PRIMARY KEY,
		    "postId" TEXT NOT NULL,
		    "userId" TEXT,
		    "authorName" TEXT NOT NULL,
		    "authorEmail" TEXT,
		    "content" TEXT NOT NULL,
		    "isApproved" BOOLEAN NOT NULL DEFAULT FALSE,
		    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		    CONSTRAINT "BlogComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE,
		    CONSTRAINT "BlogComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
		  );
		  `,
		  `ALTER TABLE IF EXISTS "BlogComment" ADD COLUMN IF NOT EXISTS "userId" TEXT;`,
		  `CREATE INDEX IF NOT EXISTS "BlogComment_postId_idx" ON "BlogComment" ("postId");`,
		  `CREATE INDEX IF NOT EXISTS "BlogComment_userId_idx" ON "BlogComment" ("userId");`,
		  `CREATE INDEX IF NOT EXISTS "BlogComment_isApproved_idx" ON "BlogComment" ("isApproved");`,
		  `CREATE INDEX IF NOT EXISTS "BlogComment_createdAt_idx" ON "BlogComment" ("createdAt");`,

		  `
			  CREATE TABLE IF NOT EXISTS "BlogCommentReply" (
			    "id" TEXT PRIMARY KEY,
			    "commentId" TEXT NOT NULL,
			    "authorType" "BlogCommentReplyAuthorType" NOT NULL,
			    "authorId" TEXT,
			    "message" TEXT NOT NULL,
			    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			    CONSTRAINT "BlogCommentReply_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "BlogComment"("id") ON DELETE CASCADE
			  );
			  `,
		  `CREATE INDEX IF NOT EXISTS "BlogCommentReply_commentId_idx" ON "BlogCommentReply" ("commentId");`,
		  `CREATE INDEX IF NOT EXISTS "BlogCommentReply_createdAt_idx" ON "BlogCommentReply" ("createdAt");`,

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
	  CREATE TABLE IF NOT EXISTS "FaqQuestion" (
	    "id" TEXT PRIMARY KEY,
	    "userId" TEXT,
	    "authorName" TEXT,
	    "authorEmail" TEXT,
	    "question" TEXT NOT NULL,
	    "answer" TEXT,
	    "isPublic" BOOLEAN NOT NULL DEFAULT FALSE,
	    "faqItemId" TEXT,
	    "answeredAt" TIMESTAMPTZ,
	    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	    CONSTRAINT "FaqQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL,
	    CONSTRAINT "FaqQuestion_faqItemId_fkey" FOREIGN KEY ("faqItemId") REFERENCES "FaqItem"("id") ON DELETE SET NULL
	  );
	  `,
	  `CREATE INDEX IF NOT EXISTS "FaqQuestion_isPublic_idx" ON "FaqQuestion" ("isPublic");`,
	  `CREATE INDEX IF NOT EXISTS "FaqQuestion_createdAt_idx" ON "FaqQuestion" ("createdAt");`,
	  `CREATE INDEX IF NOT EXISTS "FaqQuestion_answeredAt_idx" ON "FaqQuestion" ("answeredAt");`,
	  `CREATE INDEX IF NOT EXISTS "FaqQuestion_userId_idx" ON "FaqQuestion" ("userId");`,
	  `CREATE INDEX IF NOT EXISTS "FaqQuestion_faqItemId_idx" ON "FaqQuestion" ("faqItemId");`,

	  `
	  CREATE TABLE IF NOT EXISTS "NewsletterSubscriber" (
	    "id" TEXT PRIMARY KEY,
	    "userId" TEXT,
	    "email" TEXT NOT NULL,
	    "name" TEXT,
	    "status" TEXT NOT NULL DEFAULT 'subscribed',
	    "unsubscribeToken" TEXT NOT NULL,
	    "subscribedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	    "unsubscribedAt" TIMESTAMPTZ,
	    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	    CONSTRAINT "NewsletterSubscriber_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
	  );
	  `,
	  `ALTER TABLE IF EXISTS "NewsletterSubscriber" ADD COLUMN IF NOT EXISTS "userId" TEXT;`,
	  `CREATE UNIQUE INDEX IF NOT EXISTS "NewsletterSubscriber_email_uq" ON "NewsletterSubscriber" ("email");`,
	  `CREATE INDEX IF NOT EXISTS "NewsletterSubscriber_status_idx" ON "NewsletterSubscriber" ("status");`,
	  `CREATE INDEX IF NOT EXISTS "NewsletterSubscriber_createdAt_idx" ON "NewsletterSubscriber" ("createdAt");`,
	  `CREATE INDEX IF NOT EXISTS "NewsletterSubscriber_unsubscribeToken_idx" ON "NewsletterSubscriber" ("unsubscribeToken");`,
	  `CREATE INDEX IF NOT EXISTS "NewsletterSubscriber_userId_idx" ON "NewsletterSubscriber" ("userId");`,

		  `
		  CREATE TABLE IF NOT EXISTS "InstagramPost" (
		    "id" TEXT PRIMARY KEY,
	    "url" TEXT NOT NULL,
	    "caption" TEXT,
	    "coverUrl" TEXT,
	    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
	    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
	  );
	  `,
	  `CREATE INDEX IF NOT EXISTS "InstagramPost_isActive_idx" ON "InstagramPost" ("isActive");`,
	  `CREATE INDEX IF NOT EXISTS "InstagramPost_createdAt_idx" ON "InstagramPost" ("createdAt");`,

	  // Backfill/upgrade existing local DBs created before this column existed.
	  `ALTER TABLE IF EXISTS "InstagramPost" ADD COLUMN IF NOT EXISTS "coverUrl" TEXT;`,

	  `
		  CREATE TABLE IF NOT EXISTS "SupportTicket" (
		    "id" TEXT PRIMARY KEY,
		    "userId" TEXT,
		    "customerName" TEXT,
		    "customerEmail" TEXT,
		    "subject" TEXT NOT NULL,
		    "status" "SupportTicketStatus" NOT NULL DEFAULT 'open',
		    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		    CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
		  );
		  `,
	  `CREATE INDEX IF NOT EXISTS "SupportTicket_userId_idx" ON "SupportTicket" ("userId");`,
	  `CREATE INDEX IF NOT EXISTS "SupportTicket_status_idx" ON "SupportTicket" ("status");`,
	  `CREATE INDEX IF NOT EXISTS "SupportTicket_updatedAt_idx" ON "SupportTicket" ("updatedAt");`,

	  `
		  CREATE TABLE IF NOT EXISTS "SupportMessage" (
		    "id" TEXT PRIMARY KEY,
		    "ticketId" TEXT NOT NULL,
		    "authorType" "SupportMessageAuthorType" NOT NULL,
		    "authorId" TEXT,
		    "message" TEXT NOT NULL,
		    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		    CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE
		  );
		  `,
	  `CREATE INDEX IF NOT EXISTS "SupportMessage_ticketId_idx" ON "SupportMessage" ("ticketId");`,
  `CREATE INDEX IF NOT EXISTS "SupportMessage_createdAt_idx" ON "SupportMessage" ("createdAt");`,

  `
	  CREATE TABLE IF NOT EXISTS "Supplier" (
	    "id" TEXT PRIMARY KEY,
	    "name" TEXT NOT NULL,
	    "email" TEXT,
	    "phone" TEXT,
	    "link" TEXT,
	    "address" TEXT,
	    "notes" TEXT,
	    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
	  );
	  `,
  `ALTER TABLE IF EXISTS "Supplier" ADD COLUMN IF NOT EXISTS "link" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "Supplier_createdAt_idx" ON "Supplier" ("createdAt");`,
  `CREATE INDEX IF NOT EXISTS "Supplier_name_idx" ON "Supplier" ("name");`,

  `
  CREATE TABLE IF NOT EXISTS "Purchase" (
    "id" TEXT PRIMARY KEY,
    "supplierId" TEXT,
    "reference" TEXT,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'draft',
    "kind" TEXT,
    "purchasedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "notes" TEXT,
    "total" NUMERIC(12,2),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL
  );
  `,
  `ALTER TABLE IF EXISTS "Purchase" ADD COLUMN IF NOT EXISTS "kind" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "Purchase_createdAt_idx" ON "Purchase" ("createdAt");`,
  `CREATE INDEX IF NOT EXISTS "Purchase_kind_idx" ON "Purchase" ("kind");`,
  `CREATE INDEX IF NOT EXISTS "Purchase_purchasedAt_idx" ON "Purchase" ("purchasedAt");`,
  `CREATE INDEX IF NOT EXISTS "Purchase_status_idx" ON "Purchase" ("status");`,
  `CREATE INDEX IF NOT EXISTS "Purchase_supplierId_idx" ON "Purchase" ("supplierId");`,

  `
	  CREATE TABLE IF NOT EXISTS "PurchaseItem" (
	    "id" TEXT PRIMARY KEY,
	    "purchaseId" TEXT NOT NULL,
	    "productId" TEXT,
	    "productName" TEXT NOT NULL,
	    "productImage" TEXT,
	    "unitCost" NUMERIC(12,2) NOT NULL,
	    "quantity" INTEGER NOT NULL,
	    CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE,
	    CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL
	  );
	  `,
	  `CREATE INDEX IF NOT EXISTS "PurchaseItem_purchaseId_idx" ON "PurchaseItem" ("purchaseId");`,
	  `CREATE INDEX IF NOT EXISTS "PurchaseItem_productId_idx" ON "PurchaseItem" ("productId");`,
	  `ALTER TABLE IF EXISTS "PurchaseItem" ADD COLUMN IF NOT EXISTS "productImage" TEXT;`,

  `
  CREATE TABLE IF NOT EXISTS "InventoryMovement" (
    "id" TEXT PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
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
  `
  CREATE TABLE IF NOT EXISTS "BackupHistory" (
    "id" TEXT PRIMARY KEY,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "meta" JSONB,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE INDEX IF NOT EXISTS "BackupHistory_createdAt_idx" ON "BackupHistory" ("createdAt");`,
  `CREATE INDEX IF NOT EXISTS "BackupHistory_type_idx" ON "BackupHistory" ("type");`,
  `CREATE INDEX IF NOT EXISTS "BackupHistory_actorId_idx" ON "BackupHistory" ("actorId");`,

  `
  CREATE TABLE IF NOT EXISTS "Expense" (
    "id" TEXT PRIMARY KEY,
    "expenseDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "category" TEXT NOT NULL,
    "vendor" TEXT,
    "description" TEXT,
    "amount" NUMERIC(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE INDEX IF NOT EXISTS "Expense_expenseDate_idx" ON "Expense" ("expenseDate");`,
  `CREATE INDEX IF NOT EXISTS "Expense_category_idx" ON "Expense" ("category");`,
  `CREATE INDEX IF NOT EXISTS "Expense_createdAt_idx" ON "Expense" ("createdAt");`,

  // Migrate older local DBs (TEXT columns) to proper enum types used by Prisma.
  `ALTER TABLE IF EXISTS "Product" ALTER COLUMN "category" TYPE "ProductCategory" USING ("category"::"ProductCategory");`,
  `ALTER TABLE IF EXISTS "Product" ALTER COLUMN "material" TYPE "ProductMaterial" USING ("material"::"ProductMaterial");`,
  `ALTER TABLE IF EXISTS "Product" ALTER COLUMN "status" DROP DEFAULT;`,
  `ALTER TABLE IF EXISTS "Product" ALTER COLUMN "status" TYPE "ProductStatus" USING ("status"::"ProductStatus");`,
  `ALTER TABLE IF EXISTS "Product" ALTER COLUMN "status" SET DEFAULT 'active'::"ProductStatus";`,
  `ALTER TABLE IF EXISTS "Order" ALTER COLUMN "status" DROP DEFAULT;`,
  `ALTER TABLE IF EXISTS "Order" ALTER COLUMN "status" TYPE "OrderStatus" USING ("status"::"OrderStatus");`,
  `ALTER TABLE IF EXISTS "Order" ALTER COLUMN "status" SET DEFAULT 'pending'::"OrderStatus";`,
  `ALTER TABLE IF EXISTS "Appointment" ALTER COLUMN "status" DROP DEFAULT;`,
  `ALTER TABLE IF EXISTS "Appointment" ALTER COLUMN "status" TYPE "AppointmentStatus" USING ("status"::"AppointmentStatus");`,
  `ALTER TABLE IF EXISTS "Appointment" ALTER COLUMN "status" SET DEFAULT 'pending'::"AppointmentStatus";`,
  `ALTER TABLE IF EXISTS "Order" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod" USING ("paymentMethod"::"PaymentMethod");`,
  `ALTER TABLE IF EXISTS "BlogPost" ALTER COLUMN "category" TYPE "BlogCategory" USING ("category"::"BlogCategory");`,
  `ALTER TABLE IF EXISTS "BlogPost" ALTER COLUMN "status" DROP DEFAULT;`,
  `ALTER TABLE IF EXISTS "BlogPost" ALTER COLUMN "status" TYPE "BlogStatus" USING ("status"::"BlogStatus");`,
  `ALTER TABLE IF EXISTS "BlogPost" ALTER COLUMN "status" SET DEFAULT 'draft'::"BlogStatus";`,
  `ALTER TABLE IF EXISTS "BlogCommentReply" ALTER COLUMN "authorType" TYPE "BlogCommentReplyAuthorType" USING ("authorType"::"BlogCommentReplyAuthorType");`,
  `ALTER TABLE IF EXISTS "SupportTicket" ALTER COLUMN "status" DROP DEFAULT;`,
  `ALTER TABLE IF EXISTS "SupportTicket" ALTER COLUMN "status" TYPE "SupportTicketStatus" USING ("status"::"SupportTicketStatus");`,
  `ALTER TABLE IF EXISTS "SupportTicket" ALTER COLUMN "status" SET DEFAULT 'open'::"SupportTicketStatus";`,
  `ALTER TABLE IF EXISTS "SupportMessage" ALTER COLUMN "authorType" TYPE "SupportMessageAuthorType" USING ("authorType"::"SupportMessageAuthorType");`,
  `ALTER TABLE IF EXISTS "Purchase" ALTER COLUMN "status" DROP DEFAULT;`,
  `ALTER TABLE IF EXISTS "Purchase" ALTER COLUMN "status" TYPE "PurchaseStatus" USING ("status"::"PurchaseStatus");`,
  `ALTER TABLE IF EXISTS "Purchase" ALTER COLUMN "status" SET DEFAULT 'draft'::"PurchaseStatus";`,
  `ALTER TABLE IF EXISTS "InventoryMovement" ALTER COLUMN "type" TYPE "InventoryMovementType" USING ("type"::"InventoryMovementType");`,
]

export async function ensureSchema() {
  for (const statement of ddl) {
    // Static DDL, no user input.
     
    await prisma.$executeRawUnsafe(statement)
  }
}
