<script setup lang="ts">
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { computed, reactive, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AuthShell from '@/components/account/AuthShell.vue'
import TextField from '@/components/account/TextField.vue'
import { flash } from '@/composables/useFlash'
import { useSession } from '@/composables/useSession'
import { accountApi } from '@/lib/account'
import { errorMessage } from '@/lib/api'
import { checkConfirmation, checkNewPassword, collectErrors } from '@/lib/validation'

// Opened from the email link: /reset-password?token=...
const { t } = useI18n()
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
    flash({ type: 'success', text: t('account.reset.done') })
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
  <AuthShell :title="t('account.reset.title')" :description="t('account.reset.description')">
    <Alert v-if="!token" variant="destructive">
      <AlertDescription>
        {{ t('account.reset.missingToken') }}
      </AlertDescription>
    </Alert>
    <form v-else class="grid gap-4" novalidate @submit.prevent="submit">
      <Alert v-if="failure" variant="destructive">
        <AlertDescription>{{ failure }}</AlertDescription>
      </Alert>
      <TextField
        v-model="form.password"
        :label="t('account.fields.newPassword')"
        type="password"
        autocomplete="new-password"
        :hint="t('account.fields.passwordHint')"
        :error="errors.password"
      />
      <TextField v-model="form.confirmPassword" :label="t('account.fields.confirmNewPassword')" type="password" autocomplete="new-password" :error="errors.confirmPassword" />
      <Button type="submit" class="w-full" :disabled="submitting">
        {{ submitting ? t('common.saving') : t('account.reset.submit') }}
      </Button>
    </form>
    <template #footer>
      <RouterLink to="/forgot-password" class="font-medium text-primary hover:underline">
        {{ t('account.reset.requestNew') }}
      </RouterLink>
    </template>
  </AuthShell>
</template>
