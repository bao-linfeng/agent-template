import { useQueryClient } from '@tanstack/vue-query'

import type { ILoginBody } from '@/services/api/auth.api'

import { HOME_PATH, LOGIN_PATH } from '@/constants/app'
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

  /** Throws the API error so the form can show it. */
  function login(body: ILoginBody) {
    return run(async () => {
      authStore.setUser(await authApi.login(body))
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
    logout,
  }
}
