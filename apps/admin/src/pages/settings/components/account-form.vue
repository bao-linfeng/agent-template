<script setup lang="ts">
import { Button } from '@repo/ui/components/button'
import { Separator } from '@repo/ui/components/separator'
import { Spinner } from '@repo/ui/components/spinner'
import { useForm } from '@tanstack/vue-form'
import { toast } from 'vue-sonner'

import FormTextField from '@/components/form-text-field.vue'
import { useChangePasswordMutation } from '@/services/api/me.api'

import type { ChangePasswordValidator } from '../validators/account.validator'

import { changePasswordValidator } from '../validators/account.validator'
import SessionList from './session-list.vue'

const changePassword = useChangePasswordMutation()

const defaultValues: ChangePasswordValidator = { currentPassword: '', newPassword: '', confirmPassword: '' }

const form = useForm({
  defaultValues,
  validators: { onSubmit: changePasswordValidator },
  onSubmit: async ({ value }) => {
    try {
      await changePassword.mutateAsync({ currentPassword: value.currentPassword, newPassword: value.newPassword })
    }
    catch {
      return // Toasted by the global mutation handler (e.g. wrong current password).
    }
    form.reset()
    toast.success('Password changed. Your other sessions have been signed out.')
  },
})
</script>

<template>
  <div>
    <h3 class="text-lg font-medium">
      Security
    </h3>
    <p class="text-sm text-muted-foreground">
      Change your password and review where you are signed in.
    </p>
  </div>
  <Separator class="my-4" />

  <form class="space-y-6 max-w-md" novalidate @submit.prevent="form.handleSubmit">
    <form.Field name="currentPassword">
      <template #default="{ field }">
        <FormTextField :field="field" label="Current password" type="password" autocomplete="current-password" />
      </template>
    </form.Field>
    <form.Field name="newPassword">
      <template #default="{ field }">
        <FormTextField
          :field="field"
          label="New password"
          type="password"
          autocomplete="new-password"
          description="8-72 characters. Every other session will be signed out."
        />
      </template>
    </form.Field>
    <form.Field name="confirmPassword">
      <template #default="{ field }">
        <FormTextField :field="field" label="Confirm new password" type="password" autocomplete="new-password" />
      </template>
    </form.Field>

    <Button type="submit" :disabled="changePassword.isPending.value">
      <Spinner v-if="changePassword.isPending.value" class="mr-2" />
      Change password
    </Button>
  </form>

  <Separator class="my-8" />

  <SessionList />
</template>
