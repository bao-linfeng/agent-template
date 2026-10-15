<script setup lang="ts">
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import { Spinner } from '@repo/ui/components/spinner'
import { useForm } from '@tanstack/vue-form'
import { useObjectUrl } from '@vueuse/core'

import AvatarInput from '@/components/avatar-input.vue'
import FormTextField from '@/components/form-text-field.vue'
import { useAuth } from '@/composables/use-auth'
import { getErrorMessage } from '@/lib/api-client'

import type { RegisterValidator } from './validators/auth.validator'

import AuthTitle from './components/auth-title.vue'
import PrivacyPolicyButton from './components/privacy-policy-button.vue'
import TermsOfServiceButton from './components/terms-of-service-button.vue'
import { registerValidator } from './validators/auth.validator'

const { register, loading } = useAuth()
const errorMessage = shallowRef('')
const avatar = shallowRef<File | null>(null)
const avatarPreview = useObjectUrl(avatar)

const defaultValues: RegisterValidator = { nickname: '', email: '', password: '', confirmPassword: '' }

const form = useForm({
  defaultValues,
  validators: { onSubmit: registerValidator },
  onSubmit: async ({ value }) => {
    errorMessage.value = ''
    try {
      await register(
        { nickname: value.nickname.trim(), email: value.email.trim(), password: value.password },
        avatar.value,
      )
    }
    catch (error) {
      errorMessage.value = getErrorMessage(error, 'Sign up failed, please try again.')
    }
  },
})
const nickname = form.useStore(state => state.values.nickname)
</script>

<template>
  <div class="flex items-center justify-center min-h-screen p-4 min-w-screen">
    <main class="flex flex-col gap-4">
      <AuthTitle />
      <Card class="w-full max-w-sm mx-auto">
        <CardHeader>
          <CardTitle class="text-xl">
            Sign Up
          </CardTitle>
          <CardDescription>
            Enter your email and password to create an account.
            Already have an account?
            <Button
              variant="link" class="px-0 text-muted-foreground"
              @click="$router.push({ path: '/auth/sign-in', query: $route.query })"
            >
              Sign In
            </Button>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form class="grid gap-4" novalidate @submit.prevent="form.handleSubmit">
            <Alert v-if="errorMessage" variant="destructive">
              <AlertDescription>{{ errorMessage }}</AlertDescription>
            </Alert>

            <AvatarInput
              :src="avatarPreview"
              :name="nickname"
              :loading="loading"
              removable
              @select="avatar = $event"
              @remove="avatar = null"
            />

            <form.Field name="nickname">
              <template #default="{ field }">
                <FormTextField :field="field" label="Nickname" placeholder="Max Robinson" autocomplete="nickname" />
              </template>
            </form.Field>
            <form.Field name="email">
              <template #default="{ field }">
                <FormTextField :field="field" :label="$t('email')" type="email" placeholder="m@example.com" autocomplete="email" />
              </template>
            </form.Field>
            <form.Field name="password">
              <template #default="{ field }">
                <FormTextField
                  :field="field"
                  :label="$t('password')"
                  type="password"
                  placeholder="At least 8 characters"
                  autocomplete="new-password"
                />
              </template>
            </form.Field>
            <form.Field name="confirmPassword">
              <template #default="{ field }">
                <FormTextField :field="field" label="Confirm Password" type="password" autocomplete="new-password" />
              </template>
            </form.Field>

            <Button type="submit" class="w-full" :disabled="loading">
              <Spinner v-if="loading" class="mr-2" />
              Create Account
            </Button>

            <CardDescription>
              By creating an account, you agree to our
              <TermsOfServiceButton />
              and
              <PrivacyPolicyButton />
            </CardDescription>
          </form>
        </CardContent>
      </Card>
    </main>
  </div>
</template>
