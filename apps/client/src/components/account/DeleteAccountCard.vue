<script setup lang="ts">
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@repo/ui/components/alert-dialog'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import { useMutation } from '@tanstack/vue-query'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import TextField from '@/components/account/TextField.vue'
import { flash } from '@/composables/useFlash'
import { errorMessage } from '@/lib/api'
import { useSessionStore } from '@/stores/session'

const { t, locale } = useI18n()
const router = useRouter()
const session = useSessionStore()

const password = shallowRef('')
const passwordError = shallowRef<string>()
const confirming = shallowRef(false)

// Callbacks on `useMutation` still run after the page unmounts (the store signs the user out first).
const { mutate: requestDeletion, isPending, error } = useMutation({
  mutationFn: session.requestDeletion,
  onSuccess: async (scheduledAt) => {
    const date = new Date(scheduledAt).toLocaleString(locale.value, { dateStyle: 'long', timeStyle: 'short' })
    flash({ type: 'warning', text: t('account.deletion.scheduled', { date }) })
    await router.replace('/login')
  },
})
const failure = computed(() => (error.value ? errorMessage(error.value) : ''))

function submit() {
  passwordError.value = password.value ? undefined : t('validation.passwordRequired')
  if (!passwordError.value)
    confirming.value = true
}

function confirm() {
  confirming.value = false
  requestDeletion(password.value)
}
</script>

<template>
  <Card class="border-destructive/50">
    <CardHeader>
      <CardTitle>{{ t('account.deletion.cardTitle') }}</CardTitle>
      <CardDescription>{{ t('account.deletion.cardDescription') }}</CardDescription>
    </CardHeader>
    <CardContent>
      <form class="grid gap-4" novalidate @submit.prevent="submit">
        <TextField
          v-model="password"
          :label="t('account.fields.currentPassword')"
          type="password"
          autocomplete="current-password"
          :error="passwordError"
        />
        <Alert v-if="failure" variant="destructive">
          <AlertDescription>{{ failure }}</AlertDescription>
        </Alert>
        <div>
          <Button type="submit" variant="destructive" :disabled="isPending">
            {{ isPending ? t('account.deletion.submitting') : t('account.deletion.submit') }}
          </Button>
        </div>
      </form>
    </CardContent>
  </Card>

  <AlertDialog v-model:open="confirming">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('account.deletion.confirmTitle') }}</AlertDialogTitle>
        <AlertDialogDescription>{{ t('account.deletion.confirmDescription') }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('account.deletion.cancel') }}</AlertDialogCancel>
        <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="confirm">
          {{ t('account.deletion.confirm') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
