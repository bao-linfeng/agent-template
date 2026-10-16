import { getErrorCode } from '@repo/utils'
import { useQueryClient } from '@tanstack/vue-query'

import type { ILoginBody } from '@/services/api/auth.api'

import { HOME_PATH, LOGIN_PATH, MFA_PATH } from '@/constants/app'
import * as authApi from '@/services/api/auth.api'
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

  /**
   * Throws the API error so the form can show it. Admins with two-factor authentication continue on the
   * code page (keeping `?redirect=`).
   */
  function login(body: ILoginBody) {
    return run(async () => {
      const result = await authApi.login(body)
      if (authApi.isMfaChallenge(result)) {
        authStore.setPendingMfa(result, body.email)
        await router.push({ path: MFA_PATH, query: router.currentRoute.value.query })
        return
      }
      authStore.setUser(result)
      await toRedirect()
    })
  }

  /**
   * Second step with an authenticator or recovery code. Throws the API error; when the challenge is gone
   * (expired or too many wrong codes) the pending state is dropped, so the page offers to sign in again.
   */
  function verifyMfa(code: string) {
    return run(async () => {
      const pending = authStore.activeMfa()
      if (!pending) {
        authStore.clearPendingMfa()
        return
      }
      try {
        authStore.setUser(await authApi.loginMfa({ challengeToken: pending.challengeToken, code }))
      }
      catch (error) {
        if (getErrorCode(error) === 'AUTH_MFA_CHALLENGE_INVALID')
          authStore.clearPendingMfa()
        throw error
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
    verifyMfa,
    logout,
  }
}
