<script setup lang="ts">
import type { PaginationState, Updater } from '@tanstack/vue-table'

import { PlusIcon, RefreshCwIcon } from '@lucide/vue'
import { Button } from '@repo/ui/components/button'
import { Input } from '@repo/ui/components/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select'
import { refDebounced } from '@vueuse/core'

import type { AnnouncementAudience, AnnouncementStatus } from '@/services/api/announcements.api'

import { DataTable } from '@/components/data-table'
import { BasicPage } from '@/components/global-layout'
import { DEFAULT_PAGE_SIZE } from '@/constants/app'
import { useAnnouncementsQuery } from '@/services/api/announcements.api'
import { useAuthStore } from '@/stores/auth'

import AnnouncementDialog from './components/announcement-dialog.vue'
import { createColumns } from './components/columns'
import { announcementAudiences, announcementStatuses } from './data/data'

const authStore = useAuthStore()
const canManage = computed(() => authStore.can('announcement:manage'))
const columns = computed(() => createColumns({ canManage: canManage.value }))
const createOpen = shallowRef(false)

const keyword = shallowRef('')
const debouncedKeyword = refDebounced(keyword, 300)
const status = shallowRef<AnnouncementStatus | 'all'>('all')
const audience = shallowRef<AnnouncementAudience | 'any'>('any')
const pagination = shallowRef<PaginationState>({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE })

// Filters start again from the first page.
watch([debouncedKeyword, status, audience], () => {
  pagination.value = { ...pagination.value, pageIndex: 0 }
})

const { data, isPending, isFetching, refetch } = useAnnouncementsQuery(() => ({
  page: pagination.value.pageIndex + 1,
  pageSize: pagination.value.pageSize,
  keyword: debouncedKeyword.value.trim(),
  status: status.value === 'all' ? undefined : status.value,
  audience: audience.value === 'any' ? undefined : audience.value,
}))

const serverPagination = computed(() => ({
  state: pagination.value,
  rowCount: data.value?.total ?? 0,
  onChange: (updater: Updater<PaginationState>) => {
    pagination.value = typeof updater === 'function' ? updater(pagination.value) : updater
  },
}))
</script>

<template>
  <BasicPage :title="$t('announcements.title')" :description="$t('announcements.description')" sticky>
    <template #actions>
      <Button variant="outline" :disabled="isFetching" @click="refetch()">
        <RefreshCwIcon :class="{ 'animate-spin': isFetching }" />
        {{ $t('common.refresh') }}
      </Button>
      <Button v-if="canManage" @click="createOpen = true">
        <PlusIcon />
        {{ $t('announcements.new') }}
      </Button>
    </template>

    <p v-if="!canManage" class="mb-4 text-sm text-muted-foreground">
      {{ $t('announcements.readOnly') }}
    </p>

    <DataTable
      :loading="isPending"
      :data="data?.items ?? []"
      :columns="columns"
      :server-pagination="serverPagination"
    >
      <template #toolbar>
        <div class="flex flex-col gap-2 md:flex-row md:items-center">
          <Input v-model="keyword" :placeholder="$t('announcements.searchPlaceholder')" class="h-8 w-[200px] lg:w-[280px]" />
          <Select v-model="status">
            <SelectTrigger size="sm" class="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {{ $t('announcements.allStatuses') }}
              </SelectItem>
              <SelectItem v-for="item in announcementStatuses" :key="item.value" :value="item.value">
                {{ $t(item.label) }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="audience">
            <SelectTrigger size="sm" class="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">
                {{ $t('announcements.allAudiences') }}
              </SelectItem>
              <SelectItem v-for="item in announcementAudiences" :key="item.value" :value="item.value">
                {{ $t(item.label) }}
              </SelectItem>
            </SelectContent>
          </Select>
          <span class="text-sm text-muted-foreground md:ml-auto">{{ $t('announcements.total', { count: data?.total ?? 0 }) }}</span>
        </div>
      </template>
    </DataTable>

    <AnnouncementDialog v-if="canManage" v-model:open="createOpen" />
  </BasicPage>
</template>

<route lang="yaml">
meta:
  permission: announcement:read
</route>
