import { Injectable } from '@nestjs/common'
import { randomInt } from 'node:crypto'
import type { Redis } from 'ioredis'
import { sha256 } from '../../common/crypto/crypto.js'
import { AppException } from '../../common/errors/app.exception.js'
import { InjectRedis } from '../../infra/redis/redis.module.js'
import { normalizeEmail } from '../accounts/accounts.service.js'
import { SettingsService } from '../settings/settings.service.js'
import type { Realm } from './realms.js'

/** What a code proves; a code issued for one purpose is never accepted for another. */
export type VerificationPurpose = 'register'

export interface IssuedCode {
  /** Plain code to email; only its hash is stored. */
  code: string
  /** Seconds until the code expires. */
  expiresIn: number
  /** Seconds until another code may be requested for the same email. */
  resendAfter: number
}

const CODE_LENGTH = 6

// KEYS[1] = code hash; ARGV = candidate hash, max attempts. Returns 1 when the code matched (and is consumed).
const CONSUME_SCRIPT = `
local stored = redis.call('HGET', KEYS[1], 'hash')
if not stored then
  return 0
end
if stored == ARGV[1] then
  redis.call('DEL', KEYS[1])
  return 1
end
if redis.call('HINCRBY', KEYS[1], 'attempts', 1) >= tonumber(ARGV[2]) then
  redis.call('DEL', KEYS[1])
end
return 0
`

/**
 * Short numeric codes sent by email to prove ownership of an address. Codes live in Redis only
 * (hashed, with a TTL); one code per realm/purpose/email is valid at a time, requests for a new one
 * are rate limited per email and a code dies after `auth.emailCodeMaxAttempts` wrong guesses. Lifetime
 * and resend interval are the runtime settings `auth.emailCodeTtlSeconds` / `auth.emailCodeResendSeconds`.
 */
@Injectable()
export class VerificationCodesService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly settings: SettingsService,
  ) {}

  /** Creates a new code (replacing the previous one); 429 while the resend cooldown runs. */
  async issue(
    realm: Realm,
    purpose: VerificationPurpose,
    email: string,
  ): Promise<IssuedCode> {
    const key = this.key(realm, purpose, email)
    const expiresIn = this.settings.get('auth.emailCodeTtlSeconds')
    const resendAfter = this.settings.get('auth.emailCodeResendSeconds')
    const cooldown = await this.redis.set(
      `${key}:cooldown`,
      '1',
      'EX',
      resendAfter,
      'NX',
    )
    if (cooldown !== 'OK') {
      const retryAfter = await this.redis.ttl(`${key}:cooldown`)
      throw new AppException('AUTH_CODE_RESEND_TOO_SOON', {
        params: { retryAfter: Math.max(retryAfter, 1) },
      })
    }
    const code = randomInt(0, 10 ** CODE_LENGTH)
      .toString()
      .padStart(CODE_LENGTH, '0')
    await this.redis
      .multi()
      .del(key)
      .hset(key, { hash: this.hash(email, code), attempts: 0 })
      .expire(key, expiresIn)
      .exec()
    return { code, expiresIn, resendAfter }
  }

  /** Consumes a matching code; 400 when it is wrong, expired, used or out of attempts. */
  async consume(
    realm: Realm,
    purpose: VerificationPurpose,
    email: string,
    code: string,
  ): Promise<void> {
    const matched = await this.redis.eval(
      CONSUME_SCRIPT,
      1,
      this.key(realm, purpose, email),
      this.hash(email, code),
      this.settings.get('auth.emailCodeMaxAttempts'),
    )
    if (matched !== 1) {
      throw new AppException('AUTH_CODE_INVALID')
    }
  }

  private key(realm: Realm, purpose: VerificationPurpose, email: string) {
    return `auth:email-code:${realm}:${purpose}:${sha256(normalizeEmail(email))}`
  }

  private hash(email: string, code: string) {
    return sha256(`${normalizeEmail(email)}:${code}`)
  }
}
