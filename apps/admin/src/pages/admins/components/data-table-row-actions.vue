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
import type { IAdminAccount } from '@/services/types/user.type'

import { t } from '@/plugins/i18n'
import { useResetAdminMfaMutation, useUpdateAdminMutation } from '@/services/api/admins.api'
import { useAuthStore } from '@/stores/auth'

import AdminDialog from './admin-dialog.vue'

const props = defineProps<{
  row: DataTableRow<IAdminAccount>
}>()

const admin = computed(() => props.row.original)
const authStore = useAuthStore()
const isSelf = computed(() => admin.value.id === authStore.user?.id)
const isOpen = shallowRef(false)
// Mounted on first use so a page of rows does not create a form per row.
const dialogMounted = shallowRef(false)
watch(isOpen, (open) => {
  if (open)
    dialogMounted.value = true
})
const update = useUpdateAdminMutation()
const resetMfa = useResetAdminMfaMutation()
const confirmingMfaReset = shallowRef(false)

function toggleStatus() {
  update.mutate({ id: admin.value.id, status: admin.value.status === 'active' ? 'disabled' : 'active' })
}

async function onResetMfa() {
  confirmingMfaReset.value = false
  try {
    await resetMfa.mutateAsync(admin.value.id)
  }
  catch {
    return // Toasted by the global mutation handler.
  }
  toast.success(t('admins.mfaReset'))
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
      <DropdownMenuItem @click="isOpen = true">
        {{ $t('common.edit') }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        :disabled="isSelf || update.isPending.value"
        :class="admin.status === 'active' ? 'text-destructive' : ''"
        @click="toggleStatus"
      >
        {{ admin.status === 'active' ? $t('common.disable') : $t('common.enable') }}
      </DropdownMenuItem>
      <!-- Your own second factor is turned off in Settings (with password and code), not here. -->
      <DropdownMenuItem
        v-if="admin.mfaEnabled && !isSelf"
        :disabled="resetMfa.isPending.value"
        class="text-destructive"
        @click="confirmingMfaReset = true"
      >
        {{ $t('admins.resetMfa') }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <AdminDialog v-if="dialogMounted" v-model:open="isOpen" :admin="admin" />

  <AlertDialog v-model:open="confirmingMfaReset">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ $t('admins.resetMfaTitle', { email: admin.email }) }}</AlertDialogTitle>
        <AlertDialogDescription>{{ $t('admins.resetMfaDescription') }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t('common.cancel') }}</AlertDialogCancel>
        <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="onResetMfa">
          {{ $t('admins.resetMfa') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
