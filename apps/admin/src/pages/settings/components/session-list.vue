<script setup lang="ts">
import { LogOutIcon, MonitorSmartphoneIcon } from '@lucide/vue'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Skeleton } from '@repo/ui/components/skeleton'
import dayjs from 'dayjs'
import { toast } from 'vue-sonner'

import { useRevokeSessionMutation, useSessionsQuery } from '@/services/api/me.api'

const { data: sessions, isPending } = useSessionsQuery()
const revoke = useRevokeSessionMutation()

/** Short browser/OS label from a user agent string. */
function describeAgent(userAgent: string | null) {
  if (!userAgent)
    return 'Unknown device'
  const browser = /(Edg|Firefox|Chrome|Safari)\/[\d.]+/.exec(userAgent)?.[1]
  const os = /(Windows|Mac OS X|Android|iPhone|iPad|Linux)/.exec(userAgent)?.[1]
  const names: Record<string, string> = { 'Edg': 'Edge', 'Mac OS X': 'macOS' }
  return [browser && (names[browser] ?? browser), os && (names[os] ?? os)].filter(Boolean).join(' on ') || userAgent.slice(0, 60)
}

function onRevoke(id: string) {
  revoke.mutate(id, { onSuccess: () => toast.success('Session signed out.') })
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h4 class="font-medium">
        Active sessions
      </h4>
      <p class="text-sm text-muted-foreground">
        Sign out of devices you no longer use.
      </p>
    </div>

    <div v-if="isPending" class="space-y-2">
      <Skeleton v-for="i in 2" :key="i" class="h-14 w-full" />
    </div>

    <ul v-else class="divide-y rounded-md border">
      <li v-for="session in sessions" :key="session.id" class="flex items-center gap-3 p-3">
        <MonitorSmartphoneIcon class="size-5 shrink-0 text-muted-foreground" />
        <div class="grid flex-1 gap-0.5 text-sm">
          <div class="flex items-center gap-2 font-medium">
            {{ describeAgent(session.userAgent) }}
            <Badge v-if="session.current" variant="secondary">
              This device
            </Badge>
          </div>
          <span class="text-xs text-muted-foreground">
            {{ session.ip ?? 'Unknown IP' }} · Active {{ dayjs(session.lastUsedAt ?? session.createdAt).fromNow() }}
            · Signed in {{ dayjs(session.createdAt).format('YYYY-MM-DD HH:mm') }}
          </span>
        </div>
        <Button
          v-if="!session.current"
          variant="ghost"
          size="sm"
          :disabled="revoke.isPending.value"
          @click="onRevoke(session.id)"
        >
          <LogOutIcon />
          Sign out
        </Button>
      </li>
    </ul>
  </div>
</template>
