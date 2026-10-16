import { IsString, MaxLength, MinLength } from 'class-validator'

/** 6-digit code from the authenticator app, or a recovery code (`xxxxx-xxxxx`) where accepted. */
class MfaCodeField {
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  code!: string
}

export class StartTotpSetupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string
}

/** The first code shown by the app for the pending secret (recovery codes do not exist yet). */
export class EnableTotpDto extends MfaCodeField {}

/** Password plus a current authenticator code or an unused recovery code. */
export class ConfirmMfaDto extends MfaCodeField {
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string
}

/** Second sign-in step of admins with two-factor authentication. */
export class MfaLoginDto extends MfaCodeField {
  /** `challengeToken` from `POST /v1/admin/auth/login`. */
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  challengeToken!: string
}
