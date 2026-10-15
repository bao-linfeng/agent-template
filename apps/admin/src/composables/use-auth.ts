import { useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'

import type { ILoginBody, IRegisterBody } from '@/services/api/auth.api'

import { HOME_PATH, LOGIN_PATH } from '@/constants/app'
import { getErrorMessage } from '@/lib/api-client'
import * as authApi from '@/services/api/auth.api'
import { uploadAvatar } from '@/services/api/me.api'
import { useAuthStore } from '@/stores/auth'

/** Only same-app paths are accepted as `?redirect=` targets (no `//evil.com` or `/\evil.com`). */
export function safeRedirect(redirect: unknown): string {
  return typeof redirect === 'string' && /^\/(?![/\\])/.test(redirect) ? redirect : HOME_PATH
}

export function useAuth() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const loading = shallowRef(false)

  async function run(action: () => Promise<void>) {
    loading.value = true
    try {
      await action()
    }
    finally {
      loading.value = false
    }
  }

  function toRedirect() {
    return router.push(safeRedirect(router.currentRoute.value.query.redirect))
  }

  /** Throws the API error so the form can show it. */
  function login(body: ILoginBody) {
    return run(async () => {
      authStore.setUser(await authApi.login(body))
      await toRedirect()
    })
  }

  /** Registration signs the user in directly; the optional avatar is uploaded with the new session. */
  function register(body: IRegisterBody, avatar?: File | null) {
    return run(async () => {
      authStore.setUser(await authApi.register(body))
      if (avatar) {
        try {
          authStore.setUser(await uploadAvatar(avatar, avatar.name))
        }
        catch (error) {
          toast.warning('Account created, but the avatar was not saved.', { description: getErrorMessage(error) })
        }
      }
      await toRedirect()
    })
  }

  async function logout() {
    try {
      await authApi.logout()
    }
    finally {
      authStore.clear()
      queryClient.clear()
      await router.push({ path: LOGIN_PATH })
    }
  }

  return {
    loading,
    login,
    register,
    logout,
  }
}
