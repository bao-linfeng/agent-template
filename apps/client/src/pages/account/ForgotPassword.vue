<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { useMutation } from '@tanstack/vue-query'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import AuthShell from '@/components/account/AuthShell.vue'
import TextField from '@/components/account/TextField.vue'
import { accountApi } from '@/lib/account'
import { errorMessage } from '@/lib/api'
import { checkEmail } from '@/lib/validation'

const { t } = useI18n()

const email = shallowRef('')
const error = shallowRef<string>()
const sentTo = shallowRef('')

const { mutate: sendResetLink, isPending: submitting, error: requestError } = useMutation({
  // Same answer whether or not the email is registered.
  mutationFn: (address: string) => accountApi.forgotPassword(address),
  onSuccess: (_data, address) => {
    sentTo.value = address
  },
})
const failure = computed(() => (requestError.value ? errorMessage(requestError.value) : ''))

function submit() {
  error.value = checkEmail(email.value)
  if (error.value)
    return
  sendResetLink(email.value.trim())
}
</script>

<template>
  <AuthShell :title="t('account.forgot.title')" :description="t('account.forgot.description')">
    <form class="grid gap-4" novalidate @submit.prevent="submit">
      <Alert v-if="sentTo">
        <AlertTitle>{{ t('account.forgot.sentTitle') }}</AlertTitle>
        <AlertDescription>
          {{ t('account.forgot.sentBody', { email: sentTo }) }}
        </AlertDescription>
      </Alert>
      <Alert v-if="failure" variant="destructive">
        <AlertDescription>{{ failure }}</AlertDescription>
      </Alert>
      <TextField v-model="email" :label="t('account.fields.email')" type="email" placeholder="you@example.com" autocomplete="email" :error="error" />
      <Button type="submit" class="w-full" :disabled="submitting">
        {{ submitting ? t('account.forgot.submitting') : sentTo ? t('account.forgot.resend') : t('account.forgot.submit') }}
      </Button>
    </form>
    <template #footer>
      {{ t('account.forgot.remembered') }}
      <RouterLink to="/login" class="font-medium text-primary hover:underline">
        {{ t('account.forgot.backToSignIn') }}
      </RouterLink>
    </template>
  </AuthShell>
</template>
