<script setup lang="ts">
import { Button } from '@repo/ui/components/button'
import { Checkbox } from '@repo/ui/components/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@repo/ui/components/dialog'
import { FieldDescription } from '@repo/ui/components/field'
import { FormItem } from '@repo/ui/components/form'
import { Label } from '@repo/ui/components/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select'
import { Spinner } from '@repo/ui/components/spinner'
import { useForm } from '@tanstack/vue-form'
import { toast } from 'vue-sonner'
import { z } from 'zod'

import type { IAdminUser, UserStatus } from '@/services/types/user.type'

import FormTextField from '@/components/form-text-field.vue'
import { nicknameField } from '@/pages/auth/validators/auth.validator'
import { useUpdateAdminUserMutation } from '@/services/api/admin-users.api'
import { useRolesQuery } from '@/services/api/roles.api'
import { useAuthStore } from '@/stores/auth'

import { userStatuses } from '../data/data'

const props = defineProps<{ user: IAdminUser }>()
const open = defineModel<boolean>('open', { default: false })

const authStore = useAuthStore()
const isSelf = computed(() => props.user.id === authStore.user?.id)
// Listing roles needs `role:read`; without it the roles stay read-only.
const canEditRoles = computed(() => authStore.can('role:read'))
const { data: roles } = useRolesQuery(canEditRoles)
const update = useUpdateAdminUserMutation()

const validator = z.object({
  nickname: nicknameField,
  status: z.enum(['active', 'disabled']),
  roleIds: z.array(z.string()),
})

function initialValues(user: IAdminUser): z.infer<typeof validator> {
  return { nickname: user.nickname, status: user.status, roleIds: user.roles.map(role => role.id) }
}

function sameRoles(a: string[], b: string[]) {
  return a.length === b.length && a.every(id => b.includes(id))
}

const form = useForm({
  defaultValues: initialValues(props.user),
  validators: { onSubmit: validator },
  onSubmit: async ({ value }) => {
    const original = initialValues(props.user)
    try {
      await update.mutateAsync({
        id: props.user.id,
        nickname: value.nickname.trim() !== original.nickname ? value.nickname.trim() : undefined,
        status: value.status !== original.status ? value.status : undefined,
        roleIds: canEditRoles.value && !sameRoles(value.roleIds, original.roleIds) ? value.roleIds : undefined,
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

function toggleRole(ids: string[], id: string, checked: boolean | 'indeterminate') {
  return checked === true ? [...new Set([...ids, id])] : ids.filter(item => item !== id)
}
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
              <Select
                :model-value="field.state.value"
                :disabled="isSelf"
                @update:model-value="field.handleChange($event as UserStatus)"
              >
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="status in userStatuses" :key="status.value" :value="status.value">
                    {{ status.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                {{ isSelf ? 'You cannot disable your own account.' : 'Disabling signs the user out everywhere.' }}
              </FieldDescription>
            </FormItem>
          </template>
        </form.Field>

        <form.Field name="roleIds">
          <template #default="{ field }">
            <FormItem>
              <Label>Roles</Label>
              <div v-if="canEditRoles" class="grid gap-2">
                <label v-for="role in roles" :key="role.id" class="flex items-start gap-2 text-sm">
                  <Checkbox
                    :model-value="field.state.value.includes(role.id)"
                    @update:model-value="field.handleChange(toggleRole(field.state.value, role.id, $event))"
                  />
                  <span class="grid">
                    <span class="font-medium">{{ role.name }} <span class="text-muted-foreground">({{ role.code }})</span></span>
                    <span v-if="role.description" class="text-xs text-muted-foreground">{{ role.description }}</span>
                  </span>
                </label>
              </div>
              <p v-else class="text-sm text-muted-foreground">
                {{ user.roles.map(role => role.name).join(', ') || 'No roles' }}
              </p>
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
