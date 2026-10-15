<script setup lang="ts">
import { MailCheckIcon } from '@lucide/vue'
import { Alert, AlertDescription, AlertTitle } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@repo/ui/components/card'
import { Spinner } from '@repo/ui/components/spinner'
import { useForm } from '@tanstack/vue-form'

import FormTextField from '@/components/form-text-field.vue'
import { useForgotPasswordMutation } from '@/services/api/auth.api'

import AuthTitle from './components/auth-title.vue'
import { forgotPasswordValidator } from './validators/auth.validator'

const { mutateAsync, isPending } = useForgotPasswordMutation()
const sentTo = shallowRef('')

const form = useForm({
  defaultValues: { email: '' },
  validators: { onSubmit: forgotPasswordValidator },
  onSubmit: async ({ value }) => {
    const email = value.email.trim()
    // The answer is the same whether or not the email is registered.
    // Errors (e.g. 429 too many requests) are toasted by the global mutation handler.
    await mutateAsync(email).then(() => {
      sentTo.value = email
    }, () => {})
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
            Forgot Password
          </CardTitle>
          <CardDescription>
            Enter your registered email and we will send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <form novalidate @submit.prevent="form.handleSubmit">
          <CardContent class="grid gap-4">
            <Alert v-if="sentTo">
              <MailCheckIcon />
              <AlertTitle>Check your inbox</AlertTitle>
              <AlertDescription>
                If {{ sentTo }} is registered, a reset link is on its way. It is valid for a limited time and only once.
              </AlertDescription>
            </Alert>
            <form.Field name="email">
              <template #default="{ field }">
                <FormTextField :field="field" :label="$t('email')" type="email" placeholder="m@example.com" autocomplete="email" />
              </template>
            </form.Field>
          </CardContent>
          <CardFooter class="flex flex-col gap-2 pt-4">
            <Button type="submit" class="w-full" :disabled="isPending">
              <Spinner v-if="isPending" class="mr-2" />
              {{ sentTo ? 'Send again' : $t('forgotPasswordPage.continue') }}
            </Button>

            <div class="text-sm">
              Remembered it?
              <Button type="button" variant="link" class="px-0 text-muted-foreground" @click="$router.push('/auth/sign-in')">
                Back to sign in.
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </main>
  </div>
</template>
