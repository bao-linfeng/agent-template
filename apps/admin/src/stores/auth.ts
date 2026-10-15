import { defineStore } from 'pinia'

import type { IUserProfile } from '@/services/types/user.type'

import { hasPermission } from '@/lib/permissions'
import { fetchMe } from '@/services/api/me.api'

/**
 * The admin session itself lives in HttpOnly cookies; this store only mirrors the signed-in admin.
 * It is not persisted: `restore()` asks the server (`GET /admin/me`) once per page load.
 */
export const useAuthStore = defineStore('user', () => {
  const user = shallowRef<IUserProfile | null>(null)
  /** True once the session has been restored (or a login/logout happened). */
  const initialized = shallowRef(false)
  const isLogin = computed(() => user.value !== null)

  function setUser(profile: IUserProfile) {
    user.value = profile
    initialized.value = true
  }

  function clear() {
    user.value = null
    initialized.value = true
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
    setUser,
    clear,
    can,
    restore,
  }
})
