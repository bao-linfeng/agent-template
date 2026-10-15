import { ArrayUnique, IsArray, IsOptional, IsUUID } from 'class-validator'
import { CreateAccountDto } from '../../accounts/dto/account.dto.js'

export class CreateAdminDto extends CreateAccountDto {
  /** Initial roles; defaults to none (the account can sign in but sees nothing). */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  roleIds?: string[]
}

export class SetAdminRolesDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  roleIds!: string[]
}
