<script setup lang="ts">
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { reactive, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthShell from '@/components/account/AuthShell.vue'
import TextField from '@/components/account/TextField.vue'
import { takeFlash } from '@/composables/useFlash'
import { useSession } from '@/composables/useSession'
import { errorMessage } from '@/lib/api'
import { checkEmail, collectErrors, safeRedirect } from '@/lib/validation'

const route = useRoute()
const router = useRouter()
const { login } = useSession()

const form = reactive({ email: '', password: '' })
const errors = shallowRef<Partial<Record<keyof typeof form, string>>>({})
const failure = shallowRef('')
const notice = takeFlash()
const submitting = shallowRef(false)

async function submit() {
  errors.value = collectErrors({
    email: checkEmail(form.email),
    password: form.password ? undefined : 'Please enter your password.',
  })
  if (Object.keys(errors.value).length)
    return
  submitting.value = true
  failure.value = ''
  try {
    await login({ email: form.email.trim(), password: form.password })
    await router.replace(safeRedirect(route.query.redirect))
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
  <AuthShell title="Sign in" description="Welcome back! Sign in with your email and password.">
    <form class="grid gap-4" novalidate @submit.prevent="submit">
      <Alert v-if="notice && !failure">
        <AlertDescription>{{ notice.text }}</AlertDescription>
      </Alert>
      <Alert v-if="failure" variant="destructive">
        <AlertDescription>{{ failure }}</AlertDescription>
      </Alert>
      <TextField v-model="form.email" label="Email" type="email" placeholder="you@example.com" autocomplete="username" :error="errors.email" />
      <TextField v-model="form.password" label="Password" type="password" autocomplete="current-password" :error="errors.password">
        <template #label-end>
          <RouterLink to="/forgot-password" class="text-sm text-muted-foreground hover:underline">
            Forgot password?
          </RouterLink>
        </template>
      </TextField>
      <Button type="submit" class="w-full" :disabled="submitting">
        {{ submitting ? 'Signing in...' : 'Sign in' }}
      </Button>
    </form>
    <template #footer>
      No account yet?
      <RouterLink :to="{ path: '/register', query: route.query }" class="font-medium text-primary hover:underline">
        Create one
      </RouterLink>
    </template>
  </AuthShell>
</template>
