<script setup lang="ts">
import { Bell, CheckCheck } from '@lucide/vue'
import { Button } from '@repo/ui/components/button'
import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/popover'
import { ScrollArea } from '@repo/ui/components/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/tabs'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAnnouncementList, useNotificationActions, useNotificationList, useUnreadCount } from '@/composables/useNotifications'
import AnnouncementItem from './AnnouncementItem.vue'
import NotificationItem from './NotificationItem.vue'

/** Navbar bell of signed-in users: unread badge and the latest notifications and announcements. */
const PREVIEW_SIZE = 8

const { t } = useI18n()
const open = shallowRef(false)
const tab = shallowRef<'notifications' | 'announcements'>('notifications')
const { data: count } = useUnreadCount()
const { data: notifications } = useNotificationList({ pageSize: PREVIEW_SIZE }, open)
const { data: announcements } = useAnnouncementList({ pageSize: PREVIEW_SIZE }, open)
const { markAllRead, markAllAnnouncementsRead } = useNotificationActions()

const total = computed(() => count.value?.total ?? 0)
const badge = computed(() => (total.value > 99 ? '99+' : String(total.value)))
const unreadInTab = computed(() => (tab.value === 'notifications' ? count.value?.notifications : count.value?.announcements) ?? 0)

// Open on the announcements tab when only announcements are unread.
watch(open, (isOpen) => {
  if (isOpen)
    tab.value = !count.value?.notifications && count.value?.announcements ? 'announcements' : 'notifications'
})

function markAll() {
  if (tab.value === 'notifications')
    markAllRead.mutate()
  else
    markAllAnnouncementsRead.mutate()
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button variant="ghost" size="icon" class="relative" :aria-label="t('nav.notificationsUnread', { count: total })">
        <Bell class="size-5" />
        <span
          v-if="total > 0"
          class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-white"
          aria-hidden="true"
        >{{ badge }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" class="w-[360px] p-0">
      <Tabs v-model="tab" class="gap-0">
        <div class="flex items-center justify-between gap-2 border-b px-3 py-2">
          <TabsList>
            <TabsTrigger value="notifications">
              {{ t('notifications.tabs.notifications') }}
              <span v-if="count?.notifications" class="text-xs text-muted-foreground">{{ count.notifications }}</span>
            </TabsTrigger>
            <TabsTrigger value="announcements">
              {{ t('notifications.tabs.announcements') }}
              <span v-if="count?.announcements" class="text-xs text-muted-foreground">{{ count.announcements }}</span>
            </TabsTrigger>
          </TabsList>
          <Button variant="ghost" size="icon" class="size-8" :title="t('notifications.markAllRead')" :disabled="unreadInTab === 0" @click="markAll">
            <CheckCheck class="size-4" />
            <span class="sr-only">{{ t('notifications.markAllRead') }}</span>
          </Button>
        </div>
        <TabsContent value="notifications">
          <ScrollArea class="max-h-[420px]">
            <div v-if="notifications?.items.length" class="grid gap-0.5 p-1">
              <NotificationItem v-for="item in notifications.items" :key="item.id" :notification="item" compact @navigate="open = false" />
            </div>
            <p v-else class="px-4 py-8 text-center text-sm text-muted-foreground">
              {{ t('notifications.empty') }}
            </p>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="announcements">
          <ScrollArea class="max-h-[420px]">
            <div v-if="announcements?.items.length" class="grid gap-0.5 p-1">
              <AnnouncementItem v-for="item in announcements.items" :key="item.id" :announcement="item" compact />
            </div>
            <p v-else class="px-4 py-8 text-center text-sm text-muted-foreground">
              {{ t('notifications.emptyAnnouncements') }}
            </p>
          </ScrollArea>
        </TabsContent>
      </Tabs>
      <div class="border-t p-1">
        <Button variant="ghost" class="w-full" as-child @click="open = false">
          <RouterLink :to="{ path: '/notifications', query: tab === 'announcements' ? { tab } : undefined }">
            {{ t('notifications.viewAll') }}
          </RouterLink>
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
