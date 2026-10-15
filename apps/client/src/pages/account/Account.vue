<script setup lang="ts">
import { LogOut } from '@lucide/vue'
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import { reactive, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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

const { t, locale } = useI18n()
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
  run(profileStatus, savingProfile, () => session.updateProfile({ nickname: nickname.value.trim() }), t('account.profile.saved'))
}

function onAvatarSelect(file: File) {
  run(profileStatus, avatarBusy, () => session.uploadAvatar(file), t('account.profile.avatarUpdated'))
}

function onAvatarRemove() {
  run(profileStatus, avatarBusy, () => session.removeAvatar(), t('account.profile.avatarRemoved'))
}

// Password
const password = reactive({ current: '', next: '', confirm: '' })
const passwordErrors = shallowRef<Partial<Record<keyof typeof password, string>>>({})
const passwordStatus = shallowRef<Status | null>(null)
const savingPassword = shallowRef(false)

function changePassword() {
  passwordErrors.value = collectErrors({
    current: password.current ? undefined : t('validation.currentPasswordRequired'),
    next: checkNewPassword(password.next),
    confirm: checkConfirmation(password.next, password.confirm),
  })
  if (Object.keys(passwordErrors.value).length)
    return
  run(passwordStatus, savingPassword, async () => {
    await accountApi.changePassword(password.current, password.next)
    Object.assign(password, { current: '', next: '', confirm: '' })
  }, t('account.password.changed'))
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
            {{ t('account.profile.title') }}
          </h1>
          <p class="text-sm text-muted-foreground">
            {{ t('account.profile.joined', { email: user.email, date: new Date(user.createdAt).toLocaleDateString(locale) }) }}
          </p>
        </div>
        <Button variant="outline" @click="logout">
          <LogOut class="size-4" />
          {{ t('account.profile.signOut') }}
        </Button>
      </div>

      <Alert v-if="notice" :variant="notice.type === 'error' ? 'destructive' : 'default'">
        <AlertDescription>{{ notice.text }}</AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>{{ t('account.profile.cardTitle') }}</CardTitle>
          <CardDescription>{{ t('account.profile.cardDescription') }}</CardDescription>
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
            <TextField v-model="nickname" :label="t('account.fields.nickname')" autocomplete="nickname" :error="nicknameError" />
            <Alert v-if="profileStatus" :variant="profileStatus.type === 'error' ? 'destructive' : 'default'">
              <AlertDescription>{{ profileStatus.text }}</AlertDescription>
            </Alert>
            <div>
              <Button type="submit" :disabled="savingProfile">
                {{ savingProfile ? t('common.saving') : t('account.profile.save') }}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{{ t('account.password.cardTitle') }}</CardTitle>
          <CardDescription>{{ t('account.password.cardDescription') }}</CardDescription>
        </CardHeader>
        <CardContent>
          <form class="grid gap-4" novalidate @submit.prevent="changePassword">
            <TextField
              v-model="password.current"
              :label="t('account.fields.currentPassword')"
              type="password"
              autocomplete="current-password"
              :error="passwordErrors.current"
            />
            <TextField
              v-model="password.next"
              :label="t('account.fields.newPassword')"
              type="password"
              autocomplete="new-password"
              :hint="t('account.fields.passwordHint')"
              :error="passwordErrors.next"
            />
            <TextField
              v-model="password.confirm"
              :label="t('account.fields.confirmNewPassword')"
              type="password"
              autocomplete="new-password"
              :error="passwordErrors.confirm"
            />
            <Alert v-if="passwordStatus" :variant="passwordStatus.type === 'error' ? 'destructive' : 'default'">
              <AlertDescription>{{ passwordStatus.text }}</AlertDescription>
            </Alert>
            <div>
              <Button type="submit" :disabled="savingPassword">
                {{ savingPassword ? t('common.saving') : t('account.password.submit') }}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  </main>
</template>
