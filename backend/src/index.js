import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { z } from 'zod'
import crypto from 'node:crypto'
import nodemailer from 'nodemailer'

import { prisma } from './prisma.js'
import { ensureSchema } from './bootstrap.js'

const port = Number.parseInt(process.env.PORT ?? '3001', 10)
const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173'
const authSecret = process.env.AUTH_SECRET ?? 'dev-secret-change-me'
const authTokenTtlSeconds = Number.parseInt(process.env.AUTH_TOKEN_TTL_SECONDS ?? '2592000', 10) // 30 days
const passwordResetTtlSeconds = Number.parseInt(process.env.PASSWORD_RESET_TOKEN_TTL_SECONDS ?? '3600', 10) // 1 hour
const canReturnResetToken = (process.env.NODE_ENV ?? 'development') !== 'production'
const appBaseUrl = process.env.APP_BASE_URL ?? corsOrigin
const isProduction = (process.env.NODE_ENV ?? 'development') === 'production'

const smtpHost = process.env.SMTP_HOST
const smtpPort = Number.parseInt(process.env.SMTP_PORT ?? '587', 10)
const smtpSecure = (process.env.SMTP_SECURE ?? 'false') === 'true'
const smtpUser = process.env.SMTP_USER
const smtpPass = process.env.SMTP_PASS
const smtpFrom = process.env.SMTP_FROM

let cachedTransport = null
function getMailTransport() {
  if (cachedTransport) return cachedTransport
  if (!smtpHost || !smtpFrom) return null
  cachedTransport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  })
  return cachedTransport
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  const transport = getMailTransport()
  if (!transport) return false

  const subject = 'Recuperação de palavra-passe'
  const text = [
    'Recebemos um pedido para recuperar a sua palavra-passe.',
    '',
    `Abra este link para definir uma nova palavra-passe: ${resetUrl}`,
    '',
    'Se não foi você, ignore este email.',
  ].join('\n')

  await transport.sendMail({
    from: smtpFrom,
    to,
    subject,
    text,
  })

  return true
}

const app = express()
app.disable('x-powered-by')
app.use(cors({ origin: corsOrigin }))
// Product images can be stored as data URLs in dev; allow a larger JSON payload.
app.use(express.json({ limit: '10mb' }))

// Express 4 doesn't automatically handle promise rejections in async handlers.
// Wrap handlers so errors go through our error middleware (instead of crashing the process).
function wrapAsyncHandler(fn) {
  if (fn?.__isAsyncWrapped) return fn
  const wrapped = (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
  wrapped.__isAsyncWrapped = true
  return wrapped
}
for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
  const original = app[method].bind(app)
  app[method] = (...args) => original(...args.map((arg) => (typeof arg === 'function' ? wrapAsyncHandler(arg) : arg)))
}

app.get('/health', (req, res) => {
  res.json({ ok: true })
})

function base64UrlEncode(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buffer
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function base64UrlDecodeToBuffer(input) {
  const normalized = input.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  return Buffer.from(padded, 'base64')
}

function signToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const headerPart = base64UrlEncode(JSON.stringify(header))
  const payloadPart = base64UrlEncode(JSON.stringify(payload))
  const data = `${headerPart}.${payloadPart}`
  const signature = crypto.createHmac('sha256', authSecret).update(data).digest()
  return `${data}.${base64UrlEncode(signature)}`
}

function verifyToken(token) {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerPart, payloadPart, signaturePart] = parts
  const data = `${headerPart}.${payloadPart}`
  const expected = crypto.createHmac('sha256', authSecret).update(data).digest()
  let given
  try {
    given = base64UrlDecodeToBuffer(signaturePart)
  } catch {
    return null
  }

  if (given.length !== expected.length) return null
  if (!crypto.timingSafeEqual(given, expected)) return null

  let payload
  try {
    payload = JSON.parse(base64UrlDecodeToBuffer(payloadPart).toString('utf8'))
  } catch {
    return null
  }

  if (typeof payload?.exp === 'number' && Math.floor(Date.now() / 1000) >= payload.exp) {
    return null
  }

  return payload
}

function hashPassword(password, salt = crypto.randomBytes(16)) {
  const derivedKey = crypto.scryptSync(password, salt, 64)
  return {
    saltHex: salt.toString('hex'),
    hashHex: derivedKey.toString('hex'),
  }
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function verifyPassword(password, saltHex, hashHex) {
  const salt = Buffer.from(saltHex, 'hex')
  const derivedKey = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(hashHex, 'hex')
  if (derivedKey.length !== expected.length) return false
  return crypto.timingSafeEqual(derivedKey, expected)
}

const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(6).max(200),
  full_name: z.string().min(1).max(200).optional(),
})

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
})

function optionalNullableTrimmedString({ min, max }) {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === null) return value
      if (typeof value !== 'string') return value
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    },
    z.string().min(min).max(max).nullable().optional(),
  )
}

const updateMeSchema = z
  .object({
    full_name: optionalNullableTrimmedString({ min: 1, max: 200 }),
    phone: optionalNullableTrimmedString({ min: 3, max: 30 }),
    address_line1: optionalNullableTrimmedString({ min: 1, max: 200 }),
    address_line2: optionalNullableTrimmedString({ min: 1, max: 200 }),
    city: optionalNullableTrimmedString({ min: 1, max: 120 }),
    postal_code: optionalNullableTrimmedString({ min: 1, max: 30 }),
    country: optionalNullableTrimmedString({ min: 1, max: 80 }),
    newsletter_opt_in: z.boolean().optional(),
    order_updates_email: z.boolean().optional(),
  })
  // Don't fail if the frontend sends extra keys; we only persist known fields.
  .passthrough()

const passwordResetRequestSchema = z.object({
  email: z.string().email().max(320),
})

const passwordResetConfirmSchema = z.object({
  token: z.string().min(10).max(4000),
  new_password: z.string().min(6).max(200),
})

const productPayloadSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    price: z.union([z.number(), z.string()]),
    acquisition_cost: z.union([z.number(), z.string()]).optional().nullable(),
    original_price: z.union([z.number(), z.string()]).optional().nullable(),
    category: z.enum(['colares', 'brincos', 'pulseiras', 'aneis', 'conjuntos']),
    material: z
      .enum(['aco_inox', 'prata', 'dourado', 'rose_gold', 'perolas', 'cristais'])
      .optional()
      .nullable(),
    colors: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(),
    videos: z.array(z.string()).optional(),
	    stock: z.union([z.number(), z.string()]).optional().nullable(),
	    free_shipping: z.boolean().optional(),
	    is_featured: z.boolean().optional(),
	    is_new: z.boolean().optional(),
	    is_bestseller: z.boolean().optional(),
	    status: z.enum(['active', 'inactive', 'out_of_stock']).optional(),
	  })
  .passthrough()

const orderItemPayloadSchema = z.object({
  product_id: z.string().optional().nullable(),
  product_name: z.string().min(1),
  product_image: z.string().optional().nullable(),
  price: z.union([z.number(), z.string()]),
  quantity: z.number().int().positive(),
  color: z.string().optional().nullable(),
})

const orderPayloadSchema = z
  .object({
    customer_name: z.string().min(1).max(200),
    customer_email: z.string().email().max(320),
    customer_phone: z.string().optional().nullable(),
	    shipping_address: z.string().optional().nullable(),
	    shipping_city: z.string().optional().nullable(),
	    shipping_postal_code: z.string().optional().nullable(),
	    shipping_country: z.string().optional().nullable(),
	    shipping_method_id: z.string().optional().nullable(),
	    shipping_method_label: z.string().optional().nullable(),
	    subtotal: z.union([z.number(), z.string()]).optional().nullable(),
	    shipping_cost: z.union([z.number(), z.string()]).optional().nullable(),
	    total: z.union([z.number(), z.string()]),
    status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
    payment_method: z.enum(['mbway', 'transferencia', 'multibanco', 'paypal']).optional().nullable(),
    notes: z.string().optional().nullable(),
    items: z.array(orderItemPayloadSchema).min(1),
  })
  .passthrough()

const adminOrderUpdateSchema = z
  .object({
    status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
    notes: z.string().optional().nullable(),
    tracking_code: z.string().optional().nullable(),
    tracking_url: z.string().optional().nullable(),
    tracking_carrier: z.string().optional().nullable(),
  })
  .passthrough()

const blogPostPayloadSchema = z
	  .object({
	    title: z.string().min(1).max(200),
	    content: z.string().min(1),
	    excerpt: z.string().optional().nullable(),
	    image_url: z.string().optional().nullable(),
	    category: z.enum(['tendencias', 'dicas', 'novidades', 'inspiracao']).optional().nullable(),
	    status: z.enum(['draft', 'published']).optional(),
	  })
	  .passthrough()

const blogCommentCreateSchema = z
  .object({
    author_name: z.string().min(1).max(120),
    author_email: z.string().email().max(320).optional().nullable(),
    content: z.string().min(1).max(5000),
  })
  .passthrough()

const blogCommentAdminPatchSchema = z
  .object({
    is_approved: z.boolean(),
  })
  .passthrough()

const wishlistPayloadSchema = z
  .object({
    product_id: z.string().min(1),
    product_name: z.string().optional().nullable(),
    product_image: z.string().optional().nullable(),
    product_price: z.union([z.number(), z.string()]).optional().nullable(),
  })
  .passthrough()

const reviewCreateSchema = z
  .object({
    product_id: z.string().min(1),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(2000).optional().nullable(),
    author_name: z.string().max(120).optional().nullable(),
  })
  .passthrough()

const pageViewSchema = z
  .object({
    path: z.string().min(1).max(2000),
    referrer: z.string().max(2000).optional().nullable(),
  })
  .passthrough()

const productViewSchema = z
  .object({
    product_id: z.string().min(1),
  })
  .passthrough()

const searchEventSchema = z
  .object({
    query: z.string().min(1).max(200),
  })
  .passthrough()

// Any JSON object payload (unknown keys allowed).
const aboutContentSchema = z.object({}).catchall(z.any())

const shippingMethodContentSchema = z
  .object({
    id: z.string().min(1).max(60),
    label: z.string().min(1).max(80),
    enabled: z.boolean().optional(),
    price: z.union([z.number(), z.string()]).optional().nullable(),
    free_over: z.union([z.number(), z.string()]).optional().nullable(),
    description: z.string().optional().nullable(),
    eta: z.string().optional().nullable(),
  })
  .passthrough()

const shippingContentSchema = z
  .object({
    default_method_id: z.string().optional().nullable(),
    methods: z.array(shippingMethodContentSchema).optional(),
  })
  .passthrough()

const faqPayloadSchema = z
  .object({
    question: z.string().min(3).max(500),
    answer: z.string().min(1).max(10000),
    order: z.number().int().min(0).max(100000).optional(),
    is_active: z.boolean().optional(),
  })
  .passthrough()

const instagramPayloadSchema = z
	  .object({
	    url: z.string().url().max(4000),
	    caption: z.string().max(500).optional().nullable(),
	    cover_url: z.string().max(4000000).optional().nullable(),
	    is_active: z.boolean().optional(),
	  })
	  .passthrough()

const supportTicketCreateSchema = z
  .object({
    subject: z.string().min(3).max(200),
    message: z.string().min(1).max(5000),
  })
  .passthrough()

const supportMessageCreateSchema = z
  .object({
    message: z.string().min(1).max(5000),
  })
  .passthrough()

const supportTicketAdminUpdateSchema = z
  .object({
    status: z.enum(['open', 'closed']).optional(),
  })
  .passthrough()

const supplierPayloadSchema = z
  .object({
    name: z.string().min(1).max(200),
    email: z.string().email().max(320).optional().nullable(),
    phone: z.string().max(60).optional().nullable(),
    link: z.string().max(1000).optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  })
  .passthrough()

const purchaseItemPayloadSchema = z.object({
  product_id: z.string().optional().nullable(),
  product_name: z.string().min(1).max(200),
  product_image: z.string().max(5000).optional().nullable(),
  unit_cost: z.union([z.number(), z.string()]),
  quantity: z.number().int().positive(),
})

const purchasePayloadSchema = z
  .object({
    supplier_id: z.string().optional().nullable(),
    reference: z.string().max(200).optional().nullable(),
    status: z.enum(['draft', 'received', 'cancelled']).optional(),
    purchased_at: z.string().datetime().optional(),
    notes: z.string().max(4000).optional().nullable(),
    items: z.array(purchaseItemPayloadSchema).min(1),
  })
  .passthrough()

const inventoryAdjustSchema = z
  .object({
    product_id: z.string().min(1),
    delta: z.number().int(),
    unit_cost: z.union([z.number(), z.string()]).optional().nullable(),
    reason: z.string().max(500).optional().nullable(),
  })
  .passthrough()

function pickPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    is_admin: Boolean(user.isAdmin),
    created_date: user.createdAt,
    updated_date: user.updatedAt,
    full_name: user.fullName ?? null,
    phone: user.phone ?? null,
    address: {
      line1: user.addressLine1 ?? null,
      line2: user.addressLine2 ?? null,
      city: user.city ?? null,
      postal_code: user.postalCode ?? null,
      country: user.country ?? null,
    },
    settings: {
      newsletter_opt_in: Boolean(user.newsletterOptIn),
      order_updates_email: Boolean(user.orderUpdatesEmail),
    },
  }
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization ?? ''
  const match = /^Bearer\s+(.+)$/.exec(authHeader)
  return match ? match[1] : null
}

async function requireUser(req, res) {
  const token = getBearerToken(req)
  if (!token) {
    res.status(401).json({ error: 'unauthorized' })
    return null
  }
  const payload = verifyToken(token)
  const userId = payload?.sub
  if (typeof userId !== 'string' || userId.length === 0) {
    res.status(401).json({ error: 'unauthorized' })
    return null
  }
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    res.status(401).json({ error: 'unauthorized' })
    return null
  }
  return user
}

async function requireAdmin(req, res) {
  const user = await requireUser(req, res)
  if (!user) return null
  if (!user.isAdmin) {
    res.status(403).json({ error: 'forbidden' })
    return null
  }
  return user
}

async function writeAuditLog({ actorId, action, entityType, entityId, meta } = {}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        action: String(action ?? ''),
        entityType: String(entityType ?? ''),
        entityId: entityId ?? null,
        meta: meta ?? undefined,
      },
    })
  } catch (err) {
    // Don't break requests if audit logging fails.
    console.error('audit log failed', err)
  }
}

function sendInternalError(res, err, error = 'internal_error') {
  console.error(err)
  const payload = { error }
  if (!isProduction) {
    payload.detail = err?.message ? String(err.message) : String(err)
    if (err?.code) payload.code = String(err.code)
  }
  return res.status(500).json(payload)
}

function parseOrderParam(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return { createdAt: 'desc' }
  const desc = value.startsWith('-')
  const key = desc ? value.slice(1) : value
  const direction = desc ? 'desc' : 'asc'
  if (key === 'created_date') return { createdAt: direction }
  if (key === 'updated_date') return { updatedAt: direction }
  return { createdAt: 'desc' }
}

function parseLimit(raw, fallback = 100) {
  const n = Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(n, 500)
}

function decimalToNumber(value) {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function toApiProduct(p) {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    price: decimalToNumber(p.price) ?? 0,
    original_price: p.originalPrice === null || p.originalPrice === undefined ? null : decimalToNumber(p.originalPrice),
    category: p.category,
    material: p.material ?? null,
    colors: Array.isArray(p.colors) ? p.colors : [],
    images: Array.isArray(p.images) ? p.images : [],
    videos: Array.isArray(p.videos) ? p.videos : [],
    stock: p.stock ?? 0,
    free_shipping: Boolean(p.freeShipping),
    is_featured: Boolean(p.isFeatured),
    is_new: Boolean(p.isNew),
    is_bestseller: Boolean(p.isBestseller),
    status: p.status,
    created_date: p.createdAt,
    updated_date: p.updatedAt,
  }
}

function toApiAdminProduct(p) {
  return {
    ...toApiProduct(p),
    acquisition_cost:
      p.acquisitionCost === null || p.acquisitionCost === undefined ? null : decimalToNumber(p.acquisitionCost),
  }
}

function toApiOrder(o) {
  return {
    id: o.id,
    customer_name: o.customerName,
    customer_email: o.customerEmail,
    customer_phone: o.customerPhone ?? null,
    shipping_address: o.shippingAddress ?? null,
    shipping_city: o.shippingCity ?? null,
    shipping_postal_code: o.shippingPostalCode ?? null,
    shipping_country: o.shippingCountry ?? null,
    shipping_method_id: o.shippingMethodId ?? null,
    shipping_method_label: o.shippingMethodLabel ?? null,
    tracking_code: o.trackingCode ?? null,
    tracking_url: o.trackingUrl ?? null,
    tracking_carrier: o.trackingCarrier ?? null,
    subtotal: o.subtotal === null || o.subtotal === undefined ? null : decimalToNumber(o.subtotal),
    shipping_cost: decimalToNumber(o.shippingCost) ?? 0,
    total: decimalToNumber(o.total) ?? 0,
    status: o.status,
    payment_method: o.paymentMethod ?? null,
    notes: o.notes ?? null,
    created_date: o.createdAt,
    updated_date: o.updatedAt,
    created_at: o.createdAt,
    items: (o.items ?? []).map((it) => ({
      id: it.id,
      product_id: it.productId ?? null,
      product_name: it.productName,
      product_image: it.productImage ?? null,
      price: decimalToNumber(it.price) ?? 0,
      quantity: it.quantity,
      color: it.color ?? null,
    })),
  }
}

function toApiBlogPost(p) {
	  return {
	    id: p.id,
	    title: p.title,
	    content: p.content,
	    excerpt: p.excerpt ?? null,
	    image_url: p.imageUrl ?? null,
	    category: p.category ?? null,
	    status: p.status,
	    created_date: p.createdAt,
	    updated_date: p.updatedAt,
	  }
}

function toPublicBlogComment(c) {
  return {
    id: c.id,
    post_id: c.postId,
    author_name: c.authorName,
    content: c.content,
    created_date: c.createdAt,
  }
}

function toAdminBlogComment(c) {
  return {
    id: c.id,
    post_id: c.postId,
    author_name: c.authorName,
    author_email: c.authorEmail ?? null,
    content: c.content,
    is_approved: Boolean(c.isApproved),
    created_date: c.createdAt,
    post: c.post ? { id: c.post.id, title: c.post.title } : null,
  }
}

function toPublicBlogCommentReply(r, comment) {
  return {
    id: r.id,
    comment_id: r.commentId,
    author_type: r.authorType,
    author_name: r.authorType === 'admin' ? 'Zana' : comment.authorName,
    message: r.message,
    created_date: r.createdAt,
  }
}

function toApiReview(r) {
  return {
    id: r.id,
    product_id: r.productId,
    rating: r.rating,
    comment: r.comment ?? null,
    author_name: r.authorName ?? null,
    is_approved: r.isApproved === undefined ? true : Boolean(r.isApproved),
    created_date: r.createdAt,
  }
}

function toApiWishlistItem(w) {
  return {
    id: w.id,
    product_id: w.productId,
    product_name: w.productName ?? null,
    product_image: w.productImage ?? null,
    product_price: w.productPrice === null || w.productPrice === undefined ? null : decimalToNumber(w.productPrice),
    created_date: w.createdAt,
  }
}

function toApiFaqItem(f) {
  return {
    id: f.id,
    question: f.question,
    answer: f.answer,
    order: f.order,
    is_active: Boolean(f.isActive),
    created_date: f.createdAt,
    updated_date: f.updatedAt,
  }
}

function toApiInstagramPost(p) {
	  return {
	    id: p.id,
	    url: p.url,
	    caption: p.caption ?? null,
	    cover_url: p.coverUrl ?? null,
	    is_active: Boolean(p.isActive),
	    created_date: p.createdAt,
	    updated_date: p.updatedAt,
	  }
}

function toApiSupportMessage(m) {
  return {
    id: m.id,
    ticket_id: m.ticketId,
    author_type: m.authorType,
    author_id: m.authorId ?? null,
    message: m.message,
    created_date: m.createdAt,
  }
}

function toApiSupportTicket(t) {
  const last = Array.isArray(t.messages) && t.messages.length ? t.messages[0] : null
  return {
    id: t.id,
    subject: t.subject,
    status: t.status,
    customer_name: t.customerName ?? null,
    customer_email: t.customerEmail ?? null,
    created_date: t.createdAt,
    updated_date: t.updatedAt,
    message_count: typeof t?._count?.messages === 'number' ? t._count.messages : undefined,
    last_message: last ? { message: last.message, author_type: last.authorType, created_date: last.createdAt } : null,
  }
}

function toApiSupplier(s) {
  return {
    id: s.id,
    name: s.name,
    email: s.email ?? null,
    phone: s.phone ?? null,
    link: s.link ?? null,
    address: s.address ?? null,
    notes: s.notes ?? null,
    created_date: s.createdAt,
    updated_date: s.updatedAt,
  }
}

function toApiPurchase(p) {
  return {
    id: p.id,
    supplier_id: p.supplierId ?? null,
    supplier: p.supplier ? toApiSupplier(p.supplier) : null,
    reference: p.reference ?? null,
    status: p.status,
    purchased_at: p.purchasedAt,
    notes: p.notes ?? null,
    total: p.total === null || p.total === undefined ? null : decimalToNumber(p.total),
    created_date: p.createdAt,
    updated_date: p.updatedAt,
	    items: (p.items ?? []).map((it) => ({
	      id: it.id,
	      product_id: it.productId ?? null,
	      product_name: it.productName,
	      product_image: it.productImage ?? null,
	      unit_cost: decimalToNumber(it.unitCost) ?? 0,
	      quantity: it.quantity,
	    })),
	  }
}

async function ensureAdminUser() {
	  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase()
	  const password = process.env.ADMIN_PASSWORD ?? ''
	  const resetPassword = (process.env.ADMIN_RESET_PASSWORD ?? 'false') === 'true'

  if (!email || !password) return

  const existing = await prisma.user.findUnique({ where: { email } })
  const { saltHex, hashHex } = hashPassword(password)

  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        isAdmin: true,
        fullName: 'Admin',
        passwordSalt: saltHex,
        passwordHash: hashHex,
      },
    })
    return
  }

	  await prisma.user.update({
	    where: { id: existing.id },
	    data: {
	      isAdmin: true,
	      ...(resetPassword ? { passwordSalt: saltHex, passwordHash: hashHex } : null),
	    },
	  })
	}

async function ensureMockContent() {
  const env = (process.env.NODE_ENV ?? 'development').toLowerCase()
  if (env === 'production') return

  const blogCount = await prisma.blogPost.count()
  if (blogCount === 0) {
    await prisma.blogPost.createMany({
      data: [
        {
          title: 'Como escolher acessórios para o dia a dia',
          excerpt: 'Dicas simples para combinar bijuterias com conforto e estilo — sem complicar.',
          content: [
            'Escolher acessórios para o dia a dia não precisa de ser difícil.',
            '',
            '### 1) Comece por uma peça “base”',
            'Um colar delicado ou argolas pequenas combinam com quase tudo.',
            '',
            '### 2) Misture texturas com moderação',
            'Se a roupa já tem padrões, opte por acessórios mais minimalistas.',
            '',
            '### 3) Tenha um conjunto pronto',
            'Um “kit” com colar + brincos + pulseira resolve muitos looks em minutos.',
          ].join('\n'),
          imageUrl: 'https://media.base44.com/images/public/69c68e1a7672ae1454387e62/2d13f0217_generated_69ec28d0.png',
          category: 'dicas',
          status: 'published',
        },
        {
          title: 'Tendências 2026: brilho discreto e peças versáteis',
          excerpt: 'O que está a ganhar destaque e como usar no seu estilo.',
          content: [
            'Em 2026, a tendência é **brilhar sem exageros**.',
            '',
            '- Metais com acabamento suave',
            '- Pérolas reinterpretadas',
            '- Conjuntos minimalistas (mix & match)',
            '',
            'A regra é simples: escolha uma peça com presença e mantenha o resto equilibrado.',
          ].join('\n'),
          imageUrl: 'https://media.base44.com/images/public/69c68e1a7672ae1454387e62/56b29b25c_generated_ac56f9ac.png',
          category: 'tendencias',
          status: 'published',
        },
        {
          title: 'Presentes com significado: 5 ideias que nunca falham',
          excerpt: 'Sugestões para surpreender — e acertar.',
          content: [
            'Se procura um presente com significado, pense na intenção:',
            '',
            '1. Um colar com detalhe delicado',
            '2. Brincos para usar todos os dias',
            '3. Pulseira com toque minimalista',
            '4. Conjunto que combina com vários looks',
            '5. Uma peça “statement” para ocasiões especiais',
            '',
            'Dica: guarde sempre o talão e ofereça com uma mensagem curta e pessoal.',
          ].join('\n'),
          imageUrl: 'https://media.base44.com/images/public/69c68e1a7672ae1454387e62/5e15fdc1b_generated_83c31e3b.png',
          category: 'inspiracao',
          status: 'published',
        },
      ],
    })
  }

  const faqCount = await prisma.faqItem.count()
  if (faqCount === 0) {
    await prisma.faqItem.createMany({
      data: [
        {
          question: 'Quanto tempo demora a entrega?',
          answer: 'Normalmente entre 1–3 dias úteis (Portugal Continental). Em períodos promocionais pode variar.',
          order: 1,
          isActive: true,
        },
        {
          question: 'Posso trocar ou devolver?',
          answer: 'Sim. Se houver algum problema com o pedido, contacte-nos pelo Suporte e ajudamos rapidamente.',
          order: 2,
          isActive: true,
        },
        {
          question: 'Como devo cuidar das bijuterias?',
          answer: 'Evite contacto com água, perfumes e cremes. Guarde as peças em local seco e limpe com pano macio.',
          order: 3,
          isActive: true,
        },
      ],
    })
  }
}

app.post('/api/auth/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const email = parsed.data.email.trim().toLowerCase()
  const { saltHex, hashHex } = hashPassword(parsed.data.password)

  try {
    const created = await prisma.user.create({
      data: {
        email,
        fullName: parsed.data.full_name,
        passwordSalt: saltHex,
        passwordHash: hashHex,
      },
    })
    res.status(201).json({ user: pickPublicUser(created) })
  } catch (e) {
    // Prisma unique violation
    if (e?.code === 'P2002') {
      return res.status(409).json({ error: 'email_taken' })
    }
    throw e
  }
})

app.post('/api/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const email = parsed.data.email.trim().toLowerCase()
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return res.status(401).json({ error: 'invalid_credentials' })

  const ok = verifyPassword(parsed.data.password, user.passwordSalt, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' })

  const now = Math.floor(Date.now() / 1000)
  const token = signToken({ sub: user.id, exp: now + authTokenTtlSeconds })
  res.json({ token, user: pickPublicUser(user) })
})

app.get('/api/auth/me', async (req, res) => {
  const user = await requireUser(req, res)
  if (!user) return
  res.json({ user: pickPublicUser(user) })
})

app.get('/api/users/me', async (req, res) => {
  const user = await requireUser(req, res)
  if (!user) return
  res.json({ user: pickPublicUser(user) })
})

app.patch('/api/users/me', async (req, res) => {
  const user = await requireUser(req, res)
  if (!user) return

  const parsed = updateMeSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const toNull = (value) => {
    if (value === undefined) return undefined
    if (value === null) return null
    const trimmed = String(value).trim()
    return trimmed.length === 0 ? null : trimmed
  }

  const data = {
    fullName: toNull(parsed.data.full_name),
    phone: toNull(parsed.data.phone),
    addressLine1: toNull(parsed.data.address_line1),
    addressLine2: toNull(parsed.data.address_line2),
    city: toNull(parsed.data.city),
    postalCode: toNull(parsed.data.postal_code),
    country: toNull(parsed.data.country) ?? undefined,
    newsletterOptIn: parsed.data.newsletter_opt_in,
    orderUpdatesEmail: parsed.data.order_updates_email,
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
  })

  res.json({ user: pickPublicUser(updated) })
})

app.get('/api/orders/my', async (req, res) => {
  const user = await requireUser(req, res)
  if (!user) return

  const email = String(user.email ?? '').trim().toLowerCase()
  const orders = await prisma.order.findMany({
    where: { customerEmail: email },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  })

  res.json({
    orders: orders.map((o) => ({
      id: o.id,
      created_at: o.createdAt,
      total: o.total?.toString?.() ?? String(o.total),
      status: o.status,
      shipping_method_label: o.shippingMethodLabel ?? null,
      tracking_code: o.trackingCode ?? null,
      tracking_url: o.trackingUrl ?? null,
      tracking_carrier: o.trackingCarrier ?? null,
      items: o.items.map((it) => ({
        product_name: it.productName,
        product_image: it.productImage ?? null,
        quantity: it.quantity,
      })),
    })),
  })
})

app.post('/api/auth/password-reset/request', async (req, res) => {
  const parsed = passwordResetRequestSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const email = parsed.data.email.trim().toLowerCase()
  const user = await prisma.user.findUnique({ where: { email } })

  // Avoid account enumeration: always return ok.
  if (!user) return res.json({ ok: true })

  const token = base64UrlEncode(crypto.randomBytes(32))
  const tokenHash = sha256Hex(token)
  const expiresAt = new Date(Date.now() + passwordResetTtlSeconds * 1000)

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  })

  const resetUrl = `${appBaseUrl}/conta?reset_token=${encodeURIComponent(token)}`

  try {
    await sendPasswordResetEmail({ to: email, resetUrl })
  } catch (err) {
    console.error('password reset email failed', err)
  }

  // In dev, return the token to ease manual testing even if SMTP isn't configured.
  res.json({ ok: true, resetToken: canReturnResetToken ? token : undefined })
})

app.post('/api/auth/password-reset/confirm', async (req, res) => {
  const parsed = passwordResetConfirmSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const tokenHash = sha256Hex(parsed.data.token)
  const now = new Date()

  const record = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: now },
    },
    include: { user: true },
  })

  if (!record) return res.status(400).json({ error: 'invalid_token' })

  const { saltHex, hashHex } = hashPassword(parsed.data.new_password)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordSalt: saltHex,
        passwordHash: hashHex,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: now },
    }),
  ])

  res.json({ ok: true })
})

app.get('/api/products', async (req, res) => {
  const where = {}
  if (req.query.id) where.id = String(req.query.id)
  if (req.query.status) where.status = String(req.query.status)
  if (req.query.category) where.category = String(req.query.category)
  if (req.query.material) where.material = String(req.query.material)
  if (req.query.is_featured !== undefined) where.isFeatured = String(req.query.is_featured) === 'true'
  if (req.query.is_new !== undefined) where.isNew = String(req.query.is_new) === 'true'
  if (req.query.is_bestseller !== undefined) where.isBestseller = String(req.query.is_bestseller) === 'true'

  const products = await prisma.product.findMany({
    where,
    orderBy: parseOrderParam(req.query.order),
    take: parseLimit(req.query.limit, 100),
  })
  res.json(products.map(toApiProduct))
})

app.get('/api/products/:id', async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } })
  if (!product) return res.status(404).json({ error: 'not_found' })
  res.json(toApiProduct(product))
})

app.post('/api/analytics/pageview', async (req, res) => {
  const parsed = pageViewSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const token = getBearerToken(req)
  const payload = token ? verifyToken(token) : null
  const userId = typeof payload?.sub === 'string' ? payload.sub : null

  await prisma.pageView.create({
    data: {
      path: parsed.data.path,
      referrer: parsed.data.referrer ?? null,
      userId,
      userAgent: String(req.headers['user-agent'] ?? ''),
    },
  })

  res.json({ ok: true })
})

app.post('/api/analytics/product-view', async (req, res) => {
  const parsed = productViewSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const token = getBearerToken(req)
  const payload = token ? verifyToken(token) : null
  const userId = typeof payload?.sub === 'string' ? payload.sub : null

  await prisma.productView.create({
    data: {
      productId: parsed.data.product_id,
      userId,
    },
  })

  res.json({ ok: true })
})

app.post('/api/analytics/search', async (req, res) => {
  const parsed = searchEventSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const token = getBearerToken(req)
  const payload = token ? verifyToken(token) : null
  const userId = typeof payload?.sub === 'string' ? payload.sub : null

  const query = String(parsed.data.query)
  const normalized = query.trim().toLowerCase()

  await prisma.searchEvent.create({
    data: {
      query,
      queryNormalized: normalized,
      userId,
    },
  })

  res.json({ ok: true })
})

app.get('/api/reviews', async (req, res) => {
  const where = {}
  if (req.query.product_id) where.productId = String(req.query.product_id)
  where.isApproved = true
  const reviews = await prisma.review.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 })
  res.json(reviews.map(toApiReview))
})

app.post('/api/reviews', async (req, res) => {
  const user = await requireUser(req, res)
  if (!user) return

  const parsed = reviewCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const created = await prisma.review.create({
    data: {
      productId: parsed.data.product_id,
      rating: parsed.data.rating,
      comment: parsed.data.comment ?? null,
      authorName: parsed.data.author_name ?? user.fullName ?? user.email,
      isApproved: false,
    },
  })

  await writeAuditLog({ actorId: user.id, action: 'create', entityType: 'Review', entityId: created.id, meta: { product_id: created.productId } })

  res.status(201).json(toApiReview(created))
})

app.get('/api/blog-posts', async (req, res) => {
	  const where = {}
	  if (req.query.id) where.id = String(req.query.id)
	  if (req.query.status) where.status = String(req.query.status)
	  if (req.query.category) where.category = String(req.query.category)

  const posts = await prisma.blogPost.findMany({
    where,
    orderBy: parseOrderParam(req.query.order),
    take: parseLimit(req.query.limit, 100),
	  })
	  res.json(posts.map(toApiBlogPost))
	})

app.get('/api/blog-posts/:id/comments', async (req, res) => {
  const token = getBearerToken(req)
  const payload = token ? verifyToken(token) : null
  const userId = typeof payload?.sub === 'string' ? payload.sub : null

  const where = { postId: req.params.id, isApproved: true }
  const comments = await prisma.blogComment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: parseLimit(req.query.limit, 200),
    include: { replies: { orderBy: { createdAt: 'asc' } } },
  })

  res.json(
    comments.map((c) => ({
      ...toPublicBlogComment(c),
      is_mine: userId ? c.userId === userId : false,
      replies: (c.replies ?? []).map((r) => toPublicBlogCommentReply(r, c)),
    })),
  )
})

app.post('/api/blog-posts/:id/comments', async (req, res) => {
  const parsed = blogCommentCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const post = await prisma.blogPost.findUnique({ where: { id: req.params.id } })
  if (!post || post.status !== 'published') return res.status(404).json({ error: 'not_found' })

  const token = getBearerToken(req)
  const payload = token ? verifyToken(token) : null
  const userId = typeof payload?.sub === 'string' ? payload.sub : null

  const created = await prisma.blogComment.create({
    data: {
      postId: post.id,
      userId,
      authorName: parsed.data.author_name,
      authorEmail: parsed.data.author_email ? parsed.data.author_email.trim().toLowerCase() : null,
      content: parsed.data.content,
      isApproved: false,
    },
  })

  await writeAuditLog({ action: 'create', entityType: 'BlogComment', entityId: created.id, meta: { post_id: post.id } })

  res.status(201).json({ ok: true })
})

app.post('/api/blog-comments/:id/replies', async (req, res) => {
  const user = await requireUser(req, res)
  if (!user) return

  const parsed = supportMessageCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const comment = await prisma.blogComment.findUnique({ where: { id: req.params.id }, include: { post: true } })
  if (!comment) return res.status(404).json({ error: 'not_found' })
  const userEmail = user.email ? String(user.email).trim().toLowerCase() : ''
  const canReply =
    comment.userId === user.id ||
    (comment.userId === null && comment.authorEmail && userEmail && String(comment.authorEmail).trim().toLowerCase() === userEmail)
  if (!canReply) return res.status(403).json({ error: 'forbidden' })
  if (!comment.isApproved) return res.status(409).json({ error: 'comment_not_approved' })

  const reply = await prisma.blogCommentReply.create({
    data: {
      commentId: comment.id,
      authorType: 'customer',
      authorId: user.id,
      message: parsed.data.message,
    },
  })

  await writeAuditLog({ actorId: user.id, action: 'create', entityType: 'BlogCommentReply', entityId: reply.id, meta: { comment_id: comment.id, post_id: comment.postId } })

  res.status(201).json({ ok: true })
})

app.get('/api/content/about', async (req, res) => {
  const record = await prisma.siteContent.findUnique({ where: { key: 'about' } })
  res.json({ content: record?.value ?? null, updated_date: record?.updatedAt ?? null })
})

app.get('/api/content/landing', async (req, res) => {
  const record = await prisma.siteContent.findUnique({ where: { key: 'landing' } })
  res.json({ content: record?.value ?? null, updated_date: record?.updatedAt ?? null })
})

app.get('/api/content/payments', async (req, res) => {
  const record = await prisma.siteContent.findUnique({ where: { key: 'payments' } })
  res.json({ content: record?.value ?? null, updated_date: record?.updatedAt ?? null })
})

app.get('/api/content/shipping', async (req, res) => {
  const record = await prisma.siteContent.findUnique({ where: { key: 'shipping' } })
  res.json({ content: record?.value ?? null, updated_date: record?.updatedAt ?? null })
})

app.get('/api/faq', async (req, res) => {
  const items = await prisma.faqItem.findMany({
    where: { isActive: true },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    take: 500,
  })
  res.json(items.map(toApiFaqItem))
})

app.get('/api/instagram', async (req, res) => {
	  const posts = await prisma.instagramPost.findMany({
	    where: { isActive: true },
	    orderBy: { createdAt: 'desc' },
	    take: parseLimit(req.query.limit, 30),
	  })
	  res.json(posts.map(toApiInstagramPost))
})

	// Support (customer)
	app.get('/api/support/tickets', async (req, res) => {
	  const user = await requireUser(req, res)
	  if (!user) return

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    take: parseLimit(req.query.limit, 200),
    include: {
      _count: { select: { messages: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })

  res.json(tickets.map(toApiSupportTicket))
})

app.post('/api/support/tickets', async (req, res) => {
  const user = await requireUser(req, res)
  if (!user) return

  const parsed = supportTicketCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const created = await prisma.supportTicket.create({
    data: {
      userId: user.id,
      customerName: user.fullName ?? null,
      customerEmail: user.email ?? null,
      subject: parsed.data.subject.trim(),
      status: 'open',
      messages: {
        create: {
          authorType: 'customer',
          authorId: user.id,
          message: parsed.data.message,
        },
      },
    },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      _count: { select: { messages: true } },
    },
  })

  await writeAuditLog({ actorId: user.id, action: 'create', entityType: 'SupportTicket', entityId: created.id, meta: { subject: created.subject } })

  res.status(201).json({ ticket: toApiSupportTicket({ ...created, messages: [] }), messages: created.messages.map(toApiSupportMessage) })
})

app.get('/api/support/tickets/:id', async (req, res) => {
  const user = await requireUser(req, res)
  if (!user) return

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id },
    include: { messages: { orderBy: { createdAt: 'asc' } }, _count: { select: { messages: true } } },
  })

  if (!ticket || ticket.userId !== user.id) return res.status(404).json({ error: 'not_found' })

  res.json({ ticket: toApiSupportTicket({ ...ticket, messages: ticket.messages.slice(-1) }), messages: ticket.messages.map(toApiSupportMessage) })
})

app.post('/api/support/tickets/:id/messages', async (req, res) => {
  const user = await requireUser(req, res)
  if (!user) return

  const parsed = supportMessageCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.id } })
  if (!existing || existing.userId !== user.id) return res.status(404).json({ error: 'not_found' })

  const shouldReopen = String(existing.status ?? '') === 'closed'

  const updated = await prisma.supportTicket.update({
    where: { id: existing.id },
    data: {
      ...(shouldReopen ? { status: 'open' } : {}),
      messages: {
        create: {
          authorType: 'customer',
          authorId: user.id,
          message: parsed.data.message,
        },
      },
    },
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
  })

  await writeAuditLog({ actorId: user.id, action: 'create', entityType: 'SupportMessage', entityId: updated.messages?.[0]?.id ?? null, meta: { ticket_id: updated.id } })

  if (shouldReopen) {
    await writeAuditLog({
      actorId: user.id,
      action: 'update',
      entityType: 'SupportTicket',
      entityId: updated.id,
      meta: { status: 'open', source: 'customer_message' },
    })
  }

	res.status(201).json(toApiSupportMessage(updated.messages[0]))
	})

		// Support Chat (customer) - simplified endpoints for chat widget
		app.get('/api/support/chat', async (req, res) => {
		  const user = await requireUser(req, res)
		  if (!user) return

		  const ticket = await prisma.supportTicket.findFirst({
		    where: { userId: user.id, status: 'open' },
		    orderBy: { updatedAt: 'desc' },
		    include: { messages: { orderBy: { createdAt: 'asc' } }, _count: { select: { messages: true } } },
		  })

		  if (!ticket) return res.json({ ticket: null, messages: [] })

		  res.json({
		    ticket: toApiSupportTicket({ ...ticket, messages: ticket.messages.slice(-1) }),
		    messages: ticket.messages.map(toApiSupportMessage),
		  })
		})

		app.post('/api/support/chat/open', async (req, res) => {
		  const user = await requireUser(req, res)
		  if (!user) return

		  const existing = await prisma.supportTicket.findFirst({
		    where: { userId: user.id, status: 'open' },
		    orderBy: { updatedAt: 'desc' },
		  })

		  if (existing) return res.json({ ok: true, ticket_id: existing.id, created_ticket: false })

		  const created = await prisma.supportTicket.create({
		    data: {
		      userId: user.id,
		      customerName: user.fullName ?? null,
		      customerEmail: user.email ?? null,
		      subject: 'Chat / Suporte',
		      status: 'open',
		    },
		  })

		  await writeAuditLog({
		    actorId: user.id,
		    action: 'create',
		    entityType: 'SupportTicket',
		    entityId: created.id,
		    meta: { subject: created.subject, source: 'chat_widget_open' },
		  })

		  res.json({ ok: true, ticket_id: created.id, created_ticket: true })
		})

		app.post('/api/support/chat/messages', async (req, res) => {
		  const user = await requireUser(req, res)
		  if (!user) return

		  const parsed = supportMessageCreateSchema.safeParse(req.body)
	  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

	  let ticket = await prisma.supportTicket.findFirst({
	    where: { userId: user.id, status: 'open' },
	    orderBy: { updatedAt: 'desc' },
	  })

	  let createdTicket = false
	  if (!ticket) {
	    createdTicket = true
	    ticket = await prisma.supportTicket.create({
	      data: {
	        userId: user.id,
	        customerName: user.fullName ?? null,
	        customerEmail: user.email ?? null,
	        subject: 'Chat / Suporte',
	        status: 'open',
	      },
	    })

	    await writeAuditLog({
	      actorId: user.id,
	      action: 'create',
	      entityType: 'SupportTicket',
	      entityId: ticket.id,
	      meta: { subject: ticket.subject, source: 'chat_widget' },
	    })
	  }

	  const updated = await prisma.supportTicket.update({
	    where: { id: ticket.id },
	    data: {
	      messages: {
	        create: {
	          authorType: 'customer',
	          authorId: user.id,
	          message: parsed.data.message,
	        },
	      },
	    },
	    include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
	  })

	  await writeAuditLog({
	    actorId: user.id,
	    action: 'create',
	    entityType: 'SupportMessage',
	    entityId: updated.messages?.[0]?.id ?? null,
	    meta: { ticket_id: updated.id, source: 'chat_widget', created_ticket: createdTicket },
	  })

	  res.status(201).json({ ticket_id: updated.id, created_ticket: createdTicket, message: toApiSupportMessage(updated.messages[0]) })
	})

	app.post('/api/support/chat/close', async (req, res) => {
	  const user = await requireUser(req, res)
	  if (!user) return

	  const ticket = await prisma.supportTicket.findFirst({
	    where: { userId: user.id, status: 'open' },
	    orderBy: { updatedAt: 'desc' },
	  })

	  if (!ticket) return res.json({ ok: true, closed: false })

	  const updated = await prisma.supportTicket.update({
	    where: { id: ticket.id },
	    data: { status: 'closed' },
	  })

	  await writeAuditLog({
	    actorId: user.id,
	    action: 'update',
	    entityType: 'SupportTicket',
	    entityId: updated.id,
	    meta: { status: 'closed', source: 'chat_widget' },
	  })

	  res.json({ ok: true, closed: true, ticket_id: updated.id })
	})

	// Notifications (customer)
	app.get('/api/notifications', async (req, res) => {
	  const user = await requireUser(req, res)
	  if (!user) return

  const userEmail = user.email ? String(user.email).trim().toLowerCase() : ''

  const supportMessages = await prisma.supportMessage.findMany({
    where: { authorType: 'admin', ticket: { userId: user.id } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { ticket: true },
  })

	  const blogReplies = await prisma.blogCommentReply.findMany({
	    where: {
	      authorType: 'admin',
	      comment: {
        OR: [
          { userId: user.id },
          ...(userEmail ? [{ userId: null, authorEmail: userEmail }] : []),
        ],
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
	    include: { comment: { include: { post: true } } },
	  })

	  const orderStatusLogs = userEmail
	    ? await prisma.auditLog.findMany({
	        where: {
	          entityType: 'Order',
	          action: 'update',
	          meta: { path: ['customer_email'], equals: userEmail },
	        },
	        orderBy: { createdAt: 'desc' },
	        take: 20,
	      })
	    : []
	
	  const items = [
    ...supportMessages.map((m) => ({
      id: `support:${m.id}`,
      type: 'support',
      title: 'Nova resposta no suporte',
      text: m.message,
      link: '/suporte',
      created_date: m.createdAt,
    })),
    ...blogReplies.map((r) => ({
      id: `blog:${r.id}`,
      type: 'blog_comment_reply',
      title: `Resposta ao seu comentário${r.comment?.post?.title ? ` em “${r.comment.post.title}”` : ''}`,
      text: r.message,
	      link: r.comment?.post?.id ? `/blog/${r.comment.post.id}` : '/blog',
	      created_date: r.createdAt,
	    })),
	    ...orderStatusLogs.map((l) => {
	      const status = typeof l.meta?.status === 'string' ? l.meta.status : null
	      const prev = typeof l.meta?.previous_status === 'string' ? l.meta.previous_status : null
	      const orderId = l.entityId ?? null
	      const title = 'Estado da encomenda atualizado'
	      const inner = status
	        ? prev
	          ? `Estado: ${prev} → ${status}`
	          : `Novo estado: ${status}`
	        : 'A sua encomenda foi atualizada.'
	      return {
	        id: `order:${l.id}`,
	        type: 'order_status',
	        title,
	        text: orderId ? `Encomenda ${orderId}: ${inner}` : inner,
	        link: '/conta',
	        created_date: l.createdAt,
	      }
	    }),
	  ]
	    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
	    .slice(0, 20)

  res.json(items)
})

app.post('/api/orders', async (req, res) => {
  const parsed = orderPayloadSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const data = parsed.data
  const created = await prisma.order.create({
    data: {
      customerName: data.customer_name,
      customerEmail: data.customer_email.trim().toLowerCase(),
      customerPhone: data.customer_phone ?? null,
      shippingAddress: data.shipping_address ?? null,
      shippingCity: data.shipping_city ?? null,
      shippingPostalCode: data.shipping_postal_code ?? null,
      shippingCountry: data.shipping_country ?? undefined,
      shippingMethodId: data.shipping_method_id ?? null,
      shippingMethodLabel: data.shipping_method_label ?? null,
      subtotal: data.subtotal === undefined || data.subtotal === null ? undefined : String(data.subtotal),
      shippingCost:
        data.shipping_cost === undefined || data.shipping_cost === null ? undefined : String(data.shipping_cost),
      total: String(data.total),
      status: data.status ?? 'pending',
      paymentMethod: data.payment_method ?? null,
      notes: data.notes ?? null,
      items: {
        create: data.items.map((it) => ({
          productId: it.product_id ?? null,
          productName: it.product_name,
          productImage: it.product_image ?? null,
          price: String(it.price),
          quantity: it.quantity,
          color: it.color ?? null,
        })),
      },
    },
    include: { items: true },
  })

  await writeAuditLog({ action: 'create', entityType: 'Order', entityId: created.id, meta: { source: 'checkout' } })

  res.status(201).json(toApiOrder(created))
})

app.get('/api/wishlist', async (req, res) => {
  const user = await requireUser(req, res)
  if (!user) return

  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  res.json(items.map(toApiWishlistItem))
})

app.post('/api/wishlist', async (req, res) => {
  const user = await requireUser(req, res)
  if (!user) return

  const parsed = wishlistPayloadSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const created = await prisma.wishlistItem.create({
    data: {
      userId: user.id,
      productId: parsed.data.product_id,
      productName: parsed.data.product_name ?? null,
      productImage: parsed.data.product_image ?? null,
      productPrice:
        parsed.data.product_price === undefined || parsed.data.product_price === null
          ? undefined
          : String(parsed.data.product_price),
    },
  })

  await writeAuditLog({
    actorId: user.id,
    action: 'create',
    entityType: 'WishlistItem',
    entityId: created.id,
    meta: { product_id: parsed.data.product_id },
  })
  res.status(201).json(toApiWishlistItem(created))
})

app.delete('/api/wishlist/:id', async (req, res) => {
  const user = await requireUser(req, res)
  if (!user) return

  const id = String(req.params.id)
  const record = await prisma.wishlistItem.findFirst({ where: { id, userId: user.id } })
  if (!record) return res.status(404).json({ error: 'not_found' })

  await prisma.wishlistItem.delete({ where: { id } })
  await writeAuditLog({
    actorId: user.id,
    action: 'delete',
    entityType: 'WishlistItem',
    entityId: id,
    meta: { product_id: record.productId },
  })
  res.status(204).send()
})

// Admin APIs
app.get('/api/admin/users', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: parseLimit(req.query.limit, 100),
  })
  res.json(users.map(pickPublicUser))
})

app.get('/api/admin/users/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const user = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!user) return res.status(404).json({ error: 'not_found' })
  res.json({ user: pickPublicUser(user) })
})

app.get('/api/admin/users/:id/orders', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const user = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!user) return res.status(404).json({ error: 'not_found' })

  const orders = await prisma.order.findMany({
    where: { customerEmail: user.email },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
    take: 200,
  })

  res.json({ orders: orders.map(toApiOrder) })
})

app.get('/api/admin/users/:id/wishlist', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const user = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!user) return res.status(404).json({ error: 'not_found' })

  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: parseLimit(req.query.limit, 200),
  })

  res.json({ items: items.map(toApiWishlistItem) })
})

app.patch('/api/admin/users/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = updateMeSchema
    .extend({ is_admin: z.boolean().optional() })
    .passthrough()
    .safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const toNull = (value) => {
    if (value === undefined) return undefined
    if (value === null) return null
    const trimmed = String(value).trim()
    return trimmed.length === 0 ? null : trimmed
  }

  const data = {
    fullName: toNull(parsed.data.full_name),
    phone: toNull(parsed.data.phone),
    addressLine1: toNull(parsed.data.address_line1),
    addressLine2: toNull(parsed.data.address_line2),
    city: toNull(parsed.data.city),
    postalCode: toNull(parsed.data.postal_code),
    country: toNull(parsed.data.country) ?? undefined,
    newsletterOptIn: parsed.data.newsletter_opt_in,
    orderUpdatesEmail: parsed.data.order_updates_email,
    isAdmin: parsed.data.is_admin,
  }

  const updated = await prisma.user.update({ where: { id: req.params.id }, data })
  await writeAuditLog({
    actorId: admin.id,
    action: 'update',
    entityType: 'User',
    entityId: updated.id,
    meta: { patch: req.body },
  })
  res.json({ user: pickPublicUser(updated) })
})

app.get('/api/admin/products', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const products = await prisma.product.findMany({
    orderBy: parseOrderParam(req.query.order),
    take: parseLimit(req.query.limit, 500),
  })
  res.json(products.map(toApiAdminProduct))
})

app.post('/api/admin/products', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = productPayloadSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const data = parsed.data
  const created = await prisma.product.create({
	    data: {
	      name: data.name,
	      description: data.description ?? null,
	      price: String(data.price),
        acquisitionCost:
          data.acquisition_cost === undefined
            ? undefined
            : data.acquisition_cost === null
              ? null
              : String(data.acquisition_cost),
	      originalPrice: data.original_price === undefined ? undefined : data.original_price === null ? null : String(data.original_price),
	      category: data.category,
	      material: data.material ?? null,
	      colors: data.colors ?? [],
		      images: data.images ?? [],
		      videos: data.videos ?? [],
		      stock:
		        data.stock === undefined || data.stock === null ? undefined : Number.parseInt(String(data.stock), 10) || 0,
		      freeShipping: data.free_shipping ?? undefined,
		      isFeatured: data.is_featured ?? undefined,
		      isNew: data.is_new ?? undefined,
	      isBestseller: data.is_bestseller ?? undefined,
	      status: data.status ?? undefined,
    },
  })

  await writeAuditLog({ actorId: admin.id, action: 'create', entityType: 'Product', entityId: created.id, meta: req.body })
  res.status(201).json(toApiAdminProduct(created))
})

app.patch('/api/admin/products/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = productPayloadSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const data = parsed.data
  try {
	    const updated = await prisma.product.update({
	      where: { id: req.params.id },
	      data: {
	        name: data.name,
	        description: data.description === undefined ? undefined : data.description,
	        price: data.price === undefined ? undefined : String(data.price),
          acquisitionCost:
            data.acquisition_cost === undefined
              ? undefined
              : data.acquisition_cost === null
                ? null
                : String(data.acquisition_cost),
	        originalPrice:
	          data.original_price === undefined ? undefined : data.original_price === null ? null : String(data.original_price),
	        category: data.category,
	        material: data.material === undefined ? undefined : data.material,
		        colors: data.colors,
		        images: data.images,
		        videos: data.videos,
		        stock: data.stock === undefined ? undefined : data.stock === null ? null : Number.parseInt(String(data.stock), 10) || 0,
		        freeShipping: data.free_shipping,
		        isFeatured: data.is_featured,
		        isNew: data.is_new,
	        isBestseller: data.is_bestseller,
	        status: data.status,
      },
    })
    await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'Product', entityId: updated.id, meta: req.body })
    res.json(toApiAdminProduct(updated))
  } catch (e) {
    return res.status(404).json({ error: 'not_found' })
  }
})

app.delete('/api/admin/products/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  try {
    await prisma.product.delete({ where: { id: req.params.id } })
    await writeAuditLog({ actorId: admin.id, action: 'delete', entityType: 'Product', entityId: req.params.id })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'not_found' })
  }
})

app.get('/api/admin/orders', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const orders = await prisma.order.findMany({
    orderBy: parseOrderParam(req.query.order),
    include: { items: true },
    take: parseLimit(req.query.limit, 500),
  })
  res.json(orders.map(toApiOrder))
})

app.post('/api/admin/orders', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = orderPayloadSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const data = parsed.data
  const status = data.status ?? 'pending'

  const created = await prisma.order.create({
    data: {
      customerName: data.customer_name,
      customerEmail: data.customer_email.trim().toLowerCase(),
      customerPhone: data.customer_phone ?? null,
      shippingAddress: data.shipping_address ?? null,
      shippingCity: data.shipping_city ?? null,
      shippingPostalCode: data.shipping_postal_code ?? null,
      shippingCountry: data.shipping_country ?? undefined,
      shippingMethodId: data.shipping_method_id ?? null,
      shippingMethodLabel: data.shipping_method_label ?? null,
      subtotal: data.subtotal === undefined || data.subtotal === null ? undefined : String(data.subtotal),
      shippingCost:
        data.shipping_cost === undefined || data.shipping_cost === null ? undefined : String(data.shipping_cost),
      total: String(data.total),
      status,
      paymentMethod: data.payment_method ?? null,
      notes: data.notes ?? null,
      items: {
        create: data.items.map((it) => ({
          productId: it.product_id ?? null,
          productName: it.product_name,
          productImage: it.product_image ?? null,
          price: String(it.price),
          quantity: it.quantity,
          color: it.color ?? null,
        })),
      },
    },
    include: { items: true },
  })

  const shouldApplyInventory = status !== 'pending' && status !== 'cancelled'
  if (shouldApplyInventory) {
    const applied = await applyOrderToInventory({ orderId: created.id, actorId: admin.id, status })
    if (!applied.ok) {
      try {
        await prisma.order.delete({ where: { id: created.id } })
      } catch {
        // best-effort cleanup
      }
      return res.status(applied.error === 'insufficient_stock' ? 409 : 500).json({ error: applied.error })
    }
    if (!applied.already_applied) {
      await writeAuditLog({
        actorId: admin.id,
        action: 'update',
        entityType: 'Inventory',
        entityId: created.id,
        meta: { source: 'order_admin_create', order_id: created.id, order_status: status },
      })
    }
  }

  await writeAuditLog({
    actorId: admin.id,
    action: 'create',
    entityType: 'Order',
    entityId: created.id,
    meta: { source: 'admin', status },
  })

  res.status(201).json(toApiOrder(created))
})

app.patch('/api/admin/orders/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = adminOrderUpdateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  try {
    const existing = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } })
    if (!existing) return res.status(404).json({ error: 'not_found' })

    const nextStatus = parsed.data.status ?? existing.status

    const shouldApplyInventory =
      existing.status === 'pending' && ['confirmed', 'processing', 'shipped', 'delivered'].includes(nextStatus)

    if (shouldApplyInventory) {
      const applied = await applyOrderToInventory({ orderId: existing.id, actorId: admin.id, status: nextStatus })
      if (!applied.ok) {
        return res.status(applied.error === 'insufficient_stock' ? 409 : 500).json({ error: applied.error })
      }
      if (!applied.already_applied) {
        await writeAuditLog({
          actorId: admin.id,
          action: 'update',
          entityType: 'Inventory',
          entityId: existing.id,
          meta: { source: 'order_confirmed', order_id: existing.id },
        })
      }
    }

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        status: nextStatus,
        notes: parsed.data.notes === undefined ? undefined : parsed.data.notes,
        trackingCode: parsed.data.tracking_code === undefined ? undefined : parsed.data.tracking_code,
        trackingUrl: parsed.data.tracking_url === undefined ? undefined : parsed.data.tracking_url,
        trackingCarrier: parsed.data.tracking_carrier === undefined ? undefined : parsed.data.tracking_carrier,
      },
      include: { items: true },
    })

    await writeAuditLog({
      actorId: admin.id,
      action: 'update',
      entityType: 'Order',
      entityId: updated.id,
      meta: {
        ...req.body,
        previous_status: existing.status,
        status: nextStatus,
        customer_email: updated.customerEmail,
        tracking_code: parsed.data.tracking_code ?? null,
        tracking_url: parsed.data.tracking_url ?? null,
        tracking_carrier: parsed.data.tracking_carrier ?? null,
      },
    })
    res.json(toApiOrder(updated))
  } catch {
    res.status(404).json({ error: 'not_found' })
  }
})

app.get('/api/admin/blog-posts', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const posts = await prisma.blogPost.findMany({
    orderBy: parseOrderParam(req.query.order),
    take: parseLimit(req.query.limit, 200),
  })
  res.json(posts.map(toApiBlogPost))
})

app.post('/api/admin/blog-posts', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = blogPostPayloadSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const created = await prisma.blogPost.create({
    data: {
      title: parsed.data.title,
      content: parsed.data.content,
      excerpt: parsed.data.excerpt ?? null,
      imageUrl: parsed.data.image_url ?? null,
      category: parsed.data.category ?? null,
      status: parsed.data.status ?? 'draft',
    },
  })

  await writeAuditLog({ actorId: admin.id, action: 'create', entityType: 'BlogPost', entityId: created.id, meta: req.body })
  res.status(201).json(toApiBlogPost(created))
})

app.patch('/api/admin/blog-posts/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = blogPostPayloadSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  try {
    const updated = await prisma.blogPost.update({
      where: { id: req.params.id },
      data: {
        title: parsed.data.title,
        content: parsed.data.content,
        excerpt: parsed.data.excerpt,
        imageUrl: parsed.data.image_url,
        category: parsed.data.category,
        status: parsed.data.status,
      },
    })
    await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'BlogPost', entityId: updated.id, meta: req.body })
    res.json(toApiBlogPost(updated))
  } catch {
    res.status(404).json({ error: 'not_found' })
  }
})

app.delete('/api/admin/blog-posts/:id', async (req, res) => {
	  const admin = await requireAdmin(req, res)
	  if (!admin) return

  try {
    await prisma.blogPost.delete({ where: { id: req.params.id } })
    await writeAuditLog({ actorId: admin.id, action: 'delete', entityType: 'BlogPost', entityId: req.params.id })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'not_found' })
  }
})

app.get('/api/admin/logs', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: parseLimit(req.query.limit, 200),
    include: { actor: true },
  })

  res.json(
    logs.map((l) => ({
      id: l.id,
      action: l.action,
      entity_type: l.entityType,
      entity_id: l.entityId ?? null,
      meta: l.meta ?? null,
      created_date: l.createdAt,
      actor: l.actor ? { id: l.actor.id, email: l.actor.email } : null,
    })),
  )
})

// Content (About)
app.get('/api/admin/content/about', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const record = await prisma.siteContent.findUnique({ where: { key: 'about' } })
  res.json({ content: record?.value ?? null, updated_date: record?.updatedAt ?? null })
})

app.patch('/api/admin/content/about', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = aboutContentSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const value = parsed.data
  const record = await prisma.siteContent.upsert({
    where: { key: 'about' },
    create: { key: 'about', value },
    update: { value },
  })

  await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'SiteContent', entityId: 'about', meta: { keys: Object.keys(value ?? {}) } })
  res.json({ content: record.value, updated_date: record.updatedAt })
})

app.get('/api/admin/content/landing', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const record = await prisma.siteContent.findUnique({ where: { key: 'landing' } })
  res.json({ content: record?.value ?? null, updated_date: record?.updatedAt ?? null })
})

app.patch('/api/admin/content/landing', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = aboutContentSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const value = parsed.data
  const record = await prisma.siteContent.upsert({
    where: { key: 'landing' },
    create: { key: 'landing', value },
    update: { value },
  })

  await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'SiteContent', entityId: 'landing', meta: { keys: Object.keys(value ?? {}) } })
  res.json({ content: record.value, updated_date: record.updatedAt })
})

app.get('/api/admin/content/payments', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const record = await prisma.siteContent.findUnique({ where: { key: 'payments' } })
  res.json({ content: record?.value ?? null, updated_date: record?.updatedAt ?? null })
})

app.patch('/api/admin/content/payments', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = aboutContentSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const value = parsed.data
  const record = await prisma.siteContent.upsert({
    where: { key: 'payments' },
    create: { key: 'payments', value },
    update: { value },
  })

  await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'SiteContent', entityId: 'payments', meta: { keys: Object.keys(value ?? {}) } })
  res.json({ content: record.value, updated_date: record.updatedAt })
})

// Content (Shipping)
app.get('/api/admin/content/shipping', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const record = await prisma.siteContent.findUnique({ where: { key: 'shipping' } })
  res.json({ content: record?.value ?? null, updated_date: record?.updatedAt ?? null })
})

app.patch('/api/admin/content/shipping', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = shippingContentSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const value = parsed.data
  const record = await prisma.siteContent.upsert({
    where: { key: 'shipping' },
    create: { key: 'shipping', value },
    update: { value },
  })

  await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'SiteContent', entityId: 'shipping', meta: { keys: Object.keys(value ?? {}) } })
  res.json({ content: record.value, updated_date: record.updatedAt })
})

// FAQ
app.get('/api/admin/faq', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const items = await prisma.faqItem.findMany({
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    take: parseLimit(req.query.limit, 500),
  })
  res.json(items.map(toApiFaqItem))
})

app.post('/api/admin/faq', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = faqPayloadSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const created = await prisma.faqItem.create({
    data: {
      question: parsed.data.question,
      answer: parsed.data.answer,
      order: parsed.data.order ?? 0,
      isActive: parsed.data.is_active ?? true,
    },
  })
  await writeAuditLog({ actorId: admin.id, action: 'create', entityType: 'FaqItem', entityId: created.id })
  res.status(201).json(toApiFaqItem(created))
})

app.patch('/api/admin/faq/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = faqPayloadSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  try {
    const updated = await prisma.faqItem.update({
      where: { id: req.params.id },
      data: {
        question: parsed.data.question,
        answer: parsed.data.answer,
        order: parsed.data.order,
        isActive: parsed.data.is_active,
      },
    })
    await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'FaqItem', entityId: updated.id, meta: { patch: req.body } })
    res.json(toApiFaqItem(updated))
  } catch {
    res.status(404).json({ error: 'not_found' })
  }
})

app.delete('/api/admin/faq/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  try {
    await prisma.faqItem.delete({ where: { id: req.params.id } })
    await writeAuditLog({ actorId: admin.id, action: 'delete', entityType: 'FaqItem', entityId: req.params.id })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'not_found' })
  }
})

// Instagram posts (links)
app.get('/api/admin/instagram', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const posts = await prisma.instagramPost.findMany({
    orderBy: { createdAt: 'desc' },
    take: parseLimit(req.query.limit, 200),
  })
  res.json(posts.map(toApiInstagramPost))
})

app.post('/api/admin/instagram', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = instagramPayloadSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

	  const created = await prisma.instagramPost.create({
	    data: {
	      url: parsed.data.url,
	      caption: parsed.data.caption ?? null,
	      coverUrl: parsed.data.cover_url ?? null,
	      isActive: parsed.data.is_active ?? true,
	    },
	  })
	  await writeAuditLog({ actorId: admin.id, action: 'create', entityType: 'InstagramPost', entityId: created.id })
	  res.status(201).json(toApiInstagramPost(created))
	})

app.patch('/api/admin/instagram/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = instagramPayloadSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  try {
	    const updated = await prisma.instagramPost.update({
	      where: { id: req.params.id },
	      data: {
	        url: parsed.data.url,
	        caption: parsed.data.caption,
	        coverUrl: parsed.data.cover_url,
	        isActive: parsed.data.is_active,
	      },
	    })
	    await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'InstagramPost', entityId: updated.id, meta: { patch: req.body } })
	    res.json(toApiInstagramPost(updated))
	  } catch {
	    res.status(404).json({ error: 'not_found' })
	  }
	})

// Blog comments moderation
app.get('/api/admin/blog-comments', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const where = {}
  if (req.query.post_id) where.postId = String(req.query.post_id)
  const approved = String(req.query.approved ?? 'false')
  if (approved === 'true') where.isApproved = true
  if (approved === 'false') where.isApproved = false

  const comments = await prisma.blogComment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: parseLimit(req.query.limit, 500),
    include: { post: true },
  })

  res.json(comments.map(toAdminBlogComment))
})

app.patch('/api/admin/blog-comments/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = blogCommentAdminPatchSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  try {
    const updated = await prisma.blogComment.update({
      where: { id: req.params.id },
      data: { isApproved: parsed.data.is_approved },
      include: { post: true },
    })
    await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'BlogComment', entityId: updated.id, meta: { is_approved: parsed.data.is_approved } })
    res.json(toAdminBlogComment(updated))
  } catch {
    res.status(404).json({ error: 'not_found' })
  }
})

app.delete('/api/admin/blog-comments/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  try {
    await prisma.blogComment.delete({ where: { id: req.params.id } })
    await writeAuditLog({ actorId: admin.id, action: 'delete', entityType: 'BlogComment', entityId: req.params.id })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'not_found' })
  }
})

app.get('/api/admin/blog-comments/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const comment = await prisma.blogComment.findUnique({
    where: { id: req.params.id },
    include: { post: true, replies: { orderBy: { createdAt: 'asc' } } },
  })

  if (!comment) return res.status(404).json({ error: 'not_found' })

  res.json({
    comment: toAdminBlogComment(comment),
    replies: (comment.replies ?? []).map((r) => ({
      id: r.id,
      comment_id: r.commentId,
      author_type: r.authorType,
      author_id: r.authorId ?? null,
      message: r.message,
      created_date: r.createdAt,
    })),
  })
})

app.post('/api/admin/blog-comments/:id/replies', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = supportMessageCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const comment = await prisma.blogComment.findUnique({ where: { id: req.params.id } })
  if (!comment) return res.status(404).json({ error: 'not_found' })

  const reply = await prisma.blogCommentReply.create({
    data: {
      commentId: comment.id,
      authorType: 'admin',
      authorId: admin.id,
      message: parsed.data.message,
    },
  })

  await writeAuditLog({ actorId: admin.id, action: 'create', entityType: 'BlogCommentReply', entityId: reply.id, meta: { comment_id: comment.id, post_id: comment.postId } })

  res.status(201).json({ ok: true })
})

	app.delete('/api/admin/instagram/:id', async (req, res) => {
	  const admin = await requireAdmin(req, res)
	  if (!admin) return

  try {
    await prisma.instagramPost.delete({ where: { id: req.params.id } })
    await writeAuditLog({ actorId: admin.id, action: 'delete', entityType: 'InstagramPost', entityId: req.params.id })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'not_found' })
	  }
	})

// Support (admin)
app.get('/api/admin/support/tickets', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const tickets = await prisma.supportTicket.findMany({
    orderBy: { updatedAt: 'desc' },
    take: parseLimit(req.query.limit, 500),
    include: {
      _count: { select: { messages: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })

  res.json(tickets.map(toApiSupportTicket))
})

app.get('/api/admin/support/tickets/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id },
    include: { messages: { orderBy: { createdAt: 'asc' } }, _count: { select: { messages: true } } },
  })

  if (!ticket) return res.status(404).json({ error: 'not_found' })

  res.json({ ticket: toApiSupportTicket({ ...ticket, messages: ticket.messages.slice(-1) }), messages: ticket.messages.map(toApiSupportMessage) })
})

app.post('/api/admin/support/tickets/:id/messages', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = supportMessageCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  try {
    const updated = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: {
        messages: {
          create: {
            authorType: 'admin',
            authorId: admin.id,
            message: parsed.data.message,
          },
        },
      },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })

    await writeAuditLog({ actorId: admin.id, action: 'create', entityType: 'SupportMessage', entityId: updated.messages?.[0]?.id ?? null, meta: { ticket_id: updated.id } })

    res.status(201).json(toApiSupportMessage(updated.messages[0]))
  } catch {
    res.status(404).json({ error: 'not_found' })
  }
})

app.patch('/api/admin/support/tickets/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = supportTicketAdminUpdateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  try {
    const updated = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status },
    })
    await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'SupportTicket', entityId: updated.id, meta: { patch: req.body } })
    res.json(toApiSupportTicket({ ...updated, messages: [] }))
  } catch {
    res.status(404).json({ error: 'not_found' })
  }
})

// Suppliers
app.get('/api/admin/suppliers', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const suppliers = await prisma.supplier.findMany({
    orderBy: { createdAt: 'desc' },
    take: parseLimit(req.query.limit, 500),
  })
  res.json(suppliers.map(toApiSupplier))
})

app.post('/api/admin/suppliers', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = supplierPayloadSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

	  const created = await prisma.supplier.create({
	    data: {
	      name: parsed.data.name,
	      email: parsed.data.email ?? null,
	      phone: parsed.data.phone ?? null,
	      link: parsed.data.link ?? null,
	      address: parsed.data.address ?? null,
	      notes: parsed.data.notes ?? null,
	    },
	  })
  await writeAuditLog({ actorId: admin.id, action: 'create', entityType: 'Supplier', entityId: created.id })
  res.status(201).json(toApiSupplier(created))
})

app.patch('/api/admin/suppliers/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = supplierPayloadSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  try {
	    const updated = await prisma.supplier.update({
	      where: { id: req.params.id },
	      data: {
	        name: parsed.data.name,
	        email: parsed.data.email,
	        phone: parsed.data.phone,
	        link: parsed.data.link,
	        address: parsed.data.address,
	        notes: parsed.data.notes,
	      },
	    })
    await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'Supplier', entityId: updated.id, meta: { patch: req.body } })
    res.json(toApiSupplier(updated))
  } catch {
    res.status(404).json({ error: 'not_found' })
  }
})

app.delete('/api/admin/suppliers/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  try {
    await prisma.supplier.delete({ where: { id: req.params.id } })
    await writeAuditLog({ actorId: admin.id, action: 'delete', entityType: 'Supplier', entityId: req.params.id })
    res.status(204).send()
  } catch (e) {
    // likely FK constraint
    res.status(409).json({ error: 'cannot_delete' })
  }
})

// Purchases + inventory updates
async function applyPurchaseToInventory({ purchaseId, actorId } = {}) {
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { items: true },
  })
  if (!purchase) return { ok: false, error: 'not_found' }

  const items = purchase.items ?? []
  if (items.length === 0) return { ok: false, error: 'no_items' }

  // Apply stock updates in a transaction.
  await prisma.$transaction(async (tx) => {
    for (const it of items) {
      if (!it.productId) continue
      const product = await tx.product.findUnique({ where: { id: it.productId } })
      if (!product) continue

      const incomingCost = decimalToNumber(it.unitCost) ?? 0
      const currentStock = product.stock ?? 0
      const currentCost = product.acquisitionCost === null || product.acquisitionCost === undefined ? 0 : Number(product.acquisitionCost) || 0
      const nextStock = currentStock + it.quantity
      const nextCost =
        incomingCost > 0 && nextStock > 0
          ? (currentCost * currentStock + incomingCost * it.quantity) / nextStock
          : currentCost

      await tx.product.update({
        where: { id: product.id },
        data: {
          stock: { increment: it.quantity },
          acquisitionCost: incomingCost > 0 ? String(Number(nextCost).toFixed(2)) : undefined,
        },
      })
      try {
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            type: 'purchase',
            quantityChange: it.quantity,
            unitCost: it.unitCost,
            purchaseId: purchase.id,
            actorId: actorId ?? null,
            meta: { purchase_reference: purchase.reference ?? null },
          },
        })
      } catch (err) {
        console.error('inventory movement create failed (purchase)', err)
      }
    }
  })

  return { ok: true }
}

async function applyOrderToInventory({ orderId, actorId, status } = {}) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  })
  if (!order) return { ok: false, error: 'not_found' }

  const alreadyApplied = await prisma.inventoryMovement.findFirst({
    where: { type: 'order', meta: { path: ['order_id'], equals: order.id } },
    select: { id: true },
  })
  if (alreadyApplied) return { ok: true, already_applied: true }

  const items = order.items ?? []
  const productIds = Array.from(new Set(items.map((it) => it.productId).filter(Boolean)))
  if (productIds.length === 0) return { ok: true }

  const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
  const byId = new Map(products.map((p) => [p.id, p]))

  for (const it of items) {
    if (!it.productId) continue
    const p = byId.get(it.productId)
    if (!p) continue
    if (p.stock - it.quantity < 0) {
      return { ok: false, error: 'insufficient_stock' }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const it of items) {
        if (!it.productId) continue
        const p = await tx.product.findUnique({ where: { id: it.productId } })
        if (!p) continue

        const nextStock = p.stock - it.quantity
        if (nextStock < 0) {
          throw Object.assign(new Error('insufficient_stock'), { code: 'INSUFFICIENT_STOCK' })
        }

        await tx.product.update({
          where: { id: p.id },
          data: { stock: nextStock },
        })

        try {
          await tx.inventoryMovement.create({
            data: {
              productId: p.id,
              type: 'order',
              quantityChange: -it.quantity,
              unitCost: null,
              actorId: actorId ?? null,
              meta: {
                order_id: order.id,
                order_status: status ?? order.status,
                order_item_id: it.id,
                customer_email: order.customerEmail,
              },
            },
          })
        } catch (err) {
          console.error('inventory movement create failed (order)', err)
        }
      }
    })
  } catch (err) {
    if (err?.code === 'INSUFFICIENT_STOCK') return { ok: false, error: 'insufficient_stock' }
    throw err
  }

  return { ok: true }
}

async function sanitizePurchaseInput({ supplierId, items } = {}) {
  const cleanSupplierId = supplierId ? String(supplierId) : null

  let supplierExists = null
  if (cleanSupplierId) {
    supplierExists = await prisma.supplier.findUnique({ where: { id: cleanSupplierId } })
  }

  const productIds = Array.from(
    new Set(
      (items ?? [])
        .map((it) => (it?.product_id ? String(it.product_id) : null))
        .filter(Boolean),
    ),
  )

  const products = productIds.length ? await prisma.product.findMany({ where: { id: { in: productIds } } }) : []
  const productMap = new Map(products.map((p) => [p.id, p]))
  const productSet = new Set(productMap.keys())

  const sanitizedItems = (items ?? []).map((it) => {
    const productId = it?.product_id ? String(it.product_id) : null
    const product = productId ? productMap.get(productId) : null
    const unitCostNumber = Number(it?.unit_cost)
    const unitCost = Number.isFinite(unitCostNumber) ? unitCostNumber : 0
    const quantityNumber = Number.parseInt(String(it?.quantity ?? 0), 10)
    const quantity = Number.isFinite(quantityNumber) ? quantityNumber : 0
    const imageRaw = String(it?.product_image ?? '').trim()
    const productImage = imageRaw ? imageRaw : Array.isArray(product?.images) && product.images.length ? product.images[0] : null
    return {
      productId: productId && productSet.has(productId) ? productId : null,
      productName: String(it?.product_name ?? '').trim(),
      productImage,
      unitCost,
      quantity,
    }
  })

  return {
    supplierId: supplierExists ? cleanSupplierId : null,
    items: sanitizedItems,
  }
}

app.get('/api/admin/purchases', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const purchases = await prisma.purchase.findMany({
    orderBy: { purchasedAt: 'desc' },
    take: parseLimit(req.query.limit, 200),
    include: { supplier: true, items: true },
  })
  res.json(purchases.map(toApiPurchase))
})

app.post('/api/admin/purchases', async (req, res) => {
	  const admin = await requireAdmin(req, res)
	  if (!admin) return

	  const parsed = purchasePayloadSchema.safeParse(req.body)
	  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

	  try {
	    const purchasedAt = parsed.data.purchased_at ? new Date(parsed.data.purchased_at) : new Date()
	    const status = parsed.data.status ?? 'draft'

	    const sanitized = await sanitizePurchaseInput({ supplierId: parsed.data.supplier_id, items: parsed.data.items })
	    const items = sanitized.items.filter((it) => it.productName && it.quantity > 0)
	    if (items.length === 0) return res.status(400).json({ error: 'invalid_items' })

	    const total = items.reduce((sum, it) => sum + it.unitCost * it.quantity, 0)

		    const created = await prisma.purchase.create({
		      data: {
		        supplierId: sanitized.supplierId,
		        reference: parsed.data.reference ?? null,
		        status,
		        purchasedAt,
		        notes: parsed.data.notes ?? null,
		        total: String(total),
		        items: {
		          create: items.map((it) => ({
		            productId: it.productId,
		            productName: it.productName,
		            productImage: it.productImage ?? null,
		            unitCost: String(it.unitCost),
		            quantity: it.quantity,
		          })),
		        },
		      },
		      include: { supplier: true, items: true },
	    })

	    await writeAuditLog({ actorId: admin.id, action: 'create', entityType: 'Purchase', entityId: created.id })

	    if (created.status === 'received') {
	      try {
	        await applyPurchaseToInventory({ purchaseId: created.id, actorId: admin.id })
	        await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'Inventory', entityId: created.id, meta: { source: 'purchase_received' } })
	      } catch (err) {
	        return sendInternalError(res, err, 'inventory_apply_failed')
	      }
	    }

	    res.status(201).json(toApiPurchase(created))
	  } catch (err) {
	    return sendInternalError(res, err, 'purchase_create_failed')
	  }
	})

app.patch('/api/admin/purchases/:id', async (req, res) => {
	  const admin = await requireAdmin(req, res)
	  if (!admin) return

	  const parsed = purchasePayloadSchema.partial().safeParse(req.body)
	  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

	  try {
	    const existing = await prisma.purchase.findUnique({ where: { id: req.params.id }, include: { items: true, supplier: true } })
	    if (!existing) return res.status(404).json({ error: 'not_found' })

	    if (existing.status === 'received') {
	      // Don't allow editing received purchase lines to avoid stock inconsistencies.
	      if (parsed.data.items || parsed.data.status === 'draft') {
	        return res.status(409).json({ error: 'purchase_locked' })
	      }
	    }

	    const nextStatus = parsed.data.status ?? existing.status
	    const purchasedAt = parsed.data.purchased_at ? new Date(parsed.data.purchased_at) : undefined

	    const sanitized = parsed.data.items
	      ? await sanitizePurchaseInput({ supplierId: parsed.data.supplier_id ?? existing.supplierId, items: parsed.data.items })
	      : null

	    const updated = await prisma.$transaction(async (tx) => {
		      if (existing.status !== 'received' && parsed.data.items) {
		        const cleanItems = (sanitized?.items ?? [])
		          .filter((it) => it.productName && it.quantity > 0)
		          .map((it) => ({
		            id: crypto.randomUUID(),
		            purchaseId: existing.id,
		            productId: it.productId,
		            productName: it.productName,
		            productImage: it.productImage ?? null,
		            unitCost: String(it.unitCost),
		            quantity: it.quantity,
		          }))

	        if (cleanItems.length === 0) {
	          throw Object.assign(new Error('invalid_items'), { code: 'INVALID_ITEMS' })
	        }

	        await tx.purchaseItem.deleteMany({ where: { purchaseId: existing.id } })
	        await tx.purchaseItem.createMany({ data: cleanItems })
	      }

	      const itemsForTotal = parsed.data.items
	        ? (sanitized?.items ?? [])
	        : existing.items.map((it) => ({ unitCost: Number(it.unitCost), quantity: it.quantity }))

	      const total = itemsForTotal.reduce((sum, it) => sum + (Number(it.unitCost) || 0) * (Number(it.quantity) || 0), 0)

	      return tx.purchase.update({
	        where: { id: existing.id },
	        data: {
	          supplierId: parsed.data.supplier_id === undefined ? undefined : (sanitized?.supplierId ?? null),
	          reference: parsed.data.reference === undefined ? undefined : parsed.data.reference,
	          status: nextStatus,
	          purchasedAt: purchasedAt ?? undefined,
	          notes: parsed.data.notes === undefined ? undefined : parsed.data.notes,
	          total: String(total),
	        },
	        include: { supplier: true, items: true },
	      })
	    }).catch((err) => {
	      if (err?.code === 'INVALID_ITEMS') {
	        return null
	      }
	      throw err
	    })

	    if (!updated) return res.status(400).json({ error: 'invalid_items' })

	    await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'Purchase', entityId: updated.id, meta: { patch: req.body } })

	    if (existing.status !== 'received' && updated.status === 'received') {
	      try {
	        await applyPurchaseToInventory({ purchaseId: updated.id, actorId: admin.id })
	        await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'Inventory', entityId: updated.id, meta: { source: 'purchase_received' } })
	      } catch (err) {
	        return sendInternalError(res, err, 'inventory_apply_failed')
	      }
	    }

	    res.json(toApiPurchase(updated))
	  } catch (err) {
	    return sendInternalError(res, err, 'purchase_update_failed')
	  }
	})

// Inventory
app.get('/api/admin/inventory', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const products = await prisma.product.findMany({
    orderBy: { updatedAt: 'desc' },
    take: parseLimit(req.query.limit, 500),
  })

  let movements = []
  try {
    movements = await prisma.inventoryMovement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 2000,
    })
  } catch (err) {
    // If the Prisma client/schema isn't updated yet or the table isn't available, don't break inventory view.
    console.error('inventory movements fetch failed', err)
    movements = []
  }

  const lastByProduct = new Map()
  for (const m of movements) {
    if (!lastByProduct.has(m.productId)) lastByProduct.set(m.productId, m)
  }

  res.json(
    products.map((p) => {
      const last = lastByProduct.get(p.id) ?? null
      return {
        ...toApiAdminProduct(p),
        last_movement: last
          ? {
              type: last.type,
              delta: last.quantityChange,
              unit_cost: last.unitCost === null || last.unitCost === undefined ? null : decimalToNumber(last.unitCost),
              created_date: last.createdAt,
            }
          : null,
      }
    }),
  )
})

app.get('/api/admin/analytics/summary', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const days = Math.max(1, Math.min(365, Number.parseInt(String(req.query.days ?? '30'), 10) || 30))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const [topCustomers, byCountry, topViewed, topSearched, topSold, largestOrders, visitsByHour] = await Promise.all([
	    prisma.order.groupBy({
	      by: ['customerEmail'],
	      where: { createdAt: { gte: since } },
	      _count: { id: true },
	      _sum: { total: true },
	      orderBy: [{ _sum: { total: 'desc' } }],
	      take: 8,
	    }),
	    prisma.order.groupBy({
	      by: ['shippingCountry'],
	      where: { createdAt: { gte: since } },
	      _count: { id: true },
	      orderBy: [{ _count: { id: 'desc' } }],
	      take: 10,
	    }),
	    prisma.productView.groupBy({
	      by: ['productId'],
	      where: { createdAt: { gte: since } },
	      _count: { id: true },
	      orderBy: [{ _count: { id: 'desc' } }],
	      take: 8,
	    }),
	    prisma.searchEvent.groupBy({
	      by: ['queryNormalized'],
	      where: { createdAt: { gte: since } },
	      _count: { id: true },
	      orderBy: [{ _count: { id: 'desc' } }],
	      take: 10,
	    }),
    prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      where: { order: { createdAt: { gte: since } } },
      _sum: { quantity: true },
      orderBy: [{ _sum: { quantity: 'desc' } }],
      take: 8,
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { total: 'desc' },
      take: 5,
      include: { items: true },
    }),
    prisma.$queryRaw`
      SELECT
        CAST(date_part('hour', "createdAt") AS INT) AS hour,
        COUNT(*)::INT AS count
      FROM "PageView"
      WHERE "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
  ])

  const productIds = topViewed.map((r) => r.productId)
  const products = productIds.length ? await prisma.product.findMany({ where: { id: { in: productIds } } }) : []
  const productById = new Map(products.map((p) => [p.id, p]))

  res.json({
    since,
    days,
	    top_customers: topCustomers.map((c) => ({
	      email: c.customerEmail,
	      orders: c._count.id,
	      total: c._sum.total === null || c._sum.total === undefined ? 0 : decimalToNumber(c._sum.total) ?? 0,
	    })),
	    orders_by_country: byCountry.map((c) => ({ country: c.shippingCountry ?? '—', orders: c._count.id })),
	    visits_by_hour: (visitsByHour ?? []).map((r) => ({ hour: r.hour, count: r.count })),
	    top_viewed_products: topViewed.map((r) => ({
	      product_id: r.productId,
	      product_name: productById.get(r.productId)?.name ?? r.productId,
	      views: r._count.id,
	    })),
	    top_searches: topSearched.map((r) => ({ query: r.queryNormalized, count: r._count.id })),
    top_sold_products: topSold.map((r) => ({
      product_id: r.productId ?? null,
      product_name: r.productName,
      quantity: r._sum.quantity ?? 0,
    })),
    largest_orders: largestOrders.map((o) => ({
      id: o.id,
      customer_email: o.customerEmail,
      customer_name: o.customerName,
      total: decimalToNumber(o.total) ?? 0,
      status: o.status,
      created_date: o.createdAt,
      items: (o.items ?? []).length,
    })),
  })
})

// Reviews moderation
app.get('/api/admin/reviews', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const where = {}
  if (req.query.product_id) where.productId = String(req.query.product_id)
  const approved = String(req.query.approved ?? 'all')
  if (approved === 'true') where.isApproved = true
  if (approved === 'false') where.isApproved = false

  const reviews = await prisma.review.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: parseLimit(req.query.limit, 500),
  })

  res.json(reviews.map(toApiReview))
})

app.patch('/api/admin/reviews/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const isApproved = req.body?.is_approved
  if (typeof isApproved !== 'boolean') return res.status(400).json({ error: 'invalid_body' })

  try {
    const updated = await prisma.review.update({
      where: { id: req.params.id },
      data: { isApproved },
    })
    await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'Review', entityId: updated.id, meta: { is_approved: isApproved } })
    res.json(toApiReview(updated))
  } catch {
    res.status(404).json({ error: 'not_found' })
  }
})

app.delete('/api/admin/reviews/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  try {
    await prisma.review.delete({ where: { id: req.params.id } })
    await writeAuditLog({ actorId: admin.id, action: 'delete', entityType: 'Review', entityId: req.params.id })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'not_found' })
  }
})

app.post('/api/admin/inventory/adjust', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = inventoryAdjustSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const product = await prisma.product.findUnique({ where: { id: parsed.data.product_id } })
  if (!product) return res.status(404).json({ error: 'not_found' })

  const nextStock = product.stock + parsed.data.delta
  if (nextStock < 0) return res.status(400).json({ error: 'invalid_stock' })

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.product.update({ where: { id: product.id }, data: { stock: nextStock } })

    try {
      // Movement creation is best-effort; stock update is the priority.
      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          type: 'manual',
          quantityChange: parsed.data.delta,
          unitCost:
            parsed.data.unit_cost === undefined || parsed.data.unit_cost === null ? undefined : String(parsed.data.unit_cost),
          actorId: admin.id,
          meta: { reason: parsed.data.reason ?? null },
        },
      })
    } catch (err) {
      console.error('inventory movement create failed', err)
    }

    return p
  })

  await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'Inventory', entityId: product.id, meta: { delta: parsed.data.delta, reason: parsed.data.reason ?? null } })

  res.json(toApiAdminProduct(updated))
})

app.use((err, req, res, next) => {
  sendInternalError(res, err, 'internal_error')
})

async function bootstrapAndListen() {
  try {
    await prisma.$connect()
  } catch (err) {
    console.error('❌ Não foi possível ligar à base de dados.')
    console.error('   - Confirme `backend/.env` (DATABASE_URL).')
    console.error('   - Se estiver a usar Docker: `docker compose up -d` (porta 5433).')
    console.error(err)
    process.exit(1)
  }

  try {
    await ensureSchema()
    await ensureAdminUser()
    await ensureMockContent()
  } catch (err) {
    console.error('❌ Falha no bootstrap do backend (schema/seed).')
    console.error(err)
    process.exit(1)
  }

  const server = app.listen(port, () => {
    console.log(`backend listening on http://localhost:${port}`)
  })

  server.on('error', (err) => {
    if (err?.code === 'EADDRINUSE') {
      console.error(`❌ Porta ${port} já está em uso. Feche o processo que está a usar a porta ou mude PORT no backend/.env.`)
      process.exit(1)
    }
    console.error('❌ Erro ao iniciar o servidor HTTP.')
    console.error(err)
    process.exit(1)
  })
}

bootstrapAndListen()
