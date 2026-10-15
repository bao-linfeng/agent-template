<script setup lang="ts">
import type { Registration } from '@/lib/account'
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { useMutation } from '@tanstack/vue-query'
import { computed, reactive, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AuthShell from '@/components/account/AuthShell.vue'
import AvatarPicker from '@/components/account/AvatarPicker.vue'
import TextField from '@/components/account/TextField.vue'
import { useCountdown } from '@/composables/useCountdown'
import { flash } from '@/composables/useFlash'
import { useObjectUrl } from '@/composables/useObjectUrl'
import { accountApi } from '@/lib/account'
import { errorMessage } from '@/lib/api'
import { checkCode, checkConfirmation, checkEmail, checkNewPassword, checkNickname, collectErrors, safeRedirect } from '@/lib/validation'
import { useSessionStore } from '@/stores/session'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const form = reactive({ nickname: '', email: '', code: '', password: '', confirmPassword: '' })
const avatar = shallowRef<File | null>(null)
const avatarPreview = useObjectUrl(avatar)
const errors = shallowRef<Partial<Record<keyof typeof form, string>>>({})

const { remaining: resendIn, start: startResendCountdown } = useCountdown()
const codeSent = shallowRef<{ email: string, minutes: number }>()

const { mutate: sendCode, isPending: sendingCode, error: sendCodeError, reset: resetSendCode } = useMutation({
  mutationFn: (email: string) => accountApi.sendRegisterCode(email),
  onSuccess: ({ expiresIn, resendAfter }, email) => {
    codeSent.value = { email, minutes: Math.round(expiresIn / 60) }
    startResendCountdown(resendAfter)
  },
})
const sendCodeLabel = computed(() => {
  if (sendingCode.value)
    return t('account.register.sendingCode')
  if (resendIn.value)
    return t('account.register.resendIn', { seconds: resendIn.value })
  return codeSent.value ? t('account.register.resendCode') : t('account.register.sendCode')
})

const { mutate: register, isPending: submitting, error, reset: resetRegister } = useMutation({
  mutationFn: (variables: { registration: Registration, avatar: File | null }) =>
    session.register(variables.registration, variables.avatar),
  onSuccess: (avatarError) => {
    if (avatarError)
      flash({ type: 'warning', text: t('account.register.avatarNotSaved', { error: avatarError }) })
    return router.replace(safeRedirect(route.query.redirect))
  },
})
const failure = computed(() => {
  const latest = error.value ?? sendCodeError.value
  return latest ? errorMessage(latest) : ''
})

function requestCode() {
  const emailError = checkEmail(form.email)
  errors.value = { ...errors.value, email: emailError }
  if (emailError)
    return
  resetRegister()
  sendCode(form.email.trim())
}

function submit() {
  errors.value = collectErrors({
    nickname: checkNickname(form.nickname),
    email: checkEmail(form.email),
    code: checkCode(form.code),
    password: checkNewPassword(form.password),
    confirmPassword: checkConfirmation(form.password, form.confirmPassword),
  })
  if (Object.keys(errors.value).length)
    return
  resetSendCode()
  register({
    registration: { nickname: form.nickname.trim(), email: form.email.trim(), code: form.code.trim(), password: form.password },
    avatar: avatar.value,
  })
}
</script>

<template>
  <AuthShell :title="t('account.register.title')" :description="t('account.register.description')">
    <form class="grid gap-4" novalidate @submit.prevent="submit">
      <Alert v-if="failure" variant="destructive">
        <AlertDescription>{{ failure }}</AlertDescription>
      </Alert>
      <Alert v-else-if="codeSent">
        <AlertDescription>{{ t('account.register.codeSent', codeSent) }}</AlertDescription>
      </Alert>
      <AvatarPicker
        :src="avatarPreview"
        :name="form.nickname"
        :busy="submitting"
        removable
        @select="avatar = $event"
        @remove="avatar = null"
      />
      <TextField v-model="form.nickname" :label="t('account.fields.nickname')" :placeholder="t('account.fields.nicknamePlaceholder')" autocomplete="nickname" :error="errors.nickname" />
      <TextField v-model="form.email" :label="t('account.fields.email')" type="email" placeholder="you@example.com" autocomplete="email" :error="errors.email" />
      <TextField
        v-model="form.code"
        :label="t('account.fields.code')"
        :placeholder="t('account.fields.codePlaceholder')"
        autocomplete="one-time-code"
        inputmode="numeric"
        :maxlength="6"
        :error="errors.code"
      >
        <template #label-end>
          <button
            type="button"
            class="text-sm font-medium text-primary hover:underline disabled:pointer-events-none disabled:text-muted-foreground"
            :disabled="sendingCode || resendIn > 0"
            @click="requestCode"
          >
            {{ sendCodeLabel }}
          </button>
        </template>
      </TextField>
      <TextField
        v-model="form.password"
        :label="t('account.fields.password')"
        type="password"
        autocomplete="new-password"
        :hint="t('account.fields.passwordHint')"
        :error="errors.password"
      />
      <TextField v-model="form.confirmPassword" :label="t('account.fields.confirmPassword')" type="password" autocomplete="new-password" :error="errors.confirmPassword" />
      <Button type="submit" class="w-full" :disabled="submitting">
        {{ submitting ? t('account.register.submitting') : t('account.register.submit') }}
      </Button>
    </form>
    <template #footer>
      {{ t('account.register.hasAccount') }}
      <RouterLink :to="{ path: '/login', query: route.query }" class="font-medium text-primary hover:underline">
        {{ t('account.register.signIn') }}
      </RouterLink>
    </template>
  </AuthShell>
</template>
