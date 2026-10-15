<script setup lang="ts">
import type { PaginationState, Updater } from '@tanstack/vue-table'

import { PlusIcon, RefreshCwIcon } from '@lucide/vue'
import { Button } from '@repo/ui/components/button'
import { Input } from '@repo/ui/components/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select'
import { refDebounced } from '@vueuse/core'

import type { UserStatus } from '@/services/types/user.type'

import { DataTable } from '@/components/data-table'
import { BasicPage } from '@/components/global-layout'
import { DEFAULT_PAGE_SIZE } from '@/constants/app'
import { userStatuses } from '@/pages/users/data/data'
import { useAdminsQuery } from '@/services/api/admins.api'
import { useAuthStore } from '@/stores/auth'

import AdminDialog from './components/admin-dialog.vue'
import { createColumns } from './components/columns'

const authStore = useAuthStore()
const columns = computed(() => createColumns({ canEdit: authStore.can('admin:update') }))
const createOpen = shallowRef(false)

const keyword = shallowRef('')
const debouncedKeyword = refDebounced(keyword, 300)
const status = shallowRef<UserStatus | 'all'>('all')
const pagination = shallowRef<PaginationState>({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE })

// Filters start again from the first page.
watch([debouncedKeyword, status], () => {
  pagination.value = { ...pagination.value, pageIndex: 0 }
})

const { data, isPending, isFetching, refetch } = useAdminsQuery(() => ({
  page: pagination.value.pageIndex + 1,
  pageSize: pagination.value.pageSize,
  keyword: debouncedKeyword.value.trim(),
  status: status.value === 'all' ? undefined : status.value,
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
  <BasicPage title="Admins" description="Accounts that sign in to this console, their roles and status. They are separate from client app users." sticky>
    <template #actions>
      <Button variant="outline" :disabled="isFetching" @click="refetch()">
        <RefreshCwIcon :class="{ 'animate-spin': isFetching }" />
        Refresh
      </Button>
      <Button v-if="authStore.can('admin:create')" @click="createOpen = true">
        <PlusIcon />
        New admin
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
          <Input v-model="keyword" placeholder="Search email or nickname..." class="h-8 w-[200px] lg:w-[280px]" />
          <Select v-model="status">
            <SelectTrigger size="sm" class="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All statuses
              </SelectItem>
              <SelectItem v-for="item in userStatuses" :key="item.value" :value="item.value">
                {{ item.label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <span class="text-sm text-muted-foreground md:ml-auto">{{ data?.total ?? 0 }} admins</span>
        </div>
      </template>
    </DataTable>

    <AdminDialog v-if="authStore.can('admin:create')" v-model:open="createOpen" />
  </BasicPage>
</template>

<route lang="yaml">
meta:
  permission: admin:read
</route>
