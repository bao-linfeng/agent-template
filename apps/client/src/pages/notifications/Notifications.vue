<script setup lang="ts">
import { CheckCheck } from '@lucide/vue'
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent } from '@repo/ui/components/card'
import { Label } from '@repo/ui/components/label'
import { Switch } from '@repo/ui/components/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/tabs'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AnnouncementItem from '@/components/notifications/AnnouncementItem.vue'
import NotificationItem from '@/components/notifications/NotificationItem.vue'
import { MainNavigation } from '@/components/sections/navbar'
import { useAnnouncementList, useNotificationActions, useNotificationList, useUnreadCount } from '@/composables/useNotifications'
import { errorMessage } from '@/lib/api'

const PAGE_SIZE = 20

type Tab = 'notifications' | 'announcements'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const tab = computed<Tab>({
  get: () => (route.query.tab === 'announcements' ? 'announcements' : 'notifications'),
  set: value => void router.replace({ query: value === 'announcements' ? { tab: value } : {} }),
})

const unreadOnly = shallowRef(false)
const page = shallowRef(1)
const announcementPage = shallowRef(1)
watch(unreadOnly, () => {
  page.value = 1
})

const { data: count } = useUnreadCount()
const { data: notifications, isPending, error } = useNotificationList(() => ({
  page: page.value,
  pageSize: PAGE_SIZE,
  unread: unreadOnly.value || undefined,
}))
const { data: announcements, isPending: announcementsPending } = useAnnouncementList(() => ({
  page: announcementPage.value,
  pageSize: PAGE_SIZE,
}))
const { markAllRead, markAllAnnouncementsRead } = useNotificationActions()

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
  <main class="min-h-screen">
    <MainNavigation />
    <div class="container mx-auto grid max-w-2xl gap-6 px-4 py-10">
      <div>
        <h1 class="text-2xl font-semibold">
          {{ t('notifications.title') }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ t('notifications.description') }}
        </p>
      </div>

      <Tabs v-model="tab">
        <div class="flex flex-wrap items-center justify-between gap-2">
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
          <Button
            v-if="tab === 'notifications'"
            variant="outline"
            size="sm"
            :disabled="!count?.notifications || markAllRead.isPending.value"
            @click="markAllRead.mutate()"
          >
            <CheckCheck class="size-4" />
            {{ t('notifications.markAllRead') }}
          </Button>
          <Button
            v-else
            variant="outline"
            size="sm"
            :disabled="!count?.announcements || markAllAnnouncementsRead.isPending.value"
            @click="markAllAnnouncementsRead.mutate()"
          >
            <CheckCheck class="size-4" />
            {{ t('notifications.markAllRead') }}
          </Button>
        </div>

        <TabsContent value="notifications" class="grid gap-3">
          <div class="flex items-center gap-2">
            <Switch id="unread-only" v-model="unreadOnly" />
            <Label for="unread-only">{{ t('notifications.unreadOnly') }}</Label>
          </div>
          <Alert v-if="error" variant="destructive">
            <AlertDescription>{{ errorMessage(error) }}</AlertDescription>
          </Alert>
          <Card class="py-2">
            <CardContent class="px-2">
              <div v-if="notifications?.items.length" class="grid gap-0.5">
                <NotificationItem v-for="item in notifications.items" :key="item.id" :notification="item" actions />
              </div>
              <p v-else-if="!isPending" class="py-10 text-center text-sm text-muted-foreground">
                {{ unreadOnly ? t('notifications.emptyUnread') : t('notifications.empty') }}
              </p>
            </CardContent>
          </Card>
          <div v-if="pageCount(notifications?.total) > 1" class="flex items-center justify-end gap-2 text-sm text-muted-foreground">
            <span>{{ page }} / {{ pageCount(notifications?.total) }}</span>
            <Button variant="outline" size="sm" :disabled="page <= 1" @click="page--">
              {{ t('notifications.previous') }}
            </Button>
            <Button variant="outline" size="sm" :disabled="page >= pageCount(notifications?.total)" @click="page++">
              {{ t('notifications.next') }}
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
                {{ t('notifications.emptyAnnouncements') }}
              </p>
            </CardContent>
          </Card>
          <div v-if="pageCount(announcements?.total) > 1" class="flex items-center justify-end gap-2 text-sm text-muted-foreground">
            <span>{{ announcementPage }} / {{ pageCount(announcements?.total) }}</span>
            <Button variant="outline" size="sm" :disabled="announcementPage <= 1" @click="announcementPage--">
              {{ t('notifications.previous') }}
            </Button>
            <Button variant="outline" size="sm" :disabled="announcementPage >= pageCount(announcements?.total)" @click="announcementPage++">
              {{ t('notifications.next') }}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  </main>
</template>
