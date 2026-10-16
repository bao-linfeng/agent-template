import { IsObject } from 'class-validator'

export class UpdateSettingsDto {
  /**
   * Setting key → new value (see `GET /v1/admin/settings` for keys and schemas); `null` restores the
   * default. Applied atomically: one unknown key or invalid value rejects the whole change.
   */
  @IsObject()
  values!: Record<string, unknown>
}
