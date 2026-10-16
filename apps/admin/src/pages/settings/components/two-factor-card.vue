<script setup lang="ts">
import { ShieldCheckIcon, ShieldOffIcon } from '@lucide/vue'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Skeleton } from '@repo/ui/components/skeleton'
import dayjs from 'dayjs'

import { useMfaStatusQuery } from '@/services/api/me.api'

import TwoFactorConfirmDialog from './two-factor-confirm-dialog.vue'
import TwoFactorSetupDialog from './two-factor-setup-dialog.vue'

/** Below this many unused recovery codes the card suggests generating new ones. */
const LOW_RECOVERY_CODES = 3

const { data: status, isPending } = useMfaStatusQuery()
const setupOpen = shallowRef(false)
const confirmOpen = shallowRef(false)
const confirmMode = shallowRef<'disable' | 'regenerate'>('disable')

function openConfirm(mode: 'disable' | 'regenerate') {
  confirmMode.value = mode
  confirmOpen.value = true
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h4 class="flex items-center gap-2 font-medium">
        {{ $t('settings.twoFactor.title') }}
        <Badge v-if="status?.totpEnabled" variant="secondary">
          {{ $t('settings.twoFactor.statusOn') }}
        </Badge>
      </h4>
      <p class="text-sm text-muted-foreground">
        {{ $t('settings.twoFactor.description') }}
      </p>
    </div>

    <Skeleton v-if="isPending" class="h-16 w-full" />

    <div v-else-if="status?.totpEnabled" class="flex flex-wrap items-center gap-3 rounded-md border p-3">
      <ShieldCheckIcon class="size-5 shrink-0 text-primary" />
      <div class="grid flex-1 gap-0.5 text-sm">
        <span class="font-medium">{{ $t('settings.twoFactor.authenticatorApp') }}</span>
        <span class="text-xs text-muted-foreground">
          {{ $t('settings.twoFactor.enabledAt', { date: dayjs(status.enabledAt).format('YYYY-MM-DD HH:mm') }) }}
          ·
          <span :class="status.recoveryCodesRemaining <= LOW_RECOVERY_CODES ? 'text-destructive' : ''">
            {{ $t('settings.twoFactor.recoveryRemaining', { count: status.recoveryCodesRemaining }) }}
          </span>
        </span>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" size="sm" @click="openConfirm('regenerate')">
          {{ $t('settings.twoFactor.regenerate') }}
        </Button>
        <Button variant="outline" size="sm" class="text-destructive" @click="openConfirm('disable')">
          {{ $t('settings.twoFactor.disable') }}
        </Button>
      </div>
    </div>

    <div v-else class="flex flex-wrap items-center gap-3 rounded-md border p-3">
      <ShieldOffIcon class="size-5 shrink-0 text-muted-foreground" />
      <p class="flex-1 text-sm text-muted-foreground">
        {{ $t('settings.twoFactor.offHint') }}
      </p>
      <Button size="sm" @click="setupOpen = true">
        {{ $t('settings.twoFactor.enable') }}
      </Button>
    </div>

    <TwoFactorSetupDialog v-model:open="setupOpen" />
    <TwoFactorConfirmDialog v-model:open="confirmOpen" :mode="confirmMode" />
  </div>
</template>
