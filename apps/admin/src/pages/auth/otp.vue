<script setup lang="ts">
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@repo/ui/components/card'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'
import { PinInput, PinInputGroup, PinInputInput } from '@repo/ui/components/pin-input'
import { Spinner } from '@repo/ui/components/spinner'

import { useAuth } from '@/composables/use-auth'
import { LOGIN_PATH } from '@/constants/app'
import { getErrorMessage } from '@/lib/api-client'
import { t } from '@/plugins/i18n'
import { useAuthStore } from '@/stores/auth'

import AuthTitle from './components/auth-title.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { verifyMfa, loading } = useAuth()

const useRecoveryCode = shallowRef(false)
const digits = ref<number[]>([])
const recoveryCode = shallowRef('')
const errorMessage = shallowRef('')

// The challenge lives in memory only: opened directly or after a reload, start the sign-in over.
if (!authStore.activeMfa())
  router.replace({ path: LOGIN_PATH, query: route.query })

const expired = computed(() => authStore.pendingMfa === null)
const code = computed(() => (useRecoveryCode.value ? recoveryCode.value.trim() : digits.value.join('')))
const canSubmit = computed(() => (useRecoveryCode.value ? code.value.length >= 10 : code.value.length === 6))

async function submit() {
  if (!canSubmit.value || loading.value)
    return
  errorMessage.value = ''
  try {
    await verifyMfa(code.value)
  }
  catch (error) {
    errorMessage.value = getErrorMessage(error, t('auth.signInFailed'))
    digits.value = []
  }
}

function toggleMode() {
  useRecoveryCode.value = !useRecoveryCode.value
  errorMessage.value = ''
}

function backToSignIn() {
  authStore.clearPendingMfa()
  router.push({ path: LOGIN_PATH, query: route.query })
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen p-4 min-w-screen">
    <main class="flex flex-col gap-4">
      <AuthTitle />
      <Card class="w-full max-w-sm">
        <CardHeader>
          <CardTitle class="text-2xl">
            {{ $t('auth.otpTitle') }}
          </CardTitle>
          <CardDescription>
            {{ useRecoveryCode ? $t('auth.otpRecoveryDescription') : $t('auth.otpDescription') }}
          </CardDescription>
        </CardHeader>

        <CardContent v-if="expired" class="grid gap-4">
          <Alert variant="destructive">
            <AlertDescription>{{ $t('auth.otpExpired') }}</AlertDescription>
          </Alert>
        </CardContent>

        <form v-else novalidate @submit.prevent="submit">
          <CardContent class="grid gap-4">
            <p class="text-sm text-muted-foreground">
              {{ $t('auth.otpAccount', { email: authStore.pendingMfa?.email }) }}
            </p>
            <Alert v-if="errorMessage" variant="destructive">
              <AlertDescription>{{ errorMessage }}</AlertDescription>
            </Alert>

            <div v-if="useRecoveryCode" class="grid gap-2">
              <Label for="recovery-code">{{ $t('auth.recoveryCode') }}</Label>
              <Input
                id="recovery-code"
                v-model="recoveryCode"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                placeholder="xxxxx-xxxxx"
                :disabled="loading"
              />
            </div>
            <div v-else class="flex justify-center">
              <PinInput
                id="pin-input"
                v-model="digits"
                type="number"
                placeholder="○"
                :disabled="loading"
                @complete="submit"
              >
                <PinInputGroup>
                  <PinInputInput
                    v-for="(id, index) in 6"
                    :key="id"
                    :index="index"
                    autocomplete="one-time-code"
                  />
                </PinInputGroup>
              </PinInput>
            </div>
          </CardContent>
          <CardFooter class="flex flex-col gap-2 pt-4">
            <Button type="submit" class="w-full" :disabled="!canSubmit || loading">
              <Spinner v-if="loading" class="mr-2" />
              {{ $t('auth.verify') }}
            </Button>
            <Button type="button" variant="link" class="px-0 text-muted-foreground" @click="toggleMode">
              {{ useRecoveryCode ? $t('auth.useAuthenticator') : $t('auth.useRecoveryCode') }}
            </Button>
          </CardFooter>
        </form>

        <CardFooter class="pt-0">
          <Button type="button" variant="link" class="px-0 text-muted-foreground" @click="backToSignIn">
            {{ $t('auth.backToSignIn') }}
          </Button>
        </CardFooter>
      </Card>
    </main>
  </div>
</template>
