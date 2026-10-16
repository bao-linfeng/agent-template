<script setup lang="ts">
import type { PaginationState, Updater } from '@tanstack/vue-table'

import { RefreshCwIcon } from '@lucide/vue'
import { Button } from '@repo/ui/components/button'
import { Input } from '@repo/ui/components/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select'
import { refDebounced } from '@vueuse/core'

import type { UserStatus } from '@/services/types/user.type'

import { DataTable } from '@/components/data-table'
import { BasicPage } from '@/components/global-layout'
import { DEFAULT_PAGE_SIZE } from '@/constants/app'
import { useAdminUsersQuery } from '@/services/api/admin-users.api'
import { useAuthStore } from '@/stores/auth'

import { createColumns } from './components/columns'
import { userStatuses } from './data/data'

const authStore = useAuthStore()
const columns = computed(() => createColumns({ canEdit: authStore.can('user:update'), canDelete: authStore.can('user:delete') }))

const keyword = shallowRef('')
const debouncedKeyword = refDebounced(keyword, 300)
const status = shallowRef<UserStatus | 'all'>('all')
const deletion = shallowRef<'pending' | 'all'>('all')
const pagination = shallowRef<PaginationState>({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE })

// Filters start again from the first page.
watch([debouncedKeyword, status, deletion], () => {
  pagination.value = { ...pagination.value, pageIndex: 0 }
})

const { data, isPending, isFetching, refetch } = useAdminUsersQuery(() => ({
  page: pagination.value.pageIndex + 1,
  pageSize: pagination.value.pageSize,
  keyword: debouncedKeyword.value.trim(),
  status: status.value === 'all' ? undefined : status.value,
  deletion: deletion.value === 'all' ? undefined : deletion.value,
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
  <BasicPage :title="$t('users.title')" :description="$t('users.description')" sticky>
    <template #actions>
      <Button variant="outline" :disabled="isFetching" @click="refetch()">
        <RefreshCwIcon :class="{ 'animate-spin': isFetching }" />
        {{ $t('common.refresh') }}
      </Button>
    </template>

    <DataTable
      :loading="isPending"
      :data="data?.items ?? []"
      :columns="columns"
      :server-pagination="serverPagination"
    >
      <template #toolbar>
        <div class="flex flex-col gap-2 md:flex-row md:items-center">
          <Input v-model="keyword" :placeholder="$t('accounts.searchPlaceholder')" class="h-8 w-[200px] lg:w-[280px]" />
          <Select v-model="status">
            <SelectTrigger size="sm" class="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {{ $t('accounts.allStatuses') }}
              </SelectItem>
              <SelectItem v-for="item in userStatuses" :key="item.value" :value="item.value">
                {{ $t(item.label) }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="deletion">
            <SelectTrigger size="sm" class="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {{ $t('users.allAccounts') }}
              </SelectItem>
              <SelectItem value="pending">
                {{ $t('users.pendingDeletion') }}
              </SelectItem>
            </SelectContent>
          </Select>
          <span class="text-sm text-muted-foreground md:ml-auto">{{ $t('users.total', { count: data?.total ?? 0 }) }}</span>
        </div>
      </template>
    </DataTable>
  </BasicPage>
</template>

<route lang="yaml">
meta:
  permission: user:read
</route>
