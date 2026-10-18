<script setup lang="ts">
import { Badge } from '@repo/ui/components/badge'
import { cn } from '@repo/ui/lib/utils'
import dayjs from 'dayjs'

import type { AnnouncementLevel, IInboxAnnouncement } from '@/services/api/notifications.api'

import { useMarkAnnouncementReadMutation } from '@/services/api/notifications.api'

/** One announcement in the inbox; clicking it marks it read. The body is plain text. */
const props = defineProps<{
  announcement: IInboxAnnouncement
  /** Clamps the body to three lines (bell popover). */
  compact?: boolean
}>()

const markRead = useMarkAnnouncementReadMutation()
const unread = computed(() => props.announcement.readAt === null)

const levelVariants: Record<AnnouncementLevel, 'secondary' | 'default' | 'destructive'> = {
  info: 'secondary',
  warning: 'default',
  critical: 'destructive',
}

function read() {
  if (unread.value)
    markRead.mutate(props.announcement.id)
}
</script>

<template>
  <div
    :class="cn('flex gap-3 rounded-md px-3 py-2.5 text-sm', unread ? 'cursor-pointer hover:bg-accent' : '')"
    role="button"
    tabindex="0"
    @click="read"
    @keydown.enter="read"
  >
    <span :class="cn('mt-1.5 size-2 shrink-0 rounded-full', unread ? 'bg-primary' : 'bg-transparent')" aria-hidden="true" />
    <div class="grid min-w-0 flex-1 gap-1">
      <div class="flex flex-wrap items-center gap-2">
        <Badge :variant="levelVariants[announcement.level]">
          {{ $t(`notifications.levels.${announcement.level}`) }}
        </Badge>
        <p :class="cn('leading-snug', unread ? 'font-medium' : 'text-muted-foreground')">
          {{ announcement.title }}
        </p>
      </div>
      <!-- Plain text from administrators: interpolated (escaped), line breaks kept. -->
      <p :class="cn('whitespace-pre-line text-muted-foreground', compact ? 'line-clamp-3' : '')">
        {{ announcement.body }}
      </p>
      <p class="text-xs text-muted-foreground">
        <time :datetime="announcement.publishedAt">{{ dayjs(announcement.publishedAt).fromNow() }}</time>
        <template v-if="announcement.expiresAt">
          · {{ $t('notifications.expiresAt', { date: dayjs(announcement.expiresAt).format('YYYY-MM-DD HH:mm') }) }}
        </template>
      </p>
    </div>
  </div>
</template>
