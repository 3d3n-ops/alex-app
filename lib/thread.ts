import crypto from 'node:crypto'

const ALGO = 'sha256'

export function signThreadId(threadId: string, secret = process.env.THREAD_SECRET || ''): string {
  const h = crypto.createHmac(ALGO, Buffer.from(secret, 'utf8'))
  h.update(threadId, 'utf8')
  return h.digest('hex')
}

export function verifyThreadSignature(threadId: string, signature: string, secret = process.env.THREAD_SECRET || ''): boolean {
  if (!secret) return false
  const expected = signThreadId(threadId, secret)
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
}

export function newThreadId(): string {
  return crypto.randomUUID()
}

