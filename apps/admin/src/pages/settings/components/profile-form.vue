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
  uploadAvatar.mutate(file, { onSuccess: () => toast.success('Avatar updated.') })
}

function onAvatarRemove() {
  removeAvatar.mutate(undefined, { onSuccess: () => toast.success('Avatar removed.') })
}

const form = useForm({
  defaultValues: { nickname: user.value?.nickname ?? '' } satisfies ProfileValidator,
  validators: { onSubmit: profileValidator },
  onSubmit: async ({ value }) => {
    await updateMe.mutateAsync({ nickname: value.nickname.trim() }).then(
      () => toast.success('Profile updated.'),
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
      Profile
    </h3>
    <p class="text-sm text-muted-foreground">
      This is how others will see you on the site.
    </p>
  </div>
  <Separator orientation="horizontal" class="my-4" />

  <div v-if="user" class="space-y-8">
    <FormItem>
      <Label>Avatar</Label>
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
            label="Nickname"
            autocomplete="nickname"
            description="This is your public display name."
          />
        </template>
      </form.Field>

      <FormItem>
        <Label for="profile-email">Email</Label>
        <Input id="profile-email" :model-value="user.email" disabled />
        <FieldDescription>
          Used to sign in and to receive password reset links.
        </FieldDescription>
      </FormItem>

      <FormItem>
        <Label>Roles</Label>
        <div class="flex flex-wrap gap-2">
          <Badge v-for="role in user.roles" :key="role" variant="secondary">
            {{ role }}
          </Badge>
          <span v-if="!user.roles.length" class="text-sm text-muted-foreground">No roles</span>
        </div>
        <FieldDescription>
          Roles are assigned by an administrator.
        </FieldDescription>
      </FormItem>

      <div class="flex justify-start gap-2">
        <Button type="submit" :disabled="updateMe.isPending.value">
          <Spinner v-if="updateMe.isPending.value" class="mr-2" />
          Update profile
        </Button>
        <Button type="button" variant="outline" @click="form.reset()">
          Reset form
        </Button>
      </div>
    </form>
  </div>
</template>
