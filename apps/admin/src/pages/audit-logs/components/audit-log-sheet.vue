<script setup lang="ts">
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Separator } from '@repo/ui/components/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@repo/ui/components/sheet'

import type { IAuditLog } from '@/services/api/audit-logs.api'

import { Copy } from '@/components/prop-ui/copy'

import { errorLabel, formatTime, isFailure, outcomeStyles, realmLabel } from '../data/data'

defineProps<{
  log?: IAuditLog
}>()

const emit = defineEmits<{
  filterActor: [log: IAuditLog]
  filterResource: [log: IAuditLog]
}>()

const open = defineModel<boolean>('open', { required: true })

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function isEmpty(value: unknown) {
  return value === null || value === undefined || (typeof value === 'object' && Object.keys(value).length === 0)
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="w-full gap-0 sm:max-w-xl">
      <SheetHeader>
        <SheetTitle>{{ $t('auditLogs.view') }}</SheetTitle>
        <SheetDescription>{{ $t('auditLogs.detailDescription') }}</SheetDescription>
      </SheetHeader>

      <div v-if="log" class="flex-1 space-y-5 overflow-y-auto px-4 pb-6 text-sm">
        <dl class="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-3">
          <dt class="text-muted-foreground">
            {{ $t('auditLogs.fields.time') }}
          </dt>
          <dd>{{ formatTime(log.createdAt) }}</dd>

          <dt class="text-muted-foreground">
            {{ $t('auditLogs.fields.actor') }}
          </dt>
          <dd class="space-y-1">
            <div>{{ log.actorEmail ?? $t('auditLogs.anonymous') }}</div>
            <div v-if="log.actorId" class="flex items-center gap-1 font-mono text-xs text-muted-foreground">
              {{ log.actorId }}
              <Copy size="icon-xs" :content="log.actorId" />
            </div>
          </dd>

          <dt class="text-muted-foreground">
            {{ $t('auditLogs.fields.realm') }}
          </dt>
          <dd>
            <Badge variant="outline">
              {{ realmLabel(log.realm) }}
            </Badge>
          </dd>

          <dt class="text-muted-foreground">
            {{ $t('auditLogs.fields.action') }}
          </dt>
          <dd class="font-mono text-xs break-all">
            {{ log.action }}
          </dd>

          <dt class="text-muted-foreground">
            {{ $t('auditLogs.fields.route') }}
          </dt>
          <dd class="space-y-1">
            <div class="flex items-start gap-2">
              <Badge variant="secondary" class="font-mono">
                {{ log.method }}
              </Badge>
              <span class="font-mono text-xs break-all">{{ log.path }}</span>
            </div>
            <div v-if="log.route !== log.path" class="font-mono text-xs break-all text-muted-foreground">
              {{ log.route }}
            </div>
          </dd>

          <template v-if="log.resourceId">
            <dt class="text-muted-foreground">
              {{ $t('auditLogs.fields.resource') }}
            </dt>
            <dd class="flex items-center gap-1 font-mono text-xs break-all">
              {{ log.resourceId }}
              <Copy size="icon-xs" :content="log.resourceId" />
            </dd>
          </template>

          <dt class="text-muted-foreground">
            {{ $t('auditLogs.fields.result') }}
          </dt>
          <dd class="space-y-1">
            <Badge variant="outline" :class="outcomeStyles[isFailure(log) ? 'failure' : 'success']">
              {{ log.statusCode }}
            </Badge>
            <div v-if="log.errorCode" class="text-xs">
              {{ errorLabel(log.errorCode) }}
              <span class="font-mono text-muted-foreground">({{ log.errorCode }})</span>
            </div>
          </dd>

          <dt class="text-muted-foreground">
            {{ $t('auditLogs.fields.duration') }}
          </dt>
          <dd>{{ $t('auditLogs.durationMs', { value: log.durationMs }) }}</dd>

          <dt class="text-muted-foreground">
            {{ $t('auditLogs.fields.ip') }}
          </dt>
          <dd>{{ log.ip ?? '—' }}</dd>

          <dt class="text-muted-foreground">
            {{ $t('auditLogs.fields.userAgent') }}
          </dt>
          <dd class="text-xs break-all">
            {{ log.userAgent ?? '—' }}
          </dd>

          <template v-if="log.requestId">
            <dt class="text-muted-foreground">
              {{ $t('auditLogs.fields.requestId') }}
            </dt>
            <dd class="flex items-center gap-1 font-mono text-xs break-all">
              {{ log.requestId }}
              <Copy size="icon-xs" :content="log.requestId" />
            </dd>
          </template>
        </dl>

        <div class="flex flex-wrap gap-2">
          <Button v-if="log.actorId" variant="outline" size="sm" @click="emit('filterActor', log)">
            {{ $t('auditLogs.onlyActor') }}
          </Button>
          <Button v-if="log.resourceId" variant="outline" size="sm" @click="emit('filterResource', log)">
            {{ $t('auditLogs.onlyResource') }}
          </Button>
        </div>

        <template v-for="section in (['params', 'query', 'body'] as const)" :key="section">
          <template v-if="!isEmpty(log[section])">
            <Separator />
            <div class="space-y-2">
              <h4 class="font-medium">
                {{ $t(`auditLogs.fields.${section}`) }}
              </h4>
              <pre class="max-h-80 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap break-all">{{ pretty(log[section]) }}</pre>
            </div>
          </template>
        </template>
      </div>
    </SheetContent>
  </Sheet>
</template>
