<script setup lang="ts">
import { LockIcon, PencilIcon, PlusIcon, Trash2Icon } from '@lucide/vue'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Skeleton } from '@repo/ui/components/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@repo/ui/components/table'
import { toast } from 'vue-sonner'

import type { IRole } from '@/services/api/roles.api'

import ConfirmDialog from '@/components/confirm-dialog.vue'
import { BasicPage } from '@/components/global-layout'
import { t } from '@/plugins/i18n'
import { useDeleteRoleMutation, useRolesQuery } from '@/services/api/roles.api'
import { useAuthStore } from '@/stores/auth'

import RoleDialog from './components/role-dialog.vue'

const authStore = useAuthStore()
const { data: roles, isPending } = useRolesQuery()
const remove = useDeleteRoleMutation()

const editing = shallowRef<IRole>()
const dialogOpen = shallowRef(false)
const deleting = shallowRef<IRole>()
const confirmOpen = shallowRef(false)

function openDialog(role?: IRole) {
  editing.value = role
  dialogOpen.value = true
}

function askDelete(role: IRole) {
  deleting.value = role
  confirmOpen.value = true
}

function confirmDelete() {
  const role = deleting.value
  if (role)
    remove.mutate(role.id, { onSuccess: () => toast.success(t('roles.deleted', { name: role.name })) })
}
</script>

<template>
  <BasicPage :title="$t('roles.title')" :description="$t('roles.description')" sticky>
    <template #actions>
      <Button v-if="authStore.can('role:create')" @click="openDialog()">
        <PlusIcon />
        {{ $t('roles.newRole') }}
      </Button>
    </template>

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ $t('roles.role') }}</TableHead>
            <TableHead>{{ $t('fields.permissions') }}</TableHead>
            <TableHead class="w-[80px] text-right">
              {{ $t('roles.admins') }}
            </TableHead>
            <TableHead class="w-[100px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="isPending">
            <TableRow v-for="i in 3" :key="i">
              <TableCell colspan="4">
                <Skeleton class="h-8 w-full" />
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-for="role in roles" :key="role.id">
            <TableCell class="align-top">
              <div class="flex items-center gap-2 font-medium">
                {{ role.name }}
                <Badge v-if="role.isSystem" variant="outline" class="gap-1">
                  <LockIcon class="size-3" />
                  {{ $t('roles.system') }}
                </Badge>
              </div>
              <code class="text-xs text-muted-foreground">{{ role.code }}</code>
              <p v-if="role.description" class="text-xs text-muted-foreground">
                {{ role.description }}
              </p>
            </TableCell>
            <TableCell class="align-top whitespace-normal">
              <div class="flex flex-wrap gap-1">
                <Badge v-for="permission in role.permissions" :key="permission" variant="secondary">
                  {{ permission }}
                </Badge>
                <span v-if="!role.permissions.length" class="text-sm text-muted-foreground">{{ $t('common.none') }}</span>
              </div>
            </TableCell>
            <TableCell class="align-top text-right tabular-nums">
              {{ role.userCount }}
            </TableCell>
            <TableCell class="align-top text-right">
              <Button v-if="authStore.can('role:update')" variant="ghost" size="icon" :title="$t('common.edit')" @click="openDialog(role)">
                <PencilIcon />
              </Button>
              <Button
                v-if="authStore.can('role:delete') && !role.isSystem"
                variant="ghost"
                size="icon"
                :title="$t('common.delete')"
                class="text-destructive"
                @click="askDelete(role)"
              >
                <Trash2Icon />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <RoleDialog v-model:open="dialogOpen" :role="editing" />

    <ConfirmDialog
      v-model:open="confirmOpen"
      destructive
      :confirm-button-text="$t('common.delete')"
      :is-loading="remove.isPending.value"
      @confirm="confirmDelete"
    >
      <template #title>
        {{ $t('roles.deleteTitle', { name: deleting?.name }) }}
      </template>
      <template #description>
        <p>{{ deleting?.userCount ? $t('roles.deleteAffects', { count: deleting.userCount }) : $t('roles.deleteUnused') }}</p>
      </template>
    </ConfirmDialog>
  </BasicPage>
</template>

<route lang="yaml">
meta:
  permission: role:read
</route>
