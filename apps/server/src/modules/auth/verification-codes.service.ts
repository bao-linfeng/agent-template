import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomInt } from 'node:crypto'
import type { Redis } from 'ioredis'
import { sha256 } from '../../common/crypto/crypto.js'
import type { Env } from '../../config/env.js'
import { InjectRedis } from '../../infra/redis/redis.module.js'
import { normalizeEmail } from '../accounts/accounts.service.js'
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

/** Wrong guesses allowed per code before it is discarded (keeps 6 digits unguessable). */
export const VERIFICATION_CODE_MAX_ATTEMPTS = 5
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
 * are rate limited per email and a code dies after `VERIFICATION_CODE_MAX_ATTEMPTS` wrong guesses.
 */
@Injectable()
export class VerificationCodesService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Creates a new code (replacing the previous one); 429 while the resend cooldown runs. */
  async issue(
    realm: Realm,
    purpose: VerificationPurpose,
    email: string,
  ): Promise<IssuedCode> {
    const key = this.key(realm, purpose, email)
    const expiresIn = this.config.get('EMAIL_CODE_TTL_SECONDS', {
      infer: true,
    })
    const resendAfter = this.config.get('EMAIL_CODE_RESEND_SECONDS', {
      infer: true,
    })
    const cooldown = await this.redis.set(
      `${key}:cooldown`,
      '1',
      'EX',
      resendAfter,
      'NX',
    )
    if (cooldown !== 'OK') {
      throw new HttpException(
        'A code was sent recently, please wait before requesting another one',
        HttpStatus.TOO_MANY_REQUESTS,
      )
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
      VERIFICATION_CODE_MAX_ATTEMPTS,
    )
    if (matched !== 1) {
      throw new BadRequestException(
        'Verification code is invalid or has expired',
      )
    }
  }

  private key(realm: Realm, purpose: VerificationPurpose, email: string) {
    return `auth:email-code:${realm}:${purpose}:${sha256(normalizeEmail(email))}`
  }

  private hash(email: string, code: string) {
    return sha256(`${normalizeEmail(email)}:${code}`)
  }
}
