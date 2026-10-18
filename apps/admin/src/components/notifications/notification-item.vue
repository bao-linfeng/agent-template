<script setup lang="ts">
import { CheckIcon, Trash2Icon } from '@lucide/vue'
import { Button } from '@repo/ui/components/button'
import { cn } from '@repo/ui/lib/utils'
import dayjs from 'dayjs'

import type { INotification } from '@/services/api/notifications.api'

import { isAppLink, notificationText } from '@/lib/notifications'
import { useDeleteNotificationMutation, useMarkNotificationReadMutation } from '@/services/api/notifications.api'

/** One personal notification; clicking it marks it read and opens its link. */
const props = defineProps<{
  notification: INotification
  /** Shows the delete button (notification center). */
  removable?: boolean
  /** Clamps the body to two lines (bell popover). */
  compact?: boolean
}>()
const emit = defineEmits<{ navigate: [] }>()

const router = useRouter()
const markRead = useMarkNotificationReadMutation()
const remove = useDeleteNotificationMutation()
const text = computed(() => notificationText(props.notification))
const unread = computed(() => props.notification.readAt === null)
const link = computed(() => isAppLink(props.notification.link) ? props.notification.link : null)

function open() {
  if (unread.value)
    markRead.mutate(props.notification.id)
  if (link.value) {
    emit('navigate')
    void router.push(link.value)
  }
}
</script>

<template>
  <div
    :class="cn('group flex gap-3 rounded-md px-3 py-2.5 text-sm transition-colors', link || unread ? 'cursor-pointer hover:bg-accent' : '')"
    role="button"
    tabindex="0"
    @click="open"
    @keydown.enter="open"
  >
    <span :class="cn('mt-1.5 size-2 shrink-0 rounded-full', unread ? 'bg-primary' : 'bg-transparent')" aria-hidden="true" />
    <div class="grid min-w-0 flex-1 gap-0.5">
      <p :class="cn('leading-snug', unread ? 'font-medium' : 'text-muted-foreground')">
        {{ text.title }}
      </p>
      <p v-if="text.body" :class="cn('text-muted-foreground', compact ? 'line-clamp-2' : '')">
        {{ text.body }}
      </p>
      <time class="text-xs text-muted-foreground" :datetime="notification.createdAt" :title="dayjs(notification.createdAt).format('YYYY-MM-DD HH:mm:ss')">
        {{ dayjs(notification.createdAt).fromNow() }}
      </time>
    </div>
    <div v-if="!compact" class="flex shrink-0 items-start gap-1">
      <Button
        v-if="unread"
        variant="ghost"
        size="icon"
        class="size-8"
        :title="$t('notifications.markRead')"
        :disabled="markRead.isPending.value"
        @click.stop="markRead.mutate(notification.id)"
      >
        <CheckIcon class="size-4" />
        <span class="sr-only">{{ $t('notifications.markRead') }}</span>
      </Button>
      <Button
        v-if="removable"
        variant="ghost"
        size="icon"
        class="size-8 text-muted-foreground hover:text-destructive"
        :title="$t('common.delete')"
        :disabled="remove.isPending.value"
        @click.stop="remove.mutate(notification.id)"
      >
        <Trash2Icon class="size-4" />
        <span class="sr-only">{{ $t('common.delete') }}</span>
      </Button>
    </div>
  </div>
</template>
