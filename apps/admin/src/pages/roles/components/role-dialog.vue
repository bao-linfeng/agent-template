<script setup lang="ts">
import { Button } from '@repo/ui/components/button'
import { Checkbox } from '@repo/ui/components/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@repo/ui/components/dialog'
import { FieldDescription, FieldError } from '@repo/ui/components/field'
import { FormItem } from '@repo/ui/components/form'
import { Label } from '@repo/ui/components/label'
import { Spinner } from '@repo/ui/components/spinner'
import { useForm } from '@tanstack/vue-form'
import { toast } from 'vue-sonner'
import { z } from 'zod'

import type { IPermission, IRole } from '@/services/api/roles.api'

import FormTextField from '@/components/form-text-field.vue'
import { ALL_PERMISSIONS } from '@/lib/permissions'
import { usePermissionsQuery, useSaveRoleMutation } from '@/services/api/roles.api'

/** `role` undefined creates a new role. */
const props = defineProps<{ role?: IRole }>()
const open = defineModel<boolean>('open', { default: false })

const { data: permissions } = usePermissionsQuery()
const save = useSaveRoleMutation()

const isSuperAdmin = computed(() => props.role?.isSystem === true && props.role.permissions.includes(ALL_PERMISSIONS))

/** Permission catalog grouped by subject (`user:read` -> `user`). */
const permissionGroups = computed(() => {
  const groups = new Map<string, IPermission[]>()
  for (const permission of permissions.value ?? []) {
    const subject = permission.code.split(':')[0]!
    groups.set(subject, [...(groups.get(subject) ?? []), permission])
  }
  return [...groups]
})

const validator = z.object({
  code: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/, { error: 'Lower snake case, 2-64 characters, e.g. content_editor.' }),
  name: z.string().trim().min(1, { error: 'Please enter a name.' }).max(100),
  description: z.string().max(500),
  permissions: z.array(z.string()),
})

function initialValues(role?: IRole): z.infer<typeof validator> {
  return {
    code: role?.code ?? '',
    name: role?.name ?? '',
    description: role?.description ?? '',
    permissions: role ? [...role.permissions] : [],
  }
}

const form = useForm({
  defaultValues: initialValues(props.role),
  validators: { onSubmit: validator },
  onSubmit: async ({ value }) => {
    const name = value.name.trim()
    const description = value.description.trim()
    try {
      if (props.role) {
        // super_admin's permissions are fixed by the server.
        const permissions = isSuperAdmin.value ? {} : { permissions: value.permissions }
        await save.mutateAsync({ id: props.role.id, body: { name, description, ...permissions } })
      }
      else {
        await save.mutateAsync({
          body: { code: value.code, name, description: description || undefined, permissions: value.permissions },
        })
      }
    }
    catch {
      return // Toasted by the global mutation handler.
    }
    toast.success(props.role ? 'Role updated.' : 'Role created.')
    open.value = false
  },
})

watch(open, (isOpen) => {
  if (isOpen)
    form.reset(initialValues(props.role))
})

function togglePermission(codes: string[], code: string, checked: boolean | 'indeterminate') {
  return checked === true ? [...new Set([...codes, code])] : codes.filter(item => item !== code)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{{ role ? 'Edit role' : 'New role' }}</DialogTitle>
        <DialogDescription>
          Users get the union of the permissions of all their roles. Changes apply immediately.
        </DialogDescription>
      </DialogHeader>

      <form id="role-form" class="grid gap-5" novalidate @submit.prevent="form.handleSubmit">
        <form.Field name="code">
          <template #default="{ field }">
            <FormTextField
              :field="field"
              label="Code"
              placeholder="content_editor"
              :disabled="!!role"
              :description="role ? 'The code cannot be changed.' : 'Stable identifier used in code and seeds.'"
            />
          </template>
        </form.Field>
        <form.Field name="name">
          <template #default="{ field }">
            <FormTextField :field="field" label="Name" placeholder="Content editor" />
          </template>
        </form.Field>
        <form.Field name="description">
          <template #default="{ field }">
            <FormTextField :field="field" label="Description" placeholder="Optional" />
          </template>
        </form.Field>

        <form.Field name="permissions">
          <template #default="{ field, state }">
            <FormItem>
              <Label>Permissions</Label>
              <FieldDescription v-if="isSuperAdmin">
                super_admin always has every permission.
              </FieldDescription>
              <div v-else class="grid gap-4 rounded-md border p-3">
                <div v-for="[subject, items] in permissionGroups" :key="subject" class="grid gap-2">
                  <span class="text-xs font-semibold uppercase text-muted-foreground">{{ subject }}</span>
                  <label v-for="permission in items" :key="permission.code" class="flex items-start gap-2 text-sm">
                    <Checkbox
                      :model-value="field.state.value.includes(permission.code)"
                      @update:model-value="field.handleChange(togglePermission(field.state.value, permission.code, $event))"
                    />
                    <span class="grid">
                      <code class="text-xs">{{ permission.code }}</code>
                      <span class="text-muted-foreground">{{ permission.description }}</span>
                    </span>
                  </label>
                </div>
              </div>
              <FieldError :errors="state.meta.errors" />
            </FormItem>
          </template>
        </form.Field>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button type="submit" form="role-form" :disabled="save.isPending.value">
          <Spinner v-if="save.isPending.value" class="mr-2" />
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
