<script setup lang="ts">
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { FieldDescription } from '@repo/ui/components/field'
import { FormItem } from '@repo/ui/components/form'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'
import { Separator } from '@repo/ui/components/separator'
import { Spinner } from '@repo/ui/components/spinner'
import { useForm } from '@tanstack/vue-form'
import { toast } from 'vue-sonner'

import AvatarInput from '@/components/avatar-input.vue'
import FormTextField from '@/components/form-text-field.vue'
import { t } from '@/plugins/i18n'
import { useRemoveAvatarMutation, useUpdateMeMutation, useUploadAvatarMutation } from '@/services/api/me.api'
import { useAuthStore } from '@/stores/auth'

import type { ProfileValidator } from '../validators/profile.validator'

import { profileValidator } from '../validators/profile.validator'

const authStore = useAuthStore()
const user = computed(() => authStore.user)

const updateMe = useUpdateMeMutation()
const uploadAvatar = useUploadAvatarMutation()
const removeAvatar = useRemoveAvatarMutation()
const avatarBusy = computed(() => uploadAvatar.isPending.value || removeAvatar.isPending.value)

function onAvatarSelect(file: File) {
  uploadAvatar.mutate(file, { onSuccess: () => toast.success(t('settings.profile.avatarUpdated')) })
}

function onAvatarRemove() {
  removeAvatar.mutate(undefined, { onSuccess: () => toast.success(t('settings.profile.avatarRemoved')) })
}

const form = useForm({
  defaultValues: { nickname: user.value?.nickname ?? '' } satisfies ProfileValidator,
  validators: { onSubmit: profileValidator },
  onSubmit: async ({ value }) => {
    await updateMe.mutateAsync({ nickname: value.nickname.trim() }).then(
      () => toast.success(t('settings.profile.updated')),
      () => {}, // Toasted by the global mutation handler.
    )
  },
})

watch(() => user.value?.nickname, (nickname) => {
  form.reset({ nickname: nickname ?? '' })
})
</script>

<template>
  <div>
    <h3 class="text-lg font-medium">
      {{ $t('nav.profile') }}
    </h3>
    <p class="text-sm text-muted-foreground">
      {{ $t('settings.profile.description') }}
    </p>
  </div>
  <Separator orientation="horizontal" class="my-4" />

  <div v-if="user" class="space-y-8">
    <FormItem>
      <Label>{{ $t('settings.profile.avatar') }}</Label>
      <AvatarInput
        :src="user.avatarUrl"
        :name="user.nickname"
        :loading="avatarBusy"
        removable
        @select="onAvatarSelect"
        @remove="onAvatarRemove"
      />
    </FormItem>

    <form class="space-y-8" novalidate @submit.prevent="form.handleSubmit">
      <form.Field name="nickname">
        <template #default="{ field }">
          <FormTextField
            :field="field"
            :label="$t('fields.nickname')"
            autocomplete="nickname"
            :description="$t('settings.profile.nicknameHint')"
          />
        </template>
      </form.Field>

      <FormItem>
        <Label for="profile-email">{{ $t('email') }}</Label>
        <Input id="profile-email" :model-value="user.email" disabled />
        <FieldDescription>
          {{ $t('settings.profile.emailHint') }}
        </FieldDescription>
      </FormItem>

      <FormItem>
        <Label>{{ $t('fields.roles') }}</Label>
        <div class="flex flex-wrap gap-2">
          <Badge v-for="role in user.roles" :key="role" variant="secondary">
            {{ role }}
          </Badge>
          <span v-if="!user.roles.length" class="text-sm text-muted-foreground">{{ $t('common.noRoles') }}</span>
        </div>
        <FieldDescription>
          {{ $t('settings.profile.rolesHint') }}
        </FieldDescription>
      </FormItem>

      <div class="flex justify-start gap-2">
        <Button type="submit" :disabled="updateMe.isPending.value">
          <Spinner v-if="updateMe.isPending.value" class="mr-2" />
          {{ $t('settings.profile.submit') }}
        </Button>
        <Button type="button" variant="outline" @click="form.reset()">
          {{ $t('settings.profile.resetForm') }}
        </Button>
      </div>
    </form>
  </div>
</template>
