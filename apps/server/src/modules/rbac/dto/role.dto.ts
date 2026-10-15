import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PERMISSIONS, type Permission } from '../permissions.js';

const PERMISSION_CODES = Object.keys(PERMISSIONS);

export class CreateRoleDto {
  /** Stable identifier, lower snake case. */
  @Matches(/^[a-z][a-z0-9_]{1,63}$/, {
    message: 'code must be lower snake case (2-64 chars)',
  })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayUnique()
  @IsIn(PERMISSION_CODES, { each: true })
  permissions!: Permission[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PERMISSION_CODES, { each: true })
  permissions?: Permission[];
}
