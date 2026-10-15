import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  /** 8-72 characters (bcrypt limit). */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  nickname!: string;
}

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  /**
   * Page that renders the reset form, e.g. `http://localhost:5173/auth/reset-password`; `?token=` is appended.
   * Its origin must be `APP_WEB_URL` or one of `CORS_ORIGINS`. Defaults to `APP_WEB_URL/reset-password`.
   */
  @IsOptional()
  @IsUrl({
    require_tld: false,
    require_protocol: true,
    protocols: ['http', 'https'],
  })
  @MaxLength(500)
  resetUrl?: string;
}

export class ResetPasswordDto {
  /** Token from the reset link (`?token=`). */
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
