<script setup lang="ts">
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { computed, reactive, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthShell from '@/components/account/AuthShell.vue'
import TextField from '@/components/account/TextField.vue'
import { flash } from '@/composables/useFlash'
import { useSession } from '@/composables/useSession'
import { accountApi } from '@/lib/account'
import { errorMessage } from '@/lib/api'
import { checkConfirmation, checkNewPassword, collectErrors } from '@/lib/validation'

// Opened from the email link: /reset-password?token=...
const route = useRoute()
const router = useRouter()
const session = useSession()
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))

const form = reactive({ password: '', confirmPassword: '' })
const errors = shallowRef<Partial<Record<keyof typeof form, string>>>({})
const failure = shallowRef('')
const submitting = shallowRef(false)

async function submit() {
  errors.value = collectErrors({
    password: checkNewPassword(form.password),
    confirmPassword: checkConfirmation(form.password, form.confirmPassword),
  })
  if (Object.keys(errors.value).length)
    return
  submitting.value = true
  failure.value = ''
  try {
    await accountApi.resetPassword(token.value, form.password)
    // Every session of the account is signed out by the server.
    session.clear()
    flash({ type: 'success', text: 'Your password has been reset. Please sign in with the new password.' })
    await router.replace('/login')
  }
  catch (error) {
    failure.value = errorMessage(error)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthShell title="Reset password" description="Choose a new password. You will be signed out on every device.">
    <Alert v-if="!token" variant="destructive">
      <AlertDescription>
        This page needs the link from the reset email.
      </AlertDescription>
    </Alert>
    <form v-else class="grid gap-4" novalidate @submit.prevent="submit">
      <Alert v-if="failure" variant="destructive">
        <AlertDescription>{{ failure }}</AlertDescription>
      </Alert>
      <TextField
        v-model="form.password"
        label="New password"
        type="password"
        autocomplete="new-password"
        hint="8-72 characters."
        :error="errors.password"
      />
      <TextField v-model="form.confirmPassword" label="Confirm new password" type="password" autocomplete="new-password" :error="errors.confirmPassword" />
      <Button type="submit" class="w-full" :disabled="submitting">
        {{ submitting ? 'Saving...' : 'Reset password' }}
      </Button>
    </form>
    <template #footer>
      <RouterLink to="/forgot-password" class="font-medium text-primary hover:underline">
        Request a new link
      </RouterLink>
    </template>
  </AuthShell>
</template>
