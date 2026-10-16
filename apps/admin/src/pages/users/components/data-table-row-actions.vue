<script setup lang="ts">
import { EllipsisIcon } from '@lucide/vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@repo/ui/components/alert-dialog'
import { Button } from '@repo/ui/components/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@repo/ui/components/dropdown-menu'
import { toast } from 'vue-sonner'

import type { DataTableRow } from '@/components/data-table'
import type { IClientUser } from '@/services/types/user.type'

import { t } from '@/plugins/i18n'
import { useAdminUserDeletionMutation, useUpdateAdminUserMutation } from '@/services/api/admin-users.api'

import UserEditDialog from './user-edit-dialog.vue'

const props = defineProps<{
  row: DataTableRow<IClientUser>
  /** `user:update`: edit, enable/disable. */
  canEdit: boolean
  /** `user:delete`: schedule or cancel deletion. */
  canDelete: boolean
}>()

const user = computed(() => props.row.original)
const isOpen = shallowRef(false)
const confirmingDeletion = shallowRef(false)
// Mounted on first use so a page of rows does not create a form per row.
const dialogMounted = shallowRef(false)
watch(isOpen, (open) => {
  if (open)
    dialogMounted.value = true
})
const update = useUpdateAdminUserMutation()
const deletion = useAdminUserDeletionMutation()

function toggleStatus() {
  update.mutate({ id: user.value.id, status: user.value.status === 'active' ? 'disabled' : 'active' })
}

async function setDeletion(pending: boolean) {
  confirmingDeletion.value = false
  try {
    await deletion.mutateAsync({ id: user.value.id, pending })
  }
  catch {
    return // Toasted by the global mutation handler.
  }
  toast.success(t(pending ? 'users.deletionScheduled' : 'users.deletionCancelled'))
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" class="flex h-8 w-8 p-0 data-[state=open]:bg-muted">
        <EllipsisIcon class="size-4" />
        <span class="sr-only">{{ $t('common.openMenu') }}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-[180px]">
      <template v-if="canEdit">
        <DropdownMenuItem @click="isOpen = true">
          {{ $t('common.edit') }}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          :disabled="update.isPending.value"
          :class="user.status === 'active' ? 'text-destructive' : ''"
          @click="toggleStatus"
        >
          {{ user.status === 'active' ? $t('common.disable') : $t('common.enable') }}
        </DropdownMenuItem>
      </template>
      <template v-if="canDelete">
        <DropdownMenuSeparator v-if="canEdit" />
        <DropdownMenuItem
          v-if="user.deletionScheduledAt"
          :disabled="deletion.isPending.value"
          @click="setDeletion(false)"
        >
          {{ $t('users.cancelDeletion') }}
        </DropdownMenuItem>
        <DropdownMenuItem
          v-else
          :disabled="deletion.isPending.value"
          class="text-destructive"
          @click="confirmingDeletion = true"
        >
          {{ $t('users.scheduleDeletion') }}
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>

  <UserEditDialog v-if="dialogMounted" v-model:open="isOpen" :user="user" />

  <AlertDialog v-model:open="confirmingDeletion">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ $t('users.deletionConfirmTitle', { email: user.email }) }}</AlertDialogTitle>
        <AlertDialogDescription>{{ $t('users.deletionConfirmDescription') }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t('common.cancel') }}</AlertDialogCancel>
        <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="setDeletion(true)">
          {{ $t('users.scheduleDeletion') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
