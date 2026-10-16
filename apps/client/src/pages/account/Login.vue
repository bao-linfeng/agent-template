<script setup lang="ts">
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { FetchError, getErrorCode } from '@repo/utils'
import { useMutation } from '@tanstack/vue-query'
import { computed, reactive, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AuthShell from '@/components/account/AuthShell.vue'
import TextField from '@/components/account/TextField.vue'
import { takeFlash } from '@/composables/useFlash'
import { errorMessage } from '@/lib/api'
import { usePublicSettings } from '@/lib/settings'
import { checkEmail, collectErrors, safeRedirect } from '@/lib/validation'
import { useSessionStore } from '@/stores/session'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const form = reactive({ email: '', password: '' })
const errors = shallowRef<Partial<Record<keyof typeof form, string>>>({})
const notice = takeFlash()
const { registrationOpen } = usePublicSettings()

const { mutate: login, isPending: submitting, error } = useMutation({
  mutationFn: session.login,
  onSuccess: () => router.replace(safeRedirect(route.query.redirect)),
})

/** Purge date when the credentials belong to an account with a pending deletion. */
const pendingDeletion = computed(() => {
  if (getErrorCode(error.value) !== 'AUTH_ACCOUNT_PENDING_DELETION')
    return null
  const scheduledAt = error.value instanceof FetchError ? error.value.data?.params?.scheduledAt : undefined
  return typeof scheduledAt === 'string'
    ? new Date(scheduledAt).toLocaleString(locale.value, { dateStyle: 'long', timeStyle: 'short' })
    : ''
})

const { mutate: restore, isPending: restoring, error: restoreError, reset: resetRestore } = useMutation({
  mutationFn: session.restoreAccount,
  onSuccess: () => router.replace(safeRedirect(route.query.redirect)),
})

const failure = computed(() => {
  if (restoreError.value)
    return errorMessage(restoreError.value)
  return error.value && pendingDeletion.value === null ? errorMessage(error.value) : ''
})

function submit() {
  errors.value = collectErrors({
    email: checkEmail(form.email),
    password: form.password ? undefined : t('validation.passwordRequired'),
  })
  if (Object.keys(errors.value).length)
    return
  resetRestore()
  login({ email: form.email.trim(), password: form.password })
}
</script>

<template>
  <AuthShell :title="t('account.login.title')" :description="t('account.login.description')">
    <form class="grid gap-4" novalidate @submit.prevent="submit">
      <Alert v-if="notice && !failure">
        <AlertDescription>{{ notice.text }}</AlertDescription>
      </Alert>
      <Alert v-if="failure" variant="destructive">
        <AlertDescription>{{ failure }}</AlertDescription>
      </Alert>
      <Alert v-else-if="pendingDeletion !== null">
        <AlertDescription class="grid gap-3">
          <span>{{ t('account.login.pendingDeletion', { date: pendingDeletion }) }}</span>
          <Button type="button" variant="outline" :disabled="restoring" @click="restore({ email: form.email.trim(), password: form.password })">
            {{ restoring ? t('account.login.restoring') : t('account.login.restore') }}
          </Button>
        </AlertDescription>
      </Alert>
      <TextField v-model="form.email" :label="t('account.fields.email')" type="email" placeholder="you@example.com" autocomplete="username" :error="errors.email" />
      <TextField v-model="form.password" :label="t('account.fields.password')" type="password" autocomplete="current-password" :error="errors.password">
        <template #label-end>
          <RouterLink to="/forgot-password" class="text-sm text-muted-foreground hover:underline">
            {{ t('account.login.forgot') }}
          </RouterLink>
        </template>
      </TextField>
      <Button type="submit" class="w-full" :disabled="submitting">
        {{ submitting ? t('account.login.submitting') : t('account.login.submit') }}
      </Button>
    </form>
    <template v-if="registrationOpen" #footer>
      {{ t('account.login.noAccount') }}
      <RouterLink :to="{ path: '/register', query: route.query }" class="font-medium text-primary hover:underline">
        {{ t('account.login.register') }}
      </RouterLink>
    </template>
  </AuthShell>
</template>
