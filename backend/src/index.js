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

function isSmtpConfigured() {
  return Boolean(smtpHost && smtpFrom)
}

function renderTemplate(template, vars) {
  const source = template === null || template === undefined ? '' : String(template)
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const value = vars?.[key]
    if (value === null || value === undefined) return ''
    return String(value)
  })
}

function buildFromHeader(fromName) {
  const name = fromName === null || fromName === undefined ? '' : String(fromName).trim()
  if (!name) return smtpFrom
  const base = String(smtpFrom ?? '').trim()
  if (!base) return smtpFrom
  if (base.includes('<')) return base
  return `${name} <${base}>`
}

async function sendTemplatedEmail({ to, subject, text, html, fromName }) {
  const transport = getMailTransport()
  if (!transport) return false
  await transport.sendMail({
    from: buildFromHeader(fromName),
    to,
    subject: subject ?? '',
    text: text ?? undefined,
    html: html ?? undefined,
  })
  return true
}

const defaultEmailContent = {
  from_name: 'Zana',
  welcome: {
    enabled: true,
    subject: 'Bem-vindo(a) à Zana, {{first_name}}!',
    html:
      '<p>Olá {{full_name}},</p><p>Obrigado por criar conta na Zana.</p><p>Pode entrar aqui: <a href="{{app_url}}/conta">{{app_url}}/conta</a></p>',
    text: 'Olá {{full_name}},\n\nObrigado por criar conta na Zana.\n\nPode entrar aqui: {{app_url}}/conta',
  },
  order: {
    enabled: true,
    subject: 'Recebemos a sua encomenda {{order_id}}',
    html:
      '<p>Olá {{customer_name}},</p><p>Recebemos a sua encomenda <strong>{{order_id}}</strong>.</p><p>Total: {{total}}</p><p>Acompanhe em: <a href="{{app_url}}/conta">{{app_url}}/conta</a></p>',
    text:
      'Olá {{customer_name}},\n\nRecebemos a sua encomenda {{order_id}}.\nTotal: {{total}}\n\nAcompanhe em: {{app_url}}/conta',
  },
  campaign: {
    enabled: true,
    subject: 'Novidades Zana',
    html:
      '<p>Olá {{name}},</p><p>{{content}}</p><p style="font-size:12px;color:#666">Se não quiser receber mais emails, pode cancelar aqui: <a href="{{unsubscribe_url}}">{{unsubscribe_url}}</a></p>',
    text:
      'Olá {{name}},\n\n{{content}}\n\nPara cancelar: {{unsubscribe_url}}',
  },
}

async function getEmailContent() {
  const record = await prisma.siteContent.findUnique({ where: { key: 'email' } })
  const value = record?.value ?? null
  if (!value || typeof value !== 'object') return { content: defaultEmailContent, updatedAt: null }
  return {
    content: {
      ...defaultEmailContent,
      ...value,
      welcome: { ...defaultEmailContent.welcome, ...(value.welcome ?? {}) },
      order: { ...defaultEmailContent.order, ...(value.order ?? {}) },
      campaign: { ...defaultEmailContent.campaign, ...(value.campaign ?? {}) },
    },
    updatedAt: record.updatedAt,
  }
}

const defaultLoyaltyContent = {
  point_value_eur: 0.01,
  reward_text_points: 10,
  reward_image_points: 10,
  reward_video_points: 20,
}

let loyaltyCache = { content: defaultLoyaltyContent, updatedAt: 0 }
const LOYALTY_CACHE_TTL_MS = 30_000

function coerceNumber(value, fallback) {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN
  return Number.isFinite(n) ? n : fallback
}

async function getLoyaltyContent() {
  const now = Date.now()
  if (loyaltyCache?.content && now - (loyaltyCache.updatedAt ?? 0) < LOYALTY_CACHE_TTL_MS) return loyaltyCache.content

  const record = await prisma.siteContent.findUnique({ where: { key: 'loyalty' } })
  const value = record?.value ?? null
  const content = { ...defaultLoyaltyContent }

  if (value && typeof value === 'object') {
    content.point_value_eur = coerceNumber(value.point_value_eur, content.point_value_eur)
    content.reward_text_points = Math.max(0, Math.floor(coerceNumber(value.reward_text_points, content.reward_text_points)))
    content.reward_image_points = Math.max(0, Math.floor(coerceNumber(value.reward_image_points, content.reward_image_points)))
    content.reward_video_points = Math.max(0, Math.floor(coerceNumber(value.reward_video_points, content.reward_video_points)))
  }

  loyaltyCache = { content, updatedAt: now }
  return content
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase()
}

function guessFirstName(fullNameOrEmail) {
  const raw = String(fullNameOrEmail ?? '').trim()
  if (!raw) return ''
  const cleaned = raw.includes('@') ? raw.split('@')[0] : raw
  return cleaned.split(/\s+/).filter(Boolean)[0] ?? cleaned
}

async function upsertNewsletterSubscriber({ email, name, userId, status }) {
  const safeEmail = normalizeEmail(email)
  const safeName = name === undefined ? null : name === null ? null : String(name).trim() || null
  const safeStatus = status === 'unsubscribed' ? 'unsubscribed' : 'subscribed'
  const id = crypto.randomUUID()
  const unsubscribeToken = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '')

  const rows = await prisma.$queryRaw`
    INSERT INTO "NewsletterSubscriber" ("id","userId","email","name","status","unsubscribeToken","subscribedAt","unsubscribedAt","createdAt","updatedAt")
    VALUES (${id}, ${userId ?? null}, ${safeEmail}, ${safeName}, ${safeStatus}, ${unsubscribeToken}, NOW(), ${safeStatus === 'unsubscribed' ? new Date() : null}, NOW(), NOW())
    ON CONFLICT ("email") DO UPDATE SET
      "userId" = COALESCE(EXCLUDED."userId", "NewsletterSubscriber"."userId"),
      "name" = COALESCE(EXCLUDED."name", "NewsletterSubscriber"."name"),
      "status" = EXCLUDED."status",
      "subscribedAt" = CASE WHEN EXCLUDED."status" = 'subscribed' THEN NOW() ELSE "NewsletterSubscriber"."subscribedAt" END,
      "unsubscribedAt" = CASE WHEN EXCLUDED."status" = 'unsubscribed' THEN NOW() ELSE NULL END,
      "updatedAt" = NOW()
    RETURNING "id","userId","email","name","status","unsubscribeToken","subscribedAt","unsubscribedAt","createdAt","updatedAt";
  `
  return Array.isArray(rows) ? rows[0] : null
}

function subscriberToApi(s) {
  return {
    id: s.id,
    user_id: s.userId ?? null,
    email: s.email,
    name: s.name ?? null,
    status: s.status,
    subscribed_date: s.subscribedAt,
    unsubscribed_date: s.unsubscribedAt ?? null,
    created_date: s.createdAt,
    updated_date: s.updatedAt,
  }
}

function buildUnsubscribeUrl(unsubscribeToken) {
  const token = String(unsubscribeToken ?? '').trim()
  return `${appBaseUrl}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`
}

const app = express()
app.disable('x-powered-by')

function parseCorsOrigins(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

function isOriginAllowed(origin, allowed) {
  if (!origin) return true // non-browser / same-origin
  if (!Array.isArray(allowed) || allowed.length === 0) return false
  if (allowed.includes('*')) return true

  for (const entry of allowed) {
    if (entry === origin) return true
    if (entry.startsWith('*.')) {
      const suffix = entry.slice(1) // ".vercel.app"
      if (origin.endsWith(suffix)) return true
    }
  }
  return false
}

const allowedCorsOrigins = parseCorsOrigins(corsOrigin)
app.use(
  cors({
    origin(origin, cb) {
      if (isOriginAllowed(origin, allowedCorsOrigins)) return cb(null, true)
      return cb(new Error('cors_not_allowed'), false)
    },
  }),
)
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
    coupon_code: z.string().optional().nullable(),
    points_to_use: z.union([z.number(), z.string()]).optional().nullable(),
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

const couponPayloadSchema = z
  .object({
    code: z.string().min(1).max(100),
    type: z.enum(['amount', 'percent']).optional(),
    value: z.union([z.number(), z.string()]).optional(),
    description: z.string().optional().nullable(),
    max_uses: z.union([z.number(), z.string()]).optional().nullable(),
    is_active: z.boolean().optional(),
    expires_at: z.string().optional().nullable(),
    min_order_subtotal: z.union([z.number(), z.string()]).optional().nullable(),
  })
  .passthrough()

const salesTargetPayloadSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().optional().nullable(),
    start_at: z.string().optional().nullable(),
    end_at: z.string().optional().nullable(),
    goal_amount: z.union([z.number(), z.string()]).optional(),
    is_active: z.boolean().optional(),
  })
  .passthrough()

const cashClosurePayloadSchema = z
  .object({
    started_at: z.string().optional().nullable(),
    ended_at: z.string().optional().nullable(),
    opening_balance: z.union([z.number(), z.string()]).optional(),
    closing_balance: z.union([z.number(), z.string()]).optional(),
    total_sales: z.union([z.number(), z.string()]).optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .passthrough()

const appointmentsContentSchema = z
  .object({
    enabled: z.boolean().optional(),
  })
  .passthrough()

const appointmentServicePayloadSchema = z 
  .object({ 
    name: z.string().min(1).max(120), 
    description: z.string().max(2000).optional().nullable(), 
    image_url: z.string().max(10_000).optional().nullable(),
    duration_minutes: z.union([z.number(), z.string()]).optional(), 
    price: z.union([z.number(), z.string()]).optional().nullable(), 
    is_active: z.boolean().optional(), 
  }) 
  .passthrough() 

const staffAvailabilitySchema = z
  .object({
    days: z.array(z.number().int().min(0).max(6)).min(1),
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    end_time: z.string().regex(/^\d{2}:\d{2}$/),
    timezone: z.string().max(80).optional().nullable(),
  })
  .passthrough()

const appointmentStaffPayloadSchema = z 
  .object({ 
    name: z.string().min(1).max(120), 
    email: z.string().email().max(320).optional().nullable(), 
    phone: z.string().max(30).optional().nullable(), 
    availability: staffAvailabilitySchema.optional().nullable(),
    is_active: z.boolean().optional(), 
  }) 
  .passthrough() 

const appointmentCreateSchema = z
  .object({
    service_id: z.string().min(1),
    staff_id: z.string().min(1),
    start_at: z.string().min(1).max(200),
    observations: z.string().max(5000).optional().nullable(),
  })
  .passthrough()

const adminAppointmentPatchSchema = z
  .object({
    status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
    start_at: z.string().optional().nullable(),
    staff_id: z.string().optional().nullable(),
    service_id: z.string().optional().nullable(),
    observations: z.string().max(5000).optional().nullable(),
    duration_minutes: z.union([z.number(), z.string()]).optional().nullable(),
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
    images: z.array(z.string().min(1).max(2_500_000)).max(3).optional(),
    videos: z.array(z.string().min(1).max(15_000_000)).max(1).optional(),
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

const loyaltyContentSchema = z
  .object({
    point_value_eur: z.union([z.number(), z.string()]).optional(),
    reward_text_points: z.union([z.number(), z.string()]).optional(),
    reward_image_points: z.union([z.number(), z.string()]).optional(),
    reward_video_points: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough()

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

const faqQuestionCreateSchema = z
  .object({
    question: z.string().min(5).max(2000),
    author_name: z.string().max(120).optional().nullable(),
    author_email: z.string().email().max(320).optional().nullable(),
  })
  .passthrough()

const faqQuestionAdminPatchSchema = z
  .object({
    question: z.string().min(5).max(2000).optional(),
    answer: z.string().max(10000).optional().nullable(),
    is_public: z.boolean().optional(),
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

const newsletterSubscribeSchema = z
  .object({
    email: z.string().email().max(320),
    name: z.string().max(120).optional().nullable(),
  })
  .passthrough()

const emailTemplateSchema = z
  .object({
    enabled: z.boolean().optional(),
    subject: z.string().max(500).optional().nullable(),
    html: z.string().max(200000).optional().nullable(),
    text: z.string().max(200000).optional().nullable(),
  })
  .passthrough()

const emailContentSchema = z
  .object({
    from_name: z.string().max(120).optional().nullable(),
    welcome: emailTemplateSchema.optional(),
    order: emailTemplateSchema.optional(),
    campaign: emailTemplateSchema.optional(),
  })
  .passthrough()

const newsletterCampaignSendSchema = z
  .object({
    audience: z.enum(['subscribers', 'customers', 'all']).optional(),
    subject: z.string().min(1).max(500),
    content: z.string().min(1).max(200000),
    test_email: z.string().email().max(320).optional().nullable(),
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
    points_balance: user.pointsBalance ?? 0,
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
  try {
    const rows = await prisma.$queryRaw`SELECT "isDeleted" FROM "User" WHERE "id" = ${userId} LIMIT 1;`
    const isDeleted = Boolean(Array.isArray(rows) ? rows[0]?.isDeleted : false)
    if (isDeleted) {
      res.status(401).json({ error: 'unauthorized' })
      return null
    }
  } catch {
    // If the column doesn't exist yet, treat as active.
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
    coupon_code: o.couponCode ?? null,
    discount_amount: o.discountAmount === null || o.discountAmount === undefined ? null : decimalToNumber(o.discountAmount),
    discount_type: o.discountType ?? null,
  }
}

function normalizeCouponCode(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim().toUpperCase()
}

function getCouponDiscountAmount(coupon, subtotal) {
  const base = Number(subtotal ?? 0) || 0
  if (!coupon) return 0
  const value = Number(coupon.value ?? 0) || 0
  if (coupon.type === 'percent') {
    return Number(((base * value) / 100).toFixed(2))
  }
  return Number(value.toFixed ? value.toFixed(2) : value) || 0
}

function toApiCoupon(c) {
  return {
    id: c.id,
    code: c.code,
    type: c.type,
    value: decimalToNumber(c.value) ?? 0,
    description: c.description ?? null,
    max_uses: c.maxUses ?? null,
    used_count: c.usedCount,
    is_active: Boolean(c.isActive),
    expires_at: c.expiresAt ?? null,
    min_order_subtotal: c.minOrderSubtotal === null || c.minOrderSubtotal === undefined ? null : decimalToNumber(c.minOrderSubtotal),
    created_date: c.createdAt,
    updated_date: c.updatedAt,
  }
}

function toApiSalesTarget(t) {
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? null,
    start_at: t.startAt,
    end_at: t.endAt,
    goal_amount: decimalToNumber(t.goalAmount) ?? 0,
    is_active: Boolean(t.isActive),
    created_date: t.createdAt,
    updated_date: t.updatedAt,
  }
}

function toApiCashClosure(c) {
  return {
    id: c.id,
    started_at: c.startedAt,
    ended_at: c.endedAt ?? null,
    opening_balance: decimalToNumber(c.openingBalance) ?? 0,
    closing_balance: decimalToNumber(c.closingBalance) ?? 0,
    total_sales: c.totalSales === null || c.totalSales === undefined ? null : decimalToNumber(c.totalSales),
    notes: c.notes ?? null,
    created_date: c.createdAt,
    updated_date: c.updatedAt,
  }
}

function validateCouponPayload(coupon, subtotal) {
  if (!coupon || !coupon.isActive) {
    return { valid: false, message: 'cupom inválido ou inativo' }
  }
  const now = new Date()
  if (coupon.expiresAt && coupon.expiresAt < now) {
    return { valid: false, message: 'cupom expirado' }
  }
  if (coupon.maxUses !== null && coupon.maxUses !== undefined && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, message: 'cupom já foi utilizado o número máximo de vezes' }
  }
  if (coupon.minOrderSubtotal !== null && coupon.minOrderSubtotal !== undefined) {
    const threshold = Number(coupon.minOrderSubtotal) || 0
    const amount = Number(subtotal ?? 0) || 0
    if (amount < threshold) {
      return { valid: false, message: `subtotal mínimo de ${threshold.toFixed(2)}€ não atingido` }
    }
  }
  return { valid: true, discount_amount: getCouponDiscountAmount(coupon, subtotal ?? 0) }
}

function normalizeCouponPayload(body) {
  if (!body || typeof body !== 'object') return null
  const code = normalizeCouponCode(body.coupon_code ?? body.couponCode)
  if (!code) return null
  return { code }
}

function applyCouponToOrder(data) {
  const couponCode = normalizeCouponCode(data.coupon_code)
  if (!couponCode) return { coupon: null, couponId: null, couponCode: null, discountAmount: null, discountType: null }
  return { couponCode }
}

function parseDateInput(value) { 
  if (!value) return null 
  const date = new Date(value) 
  return Number.isFinite(date.getTime()) ? date : null 
} 

function parseTimeHHMM(value) {
  const raw = String(value ?? '').trim()
  const m = raw.match(/^(\d{2}):(\d{2})$/)
  if (!m) return null
  const hours = Number(m[1])
  const minutes = Number(m[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 23) return null
  if (minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

function isAppointmentWithinStaffAvailability(availability, startAt, endAt) {
  if (!availability || typeof availability !== 'object') return true
  const days = Array.isArray(availability.days) ? availability.days : null
  const startMinutes = parseTimeHHMM(availability.start_time)
  const endMinutes = parseTimeHHMM(availability.end_time)
  if (!days || startMinutes === null || endMinutes === null) return true
  if (endMinutes <= startMinutes) return false
  if (!days.includes(startAt.getDay())) return false
  if (
    startAt.getFullYear() !== endAt.getFullYear() ||
    startAt.getMonth() !== endAt.getMonth() ||
    startAt.getDate() !== endAt.getDate()
  ) {
    return false
  }
  const apptStart = startAt.getHours() * 60 + startAt.getMinutes()
  const apptEnd = endAt.getHours() * 60 + endAt.getMinutes()
  return apptStart >= startMinutes && apptEnd <= endMinutes
}

async function maybeSendAppointmentRemindersForUser(user, appointments) {
  if (!user || !Array.isArray(appointments) || appointments.length === 0) return

  const smtpOk = isSmtpConfigured()
  const now = Date.now()
  const windowHours = Math.max(1, Math.min(Number.parseInt(process.env.APPOINTMENT_REMINDER_HOURS ?? '24', 10) || 24, 24 * 14))
  const windowMs = windowHours * 60 * 60 * 1000

  const remindables = appointments
    .filter((a) => a && (a.status === 'confirmed' || a.status === 'pending'))
    .filter((a) => !a.reminderSentAt)
    .filter((a) => {
      const startMs = new Date(a.startAt).getTime()
      return Number.isFinite(startMs) && startMs > now && startMs - now <= windowMs
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 2)

  if (!remindables.length) return

  let emailContent = null
  if (smtpOk) {
    try {
      emailContent = (await getEmailContent())?.content ?? null
    } catch {}
  }

  for (const a of remindables) {
    const to = user.email ? String(user.email).trim().toLowerCase() : ''
    const startAt = new Date(a.startAt)
    const dateText = startAt.toLocaleDateString('pt-PT')
    const timeText = startAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

    let emailSent = false
    if (smtpOk && to) {
      try {
        const subject = `Lembrete: marcação em ${dateText} às ${timeText}`
        const serviceName = a.service?.name ? String(a.service.name) : 'Serviço'
        const staffName = a.staff?.name ? String(a.staff.name) : 'Atendente'
        const link = `${String(appBaseUrl ?? '').replace(/\/+$/, '')}/marcacoes`
        const html = [
          `<p>Olá ${guessFirstName(user.fullName ?? user.email)},</p>`,
          `<p>Este é um lembrete da sua marcação.</p>`,
          `<p><strong>${serviceName}</strong> · ${staffName}<br/>${dateText} às ${timeText}</p>`,
          `<p>Ver detalhes: <a href="${link}">${link}</a></p>`,
        ].join('')
        const text = [
          `Olá ${guessFirstName(user.fullName ?? user.email)},`,
          '',
          'Este é um lembrete da sua marcação.',
          `${serviceName} · ${staffName}`,
          `${dateText} às ${timeText}`,
          '',
          `Ver detalhes: ${link}`,
        ].join('\n')
        const fromName = emailContent?.from_name ? String(emailContent.from_name) : undefined
        emailSent = await sendTemplatedEmail({ to, subject, html, text, fromName })
      } catch (err) {
        console.error('appointment reminder email failed', err)
      }
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.appointment.update({ where: { id: a.id }, data: { reminderSentAt: new Date() } })
        await tx.auditLog.create({
          data: {
            actorId: null,
            action: 'reminder',
            entityType: 'Appointment',
            entityId: a.id,
            meta: {
              user_id: user.id,
              customer_email: user.email ?? null,
              appointment_id: a.id,
              start_at: a.startAt,
              service_name: a.service?.name ?? null,
              staff_name: a.staff?.name ?? null,
              email_sent: Boolean(emailSent),
            },
          },
        })
      })
    } catch (err) {
      console.error('appointment reminder log failed', err)
    }
  }
}

function parseDecimal(value) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim()
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function formatDecimal(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : '0.00'
}

function calculateCouponDiscount(coupon, subtotal) {
  return Number(getCouponDiscountAmount(coupon, subtotal) ?? 0)
}

function validateCouponRecord(coupon, subtotal) {
  return validateCouponPayload(coupon, subtotal)
}

function normalizeApiDate(value) {
  return value ? new Date(value) : null
}

function isCouponExpired(coupon) {
  if (!coupon || !coupon.expiresAt) return false
  return new Date(coupon.expiresAt) < new Date()
}

function getOrderCouponFields(coupon, subtotal) {
  if (!coupon) return { couponId: null, couponCode: null, discountAmount: null, discountType: null }
  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    discountAmount: String(Math.max(0, calculateCouponDiscount(coupon, subtotal))),
    discountType: coupon.type,
  }
}

function getCouponDiscountValue(coupon, subtotal) {
  return getCouponDiscountAmount(coupon, subtotal)
}

function roundDecimal(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Number(number.toFixed(2))
}

function toApiSalesTargetProgress(target, achievedAmount) {
  return {
    ...toApiSalesTarget(target),
    achieved_amount: achievedAmount,
    progress: target.goalAmount ? Number(((Number(achievedAmount) || 0) / Number(target.goalAmount)) * 100).toFixed(2) : '0.00',
  }
}

function toApiCashClosureSummary(closure) {
  return toApiCashClosure(closure)
}

function getCouponValidationResponse(coupon, subtotal) {
  const validation = validateCouponPayload(coupon, subtotal)
  if (!validation.valid) return { valid: false, message: validation.message }
  return {
    valid: true,
    coupon: toApiCoupon(coupon),
    discount_amount: validation.discount_amount,
    message: 'cupom válido',
  }
}

function buildCouponDurationInfo(coupon) {
  if (!coupon) return null
  const parts = []
  if (coupon.minOrderSubtotal !== null && coupon.minOrderSubtotal !== undefined) {
    parts.push(`subtotal mínimo ${Number(coupon.minOrderSubtotal).toFixed(2)}€`)
  }
  if (coupon.expiresAt) {
    parts.push(`válido até ${new Date(coupon.expiresAt).toISOString().slice(0, 10)}`)
  }
  return parts.join(', ')
}

function normalizeAdminDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

function getCouponDisplayLabel(coupon) {
  if (!coupon) return ''
  const base = coupon.type === 'percent' ? `${coupon.value}%` : `${coupon.value.toFixed(2)}€`
  return `${coupon.code} (${base})`
}

function parseApiCouponData(body) {
  return {
    code: normalizeCouponCode(body.code ?? body.coupon_code),
    type: body.type === 'percent' ? 'percent' : 'amount',
    value: Number(body.value ?? 0) || 0,
    description: body.description ?? null,
    maxUses: body.max_uses === null || body.max_uses === undefined ? null : Number(body.max_uses),
    isActive: body.is_active === false ? false : true,
    expiresAt: parseDateInput(body.expires_at),
    minOrderSubtotal:
      body.min_order_subtotal === null || body.min_order_subtotal === undefined
        ? null
        : Number(body.min_order_subtotal) || null,
  }
}

function normalizeSalesTargetPayload(body) {
  if (!body || typeof body !== 'object') return null
  return {
    name: String(body.name ?? '').trim(),
    description: body.description ?? null,
    startAt: parseDateInput(body.start_at) ?? new Date(),
    endAt: parseDateInput(body.end_at) ?? new Date(),
    goalAmount: Number(body.goal_amount ?? 0) || 0,
    isActive: body.is_active === false ? false : true,
  }
}

function normalizeCashClosurePayload(body) {
  if (!body || typeof body !== 'object') return null
  return {
    startedAt: parseDateInput(body.started_at) ?? new Date(),
    endedAt: parseDateInput(body.ended_at) ?? null,
    openingBalance: Number(body.opening_balance ?? 0) || 0,
    closingBalance: Number(body.closing_balance ?? 0) || 0,
    totalSales: body.total_sales === null || body.total_sales === undefined ? null : Number(body.total_sales) || null,
    notes: body.notes ?? null,
  }
}

function getCouponUsageCount(coupon) {
  return coupon?.usedCount ?? 0
}

function toApiCouponList(coupons) {
  return (coupons ?? []).map(toApiCoupon)
}

function toApiSalesTargetList(targets, progressMap = {}) {
  return (targets ?? []).map((target) => ({ ...toApiSalesTarget(target), achieved_amount: progressMap[target.id] ?? 0 }))
}

function toApiCashClosureList(closures) {
  return (closures ?? []).map(toApiCashClosure)
}

function getCouponRemainingUses(coupon) {
  if (coupon.maxUses === null || coupon.maxUses === undefined) return null
  return Math.max(0, (coupon.maxUses ?? 0) - (coupon.usedCount ?? 0))
}

function sanitizeCouponCode(code) {
  return normalizeCouponCode(code)
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return false
}

function formatDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function getOrderCouponMetadata(coupon) {
  if (!coupon) return null
  return {
    coupon_code: coupon.code,
    discount_type: coupon.type,
    discount_amount: getCouponDiscountAmount(coupon, 0),
  }
}

function getCouponSummary(coupon) {
  if (!coupon) return null
  return {
    ...toApiCoupon(coupon),
    remaining_uses: getCouponRemainingUses(coupon),
    expiry: coupon.expiresAt ?? null,
  }
}

function getSalesTargetStatus(target, achievedAmount) {
  const progress = Number(((Number(achievedAmount) || 0) / Number(target.goalAmount || 0)) * 100)
  return {
    ...toApiSalesTarget(target),
    achieved_amount: achievedAmount,
    progress: Number.isFinite(progress) ? Number(progress.toFixed(2)) : 0,
    completed: progress >= 100,
  }
}

function getCashClosureProgress(closure) {
  if (!closure || closure.totalSales === null || closure.totalSales === undefined) return null
  const totalSales = Number(closure.totalSales) || 0
  const diff = Number(closure.closingBalance) - Number(closure.openingBalance)
  return { totalSales, balanceDifference: diff }
}

function getCouponStatus(coupon) {
  if (!coupon) return 'invalid'
  if (!coupon.isActive) return 'inactive'
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return 'expired'
  return 'active'
}

function toApiCouponWithStatus(coupon, subtotal) {
  if (!coupon) return { valid: false }
  const validation = validateCouponPayload(coupon, subtotal)
  return {
    ...toApiCoupon(coupon),
    valid: validation.valid,
    discount_amount: validation.discount_amount ?? 0,
    message: validation.message ?? 'ok',
  }
}

function toApiCouponValidationResult(coupon, subtotal) {
  return toApiCouponWithStatus(coupon, subtotal)
}

function buildCouponResponse(coupon, subtotal) {
  const validation = validateCouponPayload(coupon, subtotal)
  return {
    valid: validation.valid,
    coupon: validation.valid ? toApiCoupon(coupon) : null,
    discount_amount: validation.discount_amount ?? 0,
    message: validation.message ?? 'cupom inválido',
  }
}

function createCouponData(body) {
  return {
    code: normalizeCouponCode(body.code),
    type: body.type === 'percent' ? 'percent' : 'amount',
    value: String(Number(body.value ?? 0) || 0),
    description: body.description ?? null,
    maxUses: body.max_uses === null || body.max_uses === undefined ? null : Number(body.max_uses) || null,
    isActive: body.is_active === false ? false : true,
    expiresAt: parseDateInput(body.expires_at),
    minOrderSubtotal: body.min_order_subtotal === null || body.min_order_subtotal === undefined ? null : String(Number(body.min_order_subtotal) || 0),
  }
}

function createSalesTargetData(body) {
  return {
    name: String(body.name ?? '').trim(),
    description: body.description ?? null,
    startAt: parseDateInput(body.start_at) || new Date(),
    endAt: parseDateInput(body.end_at) || new Date(),
    goalAmount: String(Number(body.goal_amount ?? 0) || 0),
    isActive: body.is_active === false ? false : true,
  }
}

function createCashClosureData(body) {
  return {
    startedAt: parseDateInput(body.started_at) || new Date(),
    endedAt: parseDateInput(body.ended_at) || null,
    openingBalance: String(Number(body.opening_balance ?? 0) || 0),
    closingBalance: String(Number(body.closing_balance ?? 0) || 0),
    totalSales: body.total_sales === null || body.total_sales === undefined ? null : String(Number(body.total_sales) || 0),
    notes: body.notes ?? null,
  }
}

function getCouponOrderFields(coupon, subtotal) {
  if (!coupon) return { couponId: null, couponCode: null, discountAmount: null, discountType: null }
  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    discountAmount: String(getCouponDiscountAmount(coupon, subtotal)),
    discountType: coupon.type,
  }
}

function getCouponByCode(code) {
  return prisma.coupon.findUnique({ where: { code: normalizeCouponCode(code) } })
}

function buildCouponValidationError(message) {
  return { valid: false, message }
}

function roundToTwo(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Number(n.toFixed(2))
}

function setOrderCouponValues(coupon, subtotal) {
  if (!coupon) return { couponId: null, couponCode: null, discountAmount: null, discountType: null }
  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    discountAmount: String(roundToTwo(getCouponDiscountAmount(coupon, subtotal))),
    discountType: coupon.type,
  }
}

function getCouponDiscountFromTotal(coupon, subtotal) {
  return roundToTwo(getCouponDiscountAmount(coupon, subtotal))
}

function getCouponActiveState(coupon) {
  return Boolean(coupon?.isActive)
}

function getCouponExpiration(coupon) {
  return coupon?.expiresAt ?? null
}

function getCouponRequirements(coupon) {
  const requirements = []
  if (coupon?.minOrderSubtotal) requirements.push(`subtotal mínimo ${Number(coupon.minOrderSubtotal).toFixed(2)}€`)
  if (coupon?.expiresAt) requirements.push(`válido até ${new Date(coupon.expiresAt).toISOString().slice(0, 10)}`)
  return requirements.join(', ')
}

function getCouponRemaining(coupon) {
  if (coupon?.maxUses === null || coupon?.maxUses === undefined) return null
  return Math.max(0, (coupon.maxUses ?? 0) - (coupon.usedCount ?? 0))
}

function validateCouponUsage(coupon) {
  if (!coupon || !coupon.isActive) return false
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return false
  if (coupon.maxUses !== null && coupon.maxUses !== undefined && coupon.usedCount >= coupon.maxUses) return false
  return true
}

function formatCouponType(type) {
  return type === 'percent' ? 'percent' : 'amount'
}

function getCouponDisplayValue(coupon) {
  if (!coupon) return '0.00'
  return coupon.type === 'percent' ? `${coupon.value}%` : `${Number(coupon.value).toFixed(2)}€`
}

function buildCouponResponseShape(coupon, subtotal) {
  const validation = validateCouponPayload(coupon, subtotal)
  return {
    valid: validation.valid,
    message: validation.message ?? null,
    coupon: validation.valid ? toApiCoupon(coupon) : null,
    discount_amount: validation.discount_amount ?? 0,
  }
}

function getSalesTargetProgressValue(target, achieved) {
  const a = Number(achieved ?? 0)
  const g = Number(target.goalAmount ?? 0)
  if (!g) return 0
  return Math.min(100, Number(((a / g) * 100).toFixed(2)))
}

function getCashClosureSummaryValue(closure) {
  if (!closure) return null
  return {
    totalSales: decimalToNumber(closure.totalSales) ?? 0,
    balanceDifference: decimalToNumber(closure.closingBalance) - decimalToNumber(closure.openingBalance),
  }
}

function getSalesTargetDateRange(target) {
  return {
    startAt: target.startAt,
    endAt: target.endAt,
  }
}

function getCouponSummaryLabel(coupon) {
  if (!coupon) return ''
  return `${coupon.code} (${coupon.type === 'percent' ? `${coupon.value}%` : `${Number(coupon.value).toFixed(2)}€`})`
}

function formatAmount(value) {
  return Number(value ?? 0).toFixed(2)
}

function buildCouponMessage(coupon, subtotal) {
  if (!coupon) return 'Cupom inválido'
  const validation = validateCouponPayload(coupon, subtotal)
  return validation.message ?? 'Cupom válido'
}

function parseSubtotal(value) {
  return parseDecimal(value) ?? 0
}

function getCouponDiscountForOrder(coupon, subtotal) {
  return Number(getCouponDiscountAmount(coupon, subtotal) || 0)
}

function parseCouponCode(value) {
  return normalizeCouponCode(value)
}

function toApiCouponWithDiscount(coupon, subtotal) {
  if (!coupon) return null
  return {
    ...toApiCoupon(coupon),
    discount_amount: getCouponDiscountAmount(coupon, subtotal),
  }
}

function buildCouponNormalizedCode(code) {
  return normalizeCouponCode(code)
}

function getCouponDataFromRequest(body) {
  return {
    code: normalizeCouponCode(body.code),
    type: formatCouponType(body.type),
    value: String(Number(body.value ?? 0) || 0),
    description: body.description ?? null,
    maxUses: body.max_uses === null || body.max_uses === undefined ? null : Number(body.max_uses) || null,
    isActive: body.is_active === false ? false : true,
    expiresAt: parseDateInput(body.expires_at),
    minOrderSubtotal: body.min_order_subtotal === null || body.min_order_subtotal === undefined ? null : String(Number(body.min_order_subtotal) || 0),
  }
}

function getSalesTargetById(id) {
  return prisma.salesTarget.findUnique({ where: { id } })
}

function getCashClosureById(id) {
  return prisma.cashClosure.findUnique({ where: { id } })
}

function getCouponById(id) {
  return prisma.coupon.findUnique({ where: { id } })
}

function getSalesTargetsList(order = { createdAt: 'desc' }) {
  return prisma.salesTarget.findMany({ orderBy: order })
}

function getCashClosuresList(order = { createdAt: 'desc' }) {
  return prisma.cashClosure.findMany({ orderBy: order })
}

function getCouponsList(order = { createdAt: 'desc' }) {
  return prisma.coupon.findMany({ orderBy: order })
}

function getCouponByCodeOrNull(code) {
  const normalized = normalizeCouponCode(code)
  if (!normalized) return null
  return prisma.coupon.findUnique({ where: { code: normalized } })
}

function getTypeOrDefault(value) {
  return value === 'percent' ? 'percent' : 'amount'
}

function getOrderCouponInfo(coupon, subtotal) {
  if (!coupon) return null
  return {
    coupon_id: coupon.id,
    coupon_code: coupon.code,
    discount_amount: getCouponDiscountAmount(coupon, subtotal),
    discount_type: coupon.type,
  }
}

function getCouponIsRedeemable(coupon) {
  if (!coupon) return false
  if (!coupon.isActive) return false
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return false
  if (coupon.maxUses !== null && coupon.maxUses !== undefined && coupon.usedCount >= coupon.maxUses) return false
  return true
}

function getCouponMessageForOrder(coupon, subtotal) {
  const validation = validateCouponPayload(coupon, subtotal)
  return validation.message ?? 'invalid'
}

function getCouponDiscountFromPayload(body) {
  const subtotal = parseSubtotal(body.subtotal)
  const code = normalizeCouponCode(body.coupon_code)
  if (!code) return 0
  return getCouponDiscountFromTotal(getCouponByCode(code), subtotal)
}

function buildOrderCouponFields(coupon, subtotal) {
  if (!coupon) return { couponId: null, couponCode: null, discountAmount: null, discountType: null }
  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    discountAmount: String(getCouponDiscountAmount(coupon, subtotal)),
    discountType: coupon.type,
  }
}

function getCouponControlValue(coupon) {
  return coupon?.code ?? null
}

function toApiCouponResult(coupon, subtotal) {
  if (!coupon) return { valid: false, message: 'cupom inválido' }
  const validation = validateCouponPayload(coupon, subtotal)
  return {
    valid: validation.valid,
    coupon: validation.valid ? toApiCoupon(coupon) : null,
    discount_amount: validation.discount_amount ?? 0,
    message: validation.message ?? 'cupom inválido',
  }
}

function parseCouponValidationParams(req) {
  const code = normalizeCouponCode(req.query.code)
  const subtotal = parseDecimal(req.query.subtotal)
  return { code, subtotal }
}

function getCouponValidationMessage(coupon, subtotal) {
  const validation = validateCouponPayload(coupon, subtotal)
  return validation.message
}

function buildCouponValidationPayload(coupon, subtotal) {
  const validation = validateCouponPayload(coupon, subtotal)
  return {
    valid: validation.valid,
    discount_amount: validation.discount_amount ?? 0,
    coupon: validation.valid ? toApiCoupon(coupon) : null,
    message: validation.message ?? 'cupom inválido',
  }
}

function getSalesTargetStatusForTarget(target, achieved) {
  const amount = Number(achieved ?? 0)
  const goal = Number(target.goalAmount ?? 0)
  return {
    ...toApiSalesTarget(target),
    achieved_amount: amount,
    progress: goal ? Number(Math.min((amount / goal) * 100, 100).toFixed(2)) : 0,
    completed: goal ? amount >= goal : false,
  }
}

function getCashClosureDisplay(closure) {
  return {
    ...toApiCashClosure(closure),
    balance_difference: closure.closingBalance - closure.openingBalance,
  }
}

function normalizeAdminCouponBody(body) {
  return {
    code: normalizeCouponCode(body.code),
    type: formatCouponType(body.type),
    value: Number(body.value ?? 0) || 0,
    description: body.description ?? null,
    maxUses: body.max_uses === null || body.max_uses === undefined ? null : Number(body.max_uses) || null,
    isActive: body.is_active === false ? false : true,
    expiresAt: parseDateInput(body.expires_at),
    minOrderSubtotal: body.min_order_subtotal === null || body.min_order_subtotal === undefined ? null : Number(body.min_order_subtotal) || null,
  }
}

function normalizeAdminSalesTargetBody(body) {
  return {
    name: String(body.name ?? '').trim(),
    description: body.description ?? null,
    startAt: parseDateInput(body.start_at) || new Date(),
    endAt: parseDateInput(body.end_at) || new Date(),
    goalAmount: Number(body.goal_amount ?? 0) || 0,
    isActive: body.is_active === false ? false : true,
  }
}

function normalizeAdminCashClosureBody(body) {
  return {
    startedAt: parseDateInput(body.started_at) || new Date(),
    endedAt: parseDateInput(body.ended_at) || null,
    openingBalance: Number(body.opening_balance ?? 0) || 0,
    closingBalance: Number(body.closing_balance ?? 0) || 0,
    totalSales: body.total_sales === null || body.total_sales === undefined ? null : Number(body.total_sales) || null,
    notes: body.notes ?? null,
  }
}

function getCouponPropertiesForOrder(coupon, subtotal) {
  return buildOrderCouponFields(coupon, subtotal)
}

function couponIsRedeemable(coupon) {
  return validateCouponUsage(coupon)
}

function getOrderCouponSummary(coupon, subtotal) {
  if (!coupon) return null
  const amount = getCouponDiscountAmount(coupon, subtotal)
  return { code: coupon.code, discount_amount: amount, type: coupon.type }
}

function getBasicCouponInfo(coupon) {
  return coupon ? { code: coupon.code, type: coupon.type, value: decimalToNumber(coupon.value) ?? 0 } : null
}

function buildOrderCouponRecord(coupon, subtotal) {
  if (!coupon) return { couponId: null, couponCode: null, discountAmount: null, discountType: null }
  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    discountAmount: String(getCouponDiscountAmount(coupon, subtotal)),
    discountType: coupon.type,
  }
}

function getCouponCodeFromBody(body) {
  return normalizeCouponCode(body.coupon_code ?? body.couponCode)
}

function validateOrderCoupon(coupon, subtotal) {
  return validateCouponPayload(coupon, subtotal)
}

function getCouponApplicationFields(coupon, subtotal) {
  if (!coupon) return { couponId: null, couponCode: null, discountAmount: null, discountType: null }
  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    discountAmount: String(getCouponDiscountAmount(coupon, subtotal)),
    discountType: coupon.type,
  }
}

function getCouponDiscountProperties(coupon, subtotal) {
  return { discount_amount: getCouponDiscountAmount(coupon, subtotal), type: coupon?.type ?? null }
}

function getCouponDetails(coupon, subtotal) {
  return buildCouponResponseShape(coupon, subtotal)
}

function validateCouponRequest(req) {
  const code = normalizeCouponCode(req.query.code)
  const subtotal = parseDecimal(req.query.subtotal)
  return { code, subtotal }
}

function getOrderCouponAmount(coupon, subtotal) {
  return getCouponDiscountAmount(coupon, subtotal)
}

function buildCouponOrderData(coupon, subtotal) {
  if (!coupon) return null
  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    discountAmount: String(getCouponDiscountAmount(coupon, subtotal)),
    discountType: coupon.type,
  }
}

function validateCheckoutCoupon(coupon, subtotal) {
  return validateCouponPayload(coupon, subtotal)
}

function getCouponOrderCreationFields(coupon, subtotal) {
  if (!coupon) return { couponId: null, couponCode: null, discountAmount: null, discountType: null }
  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    discountAmount: String(getCouponDiscountAmount(coupon, subtotal)),
    discountType: coupon.type,
  }
}

function toApiCouponRecord(coupon) {
  return toApiCoupon(coupon)
}

function getCouponAmountForOrder(coupon, subtotal) {
  return getCouponDiscountAmount(coupon, subtotal)
}

function toApiSalesTargetRecord(target) {
  return toApiSalesTarget(target)
}

function toApiCashClosureRecord(closure) {
  return toApiCashClosure(closure)
}

function getCouponForOrder(code) {
  return prisma.coupon.findUnique({ where: { code: normalizeCouponCode(code) } })
}

function isCouponEligibleForOrder(coupon, subtotal) {
  const validation = validateCouponPayload(coupon, subtotal)
  return validation.valid
}

function getCouponUpdateData(body) {
  return normalizeAdminCouponBody(body)
}

function getSalesTargetUpdateData(body) {
  return normalizeAdminSalesTargetBody(body)
}

function getCashClosureCreateData(body) {
  return normalizeAdminCashClosureBody(body)
}

function getCouponListResponse(coupons) {
  return toApiCouponList(coupons)
}

function getSalesTargetListResponse(targets, progressMap = {}) {
  return toApiSalesTargetList(targets, progressMap)
}

function getCashClosureListResponse(closures) {
  return toApiCashClosureList(closures)
}

function calculateSalesTargetProgress(target, orders) {
  const achieved = (orders ?? []).reduce((sum, order) => sum + (Number(order.total) || 0), 0)
  return getSalesTargetStatusForTarget(target, achieved)
}

function calculateSalesTargetAchievement(target) {
  return getSalesTargetProgressValue(target, 0)
}

function getCouponStats(coupon) {
  return {
    ...toApiCoupon(coupon),
    remaining_uses: getCouponRemaining(coupon),
  }
}

function isCouponAvailable(coupon) {
  return coupon && coupon.isActive && !(coupon.expiresAt && new Date(coupon.expiresAt) < new Date())
}

function getCouponAdminFields(body) {
  return normalizeAdminCouponBody(body)
}

function isSalesTargetActive(target) {
  return Boolean(target?.isActive)
}

function formatCashClosureDate(date) {
  return date ? new Date(date).toISOString().slice(0, 10) : null
}

function getCashClosurePeriod(closure) {
  if (!closure) return null
  return {
    start: closure.startedAt ? new Date(closure.startedAt).toISOString().slice(0, 10) : null,
    end: closure.endedAt ? new Date(closure.endedAt).toISOString().slice(0, 10) : null,
  }
}

function buildCashClosureSummary(closure) {
  return {
    ...toApiCashClosure(closure),
    balance_difference: closure.closingBalance - closure.openingBalance,
  }
}

function getCouponOrderSummary(coupon, subtotal) {
  if (!coupon) return null
  return {
    coupon_code: coupon.code,
    discount_type: coupon.type,
    discount_amount: getCouponDiscountAmount(coupon, subtotal),
  }
}

function getCouponLabel(coupon) {
  if (!coupon) return ''
  return `${coupon.code} (${coupon.type === 'percent' ? `${coupon.value}%` : `${Number(coupon.value).toFixed(2)}€`})`
}

function normalizeCouponRequestBody(body) {
  return {
    code: normalizeCouponCode(body.code),
    type: formatCouponType(body.type),
    value: Number(body.value ?? 0) || 0,
    description: body.description ?? null,
    maxUses: body.max_uses === null || body.max_uses === undefined ? null : Number(body.max_uses) || null,
    isActive: body.is_active === false ? false : true,
    expiresAt: parseDateInput(body.expires_at),
    minOrderSubtotal: body.min_order_subtotal === null || body.min_order_subtotal === undefined ? null : Number(body.min_order_subtotal) || null,
  }
}

function normalizeSalesTargetRequestBody(body) {
  return {
    name: String(body.name ?? '').trim(),
    description: body.description ?? null,
    startAt: parseDateInput(body.start_at) || new Date(),
    endAt: parseDateInput(body.end_at) || new Date(),
    goalAmount: Number(body.goal_amount ?? 0) || 0,
    isActive: body.is_active === false ? false : true,
  }
}

function normalizeCashClosureRequestBody(body) {
  return {
    startedAt: parseDateInput(body.started_at) || new Date(),
    endedAt: parseDateInput(body.ended_at) || null,
    openingBalance: Number(body.opening_balance ?? 0) || 0,
    closingBalance: Number(body.closing_balance ?? 0) || 0,
    totalSales: body.total_sales === null || body.total_sales === undefined ? null : Number(body.total_sales) || null,
    notes: body.notes ?? null,
  }
}

function getCouponListAdminResponse(coupons) {
  return (coupons ?? []).map(toApiCoupon)
}

function getSalesTargetAdminResponse(targets) {
  return (targets ?? []).map(toApiSalesTarget)
}

function getCashClosureAdminResponse(closures) {
  return (closures ?? []).map(toApiCashClosure)
}

function getCouponByCodeOrThrow(code) {
  return prisma.coupon.findUnique({ where: { code: normalizeCouponCode(code) } })
}

function getOrderCouponValidation(coupon, subtotal) {
  return validateCouponPayload(coupon, subtotal)
}

function getCouponValidationErrorMessage(coupon, subtotal) {
  const validation = validateCouponPayload(coupon, subtotal)
  return validation.message
}

function computeCouponDiscount(coupon, subtotal) {
  return getCouponDiscountAmount(coupon, subtotal)
}

function getCouponEffectiveDiscount(coupon, subtotal) {
  return computeCouponDiscount(coupon, subtotal)
}

function getOrderCouponCreateData(coupon, subtotal) {
  return getCouponOrderCreationFields(coupon, subtotal)
}

function getSalesTargetDetails(target, achieved) {
  return getSalesTargetStatusForTarget(target, achieved)
}

function getCashClosureDetails(closure) {
  return getCashClosureDisplay(closure)
}

function buildCouponCreationPayload(body) {
  return normalizeAdminCouponBody(body)
}

function buildSalesTargetCreationPayload(body) {
  return normalizeAdminSalesTargetBody(body)
}

function buildCashClosureCreationPayload(body) {
  return normalizeAdminCashClosureBody(body)
}

function getCouponIdentifier(code) {
  return normalizeCouponCode(code)
}

function getCouponFromRequestQuery(req) {
  return normalizeCouponRequestBody(req.query)
}

function getCouponValidationResult(coupon, subtotal) {
  return buildCouponResponseShape(coupon, subtotal)
}

function getCouponParameters(req) {
  const code = normalizeCouponCode(req.query.code)
  const subtotal = parseDecimal(req.query.subtotal)
  return { code, subtotal }
}

function getCouponUsageSummary(coupon) {
  return {
    used: coupon.usedCount,
    remaining: getCouponRemaining(coupon),
  }
}

function getCouponStatusLabel(coupon) {
  if (!coupon) return 'inativo'
  if (!coupon.isActive) return 'inativo'
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return 'expirado'
  return 'ativo'
}

function getCouponValidationDescription(coupon, subtotal) {
  const validation = validateCouponPayload(coupon, subtotal)
  return validation.message
}

function getCouponPayload(body) {
  return normalizeAdminCouponBody(body)
}

function getSalesTargetPayload(body) {
  return normalizeAdminSalesTargetBody(body)
}

function getCashClosurePayload(body) {
  return normalizeAdminCashClosureBody(body)
}

function getCouponCodeFromQuery(req) {
  return normalizeCouponCode(req.query.code)
}

function getCouponDiscountEstimate(coupon, subtotal) {
  return getCouponDiscountAmount(coupon, subtotal)
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
    product_name: r.product?.name ?? null,
    product_image: Array.isArray(r.product?.images) ? (r.product.images[0] ?? null) : null,
    user_id: r.userId ?? null,
    rating: r.rating,
    comment: r.comment ?? null,
    author_name: r.authorName ?? null,
    is_approved: r.isApproved === undefined ? true : Boolean(r.isApproved),
    images: Array.isArray(r.images) ? r.images : [],
    videos: Array.isArray(r.videos) ? r.videos : [],
    points_awarded: r.pointsAwarded ?? 0,
    created_date: r.createdAt,
  }
}

async function computeReviewRewardPoints(review) {
  if (!review) return 0
  const loyalty = await getLoyaltyContent()
  const hasText = Boolean(String(review.comment ?? '').trim())
  const hasImages = Array.isArray(review.images) && review.images.length > 0
  const hasVideos = Array.isArray(review.videos) && review.videos.length > 0
  let points = 0
  if (hasText) points += Math.max(0, Number(loyalty.reward_text_points ?? 10) || 0)
  if (hasImages) points += Math.max(0, Number(loyalty.reward_image_points ?? 10) || 0)
  if (hasVideos) points += Math.max(0, Number(loyalty.reward_video_points ?? 20) || 0)
  return Math.floor(points)
}

function toApiAppointmentService(s) {
  return {
    id: s.id,
    name: s.name,
    description: s.description ?? null,
    image_url: s.imageUrl ?? null,
    duration_minutes: s.durationMinutes ?? 30,
    price: s.price === null || s.price === undefined ? null : decimalToNumber(s.price),
    is_active: Boolean(s.isActive),
    created_date: s.createdAt,
    updated_date: s.updatedAt,
  }
}

function toApiStaffMember(s) { 
  return { 
    id: s.id, 
    name: s.name, 
    email: s.email ?? null, 
    phone: s.phone ?? null, 
    availability: s.availability ?? null,
    is_active: Boolean(s.isActive), 
    created_date: s.createdAt, 
    updated_date: s.updatedAt, 
  } 
} 

function toApiAppointment(a) { 
  return { 
    id: a.id, 
    user_id: a.userId, 
    customer_email: a.user?.email ?? null, 
    service: a.service ? toApiAppointmentService(a.service) : null, 
    staff: a.staff ? toApiStaffMember(a.staff) : null, 
    start_at: a.startAt, 
    end_at: a.endAt, 
    duration_minutes: a.durationMinutes, 
    status: a.status, 
    observations: a.observations ?? null, 
    reminder_sent_at: a.reminderSentAt ?? null,
    created_date: a.createdAt, 
    updated_date: a.updatedAt, 
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

function toApiFaqQuestion(q) {
  const userFullName = q.user?.fullName ?? q.userFullName ?? null
  const userEmail = q.user?.email ?? q.userEmail ?? null
  return {
    id: q.id,
    user_id: q.userId ?? null,
    author_name: q.authorName ?? userFullName ?? null,
    author_email: q.authorEmail ?? userEmail ?? null,
    question: q.question,
    answer: q.answer ?? null,
    is_public: Boolean(q.isPublic),
    faq_item_id: q.faqItemId ?? null,
    answered_date: q.answeredAt ?? null,
    created_date: q.createdAt,
    updated_date: q.updatedAt,
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

    // Welcome email (best-effort).
    void (async () => {
      try {
        if (!isSmtpConfigured()) return
        const { content } = await getEmailContent()
        if (content?.welcome?.enabled === false) return

        const fullName = created.fullName ?? created.email
        const vars = {
          full_name: fullName,
          first_name: guessFirstName(fullName),
          email: created.email,
          app_url: appBaseUrl,
        }
        const subject = renderTemplate(content.welcome.subject, vars)
        const html = renderTemplate(content.welcome.html, vars)
        const text = renderTemplate(content.welcome.text, vars)
        await sendTemplatedEmail({ to: created.email, subject, html, text, fromName: content.from_name })
      } catch (err) {
        console.error('welcome email failed', err)
      }
    })()

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

  if (parsed.data.newsletter_opt_in !== undefined) {
    try {
      await upsertNewsletterSubscriber({
        email: updated.email,
        name: updated.fullName ?? null,
        userId: updated.id,
        status: updated.newsletterOptIn ? 'subscribed' : 'unsubscribed',
      })
    } catch (err) {
      console.error('newsletter sync failed', err)
    }
  }

  res.json({ user: pickPublicUser(updated) })
})

app.delete('/api/users/me', async (req, res) => {
  const user = await requireUser(req, res)
  if (!user) return

  const oldEmail = String(user.email ?? '').trim().toLowerCase()
  const tombstoneEmail = `deleted+${user.id}+${Date.now()}@example.invalid`

  try {
    await prisma.$transaction(async (tx) => {
      // Best-effort cleanup of user-owned data where we can safely remove it.
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id } })
      await tx.wishlistItem.deleteMany({ where: { userId: user.id } })

      // Remove user linkage / PII where possible.
      await tx.supportTicket.updateMany({
        where: { userId: user.id },
        data: { userId: null, customerName: null, customerEmail: null },
      })
      await tx.blogComment.updateMany({
        where: { userId: user.id },
        data: { userId: null, authorName: null, authorEmail: null },
      })
      await tx.$executeRaw`UPDATE "FaqQuestion" SET "userId" = NULL, "authorName" = NULL, "authorEmail" = NULL, "updatedAt" = NOW() WHERE "userId" = ${user.id};`

      // Logs should not keep identifying linkage.
      await tx.auditLog.updateMany({ where: { actorId: user.id }, data: { actorId: null } })
      await tx.inventoryMovement.updateMany({ where: { actorId: user.id }, data: { actorId: null } })

      // Newsletter subscriber: unsubscribe old email.
      if (oldEmail) {
        await tx.$executeRaw`UPDATE "NewsletterSubscriber" SET "status" = 'unsubscribed', "unsubscribedAt" = NOW(), "updatedAt" = NOW() WHERE "email" = ${oldEmail};`
      }

      // Tombstone the user account (so existing tokens stop working).
      const { saltHex, hashHex } = hashPassword(crypto.randomUUID() + crypto.randomUUID())
      await tx.$executeRaw`
        UPDATE "User"
        SET
          "isDeleted" = TRUE,
          "isAdmin" = FALSE,
          "email" = ${tombstoneEmail},
          "fullName" = NULL,
          "phone" = NULL,
          "addressLine1" = NULL,
          "addressLine2" = NULL,
          "city" = NULL,
          "postalCode" = NULL,
          "country" = 'Portugal',
          "newsletterOptIn" = FALSE,
          "orderUpdatesEmail" = FALSE,
          "passwordSalt" = ${saltHex},
          "passwordHash" = ${hashHex},
          "updatedAt" = NOW()
        WHERE "id" = ${user.id};
      `
    })

    await writeAuditLog({ actorId: null, action: 'delete', entityType: 'User', entityId: user.id })
    res.json({ ok: true })
  } catch (err) {
    console.error('account delete failed', err)
    res.status(500).json({ error: 'internal_error' })
  }
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

app.get('/api/coupons/validate', async (req, res) => {
  const code = normalizeCouponCode(req.query.code)
  if (!code) return res.status(400).json({ error: 'invalid_code', detail: 'código de cupom é obrigatório' })

  const subtotal = parseDecimal(req.query.subtotal)
  const coupon = await prisma.coupon.findUnique({ where: { code } })
  if (!coupon) return res.status(404).json({ error: 'coupon_not_found', detail: 'cupom não encontrado' })

  const validation = validateCouponPayload(coupon, subtotal)
  if (!validation.valid) return res.status(400).json({ error: 'invalid_coupon', detail: validation.message })

  res.json({
    ...toApiCoupon(coupon),
    discount_amount: validation.discount_amount ?? 0,
    remaining_uses:
      coupon.maxUses === null || coupon.maxUses === undefined ? null : Math.max(0, coupon.maxUses - coupon.usedCount),
  })
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
      userId: user.id,
      rating: parsed.data.rating,
      comment: parsed.data.comment ?? null,
      authorName: parsed.data.author_name ?? user.fullName ?? user.email,
      isApproved: false,
      images: Array.isArray(parsed.data.images) ? parsed.data.images : [],
      videos: Array.isArray(parsed.data.videos) ? parsed.data.videos : [],
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

app.get('/api/content/branding', async (req, res) => {
  const record = await prisma.siteContent.findUnique({ where: { key: 'branding' } })
  res.json({ content: record?.value ?? null, updated_date: record?.updatedAt ?? null })
})

app.get('/api/content/loyalty', async (req, res) => {
  const record = await prisma.siteContent.findUnique({ where: { key: 'loyalty' } })
  const content = await getLoyaltyContent()
  res.json({ content, updated_date: record?.updatedAt ?? null })
})

app.get('/api/content/appointments', async (req, res) => {
  const record = await prisma.siteContent.findUnique({ where: { key: 'appointments' } })
  const enabled = Boolean(record?.value && typeof record.value === 'object' && record.value.enabled === true)
  res.json({ content: { enabled }, updated_date: record?.updatedAt ?? null })
})

// Newsletter (public)
app.post('/api/newsletter/subscribe', async (req, res) => {
  const parsed = newsletterSubscribeSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const token = getBearerToken(req)
  const payload = token ? verifyToken(token) : null
  const userId = typeof payload?.sub === 'string' ? payload.sub : null

  const email = normalizeEmail(parsed.data.email)
  const name = parsed.data.name ?? null

  const created = await upsertNewsletterSubscriber({ email, name, userId, status: 'subscribed' })

  await writeAuditLog({
    actorId: userId,
    action: 'create',
    entityType: 'NewsletterSubscriber',
    entityId: created?.id ?? null,
    meta: { status: 'subscribed' },
  })

  res.status(201).json({ ok: true, subscriber: created ? subscriberToApi(created) : null })
})

app.get('/api/newsletter/unsubscribe', async (req, res) => {
  const token = String(req.query.token ?? '').trim()
  if (!token) return res.status(400).json({ error: 'invalid_token' })

  const rows = await prisma.$queryRaw`
    UPDATE "NewsletterSubscriber"
    SET "status" = 'unsubscribed', "unsubscribedAt" = NOW(), "updatedAt" = NOW()
    WHERE "unsubscribeToken" = ${token}
    RETURNING "id","userId","email","name","status","unsubscribeToken","subscribedAt","unsubscribedAt","createdAt","updatedAt";
  `
  const updated = Array.isArray(rows) ? rows[0] : null
  if (!updated) return res.status(404).json({ error: 'not_found' })

  await writeAuditLog({
    actorId: updated.userId ?? null,
    action: 'update',
    entityType: 'NewsletterSubscriber',
    entityId: updated.id,
    meta: { status: 'unsubscribed' },
  })

  res.json({ ok: true })
})

app.get('/api/faq', async (req, res) => {
  const items = await prisma.faqItem.findMany({
    where: { isActive: true },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    take: 500,
  })
  res.json(items.map(toApiFaqItem))
})

app.post('/api/faq/questions', async (req, res) => {
  const parsed = faqQuestionCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const token = getBearerToken(req)
  const payload = token ? verifyToken(token) : null
  const userId = typeof payload?.sub === 'string' ? payload.sub : null

  const question = parsed.data.question.trim()
  const authorName = parsed.data.author_name ? String(parsed.data.author_name).trim() : ''
  const authorEmail = parsed.data.author_email ? String(parsed.data.author_email).trim().toLowerCase() : ''

  const id = crypto.randomUUID()
  const rows = await prisma.$queryRaw`
    INSERT INTO "FaqQuestion" ("id","userId","authorName","authorEmail","question","answer","isPublic","faqItemId","answeredAt","createdAt","updatedAt")
    VALUES (${id}, ${userId}, ${authorName || null}, ${authorEmail || null}, ${question}, ${null}, ${false}, ${null}, ${null}, NOW(), NOW())
    RETURNING "id","userId","authorName","authorEmail","question","answer","isPublic","faqItemId","answeredAt","createdAt","updatedAt";
  `
  const created = Array.isArray(rows) ? rows[0] : null

  await writeAuditLog({
    actorId: userId,
    action: 'create',
    entityType: 'FaqQuestion',
    entityId: created?.id ?? id,
    meta: { is_public: false },
  })

  res.status(201).json(toApiFaqQuestion(created ?? { id, userId, authorName: authorName || null, authorEmail: authorEmail || null, question, answer: null, isPublic: false, faqItemId: null, answeredAt: null, createdAt: new Date(), updatedAt: new Date() }))
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

    const appointmentReminderLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'Appointment',
        action: 'reminder',
        meta: { path: ['user_id'], equals: user.id },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
	 
	  const items = [ 
    ...appointmentReminderLogs.map((l) => {
      const serviceName = typeof l.meta?.service_name === 'string' ? l.meta.service_name : null
      const staffName = typeof l.meta?.staff_name === 'string' ? l.meta.staff_name : null
      const startAt = l.meta?.start_at ? new Date(l.meta.start_at) : null
      const when = startAt && Number.isFinite(startAt.getTime()) ? startAt.toLocaleString('pt-PT') : null
      const text = [serviceName, staffName, when].filter(Boolean).join(' • ') || 'Tem uma marcação em breve.'
      return {
        id: `appt:${l.id}`,
        type: 'appointment_reminder',
        title: 'Lembrete de marcação',
        text,
        link: '/marcacoes',
        created_date: l.createdAt,
      }
    }),
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
	      const title = status === 'delivered' ? 'Encomenda entregue â€” avalie e ganhe pontos' : 'Estado da encomenda atualizado'
	      const inner = status
	        ? prev
	          ? `Estado: ${prev} → ${status}`
	          : `Novo estado: ${status}`
	        : 'A sua encomenda foi atualizada.'
	      return {
	        id: `order:${l.id}`,
	        type: 'order_status',
	        title,
	        text:
	          status === 'delivered'
	            ? 'A sua encomenda foi entregue. Deixe uma avaliaÃ§Ã£o com foto/vÃ­deo e ganhe pontos.'
	            : orderId
	            ? `Encomenda ${orderId}: ${inner}`
	            : inner,
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
  const subtotalValue = Number(data.subtotal ?? 0) || 0
  const shippingCostValue = Number(data.shipping_cost ?? 0) || 0

  let coupon = null
  let appliedDiscount = 0
  let couponId = null
  let couponCode = null
  let discountType = null

  if (data.coupon_code) {
    const providedCode = normalizeCouponCode(data.coupon_code)
    if (!providedCode) return res.status(400).json({ error: 'invalid_coupon', detail: 'cupom inválido' })

    coupon = await prisma.coupon.findUnique({ where: { code: providedCode } })
    if (!coupon) return res.status(400).json({ error: 'invalid_coupon', detail: 'cupom inválido' })

    const validation = validateCouponPayload(coupon, subtotalValue)
    if (!validation.valid) return res.status(400).json({ error: 'invalid_coupon', detail: validation.message })

    appliedDiscount = Number(validation.discount_amount ?? 0) || 0
    couponId = coupon.id
    couponCode = coupon.code
    discountType = coupon.type
  }

  const totalBeforePoints = Math.max(0, subtotalValue + shippingCostValue - appliedDiscount)
  const loyalty = await getLoyaltyContent()
  const pointValue = Math.max(0.000001, Number(loyalty.point_value_eur ?? 0.01) || 0.01)

  // Optional loyalty points redemption (only for authenticated users).
  const token = getBearerToken(req)
  const payload = token ? verifyToken(token) : null
  const userId = typeof payload?.sub === 'string' ? payload.sub : null
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null

  const requestedPoints = data.points_to_use === null || data.points_to_use === undefined ? 0 : Number.parseInt(String(data.points_to_use), 10) || 0
  const pointsBalance = user && !user.isDeleted ? Number(user.pointsBalance ?? 0) || 0 : 0
  const maxPointsByTotal = Math.floor(totalBeforePoints / pointValue)
  const pointsUsed = Math.max(0, Math.min(requestedPoints, pointsBalance, maxPointsByTotal))
  const pointsDiscount = pointsUsed * pointValue
  const totalValue = Number(Math.max(0, totalBeforePoints - pointsDiscount).toFixed(2))

  const created = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
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
        couponId,
        couponCode,
        discountAmount: appliedDiscount ? String(appliedDiscount) : undefined,
        discountType: discountType ?? null,
        subtotal: data.subtotal === undefined || data.subtotal === null ? undefined : String(data.subtotal),
        shippingCost: data.shipping_cost === undefined || data.shipping_cost === null ? undefined : String(data.shipping_cost),
        total: String(totalValue.toFixed(2)),
        pointsUsed,
        pointsDiscount: String(pointsDiscount.toFixed(2)),
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

    if (coupon) {
      await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } })
    }

    if (user && !user.isDeleted && pointsUsed > 0) {
      await tx.user.update({ where: { id: user.id }, data: { pointsBalance: { decrement: pointsUsed } } })
    }

    return order
  })

  await writeAuditLog({ action: 'create', entityType: 'Order', entityId: created.id, meta: { source: 'checkout' } })

  // Order email (best-effort).
  void (async () => {
    try {
      if (!isSmtpConfigured()) return
      const { content } = await getEmailContent()
      if (content?.order?.enabled === false) return

      const customerName = created.customerName ?? created.customerEmail
      const vars = {
        customer_name: customerName,
        first_name: guessFirstName(customerName),
        order_id: created.id,
        total: `${created.total?.toString?.() ?? String(created.total)}€`,
        app_url: appBaseUrl,
      }
      const subject = renderTemplate(content.order.subject, vars)
      const html = renderTemplate(content.order.html, vars)
      const text = renderTemplate(content.order.text, vars)
      await sendTemplatedEmail({ to: created.customerEmail, subject, html, text, fromName: content.from_name })
    } catch (err) {
      console.error('order email failed', err)
    }
  })()

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

// Appointments (customers)
app.get('/api/appointments/services', async (req, res) => {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    take: 500,
  })
  res.json({ services: services.map(toApiAppointmentService) })
})

app.get('/api/appointments/staff', async (req, res) => { 
  const serviceId = req.query.service_id ? String(req.query.service_id) : null 
  if (!serviceId) { 
    const staff = await prisma.staffMember.findMany({ 
      where: { isActive: true }, 
      orderBy: { name: 'asc' },
      take: 500,
    })
    return res.json({ staff: staff.map(toApiStaffMember) })
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service || !service.isActive) return res.status(404).json({ error: 'service_not_found' })

  const linkCount = await prisma.staffService.count({ where: { serviceId } })
  if (linkCount === 0) {
    const staff = await prisma.staffMember.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      take: 500,
    })
    return res.json({ staff: staff.map(toApiStaffMember) })
  }

  const links = await prisma.staffService.findMany({
    where: { serviceId },
    select: { staffId: true },
  })
  const allowedIds = links.map((l) => l.staffId)
  const staff = await prisma.staffMember.findMany({ 
    where: { isActive: true, id: { in: allowedIds } }, 
    orderBy: { name: 'asc' }, 
    take: 500, 
  }) 
  return res.json({ staff: staff.map(toApiStaffMember) }) 
}) 

app.get('/api/appointments/staff/available', async (req, res) => {
  const serviceId = req.query.service_id ? String(req.query.service_id) : null
  const startAtRaw = req.query.start_at ? String(req.query.start_at) : null
  if (!serviceId || !startAtRaw) return res.status(400).json({ error: 'invalid_body', detail: 'service_id e start_at obrigatórios' })

  const startAt = parseDateInput(startAtRaw)
  if (!startAt) return res.status(400).json({ error: 'invalid_body', detail: 'start_at inválido' })

  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service || !service.isActive) return res.status(404).json({ error: 'service_not_found' })

  const durationMinutes = Math.max(1, Math.min(Number(service.durationMinutes ?? 30) || 30, 24 * 60))
  const endAt = new Date(startAt.getTime() + durationMinutes * 60_000)

  const linkCount = await prisma.staffService.count({ where: { serviceId } })
  let allowedIds = null
  if (linkCount > 0) {
    const links = await prisma.staffService.findMany({
      where: { serviceId },
      select: { staffId: true },
    })
    allowedIds = links.map((l) => l.staffId)
  }

  const baseWhere = allowedIds ? { isActive: true, id: { in: allowedIds } } : { isActive: true }
  const allStaff = await prisma.staffMember.findMany({
    where: baseWhere,
    orderBy: { name: 'asc' },
    take: 500,
  })

  const staffWithinAvailability = allStaff.filter((s) => !s.availability || isAppointmentWithinStaffAvailability(s.availability, startAt, endAt))
  const ids = staffWithinAvailability.map((s) => s.id)
  if (!ids.length) return res.json({ staff: [] })

  const conflicts = await prisma.appointment.findMany({
    where: {
      staffId: { in: ids },
      status: { in: ['pending', 'confirmed'] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { staffId: true },
    take: 500,
  })
  const busy = new Set(conflicts.map((c) => c.staffId))
  const available = staffWithinAvailability.filter((s) => !busy.has(s.id))
  res.json({ staff: available.map(toApiStaffMember) })
})

app.get('/api/appointments/my', async (req, res) => { 
  const user = await requireUser(req, res) 
  if (!user) return 
 
  const appointments = await prisma.appointment.findMany({ 
    where: { userId: user.id }, 
    include: { user: true, service: true, staff: true }, 
    orderBy: { startAt: 'desc' }, 
    take: 200, 
  }) 
  
  // Best-effort reminders (no scheduler needed).
  maybeSendAppointmentRemindersForUser(user, appointments).catch(() => {})
 
  res.json({ appointments: appointments.map(toApiAppointment) }) 
}) 

app.get('/api/appointments/:id', async (req, res) => {
  const user = await requireUser(req, res)
  if (!user) return

  const id = String(req.params.id)
  const appointment = await prisma.appointment.findFirst({
    where: { id, userId: user.id },
    include: { user: true, service: true, staff: true },
  })
  if (!appointment) return res.status(404).json({ error: 'not_found' })
  res.json({ appointment: toApiAppointment(appointment) })
})

app.post('/api/appointments/:id/remind', async (req, res) => {
  const user = await requireUser(req, res)
  if (!user) return

  const id = String(req.params.id)
  const appointment = await prisma.appointment.findFirst({
    where: { id, userId: user.id },
    include: { user: true, service: true, staff: true },
  })
  if (!appointment) return res.status(404).json({ error: 'not_found' })

  if (appointment.reminderSentAt) return res.json({ ok: true, sent: false, reason: 'already_sent' })
  if (appointment.status !== 'pending' && appointment.status !== 'confirmed') {
    return res.status(400).json({ error: 'invalid_body', detail: 'status inválido' })
  }
  const now = new Date()
  if (appointment.startAt <= now) return res.json({ ok: true, sent: false, reason: 'past' })

  await maybeSendAppointmentRemindersForUser(user, [appointment])
  res.json({ ok: true, sent: true })
})

app.post('/api/appointments', async (req, res) => {
  const user = await requireUser(req, res)
  if (!user) return

  const record = await prisma.siteContent.findUnique({ where: { key: 'appointments' } })
  const enabled = Boolean(record?.value && typeof record.value === 'object' && record.value.enabled === true)
  if (!enabled) return res.status(403).json({ error: 'appointments_disabled' })

  const parsed = appointmentCreateSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const startAt = parseDateInput(parsed.data.start_at)
  if (!startAt) return res.status(400).json({ error: 'invalid_body', detail: 'start_at inválido' })
  const now = new Date()
  if (startAt.getTime() < now.getTime() - 60_000) {
    return res.status(400).json({ error: 'invalid_body', detail: 'start_at no passado' })
  }

  const service = await prisma.service.findUnique({ where: { id: parsed.data.service_id } })
  if (!service || !service.isActive) return res.status(404).json({ error: 'service_not_found' })

  const staff = await prisma.staffMember.findUnique({ where: { id: parsed.data.staff_id } })
  if (!staff || !staff.isActive) return res.status(404).json({ error: 'staff_not_found' })

  const linkCount = await prisma.staffService.count({ where: { serviceId: service.id } })
  if (linkCount > 0) {
    const allowed = await prisma.staffService.findUnique({
      where: { staffId_serviceId: { staffId: staff.id, serviceId: service.id } },
    })
    if (!allowed) return res.status(400).json({ error: 'staff_not_allowed_for_service' })
  }

  const durationMinutes = Math.max(1, Math.min(Number(service.durationMinutes ?? 30) || 30, 24 * 60)) 
  const endAt = new Date(startAt.getTime() + durationMinutes * 60_000) 

  if (staff.availability && !isAppointmentWithinStaffAvailability(staff.availability, startAt, endAt)) {
    return res.status(409).json({ error: 'staff_unavailable' })
  }
 
  const conflict = await prisma.appointment.findFirst({ 
    where: { 
      staffId: staff.id, 
      status: { in: ['pending', 'confirmed'] }, 
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
  })
  if (conflict) return res.status(409).json({ error: 'slot_unavailable' })

  const created = await prisma.appointment.create({
    data: {
      userId: user.id,
      serviceId: service.id,
      staffId: staff.id,
      startAt,
      endAt,
      durationMinutes,
      status: 'pending',
      observations: parsed.data.observations ?? null,
    },
    include: { user: true, service: true, staff: true },
  })

  await writeAuditLog({
    actorId: user.id,
    action: 'create',
    entityType: 'Appointment',
    entityId: created.id,
    meta: { service_id: service.id, staff_id: staff.id, start_at: startAt.toISOString(), duration_minutes: durationMinutes },
  })

  res.status(201).json({ appointment: toApiAppointment(created) })
})

app.patch('/api/appointments/:id/cancel', async (req, res) => {
  const user = await requireUser(req, res)
  if (!user) return

  const id = String(req.params.id)
  const existing = await prisma.appointment.findFirst({
    where: { id, userId: user.id },
    include: { user: true, service: true, staff: true },
  })
  if (!existing) return res.status(404).json({ error: 'not_found' })
  if (existing.status === 'cancelled' || existing.status === 'completed') {
    return res.status(409).json({ error: 'invalid_status' })
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: 'cancelled' },
    include: { user: true, service: true, staff: true },
  })

  await writeAuditLog({
    actorId: user.id,
    action: 'update',
    entityType: 'Appointment',
    entityId: updated.id,
    meta: { status: 'cancelled' },
  })

  res.json({ appointment: toApiAppointment(updated) })
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
    .extend({
      is_admin: z.boolean().optional(),
      points_balance: z
        .preprocess(
          (v) => {
            if (v === undefined || v === null || v === '') return undefined
            if (typeof v === 'number') return v
            if (typeof v === 'string') return Number(v)
            return v
          },
          z.number().int().min(0).optional(),
        )
        .optional(),
      points_delta: z.preprocess(
        (v) => {
          if (v === undefined || v === null || v === '') return undefined
          if (typeof v === 'number') return v
          if (typeof v === 'string') return Number(v)
          return v
        },
        z.number().int().optional(),
      ),
      points_reason: optionalNullableTrimmedString({ min: 1, max: 200 }),
    })
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

  const wantsPointsBalance = parsed.data.points_balance !== undefined
  const wantsPointsDelta = parsed.data.points_delta !== undefined

  if (wantsPointsBalance && wantsPointsDelta) {
    return res.status(400).json({ error: 'invalid_body', message: 'Use points_balance ou points_delta, não ambos.' })
  }

  let pointsBefore = null
  let pointsAfter = null
  if (wantsPointsBalance || wantsPointsDelta) {
    const current = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!current) return res.status(404).json({ error: 'not_found' })
    pointsBefore = current.pointsBalance ?? 0

    if (wantsPointsBalance) {
      pointsAfter = parsed.data.points_balance
    } else {
      pointsAfter = pointsBefore + (parsed.data.points_delta ?? 0)
    }

    if (!Number.isFinite(pointsAfter)) {
      return res.status(400).json({ error: 'invalid_body', message: 'points_balance/points_delta inválido.' })
    }

    if (pointsAfter < 0) {
      return res.status(400).json({ error: 'invalid_body', message: 'O saldo de pontos não pode ser negativo.' })
    }

    data.pointsBalance = pointsAfter
  }

  const updated = await prisma.user.update({ where: { id: req.params.id }, data })

  if (parsed.data.newsletter_opt_in !== undefined) {
    try {
      await upsertNewsletterSubscriber({
        email: updated.email,
        name: updated.fullName ?? null,
        userId: updated.id,
        status: updated.newsletterOptIn ? 'subscribed' : 'unsubscribed',
      })
    } catch (err) {
      console.error('newsletter sync failed', err)
    }
  }

  await writeAuditLog({
    actorId: admin.id,
    action: 'update',
    entityType: 'User',
    entityId: updated.id,
    meta: {
      patch: req.body,
      points_before: pointsBefore,
      points_after: pointsAfter,
      points_reason: parsed.data.points_reason ?? null,
    },
  })
  res.json({ user: pickPublicUser(updated) })
})

app.get('/api/admin/loyalty/stats', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const loyalty = await getLoyaltyContent()
  const pointValue = Math.max(0.000001, Number(loyalty.point_value_eur ?? 0.01) || 0.01)

  const [earnedAgg, usedAgg, usersWithBalance, ordersWithPoints, earnedUsers, usedUsers] = await Promise.all([
    prisma.review.aggregate({ where: { pointsAwarded: { gt: 0 } }, _sum: { pointsAwarded: true } }),
    prisma.order.aggregate({ where: { pointsUsed: { gt: 0 } }, _sum: { pointsUsed: true } }),
    prisma.user.count({ where: { pointsBalance: { gt: 0 }, isDeleted: false } }),
    prisma.order.count({ where: { pointsUsed: { gt: 0 } } }),
    prisma.review.findMany({ where: { pointsAwarded: { gt: 0 }, userId: { not: null } }, distinct: ['userId'], select: { userId: true } }),
    prisma.order.findMany({ where: { pointsUsed: { gt: 0 } }, distinct: ['customerEmail'], select: { customerEmail: true } }),
  ])

  const totalPointsGenerated = Number(earnedAgg?._sum?.pointsAwarded ?? 0) || 0
  const totalPointsUsed = Number(usedAgg?._sum?.pointsUsed ?? 0) || 0

  res.json({
    point_value_eur: pointValue,
    total_points_generated: totalPointsGenerated,
    total_points_used: totalPointsUsed,
    total_discount_eur: Number((totalPointsUsed * pointValue).toFixed(2)),
    users_with_points_balance: usersWithBalance,
    users_who_generated_points: Array.isArray(earnedUsers) ? earnedUsers.length : 0,
    users_who_used_points: Array.isArray(usedUsers) ? usedUsers.length : 0,
    orders_with_points: ordersWithPoints,
  })
})

// Appointments (admin)
app.get('/api/admin/appointment-services', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const services = await prisma.service.findMany({ orderBy: { createdAt: 'desc' }, take: parseLimit(req.query.limit, 500) })
  res.json({ services: services.map(toApiAppointmentService) })
})

app.post('/api/admin/appointment-services', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = appointmentServicePayloadSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const durationMinutes = Math.max(1, Math.min(Number(parsed.data.duration_minutes ?? 30) || 30, 24 * 60))
  const price = parsed.data.price === undefined ? undefined : parsed.data.price === null ? null : String(parsed.data.price)

  const created = await prisma.service.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      imageUrl: parsed.data.image_url ?? null,
      durationMinutes,
      price,
      isActive: parsed.data.is_active !== false,
    },
  })

  await writeAuditLog({ actorId: admin.id, action: 'create', entityType: 'Service', entityId: created.id, meta: { name: created.name } })
  res.status(201).json({ service: toApiAppointmentService(created) })
})

app.patch('/api/admin/appointment-services/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = appointmentServicePayloadSchema.partial().safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const data = {}
  if (parsed.data.name !== undefined) data.name = parsed.data.name
  if (parsed.data.description !== undefined) data.description = parsed.data.description ?? null
  if (parsed.data.image_url !== undefined) data.imageUrl = parsed.data.image_url ?? null
  if (parsed.data.duration_minutes !== undefined) data.durationMinutes = Math.max(1, Math.min(Number(parsed.data.duration_minutes ?? 30) || 30, 24 * 60))
  if (parsed.data.price !== undefined) data.price = parsed.data.price === null ? null : String(parsed.data.price)
  if (parsed.data.is_active !== undefined) data.isActive = Boolean(parsed.data.is_active)

  const updated = await prisma.service.update({ where: { id: req.params.id }, data })
  await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'Service', entityId: updated.id, meta: { patch: req.body } })
  res.json({ service: toApiAppointmentService(updated) })
})

app.get('/api/admin/appointment-services/:id/staff', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const service = await prisma.service.findUnique({ where: { id: req.params.id } })
  if (!service) return res.status(404).json({ error: 'not_found' })

  const links = await prisma.staffService.findMany({
    where: { serviceId: service.id },
    select: { staffId: true },
    orderBy: { createdAt: 'asc' },
  })
  res.json({ staff_ids: links.map((l) => l.staffId) })
})

app.patch('/api/admin/appointment-services/:id/staff', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const staffIds = Array.isArray(req.body?.staff_ids) ? req.body.staff_ids.map((v) => String(v)) : null
  if (!staffIds) return res.status(400).json({ error: 'invalid_body', detail: 'staff_ids inválido' })

  const service = await prisma.service.findUnique({ where: { id: req.params.id } })
  if (!service) return res.status(404).json({ error: 'not_found' })

  const unique = Array.from(new Set(staffIds.filter(Boolean)))
  const existingStaff = await prisma.staffMember.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  })
  const validIds = new Set(existingStaff.map((s) => s.id))
  const finalIds = unique.filter((id) => validIds.has(id))

  await prisma.$transaction(async (tx) => {
    await tx.staffService.deleteMany({
      where: { serviceId: service.id, staffId: { notIn: finalIds.length ? finalIds : ['__none__'] } },
    })

    if (finalIds.length) {
      await tx.staffService.createMany({
        data: finalIds.map((staffId) => ({ staffId, serviceId: service.id })),
        skipDuplicates: true,
      })
    }
  })

  await writeAuditLog({
    actorId: admin.id,
    action: 'update',
    entityType: 'Service',
    entityId: service.id,
    meta: { staff_ids: finalIds },
  })

  res.json({ ok: true, staff_ids: finalIds })
})

app.get('/api/admin/appointment-staff', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const staff = await prisma.staffMember.findMany({ orderBy: { createdAt: 'desc' }, take: parseLimit(req.query.limit, 500) })
  res.json({ staff: staff.map(toApiStaffMember) })
})

app.post('/api/admin/appointment-staff', async (req, res) => { 
  const admin = await requireAdmin(req, res) 
  if (!admin) return 
 
  const parsed = appointmentStaffPayloadSchema.safeParse(req.body ?? {}) 
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues }) 

  if (!parsed.data.availability) {
    return res.status(400).json({ error: 'invalid_body', detail: 'availability obrigatório' })
  }
  const startMinutes = parseTimeHHMM(parsed.data.availability.start_time)
  const endMinutes = parseTimeHHMM(parsed.data.availability.end_time)
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return res.status(400).json({ error: 'invalid_body', detail: 'horário inválido' })
  }
 
  const created = await prisma.staffMember.create({ 
    data: { 
      name: parsed.data.name, 
      email: parsed.data.email ?? null, 
      phone: parsed.data.phone ?? null, 
      availability: parsed.data.availability,
      isActive: parsed.data.is_active !== false, 
    }, 
  }) 

  await writeAuditLog({ actorId: admin.id, action: 'create', entityType: 'StaffMember', entityId: created.id, meta: { name: created.name } })
  res.status(201).json({ staff: toApiStaffMember(created) })
})

app.patch('/api/admin/appointment-staff/:id', async (req, res) => { 
  const admin = await requireAdmin(req, res) 
  if (!admin) return 
 
  const parsed = appointmentStaffPayloadSchema.partial().safeParse(req.body ?? {}) 
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues }) 
 
  const data = {} 
  if (parsed.data.name !== undefined) data.name = parsed.data.name 
  if (parsed.data.email !== undefined) data.email = parsed.data.email ?? null 
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone ?? null 
  if (parsed.data.availability !== undefined) {
    if (parsed.data.availability === null) {
      data.availability = null
    } else {
      const startMinutes = parseTimeHHMM(parsed.data.availability.start_time)
      const endMinutes = parseTimeHHMM(parsed.data.availability.end_time)
      if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
        return res.status(400).json({ error: 'invalid_body', detail: 'horário inválido' })
      }
      data.availability = parsed.data.availability
    }
  }
  if (parsed.data.is_active !== undefined) data.isActive = Boolean(parsed.data.is_active) 
 
  const updated = await prisma.staffMember.update({ where: { id: req.params.id }, data }) 
  await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'StaffMember', entityId: updated.id, meta: { patch: req.body } }) 
  res.json({ staff: toApiStaffMember(updated) }) 
}) 

app.get('/api/admin/appointments', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const from = parseDateInput(req.query.from)
  const to = parseDateInput(req.query.to)
  const status = req.query.status ? String(req.query.status) : null
  const staffId = req.query.staff_id ? String(req.query.staff_id) : null

  const where = {}
  if (from) where.startAt = { ...(where.startAt ?? {}), gte: from }
  if (to) where.startAt = { ...(where.startAt ?? {}), lte: to }
  if (status && ['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) where.status = status
  if (staffId) where.staffId = staffId

  const appointments = await prisma.appointment.findMany({
    where,
    include: { user: true, service: true, staff: true },
    orderBy: { startAt: 'desc' },
    take: parseLimit(req.query.limit, 200),
  })

  res.json({ appointments: appointments.map(toApiAppointment) })
})

app.patch('/api/admin/appointments/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = adminAppointmentPatchSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const existing = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: { user: true, service: true, staff: true },
  })
  if (!existing) return res.status(404).json({ error: 'not_found' })

  const nextStaffId = parsed.data.staff_id ?? undefined
  const nextServiceId = parsed.data.service_id ?? undefined
  const nextStartAt = parsed.data.start_at ? parseDateInput(parsed.data.start_at) : null
  if (parsed.data.start_at && !nextStartAt) return res.status(400).json({ error: 'invalid_body', detail: 'start_at inválido' })

  const staff = nextStaffId ? await prisma.staffMember.findUnique({ where: { id: nextStaffId } }) : existing.staff
  if (nextStaffId && (!staff || !staff.isActive)) return res.status(404).json({ error: 'staff_not_found' })

  const service = nextServiceId ? await prisma.service.findUnique({ where: { id: nextServiceId } }) : existing.service
  if (nextServiceId && (!service || !service.isActive)) return res.status(404).json({ error: 'service_not_found' })

  const durationMinutesRaw =
    parsed.data.duration_minutes === undefined || parsed.data.duration_minutes === null
      ? Number(service?.durationMinutes ?? existing.durationMinutes ?? 30) || 30
      : Number(parsed.data.duration_minutes) || 30
  const durationMinutes = Math.max(1, Math.min(durationMinutesRaw, 24 * 60))

  const startAt = nextStartAt ?? existing.startAt 
  const endAt = new Date(startAt.getTime() + durationMinutes * 60_000) 
 
  const statusNext = parsed.data.status ?? existing.status 
  const shouldCheckConflict = statusNext === 'pending' || statusNext === 'confirmed' 
 
  if (shouldCheckConflict && staff?.availability && !isAppointmentWithinStaffAvailability(staff.availability, startAt, endAt)) {
    return res.status(409).json({ error: 'staff_unavailable' })
  }

  if (shouldCheckConflict) { 
    const conflict = await prisma.appointment.findFirst({ 
      where: { 
        id: { not: existing.id }, 
        staffId: staff.id, 
        status: { in: ['pending', 'confirmed'] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    })
    if (conflict) return res.status(409).json({ error: 'slot_unavailable' })
  }

  const updated = await prisma.appointment.update({ 
    where: { id: existing.id }, 
    data: { 
      staffId: staff.id, 
      serviceId: service.id, 
      startAt, 
      endAt, 
      durationMinutes, 
      status: statusNext, 
      reminderSentAt:
        parsed.data.start_at || parsed.data.staff_id || parsed.data.service_id || parsed.data.status
          ? null
          : undefined,
      observations: parsed.data.observations === undefined ? undefined : parsed.data.observations ?? null, 
    }, 
    include: { user: true, service: true, staff: true }, 
  }) 

  await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'Appointment', entityId: updated.id, meta: { patch: req.body } })
  res.json({ appointment: toApiAppointment(updated) })
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

app.get('/api/admin/coupons', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const coupons = await prisma.coupon.findMany({
    orderBy: parseOrderParam(req.query.order),
    take: parseLimit(req.query.limit, 200),
  })

  res.json(coupons.map(toApiCoupon))
})

app.post('/api/admin/coupons', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = couponPayloadSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const code = normalizeCouponCode(parsed.data.code)
  const created = await prisma.coupon.create({
    data: {
      code,
      type: parsed.data.type ?? 'amount',
      value: String(Number(parsed.data.value ?? 0) || 0),
      description: parsed.data.description ?? null,
      maxUses:
        parsed.data.max_uses === null || parsed.data.max_uses === undefined
          ? undefined
          : Number(parsed.data.max_uses) > 0
          ? Number(parsed.data.max_uses)
          : null,
      isActive: parsed.data.is_active === false ? false : true,
      expiresAt: parsed.data.expires_at ? new Date(parsed.data.expires_at) : null,
      minOrderSubtotal:
        parsed.data.min_order_subtotal === null || parsed.data.min_order_subtotal === undefined
          ? null
          : String(Number(parsed.data.min_order_subtotal) || 0),
    },
  })

  await writeAuditLog({ actorId: admin.id, action: 'create', entityType: 'Coupon', entityId: created.id, meta: req.body })
  res.status(201).json(toApiCoupon(created))
})

app.patch('/api/admin/coupons/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = couponPayloadSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  try {
    const updated = await prisma.coupon.update({
      where: { id: req.params.id },
      data: {
        code: parsed.data.code ? normalizeCouponCode(parsed.data.code) : undefined,
        type: parsed.data.type,
        value: parsed.data.value === undefined ? undefined : String(Number(parsed.data.value) || 0),
        description: parsed.data.description,
        maxUses:
          parsed.data.max_uses === undefined
            ? undefined
            : parsed.data.max_uses === null
            ? null
            : Number(parsed.data.max_uses) > 0
            ? Number(parsed.data.max_uses)
            : null,
        isActive: parsed.data.is_active === false ? false : parsed.data.is_active === true ? true : undefined,
        expiresAt: parsed.data.expires_at === undefined ? undefined : parsed.data.expires_at ? new Date(parsed.data.expires_at) : null,
        minOrderSubtotal:
          parsed.data.min_order_subtotal === undefined
            ? undefined
            : parsed.data.min_order_subtotal === null
            ? null
            : String(Number(parsed.data.min_order_subtotal) || 0),
      },
    })
    await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'Coupon', entityId: updated.id, meta: req.body })
    res.json(toApiCoupon(updated))
  } catch {
    res.status(404).json({ error: 'not_found' })
  }
})

app.delete('/api/admin/coupons/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  try {
    await prisma.coupon.delete({ where: { id: req.params.id } })
    await writeAuditLog({ actorId: admin.id, action: 'delete', entityType: 'Coupon', entityId: req.params.id })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'not_found' })
  }
})

app.get('/api/admin/sales-targets', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const targets = await prisma.salesTarget.findMany({
    orderBy: parseOrderParam(req.query.order),
    take: parseLimit(req.query.limit, 200),
  })

  const sales = await prisma.order.groupBy({
    by: ['status'],
    where: { status: 'delivered' },
    _sum: { total: true },
  })
  const deliveredTotal = Number(sales.find((row) => row.status === 'delivered')?._sum?.total ?? 0)

  res.json(targets.map((t) => ({
    ...toApiSalesTarget(t),
    achieved_amount: deliveredTotal,
    progress:
      Number(t.goalAmount) > 0 ? Number(Math.min((deliveredTotal / Number(t.goalAmount)) * 100, 100).toFixed(2)) : 0,
  })))
})

app.post('/api/admin/sales-targets', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = salesTargetPayloadSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const created = await prisma.salesTarget.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      startAt: parsed.data.start_at ? new Date(parsed.data.start_at) : new Date(),
      endAt: parsed.data.end_at ? new Date(parsed.data.end_at) : new Date(),
      goalAmount: String(Number(parsed.data.goal_amount ?? 0) || 0),
      isActive: parsed.data.is_active === false ? false : true,
    },
  })

  await writeAuditLog({ actorId: admin.id, action: 'create', entityType: 'SalesTarget', entityId: created.id, meta: req.body })
  res.status(201).json(toApiSalesTarget(created))
})

app.patch('/api/admin/sales-targets/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = salesTargetPayloadSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  try {
    const updated = await prisma.salesTarget.update({
      where: { id: req.params.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        startAt: parsed.data.start_at === undefined ? undefined : parsed.data.start_at ? new Date(parsed.data.start_at) : undefined,
        endAt: parsed.data.end_at === undefined ? undefined : parsed.data.end_at ? new Date(parsed.data.end_at) : undefined,
        goalAmount: parsed.data.goal_amount === undefined ? undefined : String(Number(parsed.data.goal_amount || 0)),
        isActive: parsed.data.is_active === undefined ? undefined : parsed.data.is_active,
      },
    })
    await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'SalesTarget', entityId: updated.id, meta: req.body })
    res.json(toApiSalesTarget(updated))
  } catch {
    res.status(404).json({ error: 'not_found' })
  }
})

app.delete('/api/admin/sales-targets/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  try {
    await prisma.salesTarget.delete({ where: { id: req.params.id } })
    await writeAuditLog({ actorId: admin.id, action: 'delete', entityType: 'SalesTarget', entityId: req.params.id })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'not_found' })
  }
})

app.get('/api/admin/cash-closures', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const closures = await prisma.cashClosure.findMany({
    orderBy: parseOrderParam(req.query.order),
    take: parseLimit(req.query.limit, 200),
  })

  res.json(closures.map(toApiCashClosure))
})

function parseIsoDateOnly(value) {
  if (!value) return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return null
  return date
}

async function computeCashClosureTotalSales({ startedAt, endedAt }) {
  const start = startedAt ?? new Date()
  const end = endedAt ?? start
  const endExclusive = new Date(end)
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1)

  const agg = await prisma.order.aggregate({
    _sum: { total: true },
    where: {
      createdAt: { gte: start, lt: endExclusive },
      status: { in: ['delivered'] },
    },
  })

  const sum = agg?._sum?.total
  if (sum === null || sum === undefined) return 0
  return Number(sum)
}

app.get('/api/admin/cash-closures/summary', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const startedAt = parseIsoDateOnly(req.query.started_at)
  const endedAt = parseIsoDateOnly(req.query.ended_at)

  if (!startedAt || !endedAt) return res.status(400).json({ error: 'invalid_query' })
  if (endedAt < startedAt) return res.status(400).json({ error: 'invalid_range' })

  const totalSales = await computeCashClosureTotalSales({ startedAt: startedAt, endedAt: endedAt })
  res.json({ started_at: req.query.started_at, ended_at: req.query.ended_at, total_sales: totalSales })
})

app.post('/api/admin/cash-closures', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = cashClosurePayloadSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const startedAt = parsed.data.started_at ? parseIsoDateOnly(parsed.data.started_at) : new Date()
  const endedAt = parsed.data.ended_at ? parseIsoDateOnly(parsed.data.ended_at) : null
  if (!startedAt) return res.status(400).json({ error: 'invalid_body', issues: [{ path: ['started_at'], message: 'invalid_date' }] })
  if (endedAt && endedAt < startedAt) return res.status(400).json({ error: 'invalid_body', issues: [{ path: ['ended_at'], message: 'invalid_range' }] })

  const openingBalance = Number(parsed.data.opening_balance ?? 0) || 0
  const totalSales = endedAt ? await computeCashClosureTotalSales({ startedAt: startedAt, endedAt: endedAt }) : 0
  const closingBalance = openingBalance + totalSales

  const created = await prisma.cashClosure.create({
    data: {
      startedAt: startedAt,
      endedAt: endedAt,
      openingBalance: String(openingBalance),
      closingBalance: String(closingBalance),
      totalSales: endedAt ? String(totalSales) : null,
      notes: parsed.data.notes ?? null,
    },
  })

  await writeAuditLog({ actorId: admin.id, action: 'create', entityType: 'CashClosure', entityId: created.id, meta: req.body })
  res.status(201).json(toApiCashClosure(created))
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

  // System notifications surfaced via AuditLog (shown in the admin bell).
  // We generate them lazily here to avoid needing a scheduler.
  try {
    const now = new Date()

    const deliveredAgg = await prisma.order.aggregate({
      _sum: { total: true },
      where: { status: 'delivered' },
    })
    const deliveredTotal = Number(deliveredAgg?._sum?.total ?? 0) || 0

    const [targets, coupons] = await Promise.all([
      prisma.salesTarget.findMany({ where: { isActive: true } }),
      prisma.coupon.findMany({ where: { isActive: true, expiresAt: { not: null } } }),
    ])

    const notificationExists = async (notificationKey) => {
      if (!notificationKey) return false
      const existing = await prisma.auditLog.findFirst({
        where: { action: 'notify', meta: { path: ['notification_key'], equals: String(notificationKey) } },
        select: { id: true },
      })
      return Boolean(existing?.id)
    }

    const maybeNotify = async ({ notificationKey, entityType, entityId, meta }) => {
      if (!notificationKey) return
      if (await notificationExists(notificationKey)) return
      await writeAuditLog({
        actorId: null,
        action: 'notify',
        entityType,
        entityId: entityId ?? null,
        meta: { notification_key: notificationKey, ...(meta ?? {}) },
      })
    }

    for (const t of targets ?? []) {
      const goal = Number(t.goalAmount ?? 0) || 0
      const endAt = t.endAt ? new Date(t.endAt) : null

      if (endAt && endAt < now) {
        const key = `sales_target_expired:${t.id}:${endAt.toISOString().slice(0, 10)}`
        await maybeNotify({
          notificationKey: key,
          entityType: 'SalesTarget',
          entityId: t.id,
          meta: { kind: 'sales_target_expired', name: t.name, end_at: t.endAt },
        })
      }

      if (goal > 0 && deliveredTotal >= goal) {
        const key = `sales_target_achieved:${t.id}:${formatDecimal(goal)}:${formatDecimal(deliveredTotal)}`
        await maybeNotify({
          notificationKey: key,
          entityType: 'SalesTarget',
          entityId: t.id,
          meta: {
            kind: 'sales_target_achieved',
            name: t.name,
            goal_amount: goal,
            achieved_amount: deliveredTotal,
          },
        })
      }
    }

    const daysUntil = (date) => Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

    for (const c of coupons ?? []) {
      const expiresAt = c.expiresAt ? new Date(c.expiresAt) : null
      if (!expiresAt) continue

      if (expiresAt < now) {
        const key = `coupon_expired:${c.id}:${expiresAt.toISOString().slice(0, 10)}`
        await maybeNotify({
          notificationKey: key,
          entityType: 'Coupon',
          entityId: c.id,
          meta: { kind: 'coupon_expired', code: c.code, expires_at: c.expiresAt },
        })
        continue
      }

      const left = daysUntil(expiresAt)
      if (left <= 3) {
        const key = `coupon_expiring:${c.id}:${expiresAt.toISOString().slice(0, 10)}`
        await maybeNotify({
          notificationKey: key,
          entityType: 'Coupon',
          entityId: c.id,
          meta: { kind: 'coupon_expiring', code: c.code, expires_at: c.expiresAt, days_left: left },
        })
      }
    }
  } catch (err) {
    console.error('admin notifications generation failed', err)
  }

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

// Content (Branding)
app.get('/api/admin/content/branding', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const record = await prisma.siteContent.findUnique({ where: { key: 'branding' } })
  res.json({ content: record?.value ?? null, updated_date: record?.updatedAt ?? null })
})

app.patch('/api/admin/content/branding', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = aboutContentSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const value = parsed.data
  const record = await prisma.siteContent.upsert({
    where: { key: 'branding' },
    create: { key: 'branding', value },
    update: { value },
  })

  await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'SiteContent', entityId: 'branding', meta: { keys: Object.keys(value ?? {}) } })
  res.json({ content: record.value, updated_date: record.updatedAt })
})

app.get('/api/admin/content/loyalty', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const record = await prisma.siteContent.findUnique({ where: { key: 'loyalty' } })
  const content = await getLoyaltyContent()
  res.json({ content, updated_date: record?.updatedAt ?? null })
})

app.patch('/api/admin/content/loyalty', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = loyaltyContentSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const value = parsed.data
  const record = await prisma.siteContent.upsert({
    where: { key: 'loyalty' },
    create: { key: 'loyalty', value },
    update: { value },
  })

  loyaltyCache = { content: defaultLoyaltyContent, updatedAt: 0 }

  await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'SiteContent', entityId: 'loyalty', meta: { keys: Object.keys(value ?? {}) } })
  res.json({ content: await getLoyaltyContent(), updated_date: record.updatedAt })
})

app.get('/api/admin/content/appointments', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const record = await prisma.siteContent.findUnique({ where: { key: 'appointments' } })
  const enabled = Boolean(record?.value && typeof record.value === 'object' && record.value.enabled === true)
  res.json({ content: { enabled }, updated_date: record?.updatedAt ?? null })
})

app.patch('/api/admin/content/appointments', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = appointmentsContentSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const value = { enabled: Boolean(parsed.data.enabled) }
  const record = await prisma.siteContent.upsert({
    where: { key: 'appointments' },
    create: { key: 'appointments', value },
    update: { value },
  })

  await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'SiteContent', entityId: 'appointments', meta: { keys: Object.keys(value ?? {}) } })
  res.json({ content: value, updated_date: record.updatedAt })
})

// Marketing / Email templates
app.get('/api/admin/marketing/email', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const { content, updatedAt } = await getEmailContent()
  res.json({ content, updated_date: updatedAt, smtp_configured: isSmtpConfigured() })
})

app.patch('/api/admin/marketing/email', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = emailContentSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const value = parsed.data
  const record = await prisma.siteContent.upsert({
    where: { key: 'email' },
    create: { key: 'email', value },
    update: { value },
  })

  await writeAuditLog({
    actorId: admin.id,
    action: 'update',
    entityType: 'SiteContent',
    entityId: 'email',
    meta: { keys: Object.keys(value ?? {}) },
  })

  const { content } = await getEmailContent()
  res.json({ content, updated_date: record.updatedAt, smtp_configured: isSmtpConfigured() })
})

// Newsletter (admin)
app.get('/api/admin/newsletter/subscribers', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const status = String(req.query.status ?? 'subscribed')
  const limit = parseLimit(req.query.limit, 500)

  const conditions = []
  const values = []
  const add = (sql, value) => {
    values.push(value)
    conditions.push(sql.replace('?', `$${values.length}`))
  }

  if (status === 'subscribed') conditions.push(`s."status" = 'subscribed'`)
  if (status === 'unsubscribed') conditions.push(`s."status" = 'unsubscribed'`)
  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const sql = `
    SELECT s."id", s."userId", s."email", s."name", s."status", s."unsubscribeToken", s."subscribedAt", s."unsubscribedAt", s."createdAt", s."updatedAt"
    FROM "NewsletterSubscriber" s
    ${whereSql}
    ORDER BY s."createdAt" DESC
    LIMIT ${Number(limit)}
  `
  const rows = await prisma.$queryRawUnsafe(sql, ...values)
  res.json((Array.isArray(rows) ? rows : []).map(subscriberToApi))
})

app.post('/api/admin/newsletter/send', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  if (!isSmtpConfigured()) return res.status(400).json({ error: 'smtp_not_configured' })

  const parsed = newsletterCampaignSendSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const audience = parsed.data.audience ?? 'all'
  const subjectRaw = parsed.data.subject
  const contentRaw = parsed.data.content
  const testEmail = parsed.data.test_email ? normalizeEmail(parsed.data.test_email) : null

  const { content: emailContent } = await getEmailContent()
  if (emailContent?.campaign?.enabled === false) return res.status(400).json({ error: 'campaign_disabled' })

  const recipients = []

  if (testEmail) {
    recipients.push({ email: testEmail, name: testEmail, userId: null })
  } else {
    if (audience === 'subscribers' || audience === 'all') {
      const subs = await prisma.$queryRaw`
        SELECT "email","name","userId"
        FROM "NewsletterSubscriber"
        WHERE "status" = 'subscribed'
        ORDER BY "createdAt" DESC
        LIMIT 5000;
      `
      for (const s of Array.isArray(subs) ? subs : []) {
        recipients.push({ email: s.email, name: s.name ?? s.email, userId: s.userId ?? null })
      }
    }

    if (audience === 'customers' || audience === 'all') {
      const users = await prisma.user.findMany({
        where: { newsletterOptIn: true },
        take: 5000,
        orderBy: { createdAt: 'desc' },
      })
      for (const u of users) {
        recipients.push({ email: normalizeEmail(u.email), name: u.fullName ?? u.email, userId: u.id })
      }
    }
  }

  const byEmail = new Map()
  for (const r of recipients) {
    const e = normalizeEmail(r.email)
    if (!e) continue
    if (!byEmail.has(e)) byEmail.set(e, { ...r, email: e })
  }
  const uniqueRecipients = Array.from(byEmail.values())

  let sent = 0
  let failed = 0

  for (const r of uniqueRecipients) {
    try {
      const sub = await upsertNewsletterSubscriber({ email: r.email, name: r.name ?? null, userId: r.userId, status: 'subscribed' })
      const unsubscribeUrl = buildUnsubscribeUrl(sub?.unsubscribeToken ?? '')
      const vars = {
        name: r.name ?? r.email,
        email: r.email,
        app_url: appBaseUrl,
        unsubscribe_url: unsubscribeUrl,
        content: contentRaw,
      }
      const subject = renderTemplate(subjectRaw, vars)
      const html = renderTemplate(emailContent.campaign.html, vars)
      const text = renderTemplate(emailContent.campaign.text, vars)
      await sendTemplatedEmail({ to: r.email, subject, html, text, fromName: emailContent.from_name })
      sent += 1
    } catch (err) {
      failed += 1
      console.error('newsletter send failed', r.email, err)
    }
  }

  await writeAuditLog({
    actorId: admin.id,
    action: 'create',
    entityType: 'NewsletterCampaign',
    entityId: null,
    meta: { audience, total: uniqueRecipients.length, sent, failed, test_email: testEmail },
  })

  res.json({ ok: true, total: uniqueRecipients.length, sent, failed, test_email: testEmail })
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

// FAQ Questions (customer-submitted)
app.get('/api/admin/faq/questions', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const status = String(req.query.status ?? 'pending')
  const publicFilter = String(req.query.public ?? 'all')

  const conditions = []
  const values = []
  const add = (sql, value) => {
    values.push(value)
    conditions.push(sql.replace('?', `$${values.length}`))
  }

  if (status === 'pending') conditions.push(`q."answeredAt" IS NULL`)
  if (status === 'answered') conditions.push(`q."answeredAt" IS NOT NULL`)

  if (publicFilter === 'true') add(`q."isPublic" = ?`, true)
  if (publicFilter === 'false') add(`q."isPublic" = ?`, false)

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = parseLimit(req.query.limit, 500)
  const sql = `
    SELECT
      q."id", q."userId", q."authorName", q."authorEmail", q."question", q."answer", q."isPublic", q."faqItemId",
      q."answeredAt", q."createdAt", q."updatedAt",
      u."fullName" as "userFullName", u."email" as "userEmail"
    FROM "FaqQuestion" q
    LEFT JOIN "User" u ON u."id" = q."userId"
    ${whereSql}
    ORDER BY q."createdAt" DESC
    LIMIT ${Number(limit)}
  `

  const questions = await prisma.$queryRawUnsafe(sql, ...values)
  res.json((Array.isArray(questions) ? questions : []).map(toApiFaqQuestion))
})

app.patch('/api/admin/faq/questions/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const parsed = faqQuestionAdminPatchSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const patch = parsed.data ?? {}

  const id = String(req.params.id)
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existingRows = await tx.$queryRaw`
        SELECT "id","userId","authorName","authorEmail","question","answer","isPublic","faqItemId","answeredAt","createdAt","updatedAt"
        FROM "FaqQuestion"
        WHERE "id" = ${id}
        LIMIT 1;
      `
      const existing = Array.isArray(existingRows) ? existingRows[0] : null
      if (!existing) return null

      const nextAnswer = patch.answer === undefined ? existing.answer : patch.answer === null ? null : String(patch.answer)
      const nextQuestion = patch.question === undefined ? existing.question : String(patch.question)
      const willBeAnswered = typeof nextAnswer === 'string' && nextAnswer.trim().length > 0
      const nextAnsweredAt = patch.answer === undefined ? existing.answeredAt : willBeAnswered ? new Date() : null
      const nextIsPublic = patch.is_public === undefined ? existing.isPublic : Boolean(patch.is_public)

      const updatedRows = await tx.$queryRaw`
        UPDATE "FaqQuestion"
        SET
          "question" = ${nextQuestion},
          "answer" = ${nextAnswer},
          "answeredAt" = ${nextAnsweredAt},
          "isPublic" = ${nextIsPublic},
          "updatedAt" = NOW()
        WHERE "id" = ${id}
        RETURNING "id","userId","authorName","authorEmail","question","answer","isPublic","faqItemId","answeredAt","createdAt","updatedAt";
      `
      const q = Array.isArray(updatedRows) ? updatedRows[0] : null
      if (!q) return null

      const linkedItemId = existing.faqItemId ? String(existing.faqItemId) : null

      if (nextIsPublic && willBeAnswered) {
        if (linkedItemId) {
          await tx.$executeRaw`
            UPDATE "FaqItem"
            SET "question" = ${nextQuestion}, "answer" = ${String(nextAnswer)}, "isActive" = ${true}, "updatedAt" = NOW()
            WHERE "id" = ${linkedItemId};
          `
          q.faqItemId = linkedItemId
        } else {
          const maxRows = await tx.$queryRaw`SELECT COALESCE(MAX("order"), 0) AS "maxOrder" FROM "FaqItem";`
          const maxOrder = Number(Array.isArray(maxRows) ? maxRows[0]?.maxOrder ?? 0 : 0)
          const order = maxOrder + 1
          const newItemId = crypto.randomUUID()
          await tx.$executeRaw`
            INSERT INTO "FaqItem" ("id","question","answer","order","isActive","createdAt","updatedAt")
            VALUES (${newItemId}, ${nextQuestion}, ${String(nextAnswer)}, ${order}, ${true}, NOW(), NOW());
          `
          await tx.$executeRaw`UPDATE "FaqQuestion" SET "faqItemId" = ${newItemId}, "updatedAt" = NOW() WHERE "id" = ${id};`
          q.faqItemId = newItemId
        }
      } else if (linkedItemId) {
        await tx.$executeRaw`UPDATE "FaqItem" SET "isActive" = ${false}, "updatedAt" = NOW() WHERE "id" = ${linkedItemId};`
      }

      return q
    })

    if (!updated) return res.status(404).json({ error: 'not_found' })

    await writeAuditLog({ actorId: admin.id, action: 'update', entityType: 'FaqQuestion', entityId: updated.id, meta: { patch: req.body ?? {} } })

    const rows = await prisma.$queryRaw`
      SELECT
        q."id", q."userId", q."authorName", q."authorEmail", q."question", q."answer", q."isPublic", q."faqItemId",
        q."answeredAt", q."createdAt", q."updatedAt",
        u."fullName" as "userFullName", u."email" as "userEmail"
      FROM "FaqQuestion" q
      LEFT JOIN "User" u ON u."id" = q."userId"
      WHERE q."id" = ${String(updated.id)}
      LIMIT 1;
    `
    const withUser = Array.isArray(rows) ? rows[0] : null
    res.json(toApiFaqQuestion(withUser ?? updated))
  } catch (err) {
    console.error('faq question update failed', err)
    res.status(500).json({ error: 'internal_error' })
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
    include: { product: { select: { name: true, images: true } } },
  })

  res.json(reviews.map(toApiReview))
})

app.patch('/api/admin/reviews/:id', async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const isApproved = req.body?.is_approved
  if (typeof isApproved !== 'boolean') return res.status(400).json({ error: 'invalid_body' })

  try {
    const existing = await prisma.review.findUnique({
      where: { id: req.params.id },
      select: { id: true, isApproved: true, userId: true, pointsAwarded: true, comment: true, images: true, videos: true },
    })
    if (!existing) return res.status(404).json({ error: 'not_found' })

    const shouldAward = isApproved === true && existing.isApproved === false && existing.userId && (existing.pointsAwarded ?? 0) === 0
    const rewardPoints = shouldAward ? await computeReviewRewardPoints(existing) : 0

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.review.update({
        where: { id: req.params.id },
        data: {
          isApproved,
          pointsAwarded: shouldAward && rewardPoints > 0 ? rewardPoints : undefined,
        },
        include: { product: { select: { name: true, images: true } } },
      })

      if (shouldAward && rewardPoints > 0) {
        await tx.user.update({
          where: { id: existing.userId },
          data: { pointsBalance: { increment: rewardPoints } },
        })
      }

      return next
    })

    await writeAuditLog({
      actorId: admin.id,
      action: 'update',
      entityType: 'Review',
      entityId: updated.id,
      meta: { is_approved: isApproved, points_awarded: shouldAward ? rewardPoints : 0 },
    })
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

  // Appointment reminders (email + notification) without external scheduler.
  let reminderRunning = false
  const sweepMs = Math.max(60_000, Math.min(Number.parseInt(process.env.APPOINTMENT_REMINDER_SWEEP_MS ?? '300000', 10) || 300000, 60 * 60 * 1000))
  const runReminderSweep = async () => {
    if (reminderRunning) return
    reminderRunning = true
    try {
      const now = new Date()
      const windowHours = Math.max(1, Math.min(Number.parseInt(process.env.APPOINTMENT_REMINDER_HOURS ?? '24', 10) || 24, 24 * 14))
      const to = new Date(now.getTime() + windowHours * 60 * 60 * 1000)

      const appts = await prisma.appointment.findMany({
        where: {
          reminderSentAt: null,
          status: { in: ['pending', 'confirmed'] },
          startAt: { gte: now, lte: to },
        },
        include: { user: true, service: true, staff: true },
        orderBy: { startAt: 'asc' },
        take: 100,
      })

      const byUser = new Map()
      for (const a of appts) {
        if (!a?.user) continue
        const key = a.userId
        if (!byUser.has(key)) byUser.set(key, { user: a.user, appointments: [] })
        byUser.get(key).appointments.push(a)
      }

      for (const entry of byUser.values()) {
        await maybeSendAppointmentRemindersForUser(entry.user, entry.appointments)
      }
    } catch (err) {
      console.error('appointment reminder sweep failed', err)
    } finally {
      reminderRunning = false
    }
  }

  runReminderSweep().catch(() => {})
  const reminderInterval = setInterval(() => {
    runReminderSweep().catch(() => {})
  }, sweepMs)
  reminderInterval.unref?.()
 
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
