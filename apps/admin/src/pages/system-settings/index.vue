<script setup lang="ts">
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card'
import { Separator } from '@repo/ui/components/separator'
import { Skeleton } from '@repo/ui/components/skeleton'
import { Spinner } from '@repo/ui/components/spinner'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import type { SettingInput, SettingProblem } from '@/lib/system-settings'
import type { SettingChanges } from '@/services/api/settings.api'

import { BasicPage } from '@/components/global-layout'
import { collectSettingChanges, groupSettings, isSettingDirty, syncSettingInputs } from '@/lib/system-settings'
import { useSettingsQuery, useUpdateSettingsMutation } from '@/services/api/settings.api'
import { useAuthStore } from '@/stores/auth'

import SettingField from './components/setting-field.vue'

const { t, te } = useI18n()
const authStore = useAuthStore()
const canManage = computed(() => authStore.can('setting:manage'))

const { data: views, isPending } = useSettingsQuery()
const update = useUpdateSettingsMutation()

const inputs = ref<Record<string, SettingInput>>({})
const problems = shallowRef<Record<string, SettingProblem>>({})

// Refetches (window focus, after saving) update untouched settings and keep edits in progress.
watch(views, (next, previous) => {
  if (next)
    inputs.value = syncSettingInputs(next, previous, inputs.value)
}, { immediate: true })

const groups = computed(() => groupSettings(views.value ?? []))
const dirtyCount = computed(() => (views.value ?? []).filter(view => isSettingDirty(view, inputs.value[view.key])).length)

function groupTitle(group: string) {
  const key = `systemSettings.groups.${group}`
  return te(key) ? t(key) : group
}

function discard() {
  inputs.value = syncSettingInputs(views.value ?? [], undefined, {})
  problems.value = {}
}

function send(changes: SettingChanges, message: string) {
  update.mutate(changes, {
    onSuccess: () => {
      problems.value = {}
      toast.success(message)
    },
    // Errors (e.g. SETTING_INVALID when the server is stricter) are toasted globally.
  })
}

function save() {
  const collected = collectSettingChanges(views.value ?? [], inputs.value)
  problems.value = collected.problems
  if (Object.keys(collected.problems).length)
    return
  const count = Object.keys(collected.changes).length
  send(collected.changes, t('systemSettings.saved', { count }, count))
}

function reset(key: string) {
  send({ [key]: null }, t('systemSettings.resetDone'))
}
</script>

<template>
  <BasicPage
    :title="$t('systemSettings.title')"
    :description="$t('systemSettings.description')"
    sticky
  >
    <template v-if="canManage" #actions>
      <Button variant="outline" :disabled="!dirtyCount || update.isPending.value" @click="discard">
        {{ $t('systemSettings.discard') }}
      </Button>
      <Button :disabled="!dirtyCount || update.isPending.value" @click="save">
        <Spinner v-if="update.isPending.value" class="mr-2" />
        {{ dirtyCount ? $t('systemSettings.saveCount', { count: dirtyCount }, dirtyCount) : $t('common.saveChanges') }}
      </Button>
    </template>

    <div class="grid gap-4">
      <Alert v-if="!canManage">
        <AlertDescription>{{ $t('systemSettings.readOnly') }}</AlertDescription>
      </Alert>

      <template v-if="isPending">
        <Skeleton v-for="i in 2" :key="i" class="h-40 w-full" />
      </template>

      <Card v-for="{ group, views: items } in groups" :key="group" class="gap-0">
        <CardHeader>
          <CardTitle>{{ groupTitle(group) }}</CardTitle>
        </CardHeader>
        <CardContent>
          <template v-for="(view, index) in items" :key="view.key">
            <Separator v-if="index" />
            <SettingField
              v-model="inputs[view.key]!"
              :view="view"
              :problem="problems[view.key]"
              :disabled="!canManage || update.isPending.value"
              @reset="reset(view.key)"
            />
          </template>
        </CardContent>
      </Card>

      <p class="text-xs text-muted-foreground">
        {{ $t('systemSettings.envHint') }}
      </p>
    </div>
  </BasicPage>
</template>

<route lang="yaml">
meta:
  permission: setting:read
</route>
