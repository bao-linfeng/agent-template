<script setup lang="ts">
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@repo/ui/components/card'
import { Spinner } from '@repo/ui/components/spinner'
import { useForm } from '@tanstack/vue-form'
import { toast } from 'vue-sonner'

import FormTextField from '@/components/form-text-field.vue'
import { LOGIN_PATH } from '@/constants/app'
import { useResetPasswordMutation } from '@/services/api/auth.api'
import { useAuthStore } from '@/stores/auth'

import type { ResetPasswordValidator } from './validators/auth.validator'

import AuthTitle from './components/auth-title.vue'
import { resetPasswordValidator } from './validators/auth.validator'

// Opened from the email link: /auth/reset-password?token=...
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))

const { mutateAsync, isPending } = useResetPasswordMutation()

const defaultValues: ResetPasswordValidator = { password: '', confirmPassword: '' }

const form = useForm({
  defaultValues,
  validators: { onSubmit: resetPasswordValidator },
  onSubmit: async ({ value }) => {
    try {
      await mutateAsync({ token: token.value, password: value.password })
    }
    catch {
      return // Toasted by the global mutation handler (e.g. expired link).
    }
    // Every session of the account was signed out, including this browser's.
    authStore.clear()
    toast.success('Your password has been reset. Please sign in with the new password.')
    await router.replace(LOGIN_PATH)
  },
})
</script>

<template>
  <div class="flex items-center justify-center min-h-screen p-4 min-w-screen">
    <main class="flex flex-col gap-4">
      <AuthTitle />
      <Card class="w-full max-w-sm">
        <CardHeader>
          <CardTitle class="text-2xl">
            Reset Password
          </CardTitle>
          <CardDescription>
            Choose a new password. You will be signed out on every device.
          </CardDescription>
        </CardHeader>
        <form novalidate @submit.prevent="form.handleSubmit">
          <CardContent class="grid gap-4">
            <Alert v-if="!token" variant="destructive">
              <AlertDescription>
                This page needs the link from the reset email. Request a new one if it has expired.
              </AlertDescription>
            </Alert>
            <template v-else>
              <form.Field name="password">
                <template #default="{ field }">
                  <FormTextField
                    :field="field"
                    label="New password"
                    type="password"
                    placeholder="At least 8 characters"
                    autocomplete="new-password"
                  />
                </template>
              </form.Field>
              <form.Field name="confirmPassword">
                <template #default="{ field }">
                  <FormTextField :field="field" label="Confirm new password" type="password" autocomplete="new-password" />
                </template>
              </form.Field>
            </template>
          </CardContent>
          <CardFooter class="flex flex-col gap-2 pt-4">
            <Button v-if="token" type="submit" class="w-full" :disabled="isPending">
              <Spinner v-if="isPending" class="mr-2" />
              Reset password
            </Button>
            <Button type="button" variant="link" class="text-muted-foreground" @click="$router.push('/auth/forgot-password')">
              Request a new link
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  </div>
</template>
