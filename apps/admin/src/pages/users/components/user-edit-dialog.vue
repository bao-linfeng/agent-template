<script setup lang="ts">
import { Button } from '@repo/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@repo/ui/components/dialog'
import { FieldDescription } from '@repo/ui/components/field'
import { FormItem } from '@repo/ui/components/form'
import { Label } from '@repo/ui/components/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select'
import { Spinner } from '@repo/ui/components/spinner'
import { useForm } from '@tanstack/vue-form'
import { toast } from 'vue-sonner'
import { z } from 'zod'

import type { IClientUser, UserStatus } from '@/services/types/user.type'

import FormTextField from '@/components/form-text-field.vue'
import { nicknameField } from '@/pages/auth/validators/auth.validator'
import { useUpdateAdminUserMutation } from '@/services/api/admin-users.api'

import { userStatuses } from '../data/data'

const props = defineProps<{ user: IClientUser }>()
const open = defineModel<boolean>('open', { default: false })

const update = useUpdateAdminUserMutation()

const validator = z.object({
  nickname: nicknameField,
  status: z.enum(['active', 'disabled']),
})

function initialValues(user: IClientUser): z.infer<typeof validator> {
  return { nickname: user.nickname, status: user.status }
}

const form = useForm({
  defaultValues: initialValues(props.user),
  validators: { onSubmit: validator },
  onSubmit: async ({ value }) => {
    const original = initialValues(props.user)
    const nickname = value.nickname.trim()
    try {
      await update.mutateAsync({
        id: props.user.id,
        nickname: nickname !== original.nickname ? nickname : undefined,
        status: value.status !== original.status ? value.status : undefined,
      })
    }
    catch {
      return // Toasted by the global mutation handler.
    }
    toast.success('User updated.')
    open.value = false
  },
})

watch(open, (isOpen) => {
  if (isOpen)
    form.reset(initialValues(props.user))
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Edit user</DialogTitle>
        <DialogDescription>{{ user.email }}</DialogDescription>
      </DialogHeader>

      <form id="user-edit-form" class="grid gap-6" novalidate @submit.prevent="form.handleSubmit">
        <form.Field name="nickname">
          <template #default="{ field }">
            <FormTextField :field="field" label="Nickname" />
          </template>
        </form.Field>

        <form.Field name="status">
          <template #default="{ field }">
            <FormItem>
              <Label>Status</Label>
              <Select :model-value="field.state.value" @update:model-value="field.handleChange($event as UserStatus)">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="status in userStatuses" :key="status.value" :value="status.value">
                    {{ status.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>Disabling signs the user out of the client app everywhere.</FieldDescription>
            </FormItem>
          </template>
        </form.Field>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button type="submit" form="user-edit-form" :disabled="update.isPending.value">
          <Spinner v-if="update.isPending.value" class="mr-2" />
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
