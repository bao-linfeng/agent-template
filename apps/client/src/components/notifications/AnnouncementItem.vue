<script setup lang="ts">
import type { Announcement, AnnouncementLevel } from '@/lib/notifications'
import { Badge } from '@repo/ui/components/badge'
import { cn } from '@repo/ui/lib/utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotificationActions } from '@/composables/useNotifications'

/** One announcement; clicking it marks it read. The body is plain text. */
const props = defineProps<{
  announcement: Announcement
  /** Clamps the body to three lines (bell popover). */
  compact?: boolean
}>()

const { t, locale } = useI18n()
const { markAnnouncementRead } = useNotificationActions()
const unread = computed(() => props.announcement.readAt === null)

const levelVariants: Record<AnnouncementLevel, 'secondary' | 'default' | 'destructive'> = {
  info: 'secondary',
  warning: 'default',
  critical: 'destructive',
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(locale.value, { dateStyle: 'medium', timeStyle: 'short' })
}

function read() {
  if (unread.value)
    markAnnouncementRead.mutate(props.announcement.id)
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
          {{ t(`notifications.levels.${announcement.level}`) }}
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
        <time :datetime="announcement.publishedAt">{{ formatDate(announcement.publishedAt) }}</time>
        <template v-if="announcement.expiresAt">
          · {{ t('notifications.expiresAt', { date: formatDate(announcement.expiresAt) }) }}
        </template>
      </p>
    </div>
  </div>
</template>
