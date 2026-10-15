<script setup lang="ts">
import { EllipsisIcon } from '@lucide/vue'
import { Button } from '@repo/ui/components/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@repo/ui/components/dropdown-menu'

import type { DataTableRow } from '@/components/data-table'
import type { IAdminAccount } from '@/services/types/user.type'

import { useUpdateAdminMutation } from '@/services/api/admins.api'
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

function toggleStatus() {
  update.mutate({ id: admin.value.id, status: admin.value.status === 'active' ? 'disabled' : 'active' })
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
    <DropdownMenuContent align="end" class="w-[160px]">
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
    </DropdownMenuContent>
  </DropdownMenu>

  <AdminDialog v-if="dialogMounted" v-model:open="isOpen" :admin="admin" />
</template>
