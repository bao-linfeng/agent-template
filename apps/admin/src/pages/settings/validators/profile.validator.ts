import { z } from 'zod'

import { nicknameField } from '@/pages/auth/validators/auth.validator'

export const profileValidator = z.object({
  nickname: nicknameField,
})

export type ProfileValidator = z.infer<typeof profileValidator>
