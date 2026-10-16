import { defineStore } from 'pinia'

import type { IMfaChallenge, IUserProfile } from '@/services/types/user.type'

import { hasPermission } from '@/lib/permissions'
import { fetchMe } from '@/services/api/me.api'

/** Sign-in that passed the password step and waits for a two-factor code (`/auth/otp`). */
export interface IPendingMfa {
  challengeToken: string
  email: string
  /** Epoch ms after which the server has forgotten the challenge. */
  expiresAt: number
}

/**
 * The admin session itself lives in HttpOnly cookies; this store only mirrors the signed-in admin.
 * It is not persisted: `restore()` asks the server (`GET /admin/me`) once per page load. A pending
 * two-factor challenge is kept in memory only, so reloading the code page starts the sign-in over.
 */
export const useAuthStore = defineStore('user', () => {
  const user = shallowRef<IUserProfile | null>(null)
  /** True once the session has been restored (or a login/logout happened). */
  const initialized = shallowRef(false)
  const isLogin = computed(() => user.value !== null)
  const pendingMfa = shallowRef<IPendingMfa | null>(null)

  function setUser(profile: IUserProfile) {
    user.value = profile
    pendingMfa.value = null
    initialized.value = true
  }

  function clear() {
    user.value = null
    pendingMfa.value = null
    initialized.value = true
  }

  function setPendingMfa(challenge: IMfaChallenge, email: string, now = Date.now()) {
    pendingMfa.value = {
      challengeToken: challenge.challengeToken,
      email,
      expiresAt: now + challenge.expiresIn * 1000,
    }
  }

  /** The pending challenge, or null when there is none or it has expired. */
  function activeMfa(now = Date.now()): IPendingMfa | null {
    const pending = pendingMfa.value
    return pending && pending.expiresAt > now ? pending : null
  }

  function clearPendingMfa() {
    pendingMfa.value = null
  }

  function can(permission: string) {
    return hasPermission(user.value?.permissions ?? [], permission)
  }

  let restoring: Promise<void> | null = null

  /** Loads the profile for an existing cookie session; concurrent callers share one request. */
  function restore(): Promise<void> {
    restoring ??= fetchMe()
      .then(setUser, clear)
      .finally(() => {
        restoring = null
      })
    return restoring
  }

  return {
    user,
    initialized,
    isLogin,
    pendingMfa,
    setUser,
    clear,
    setPendingMfa,
    activeMfa,
    clearPendingMfa,
    can,
    restore,
  }
})
