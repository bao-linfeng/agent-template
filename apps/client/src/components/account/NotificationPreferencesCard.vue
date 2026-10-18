<script setup lang="ts">
import type { NotificationChannel } from '@/lib/notifications'
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import { Switch } from '@repo/ui/components/switch'
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotificationActions, useNotificationPreferences } from '@/composables/useNotifications'
import { errorMessage } from '@/lib/api'
import { categoryLabel } from '@/lib/notifications'

/** Per-category channel switches; each switch is saved right away. */
const { t } = useI18n()
const { data: preferences, error: loadError } = useNotificationPreferences()
const { updatePreferences } = useNotificationActions()
const status = shallowRef<{ type: 'success' | 'error', text: string } | null>(null)

const CHANNELS: NotificationChannel[] = ['inApp', 'email']

function toggle(category: string, channel: NotificationChannel, value: boolean) {
  status.value = null
  updatePreferences.mutate({ [category]: { [channel]: value } }, {
    onSuccess: () => {
      status.value = { type: 'success', text: t('notifications.preferences.saved') }
    },
    onError: (error) => {
      status.value = { type: 'error', text: errorMessage(error) }
    },
  })
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ t('notifications.preferences.title') }}</CardTitle>
      <CardDescription>{{ t('notifications.preferences.description') }}</CardDescription>
    </CardHeader>
    <CardContent class="grid gap-3">
      <Alert v-if="loadError" variant="destructive">
        <AlertDescription>{{ errorMessage(loadError) }}</AlertDescription>
      </Alert>
      <div
        v-for="item in preferences"
        :key="item.category"
        class="flex flex-col gap-3 rounded-md border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="grid gap-0.5 text-sm">
          <span class="font-medium">{{ categoryLabel(item.category, item.description) }}</span>
          <span v-if="item.mandatory" class="text-muted-foreground">{{ t('notifications.preferences.mandatoryHint') }}</span>
        </div>
        <div class="flex items-center gap-5">
          <template v-for="channel in CHANNELS" :key="channel">
            <label v-if="item.channels[channel] !== undefined" class="flex items-center gap-2 text-sm">
              <Switch
                :model-value="item.channels[channel]"
                :disabled="item.mandatory || updatePreferences.isPending.value"
                @update:model-value="toggle(item.category, channel, $event)"
              />
              {{ t(`notifications.channels.${channel}`) }}
            </label>
          </template>
        </div>
      </div>
      <Alert v-if="status" :variant="status.type === 'error' ? 'destructive' : 'default'">
        <AlertDescription>{{ status.text }}</AlertDescription>
      </Alert>
    </CardContent>
  </Card>
</template>
