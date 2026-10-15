<script setup lang="ts">
import { EllipsisIcon } from '@lucide/vue'
import { Button } from '@repo/ui/components/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@repo/ui/components/dropdown-menu'

import type { DataTableRow } from '@/components/data-table'
import type { IClientUser } from '@/services/types/user.type'

import { useUpdateAdminUserMutation } from '@/services/api/admin-users.api'

import UserEditDialog from './user-edit-dialog.vue'

const props = defineProps<{
  row: DataTableRow<IClientUser>
}>()

const user = computed(() => props.row.original)
const isOpen = shallowRef(false)
// Mounted on first use so a page of rows does not create a form per row.
const dialogMounted = shallowRef(false)
watch(isOpen, (open) => {
  if (open)
    dialogMounted.value = true
})
const update = useUpdateAdminUserMutation()

function toggleStatus() {
  update.mutate({ id: user.value.id, status: user.value.status === 'active' ? 'disabled' : 'active' })
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
        :disabled="update.isPending.value"
        :class="user.status === 'active' ? 'text-destructive' : ''"
        @click="toggleStatus"
      >
        {{ user.status === 'active' ? $t('common.disable') : $t('common.enable') }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <UserEditDialog v-if="dialogMounted" v-model:open="isOpen" :user="user" />
</template>
