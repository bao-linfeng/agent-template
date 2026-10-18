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
import type { IAnnouncement } from '@/services/api/announcements.api'

import { t } from '@/plugins/i18n'
import {
  useDeleteAnnouncementMutation,
  usePublishAnnouncementMutation,
  useWithdrawAnnouncementMutation,
} from '@/services/api/announcements.api'

import AnnouncementDialog from './announcement-dialog.vue'

const props = defineProps<{
  row: DataTableRow<IAnnouncement>
}>()

const announcement = computed(() => props.row.original)
const isOpen = shallowRef(false)
// Mounted on first use so a page of rows does not create a form per row.
const dialogMounted = shallowRef(false)
watch(isOpen, (open) => {
  if (open)
    dialogMounted.value = true
})
const confirmingDelete = shallowRef(false)
const publish = usePublishAnnouncementMutation()
const withdraw = useWithdrawAnnouncementMutation()
const remove = useDeleteAnnouncementMutation()

async function run(action: () => Promise<unknown>, message: string) {
  try {
    await action()
  }
  catch {
    return // Toasted by the global mutation handler.
  }
  toast.success(message)
}

function onPublish() {
  void run(() => publish.mutateAsync(announcement.value.id), t('announcements.published'))
}

function onWithdraw() {
  void run(() => withdraw.mutateAsync(announcement.value.id), t('announcements.withdrawn'))
}

function onDelete() {
  confirmingDelete.value = false
  void run(() => remove.mutateAsync(announcement.value.id), t('announcements.deleted'))
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
      <DropdownMenuItem v-if="announcement.status === 'draft'" :disabled="publish.isPending.value" @click="onPublish">
        {{ $t('announcements.publish') }}
      </DropdownMenuItem>
      <DropdownMenuItem v-else :disabled="withdraw.isPending.value" @click="onWithdraw">
        {{ $t('announcements.withdraw') }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem class="text-destructive" @click="confirmingDelete = true">
        {{ $t('common.delete') }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <AnnouncementDialog v-if="dialogMounted" v-model:open="isOpen" :announcement="announcement" />

  <AlertDialog v-model:open="confirmingDelete">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ $t('announcements.deleteTitle', { title: announcement.title }) }}</AlertDialogTitle>
        <AlertDialogDescription>{{ $t('announcements.deleteDescription') }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t('common.cancel') }}</AlertDialogCancel>
        <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="onDelete">
          {{ $t('common.delete') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
