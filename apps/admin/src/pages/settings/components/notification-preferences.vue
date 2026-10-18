<script setup lang="ts">
import { Separator } from '@repo/ui/components/separator'
import { Switch } from '@repo/ui/components/switch'
import { toast } from 'vue-sonner'

import type { NotificationChannel } from '@/services/api/notifications.api'

import { categoryLabel } from '@/lib/notifications'
import { t } from '@/plugins/i18n'
import { useNotificationPreferencesQuery, useUpdateNotificationPreferencesMutation } from '@/services/api/notifications.api'

/** Per-category channel switches of the signed-in admin; each switch is saved right away. */
const { data: preferences, isError } = useNotificationPreferencesQuery()
const update = useUpdateNotificationPreferencesMutation()

const CHANNELS: NotificationChannel[] = ['inApp', 'email']

async function toggle(category: string, channel: NotificationChannel, value: boolean) {
  try {
    await update.mutateAsync({ [category]: { [channel]: value } })
  }
  catch {
    return // Toasted by the global mutation handler.
  }
  toast.success(t('notifications.preferences.saved'))
}
</script>

<template>
  <div>
    <h3 class="text-lg font-medium">
      {{ $t('notifications.preferences.title') }}
    </h3>
    <p class="text-sm text-muted-foreground">
      {{ $t('notifications.preferences.description') }}
    </p>
  </div>
  <Separator class="my-4" />

  <p v-if="isError" class="text-sm text-destructive">
    {{ $t('notifications.preferences.loadFailed') }}
  </p>
  <div v-else class="grid max-w-xl gap-3">
    <div
      v-for="item in preferences"
      :key="item.category"
      class="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="grid gap-0.5">
        <p class="font-medium">
          {{ categoryLabel(item.category, item.description) }}
        </p>
        <p v-if="item.mandatory" class="text-sm text-muted-foreground">
          {{ $t('notifications.preferences.mandatoryHint') }}
        </p>
      </div>
      <div class="flex items-center gap-5">
        <template v-for="channel in CHANNELS" :key="channel">
          <label v-if="item.channels[channel] !== undefined" class="flex items-center gap-2 text-sm">
            <Switch
              :model-value="item.channels[channel]"
              :disabled="item.mandatory || update.isPending.value"
              @update:model-value="toggle(item.category, channel, $event)"
            />
            {{ $t(`notifications.channels.${channel}`) }}
          </label>
        </template>
      </div>
    </div>
  </div>
</template>
