<script setup lang="ts">
import type { Registration } from '@/lib/account'
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { useMutation } from '@tanstack/vue-query'
import { computed, reactive, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AuthShell from '@/components/account/AuthShell.vue'
import AvatarPicker from '@/components/account/AvatarPicker.vue'
import TextField from '@/components/account/TextField.vue'
import { flash } from '@/composables/useFlash'
import { useObjectUrl } from '@/composables/useObjectUrl'
import { errorMessage } from '@/lib/api'
import { checkConfirmation, checkEmail, checkNewPassword, checkNickname, collectErrors, safeRedirect } from '@/lib/validation'
import { useSessionStore } from '@/stores/session'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const form = reactive({ nickname: '', email: '', password: '', confirmPassword: '' })
const avatar = shallowRef<File | null>(null)
const avatarPreview = useObjectUrl(avatar)
const errors = shallowRef<Partial<Record<keyof typeof form, string>>>({})

const { mutate: register, isPending: submitting, error } = useMutation({
  mutationFn: (variables: { registration: Registration, avatar: File | null }) =>
    session.register(variables.registration, variables.avatar),
  onSuccess: (avatarError) => {
    if (avatarError)
      flash({ type: 'warning', text: t('account.register.avatarNotSaved', { error: avatarError }) })
    return router.replace(safeRedirect(route.query.redirect))
  },
})
const failure = computed(() => (error.value ? errorMessage(error.value) : ''))

function submit() {
  errors.value = collectErrors({
    nickname: checkNickname(form.nickname),
    email: checkEmail(form.email),
    password: checkNewPassword(form.password),
    confirmPassword: checkConfirmation(form.password, form.confirmPassword),
  })
  if (Object.keys(errors.value).length)
    return
  register({
    registration: { nickname: form.nickname.trim(), email: form.email.trim(), password: form.password },
    avatar: avatar.value,
  })
}
</script>

<template>
  <AuthShell :title="t('account.register.title')" :description="t('account.register.description')">
    <form class="grid gap-4" novalidate @submit.prevent="submit">
      <Alert v-if="failure" variant="destructive">
        <AlertDescription>{{ failure }}</AlertDescription>
      </Alert>
      <AvatarPicker
        :src="avatarPreview"
        :name="form.nickname"
        :busy="submitting"
        removable
        @select="avatar = $event"
        @remove="avatar = null"
      />
      <TextField v-model="form.nickname" :label="t('account.fields.nickname')" :placeholder="t('account.fields.nicknamePlaceholder')" autocomplete="nickname" :error="errors.nickname" />
      <TextField v-model="form.email" :label="t('account.fields.email')" type="email" placeholder="you@example.com" autocomplete="email" :error="errors.email" />
      <TextField
        v-model="form.password"
        :label="t('account.fields.password')"
        type="password"
        autocomplete="new-password"
        :hint="t('account.fields.passwordHint')"
        :error="errors.password"
      />
      <TextField v-model="form.confirmPassword" :label="t('account.fields.confirmPassword')" type="password" autocomplete="new-password" :error="errors.confirmPassword" />
      <Button type="submit" class="w-full" :disabled="submitting">
        {{ submitting ? t('account.register.submitting') : t('account.register.submit') }}
      </Button>
    </form>
    <template #footer>
      {{ t('account.register.hasAccount') }}
      <RouterLink :to="{ path: '/login', query: route.query }" class="font-medium text-primary hover:underline">
        {{ t('account.register.signIn') }}
      </RouterLink>
    </template>
  </AuthShell>
</template>
