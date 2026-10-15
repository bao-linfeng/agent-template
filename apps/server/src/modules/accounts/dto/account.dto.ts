import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { userStatus, type UserStatus } from '../../../database/schema/index.js';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  nickname?: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}

export class ListAccountsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(userStatus.enumValues)
  status?: UserStatus;
}

/** Fields an administrator may change on an account of either realm. */
export class AdminUpdateAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  nickname?: string;

  /** Disabling an account signs it out everywhere. */
  @IsOptional()
  @IsIn(userStatus.enumValues)
  status?: UserStatus;
}

export class CreateAccountDto {
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
