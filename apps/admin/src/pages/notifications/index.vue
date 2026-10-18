<script setup lang="ts">
import { CheckCheckIcon, ChevronLeftIcon, ChevronRightIcon } from '@lucide/vue'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent } from '@repo/ui/components/card'
import { Label } from '@repo/ui/components/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select'
import { Switch } from '@repo/ui/components/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/tabs'

import { BasicPage } from '@/components/global-layout'
import AnnouncementItem from '@/components/notifications/announcement-item.vue'
import NotificationItem from '@/components/notifications/notification-item.vue'
import { categoryLabel } from '@/lib/notifications'
import {
  useInboxAnnouncementsQuery,
  useMarkAllAnnouncementsReadMutation,
  useMarkAllNotificationsReadMutation,
  useNotificationPreferencesQuery,
  useNotificationsQuery,
  useUnreadCountQuery,
} from '@/services/api/notifications.api'

const PAGE_SIZE = 20

type Tab = 'notifications' | 'announcements'

const route = useRoute()
const router = useRouter()
const tab = computed<Tab>({
  get: () => (route.query.tab === 'announcements' ? 'announcements' : 'notifications'),
  set: value => void router.replace({ query: value === 'announcements' ? { tab: value } : {} }),
})

const unreadOnly = shallowRef(false)
const category = shallowRef('all')
const page = shallowRef(1)
const announcementPage = shallowRef(1)
watch([unreadOnly, category], () => {
  page.value = 1
})

const { data: count } = useUnreadCountQuery()
// Categories of this realm, for the filter.
const { data: preferences } = useNotificationPreferencesQuery()
const { data: notifications, isPending } = useNotificationsQuery(() => ({
  page: page.value,
  pageSize: PAGE_SIZE,
  unread: unreadOnly.value || undefined,
  category: category.value === 'all' ? undefined : category.value,
}))
const { data: announcements, isPending: announcementsPending } = useInboxAnnouncementsQuery(() => ({
  page: announcementPage.value,
  pageSize: PAGE_SIZE,
}))
const markAllNotifications = useMarkAllNotificationsReadMutation()
const markAllAnnouncements = useMarkAllAnnouncementsReadMutation()

function pageCount(total = 0) {
  return Math.max(1, Math.ceil(total / PAGE_SIZE))
}

// Deleting the last item of a page moves back one page.
watch(() => notifications.value?.total, (total) => {
  if (total !== undefined && page.value > pageCount(total))
    page.value = pageCount(total)
})
</script>

<template>
  <BasicPage :title="$t('notifications.title')" :description="$t('notifications.description')">
    <Tabs v-model="tab">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="notifications">
            {{ $t('notifications.tabs.notifications') }}
            <span v-if="count?.notifications" class="text-xs text-muted-foreground">{{ count.notifications }}</span>
          </TabsTrigger>
          <TabsTrigger value="announcements">
            {{ $t('notifications.tabs.announcements') }}
            <span v-if="count?.announcements" class="text-xs text-muted-foreground">{{ count.announcements }}</span>
          </TabsTrigger>
        </TabsList>
        <Button
          v-if="tab === 'notifications'"
          variant="outline"
          size="sm"
          :disabled="!count?.notifications || markAllNotifications.isPending.value"
          @click="markAllNotifications.mutate(undefined)"
        >
          <CheckCheckIcon class="size-4" />
          {{ $t('notifications.markAllRead') }}
        </Button>
        <Button
          v-else
          variant="outline"
          size="sm"
          :disabled="!count?.announcements || markAllAnnouncements.isPending.value"
          @click="markAllAnnouncements.mutate(undefined)"
        >
          <CheckCheckIcon class="size-4" />
          {{ $t('notifications.markAllRead') }}
        </Button>
      </div>

      <TabsContent value="notifications" class="grid gap-3">
        <div class="flex flex-wrap items-center gap-4">
          <div class="flex items-center gap-2">
            <Switch id="unread-only" v-model="unreadOnly" />
            <Label for="unread-only">{{ $t('notifications.unreadOnly') }}</Label>
          </div>
          <Select v-model="category">
            <SelectTrigger size="sm" class="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {{ $t('notifications.allCategories') }}
              </SelectItem>
              <SelectItem v-for="item in preferences" :key="item.category" :value="item.category">
                {{ categoryLabel(item.category, item.description) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card class="py-2">
          <CardContent class="px-2">
            <div v-if="notifications?.items.length" class="grid gap-0.5">
              <NotificationItem v-for="item in notifications.items" :key="item.id" :notification="item" removable />
            </div>
            <p v-else-if="!isPending" class="py-10 text-center text-sm text-muted-foreground">
              {{ unreadOnly ? $t('notifications.emptyUnread') : $t('notifications.empty') }}
            </p>
          </CardContent>
        </Card>
        <div v-if="pageCount(notifications?.total) > 1" class="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span>{{ page }} / {{ pageCount(notifications?.total) }}</span>
          <Button variant="outline" size="icon" class="size-8" :disabled="page <= 1" @click="page--">
            <ChevronLeftIcon class="size-4" />
          </Button>
          <Button variant="outline" size="icon" class="size-8" :disabled="page >= pageCount(notifications?.total)" @click="page++">
            <ChevronRightIcon class="size-4" />
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="announcements" class="grid gap-3">
        <Card class="py-2">
          <CardContent class="px-2">
            <div v-if="announcements?.items.length" class="grid gap-0.5">
              <AnnouncementItem v-for="item in announcements.items" :key="item.id" :announcement="item" />
            </div>
            <p v-else-if="!announcementsPending" class="py-10 text-center text-sm text-muted-foreground">
              {{ $t('notifications.emptyAnnouncements') }}
            </p>
          </CardContent>
        </Card>
        <div v-if="pageCount(announcements?.total) > 1" class="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span>{{ announcementPage }} / {{ pageCount(announcements?.total) }}</span>
          <Button variant="outline" size="icon" class="size-8" :disabled="announcementPage <= 1" @click="announcementPage--">
            <ChevronLeftIcon class="size-4" />
          </Button>
          <Button variant="outline" size="icon" class="size-8" :disabled="announcementPage >= pageCount(announcements?.total)" @click="announcementPage++">
            <ChevronRightIcon class="size-4" />
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  </BasicPage>
</template>
