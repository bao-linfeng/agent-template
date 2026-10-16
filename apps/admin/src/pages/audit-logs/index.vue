<script setup lang="ts">
import type { PaginationState, Updater } from '@tanstack/vue-table'

import { RefreshCwIcon, XIcon } from '@lucide/vue'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Input } from '@repo/ui/components/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select'
import { refDebounced } from '@vueuse/core'

import type { AuditOutcome, AuditRealm, IAuditLog } from '@/services/api/audit-logs.api'

import { DataTable } from '@/components/data-table'
import { BasicPage } from '@/components/global-layout'
import { DEFAULT_PAGE_SIZE } from '@/constants/app'
import { dayRangeQuery, useAuditLogsQuery } from '@/services/api/audit-logs.api'

import AuditLogSheet from './components/audit-log-sheet.vue'
import { createColumns } from './components/columns'
import { auditOutcomes, auditRealms } from './data/data'

const keyword = shallowRef('')
const debouncedKeyword = refDebounced(keyword, 300)
const realm = shallowRef<AuditRealm | 'all'>('all')
const outcome = shallowRef<AuditOutcome | 'all'>('all')
const fromDay = shallowRef('')
const toDay = shallowRef('')
/** Set from the detail sheet; `label` is what the filter chip shows. */
const actor = shallowRef<{ id: string, label: string }>()
const resourceId = shallowRef<string>()
const pagination = shallowRef<PaginationState>({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE })

// Filters start again from the first page.
watch([debouncedKeyword, realm, outcome, fromDay, toDay, actor, resourceId], () => {
  pagination.value = { ...pagination.value, pageIndex: 0 }
})

const { data, isPending, isFetching, refetch } = useAuditLogsQuery(() => ({
  page: pagination.value.pageIndex + 1,
  pageSize: pagination.value.pageSize,
  keyword: debouncedKeyword.value.trim(),
  realm: realm.value === 'all' ? undefined : realm.value,
  outcome: outcome.value === 'all' ? undefined : outcome.value,
  actorId: actor.value?.id,
  resourceId: resourceId.value,
  ...dayRangeQuery(fromDay.value, toDay.value),
}))

const serverPagination = computed(() => ({
  state: pagination.value,
  rowCount: data.value?.total ?? 0,
  onChange: (updater: Updater<PaginationState>) => {
    pagination.value = typeof updater === 'function' ? updater(pagination.value) : updater
  },
}))

const selected = shallowRef<IAuditLog>()
const sheetOpen = shallowRef(false)
const columns = createColumns({
  onView: (log) => {
    selected.value = log
    sheetOpen.value = true
  },
})

function filterActor(log: IAuditLog) {
  if (log.actorId)
    actor.value = { id: log.actorId, label: log.actorEmail ?? log.actorId }
  sheetOpen.value = false
}

function filterResource(log: IAuditLog) {
  resourceId.value = log.resourceId ?? undefined
  sheetOpen.value = false
}
</script>

<template>
  <BasicPage :title="$t('auditLogs.title')" :description="$t('auditLogs.description')" sticky>
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
        <div class="flex flex-col gap-2">
          <div class="flex flex-col flex-wrap gap-2 md:flex-row md:items-center">
            <Input v-model="keyword" :placeholder="$t('auditLogs.searchPlaceholder')" class="h-8 w-[200px] lg:w-[280px]" />
            <Select v-model="realm">
              <SelectTrigger size="sm" class="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {{ $t('auditLogs.allRealms') }}
                </SelectItem>
                <SelectItem v-for="item in auditRealms" :key="item.value" :value="item.value">
                  {{ $t(item.label) }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select v-model="outcome">
              <SelectTrigger size="sm" class="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {{ $t('auditLogs.allOutcomes') }}
                </SelectItem>
                <SelectItem v-for="item in auditOutcomes" :key="item.value" :value="item.value">
                  {{ $t(item.label) }}
                </SelectItem>
              </SelectContent>
            </Select>
            <div class="flex items-center gap-2">
              <Input
                v-model="fromDay"
                type="date"
                :max="toDay || undefined"
                :aria-label="$t('auditLogs.from')"
                :title="$t('auditLogs.from')"
                class="h-8 w-[150px]"
              />
              <span class="text-muted-foreground">–</span>
              <Input
                v-model="toDay"
                type="date"
                :min="fromDay || undefined"
                :aria-label="$t('auditLogs.to')"
                :title="$t('auditLogs.to')"
                class="h-8 w-[150px]"
              />
            </div>
            <span class="text-sm text-muted-foreground md:ml-auto">{{ $t('auditLogs.total', { count: data?.total ?? 0 }) }}</span>
          </div>

          <div v-if="actor || resourceId" class="flex flex-wrap gap-2">
            <Badge v-if="actor" variant="secondary" class="gap-1 pr-1">
              {{ $t('auditLogs.actorFilter', { value: actor.label }) }}
              <Button variant="ghost" size="icon-xs" :aria-label="$t('auditLogs.clearFilter')" @click="actor = undefined">
                <XIcon />
              </Button>
            </Badge>
            <Badge v-if="resourceId" variant="secondary" class="gap-1 pr-1 font-mono">
              {{ $t('auditLogs.resourceFilter', { value: resourceId }) }}
              <Button variant="ghost" size="icon-xs" :aria-label="$t('auditLogs.clearFilter')" @click="resourceId = undefined">
                <XIcon />
              </Button>
            </Badge>
          </div>
        </div>
      </template>
    </DataTable>

    <AuditLogSheet
      v-model:open="sheetOpen"
      :log="selected"
      @filter-actor="filterActor"
      @filter-resource="filterResource"
    />
  </BasicPage>
</template>

<route lang="yaml">
meta:
  permission: audit-log:read
</route>
