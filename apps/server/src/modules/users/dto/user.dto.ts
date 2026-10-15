import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
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

export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(userStatus.enumValues)
  status?: UserStatus;
}

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  nickname?: string;

  /** Disabling a user signs them out everywhere. */
  @IsOptional()
  @IsIn(userStatus.enumValues)
  status?: UserStatus;
}

export class SetUserRolesDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  roleIds!: string[];
}
