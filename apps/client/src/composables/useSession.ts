import type { Credentials, Registration, UserProfile } from '@/lib/account'
import { computed, readonly, shallowRef } from 'vue'
import { accountApi } from '@/lib/account'
import { onSessionExpired } from '@/lib/api'

/**
 * App-wide session state (module level, like `useCollecty`). The session itself is kept in HttpOnly
 * cookies; this only mirrors the signed-in profile and is restored from `GET /users/me` on load.
 */
const user = shallowRef<UserProfile | null>(null)
const initialized = shallowRef(false)
let restoring: Promise<void> | null = null

function setUser(profile: UserProfile | null) {
  user.value = profile
  initialized.value = true
}

onSessionExpired(() => setUser(null))

export function useSession() {
  const isLoggedIn = computed(() => user.value !== null)

  /** Loads the profile for an existing cookie session once; concurrent callers share the request. */
  function restore(): Promise<void> {
    restoring ??= accountApi.me()
      .then(setUser, () => setUser(null))
      .finally(() => {
        restoring = null
      })
    return restoring
  }

  async function login(credentials: Credentials) {
    setUser(await accountApi.login(credentials))
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
      return error instanceof Error ? error.message : 'The avatar could not be saved.'
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
    user: readonly(user),
    initialized: readonly(initialized),
    isLoggedIn,
    restore,
    login,
    register,
    logout,
    updateProfile,
    uploadAvatar,
    removeAvatar,
    clear,
  }
}
