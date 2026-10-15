import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcryptjs';
import type { Env } from '../../config/env.js';

/** bcrypt hashing. Passwords are limited to 72 bytes by bcrypt; DTOs cap them at 72 characters. */
@Injectable()
export class PasswordHasher {
  private readonly rounds: number;
  private dummyHash?: Promise<string>;

  constructor(config: ConfigService<Env, true>) {
    this.rounds = config.get('PASSWORD_HASH_ROUNDS', { infer: true });
  }

  hash(password: string): Promise<string> {
    return hash(password, this.rounds);
  }

  verify(password: string, passwordHash: string): Promise<boolean> {
    return compare(password, passwordHash);
  }

  /** Spends the same time as a real check when the account does not exist (avoids user enumeration). */
  async verifyAgainstDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash('dummy-password-for-timing');
    await compare(password, await this.dummyHash);
    return false;
  }
}
