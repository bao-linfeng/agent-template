<script setup lang="ts">
import { LogOut } from '@lucide/vue'
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import { reactive, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import AvatarPicker from '@/components/account/AvatarPicker.vue'
import TextField from '@/components/account/TextField.vue'
import { MainNavigation } from '@/components/sections/navbar'
import { takeFlash } from '@/composables/useFlash'
import { useSession } from '@/composables/useSession'
import { accountApi } from '@/lib/account'
import { errorMessage } from '@/lib/api'
import { checkConfirmation, checkNewPassword, checkNickname, collectErrors } from '@/lib/validation'

interface Status {
  type: 'success' | 'error' | 'warning'
  text: string
}

const router = useRouter()
const session = useSession()
const { user } = session

const notice = shallowRef<Status | null>(takeFlash())

// Profile
const nickname = shallowRef(user.value?.nickname ?? '')
const nicknameError = shallowRef<string>()
const profileStatus = shallowRef<Status | null>(null)
const savingProfile = shallowRef(false)
const avatarBusy = shallowRef(false)

watch(() => user.value?.nickname, (value) => {
  nickname.value = value ?? ''
})

async function run(status: typeof profileStatus, busy: typeof savingProfile, action: () => Promise<void>, success: string) {
  busy.value = true
  status.value = null
  try {
    await action()
    status.value = { type: 'success', text: success }
  }
  catch (error) {
    status.value = { type: 'error', text: errorMessage(error) }
  }
  finally {
    busy.value = false
  }
}

function saveProfile() {
  nicknameError.value = checkNickname(nickname.value)
  if (nicknameError.value)
    return
  run(profileStatus, savingProfile, () => session.updateProfile({ nickname: nickname.value.trim() }), 'Profile updated.')
}

function onAvatarSelect(file: File) {
  run(profileStatus, avatarBusy, () => session.uploadAvatar(file), 'Avatar updated.')
}

function onAvatarRemove() {
  run(profileStatus, avatarBusy, () => session.removeAvatar(), 'Avatar removed.')
}

// Password
const password = reactive({ current: '', next: '', confirm: '' })
const passwordErrors = shallowRef<Partial<Record<keyof typeof password, string>>>({})
const passwordStatus = shallowRef<Status | null>(null)
const savingPassword = shallowRef(false)

function changePassword() {
  passwordErrors.value = collectErrors({
    current: password.current ? undefined : 'Please enter your current password.',
    next: checkNewPassword(password.next),
    confirm: checkConfirmation(password.next, password.confirm),
  })
  if (Object.keys(passwordErrors.value).length)
    return
  run(passwordStatus, savingPassword, async () => {
    await accountApi.changePassword(password.current, password.next)
    Object.assign(password, { current: '', next: '', confirm: '' })
  }, 'Password changed. Your other devices have been signed out.')
}

async function logout() {
  // The local session is cleared even if the server cannot be reached.
  await session.logout().catch(() => {})
  await router.replace('/login')
}
</script>

<template>
  <main class="min-h-screen">
    <MainNavigation />
    <div v-if="user" class="container mx-auto grid max-w-2xl gap-6 px-4 py-10">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold">
            My account
          </h1>
          <p class="text-sm text-muted-foreground">
            {{ user.email }} · joined {{ new Date(user.createdAt).toLocaleDateString() }}
          </p>
        </div>
        <Button variant="outline" @click="logout">
          <LogOut class="size-4" />
          Sign out
        </Button>
      </div>

      <Alert v-if="notice" :variant="notice.type === 'error' ? 'destructive' : 'default'">
        <AlertDescription>{{ notice.text }}</AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How other people see you.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-6">
          <AvatarPicker
            :src="user.avatarUrl"
            :name="user.nickname"
            :busy="avatarBusy"
            removable
            @select="onAvatarSelect"
            @remove="onAvatarRemove"
          />
          <form class="grid gap-4" novalidate @submit.prevent="saveProfile">
            <TextField v-model="nickname" label="Nickname" autocomplete="nickname" :error="nicknameError" />
            <Alert v-if="profileStatus" :variant="profileStatus.type === 'error' ? 'destructive' : 'default'">
              <AlertDescription>{{ profileStatus.text }}</AlertDescription>
            </Alert>
            <div>
              <Button type="submit" :disabled="savingProfile">
                {{ savingProfile ? 'Saving...' : 'Save profile' }}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Changing it signs out every other device.</CardDescription>
        </CardHeader>
        <CardContent>
          <form class="grid gap-4" novalidate @submit.prevent="changePassword">
            <TextField
              v-model="password.current"
              label="Current password"
              type="password"
              autocomplete="current-password"
              :error="passwordErrors.current"
            />
            <TextField
              v-model="password.next"
              label="New password"
              type="password"
              autocomplete="new-password"
              hint="8-72 characters."
              :error="passwordErrors.next"
            />
            <TextField
              v-model="password.confirm"
              label="Confirm new password"
              type="password"
              autocomplete="new-password"
              :error="passwordErrors.confirm"
            />
            <Alert v-if="passwordStatus" :variant="passwordStatus.type === 'error' ? 'destructive' : 'default'">
              <AlertDescription>{{ passwordStatus.text }}</AlertDescription>
            </Alert>
            <div>
              <Button type="submit" :disabled="savingPassword">
                {{ savingPassword ? 'Saving...' : 'Change password' }}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  </main>
</template>
