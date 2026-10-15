<script setup lang="ts">
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import { Label } from '@repo/ui/components/label'
import { Spinner } from '@repo/ui/components/spinner'
import { useForm } from '@tanstack/vue-form'

import FormTextField from '@/components/form-text-field.vue'
import { useAuth } from '@/composables/use-auth'
import { getErrorMessage } from '@/lib/api-client'

import type { LoginValidator } from '../validators/auth.validator'

import { loginValidator } from '../validators/auth.validator'
import PrivacyPolicyButton from './privacy-policy-button.vue'
import TermsOfServiceButton from './terms-of-service-button.vue'
import ToForgotPasswordLink from './to-forgot-password-link.vue'

const { login, loading } = useAuth()
const errorMessage = shallowRef('')

const defaultValues: LoginValidator = { email: '', password: '' }

const form = useForm({
  defaultValues,
  validators: { onSubmit: loginValidator },
  onSubmit: async ({ value }) => {
    errorMessage.value = ''
    try {
      await login({ email: value.email.trim(), password: value.password })
    }
    catch (error) {
      errorMessage.value = getErrorMessage(error, 'Sign in failed, please try again.')
    }
  },
})
</script>

<template>
  <Card class="w-full max-w-sm">
    <CardHeader>
      <CardTitle class="text-2xl">
        Login
      </CardTitle>
      <CardDescription>
        Enter your email and password below to log into your account.
        Not have an account?
        <Button
          variant="link" class="px-0 text-muted-foreground"
          @click="$router.push({ path: '/auth/sign-up', query: $route.query })"
        >
          Sign Up
        </Button>
      </CardDescription>
    </CardHeader>
    <CardContent>
      <form class="grid gap-4" novalidate @submit.prevent="form.handleSubmit">
        <Alert v-if="errorMessage" variant="destructive">
          <AlertDescription>{{ errorMessage }}</AlertDescription>
        </Alert>

        <form.Field name="email">
          <template #default="{ field }">
            <FormTextField
              :field="field"
              :label="$t('email')"
              type="email"
              placeholder="m@example.com"
              autocomplete="username"
            />
          </template>
        </form.Field>

        <form.Field name="password">
          <template #default="{ field }">
            <FormTextField
              :field="field"
              :label="$t('password')"
              type="password"
              placeholder="*********"
              autocomplete="current-password"
            >
              <template #label>
                <div class="flex items-center justify-between">
                  <Label for="field-password">{{ $t('password') }}</Label>
                  <ToForgotPasswordLink class="h-auto p-0" />
                </div>
              </template>
            </FormTextField>
          </template>
        </form.Field>

        <Button type="submit" class="w-full" :disabled="loading">
          <Spinner v-if="loading" class="mr-2" />
          {{ $t('login') }}
        </Button>

        <CardDescription>
          By clicking login, you agree to our
          <TermsOfServiceButton />
          and
          <PrivacyPolicyButton />
        </CardDescription>
      </form>
    </CardContent>
  </Card>
</template>
