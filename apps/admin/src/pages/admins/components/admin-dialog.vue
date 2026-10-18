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

import type { IAdminAccount, UserStatus } from '@/services/types/user.type'

import FormTextField from '@/components/form-text-field.vue'
import { coversPermissions } from '@/lib/permissions'
import { emailField, newPasswordField, nicknameField } from '@/pages/auth/validators/auth.validator'
import { userStatuses } from '@/pages/users/data/data'
import { t } from '@/plugins/i18n'
import { useCreateAdminMutation, useUpdateAdminMutation } from '@/services/api/admins.api'
import { useRolesQuery } from '@/services/api/roles.api'
import { useAuthStore } from '@/stores/auth'

/** Creates an admin account when `admin` is omitted, otherwise edits it. */
const props = defineProps<{ admin?: IAdminAccount }>()
const open = defineModel<boolean>('open', { default: false })

const authStore = useAuthStore()
const isCreate = computed(() => !props.admin)
const isSelf = computed(() => props.admin?.id === authStore.user?.id)
// Listing roles needs `role:read`; without it the roles stay read-only.
const canEditRoles = computed(() => authStore.can('role:read'))
const { data: roles } = useRolesQuery(canEditRoles)
/** Roles with permissions the signed-in admin lacks cannot be assigned or removed (`PERMISSIONS_EXCEED_OWN`). */
function canGrant(role: { permissions: string[] }) {
  return coversPermissions(authStore.user?.permissions ?? [], role.permissions)
}
const create = useCreateAdminMutation()
const update = useUpdateAdminMutation()
const pending = computed(() => create.isPending.value || update.isPending.value)

const validator = z.object({
  email: z.string(),
  password: z.string(),
  nickname: nicknameField,
  status: z.enum(['active', 'disabled']),
  roleIds: z.array(z.string()),
})
// Email and password are only entered when creating.
const createValidator = validator.extend({ email: emailField, password: newPasswordField })

type FormValues = z.infer<typeof validator>

// Create and edit dialogs are separate instances, so the mode does not change after setup.
const schema: z.ZodType<FormValues, FormValues> = props.admin ? validator : createValidator

function initialValues(admin?: IAdminAccount): FormValues {
  return {
    email: '',
    password: '',
    nickname: admin?.nickname ?? '',
    status: admin?.status ?? 'active',
    roleIds: admin?.roles.map(role => role.id) ?? [],
  }
}

function sameRoles(a: string[], b: string[]) {
  return a.length === b.length && a.every(id => b.includes(id))
}

async function save(value: FormValues) {
  const nickname = value.nickname.trim()
  if (!props.admin) {
    await create.mutateAsync({
      email: value.email.trim(),
      password: value.password,
      nickname,
      roleIds: canEditRoles.value ? value.roleIds : undefined,
    })
    toast.success(t('admins.created', { email: value.email.trim() }))
    return
  }
  const original = initialValues(props.admin)
  await update.mutateAsync({
    id: props.admin.id,
    nickname: nickname !== original.nickname ? nickname : undefined,
    status: value.status !== original.status ? value.status : undefined,
    roleIds: canEditRoles.value && !sameRoles(value.roleIds, original.roleIds) ? value.roleIds : undefined,
  })
  toast.success(t('admins.updated'))
}

const form = useForm({
  defaultValues: initialValues(props.admin),
  validators: { onSubmit: schema },
  onSubmit: async ({ value }) => {
    try {
      await save(value)
    }
    catch {
      return // Toasted by the global mutation handler.
    }
    open.value = false
  },
})

watch(open, (isOpen) => {
  if (isOpen)
    form.reset(initialValues(props.admin))
})

function toggleRole(ids: string[], id: string, checked: boolean | 'indeterminate') {
  return checked === true ? [...new Set([...ids, id])] : ids.filter(item => item !== id)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ isCreate ? $t('admins.newAdmin') : $t('admins.editTitle') }}</DialogTitle>
        <DialogDescription>
          {{ admin ? admin.email : $t('admins.createDescription') }}
        </DialogDescription>
      </DialogHeader>

      <form id="admin-form" class="grid gap-6" novalidate @submit.prevent="form.handleSubmit">
        <template v-if="isCreate">
          <form.Field name="email">
            <template #default="{ field }">
              <FormTextField :field="field" :label="$t('email')" type="email" autocomplete="off" />
            </template>
          </form.Field>
          <form.Field name="password">
            <template #default="{ field }">
              <FormTextField
                :field="field"
                :label="$t('admins.initialPassword')"
                type="password"
                autocomplete="new-password"
                :description="$t('admins.initialPasswordHint')"
              />
            </template>
          </form.Field>
        </template>

        <form.Field name="nickname">
          <template #default="{ field }">
            <FormTextField :field="field" :label="$t('fields.nickname')" />
          </template>
        </form.Field>

        <form.Field v-if="!isCreate" name="status">
          <template #default="{ field }">
            <FormItem>
              <Label>{{ $t('fields.status') }}</Label>
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
                    {{ $t(status.label) }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                {{ isSelf ? $t('admins.cannotDisableSelf') : $t('admins.statusHint') }}
              </FieldDescription>
            </FormItem>
          </template>
        </form.Field>

        <form.Field name="roleIds">
          <template #default="{ field }">
            <FormItem>
              <Label>{{ $t('fields.roles') }}</Label>
              <div v-if="canEditRoles" class="grid gap-2">
                <label
                  v-for="role in roles"
                  :key="role.id"
                  class="flex items-start gap-2 text-sm"
                  :class="{ 'opacity-60': !canGrant(role) }"
                >
                  <Checkbox
                    :model-value="field.state.value.includes(role.id)"
                    :disabled="!canGrant(role)"
                    @update:model-value="field.handleChange(toggleRole(field.state.value, role.id, $event))"
                  />
                  <span class="grid">
                    <span class="font-medium">{{ role.name }} <span class="text-muted-foreground">({{ role.code }})</span></span>
                    <span v-if="role.description" class="text-xs text-muted-foreground">{{ role.description }}</span>
                  </span>
                </label>
                <FieldDescription v-if="roles?.some(role => !canGrant(role))">
                  {{ $t('admins.rolesBeyondOwn') }}
                </FieldDescription>
              </div>
              <p v-else class="text-sm text-muted-foreground">
                {{ admin?.roles.map(role => role.name).join(', ') || $t('common.noRoles') }}
              </p>
            </FormItem>
          </template>
        </form.Field>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" @click="open = false">
          {{ $t('common.cancel') }}
        </Button>
        <Button type="submit" form="admin-form" :disabled="pending">
          <Spinner v-if="pending" class="mr-2" />
          {{ isCreate ? $t('admins.createSubmit') : $t('common.saveChanges') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
