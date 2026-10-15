<script setup lang="ts">
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { reactive, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthShell from '@/components/account/AuthShell.vue'
import AvatarPicker from '@/components/account/AvatarPicker.vue'
import TextField from '@/components/account/TextField.vue'
import { flash } from '@/composables/useFlash'
import { useObjectUrl } from '@/composables/useObjectUrl'
import { useSession } from '@/composables/useSession'
import { errorMessage } from '@/lib/api'
import { checkConfirmation, checkEmail, checkNewPassword, checkNickname, collectErrors, safeRedirect } from '@/lib/validation'

const route = useRoute()
const router = useRouter()
const { register } = useSession()

const form = reactive({ nickname: '', email: '', password: '', confirmPassword: '' })
const avatar = shallowRef<File | null>(null)
const avatarPreview = useObjectUrl(avatar)
const errors = shallowRef<Partial<Record<keyof typeof form, string>>>({})
const failure = shallowRef('')
const submitting = shallowRef(false)

async function submit() {
  errors.value = collectErrors({
    nickname: checkNickname(form.nickname),
    email: checkEmail(form.email),
    password: checkNewPassword(form.password),
    confirmPassword: checkConfirmation(form.password, form.confirmPassword),
  })
  if (Object.keys(errors.value).length)
    return
  submitting.value = true
  failure.value = ''
  try {
    const avatarError = await register(
      { nickname: form.nickname.trim(), email: form.email.trim(), password: form.password },
      avatar.value,
    )
    if (avatarError)
      flash({ type: 'warning', text: `Account created, but the avatar was not saved: ${avatarError}` })
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
  <AuthShell title="Create an account" description="It only takes a minute.">
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
      <TextField v-model="form.nickname" label="Nickname" placeholder="Ada Lovelace" autocomplete="nickname" :error="errors.nickname" />
      <TextField v-model="form.email" label="Email" type="email" placeholder="you@example.com" autocomplete="email" :error="errors.email" />
      <TextField
        v-model="form.password"
        label="Password"
        type="password"
        autocomplete="new-password"
        hint="8-72 characters."
        :error="errors.password"
      />
      <TextField v-model="form.confirmPassword" label="Confirm password" type="password" autocomplete="new-password" :error="errors.confirmPassword" />
      <Button type="submit" class="w-full" :disabled="submitting">
        {{ submitting ? 'Creating account...' : 'Create account' }}
      </Button>
    </form>
    <template #footer>
      Already have an account?
      <RouterLink :to="{ path: '/login', query: route.query }" class="font-medium text-primary hover:underline">
        Sign in
      </RouterLink>
    </template>
  </AuthShell>
</template>
