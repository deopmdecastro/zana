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
app.use(express.json({ limit: '1mb' }))

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

const updateMeSchema = z
  .object({
    full_name: z.string().min(1).max(200).nullable().optional(),
    phone: z.string().min(3).max(30).nullable().optional(),
    address_line1: z.string().min(1).max(200).nullable().optional(),
    address_line2: z.string().min(1).max(200).nullable().optional(),
    city: z.string().min(1).max(120).nullable().optional(),
    postal_code: z.string().min(1).max(30).nullable().optional(),
    country: z.string().min(1).max(80).nullable().optional(),
    newsletter_opt_in: z.boolean().optional(),
    order_updates_email: z.boolean().optional(),
  })
  .strict()

const passwordResetRequestSchema = z.object({
  email: z.string().email().max(320),
})

const passwordResetConfirmSchema = z.object({
  token: z.string().min(10).max(4000),
  new_password: z.string().min(6).max(200),
})

function pickPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
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

  const orders = await prisma.order.findMany({
    where: { customerEmail: user.email },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  })

  res.json({
    orders: orders.map((o) => ({
      id: o.id,
      created_at: o.createdAt,
      total: o.total?.toString?.() ?? String(o.total),
      status: o.status,
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

const productInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.union([z.number(), z.string()]),
  originalPrice: z.union([z.number(), z.string()]).optional(),
  category: z.enum(['colares', 'brincos', 'pulseiras', 'aneis', 'conjuntos']),
  material: z
    .enum(['aco_inox', 'prata', 'dourado', 'rose_gold', 'perolas', 'cristais'])
    .optional(),
  colors: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  stock: z.number().int().nonnegative().optional(),
  isFeatured: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isBestseller: z.boolean().optional(),
  status: z.enum(['active', 'inactive', 'out_of_stock']).optional(),
})

app.get('/api/products', async (req, res) => {
  const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } })
  res.json(products)
})

app.get('/api/products/:id', async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } })
  if (!product) return res.status(404).json({ error: 'not_found' })
  res.json(product)
})

app.post('/api/products', async (req, res) => {
  const parsed = productInputSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  const created = await prisma.product.create({
    data: {
      ...parsed.data,
      price: String(parsed.data.price),
      originalPrice: parsed.data.originalPrice === undefined ? undefined : String(parsed.data.originalPrice),
      colors: parsed.data.colors ?? [],
      images: parsed.data.images ?? [],
    },
  })
  res.status(201).json(created)
})

app.patch('/api/products/:id', async (req, res) => {
  const parsed = productInputSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })

  try {
    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...parsed.data,
        price: parsed.data.price === undefined ? undefined : String(parsed.data.price),
        originalPrice:
          parsed.data.originalPrice === undefined ? undefined : String(parsed.data.originalPrice),
      },
    })
    res.json(updated)
  } catch (e) {
    return res.status(404).json({ error: 'not_found' })
  }
})

app.delete('/api/products/:id', async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch (e) {
    res.status(404).json({ error: 'not_found' })
  }
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'internal_error' })
})

await ensureSchema()

app.listen(port, () => {
  console.log(`backend listening on http://localhost:${port}`)
})
