<script setup lang="ts">
import type { DataExport } from '@/lib/account'
import { Download } from '@lucide/vue'
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { accountApi, exportFileName } from '@/lib/account'
import { errorMessage } from '@/lib/api'
import { formatBytes, saveBlob } from '@/lib/download'

const { t, locale } = useI18n()
const queryClient = useQueryClient()
const queryKey = ['account', 'exports']

function isBuilding(item: DataExport) {
  return item.status === 'pending' || item.status === 'processing'
}

const { data, error: listError } = useQuery({
  queryKey,
  queryFn: () => accountApi.listExports(),
  // Poll while an export is being built; the server also emails the user when it is ready.
  refetchInterval: query => (query.state.data?.items.some(isBuilding) ? 2000 : false),
})
const items = computed(() => data.value?.items ?? [])
const building = computed(() => items.value.some(isBuilding))

const status = shallowRef<{ type: 'success' | 'error', text: string } | null>(null)

const { mutate: requestExport, isPending: requesting } = useMutation({
  mutationFn: accountApi.requestExport,
  onMutate: () => {
    status.value = null
  },
  onSuccess: () => {
    status.value = { type: 'success', text: t('account.export.requested') }
  },
  onError: (error: Error) => {
    status.value = { type: 'error', text: errorMessage(error) }
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey }),
})

const { mutate: download, isPending: downloading, variables: downloadingItem } = useMutation({
  mutationFn: async (item: DataExport) => saveBlob(await accountApi.downloadExport(item.id), exportFileName(item)),
  onMutate: () => {
    status.value = null
  },
  onError: (error: Error) => {
    status.value = { type: 'error', text: errorMessage(error) }
    // An expired export disappears from the list once refreshed.
    void queryClient.invalidateQueries({ queryKey })
  },
})

function formatDate(value: string) {
  return new Date(value).toLocaleString(locale.value, { dateStyle: 'medium', timeStyle: 'short' })
}

const statusVariant = {
  pending: 'secondary',
  processing: 'secondary',
  ready: 'default',
  failed: 'destructive',
} as const
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ t('account.export.cardTitle') }}</CardTitle>
      <CardDescription>{{ t('account.export.cardDescription') }}</CardDescription>
    </CardHeader>
    <CardContent class="grid gap-4">
      <ul v-if="items.length" class="grid gap-2">
        <li v-for="item in items" :key="item.id" class="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2">
          <div class="grid gap-0.5 text-sm">
            <div class="flex items-center gap-2">
              <Badge :variant="statusVariant[item.status]">
                {{ t(`account.export.status.${item.status}`) }}
              </Badge>
              <span>{{ t('account.export.requestedAt', { date: formatDate(item.createdAt) }) }}</span>
            </div>
            <span v-if="item.status === 'ready' && item.expiresAt" class="text-muted-foreground">
              {{ t('account.export.availableUntil', { date: formatDate(item.expiresAt) }) }}
              <template v-if="item.sizeBytes !== null"> · {{ formatBytes(item.sizeBytes, locale) }}</template>
            </span>
          </div>
          <Button
            v-if="item.status === 'ready'"
            variant="outline"
            size="sm"
            :disabled="downloading && downloadingItem?.id === item.id"
            @click="download(item)"
          >
            <Download class="size-4" />
            {{ t('account.export.download') }}
          </Button>
        </li>
      </ul>
      <p v-else-if="!listError" class="text-sm text-muted-foreground">
        {{ t('account.export.empty') }}
      </p>
      <Alert v-if="listError" variant="destructive">
        <AlertDescription>{{ errorMessage(listError) }}</AlertDescription>
      </Alert>
      <Alert v-if="status" :variant="status.type === 'error' ? 'destructive' : 'default'">
        <AlertDescription>{{ status.text }}</AlertDescription>
      </Alert>
      <div>
        <Button :disabled="requesting || building" @click="requestExport()">
          {{ requesting ? t('account.export.requesting') : t('account.export.request') }}
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
