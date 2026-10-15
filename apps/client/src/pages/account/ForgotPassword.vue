<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { shallowRef } from 'vue'
import AuthShell from '@/components/account/AuthShell.vue'
import TextField from '@/components/account/TextField.vue'
import { accountApi } from '@/lib/account'
import { errorMessage } from '@/lib/api'
import { checkEmail } from '@/lib/validation'

const email = shallowRef('')
const error = shallowRef<string>()
const failure = shallowRef('')
const sentTo = shallowRef('')
const submitting = shallowRef(false)

async function submit() {
  error.value = checkEmail(email.value)
  if (error.value)
    return
  submitting.value = true
  failure.value = ''
  try {
    // Same answer whether or not the email is registered.
    await accountApi.forgotPassword(email.value.trim())
    sentTo.value = email.value.trim()
  }
  catch (requestError) {
    failure.value = errorMessage(requestError)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthShell title="Forgot password" description="Enter your email and we will send you a link to reset your password.">
    <form class="grid gap-4" novalidate @submit.prevent="submit">
      <Alert v-if="sentTo">
        <AlertTitle>Check your inbox</AlertTitle>
        <AlertDescription>
          If {{ sentTo }} is registered, a reset link is on its way. It is valid for a limited time and only once.
        </AlertDescription>
      </Alert>
      <Alert v-if="failure" variant="destructive">
        <AlertDescription>{{ failure }}</AlertDescription>
      </Alert>
      <TextField v-model="email" label="Email" type="email" placeholder="you@example.com" autocomplete="email" :error="error" />
      <Button type="submit" class="w-full" :disabled="submitting">
        {{ submitting ? 'Sending...' : sentTo ? 'Send again' : 'Send reset link' }}
      </Button>
    </form>
    <template #footer>
      Remembered it?
      <RouterLink to="/login" class="font-medium text-primary hover:underline">
        Back to sign in
      </RouterLink>
    </template>
  </AuthShell>
</template>
