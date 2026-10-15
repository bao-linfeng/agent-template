import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import type { Env } from '../../config/env.js'
import { AuthCookies } from './auth-cookies.service.js'
import { PasswordHasher } from './password-hasher.service.js'
import { SessionsService } from './sessions.service.js'

/** Token, session and password primitives shared by the auth and users modules. */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  providers: [SessionsService, PasswordHasher, AuthCookies],
  exports: [JwtModule, SessionsService, PasswordHasher, AuthCookies],
})
export class SecurityModule {}
