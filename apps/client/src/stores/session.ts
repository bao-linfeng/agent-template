import type { Credentials, Registration, UserProfile } from '@/lib/account'
import { isUnauthorized } from '@repo/utils'
import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import { t } from '@/i18n'
import { accountApi } from '@/lib/account'
import { errorMessage, onSessionExpired } from '@/lib/api'
import { queryClient } from '@/lib/query-client'

/**
 * The session itself lives in HttpOnly cookies; this store only mirrors the signed-in profile.
 * It is not persisted: `restore()` asks the server (`GET /users/me`) once per page load.
 */
export const useSessionStore = defineStore('session', () => {
  const user = shallowRef<UserProfile | null>(null)
  /** True once the session has been restored (or a login/logout happened). */
  const initialized = shallowRef(false)
  const isLoggedIn = computed(() => user.value !== null)

  function setUser(profile: UserProfile | null) {
    // Cached server data belongs to the user who just left.
    if (user.value && user.value.id !== profile?.id)
      queryClient.removeQueries()
    user.value = profile
    initialized.value = true
  }

  onSessionExpired(() => setUser(null))

  let restoring: Promise<void> | null = null

  /**
   * Loads the profile for an existing cookie session once; concurrent callers share the request. Only
   * a 401 means signed out: when the server cannot be reached or fails, the session stays unknown
   * (`initialized` false) and the next navigation asks again instead of forgetting a valid session.
   */
  function restore(): Promise<void> {
    restoring ??= accountApi.me()
      .then(setUser, (error: unknown) => {
        if (isUnauthorized(error))
          setUser(null)
      })
      .finally(() => {
        restoring = null
      })
    return restoring
  }

  async function login(credentials: Credentials) {
    setUser(await accountApi.login(credentials))
  }

  /** Cancels a pending deletion of the account and signs in. */
  async function restoreAccount(credentials: Credentials) {
    setUser(await accountApi.restoreAccount(credentials))
  }

  /** The server signs every session out, so the local profile goes too. Returns the purge date. */
  async function requestDeletion(password: string): Promise<string> {
    const { deletionScheduledAt } = await accountApi.requestDeletion(password)
    setUser(null)
    return deletionScheduledAt
  }

  /**
   * Registration signs the user in; the optional avatar is uploaded with the new session.
   * Returns an error message when only the avatar failed.
   */
  async function register(registration: Registration, avatar?: File | null): Promise<string | undefined> {
    setUser(await accountApi.register(registration))
    if (!avatar)
      return undefined
    try {
      setUser(await accountApi.uploadAvatar(avatar, avatar.name))
    }
    catch (error) {
      return errorMessage(error, t('account.avatar.saveFailed'))
    }
  }

  async function logout() {
    try {
      await accountApi.logout()
    }
    finally {
      setUser(null)
    }
  }

  async function updateProfile(changes: { nickname?: string }) {
    setUser(await accountApi.updateProfile(changes))
  }

  async function uploadAvatar(file: File) {
    setUser(await accountApi.uploadAvatar(file, file.name))
  }

  async function removeAvatar() {
    setUser(await accountApi.removeAvatar())
  }

  /** Forgets the local profile, e.g. after a password reset signed every session out. */
  function clear() {
    setUser(null)
  }

  return {
    user,
    initialized,
    isLoggedIn,
    restore,
    login,
    restoreAccount,
    requestDeletion,
    register,
    logout,
    updateProfile,
    uploadAvatar,
    removeAvatar,
    clear,
  }
})
