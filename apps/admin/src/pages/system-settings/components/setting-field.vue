<script setup lang="ts">
import { RotateCcwIcon } from '@lucide/vue'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Input } from '@repo/ui/components/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select'
import { Switch } from '@repo/ui/components/switch'
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'

import type { SettingInput, SettingProblem } from '@/lib/system-settings'
import type { ISettingView } from '@/services/api/settings.api'

import { isSettingDirty, settingControl } from '@/lib/system-settings'

const props = defineProps<{
  view: ISettingView
  problem?: SettingProblem
  /** Read-only without `setting:manage`, and while saving. */
  disabled?: boolean
}>()
const emit = defineEmits<{ reset: [] }>()
const input = defineModel<SettingInput>({ required: true })

const { t, te } = useI18n()

const control = computed(() => settingControl(props.view.schema))
const dirty = computed(() => isSettingDirty(props.view, input.value))
const id = computed(() => `setting-${props.view.key}`)

/** Translated in the console when known, otherwise the key and the server's (Chinese) description. */
const title = computed(() => {
  const key = `systemSettings.items.${props.view.key}.title`
  return te(key) ? t(key) : props.view.key
})
const description = computed(() => {
  const key = `systemSettings.items.${props.view.key}.description`
  return te(key) ? t(key) : props.view.description
})

function display(value: unknown): string {
  if (typeof value === 'boolean')
    return value ? t('common.enabled') : t('common.disabled')
  return typeof value === 'string' ? value : JSON.stringify(value)
}

const range = computed(() => {
  const { minimum: min, maximum: max } = props.view.schema
  return min !== undefined && max !== undefined ? t('systemSettings.range', { min, max }) : undefined
})
</script>

<template>
  <div class="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
    <div class="min-w-0 flex-1 space-y-1">
      <div class="flex flex-wrap items-center gap-2">
        <label :for="id" class="text-sm font-medium">{{ title }}</label>
        <Badge v-if="view.overridden" variant="secondary">
          {{ $t('systemSettings.overridden') }}
        </Badge>
        <Badge v-if="view.public" variant="outline">
          {{ $t('systemSettings.public') }}
        </Badge>
        <Badge v-if="dirty" variant="outline" class="border-amber-500 text-amber-600 dark:text-amber-400">
          {{ $t('systemSettings.unsaved') }}
        </Badge>
      </div>
      <p class="text-sm text-muted-foreground">
        {{ description }}
      </p>
      <p class="text-xs text-muted-foreground">
        <code>{{ view.key }}</code>
        · {{ $t('systemSettings.defaultValue', { value: display(view.defaultValue) }) }}
        <template v-if="range">
          · {{ range }}
        </template>
        <template v-if="view.updatedAt">
          · {{ $t('systemSettings.updatedAt', { date: dayjs(view.updatedAt).format('YYYY-MM-DD HH:mm') }) }}
        </template>
      </p>
    </div>

    <div class="flex shrink-0 flex-col items-start gap-1 sm:items-end">
      <div class="flex items-center gap-2">
        <Switch
          v-if="control === 'switch'"
          :id="id"
          :model-value="input === true"
          :disabled="disabled"
          @update:model-value="input = $event"
        />
        <Input
          v-else-if="control === 'integer' || control === 'number'"
          :id="id"
          :model-value="String(input)"
          type="number"
          inputmode="decimal"
          :step="control === 'integer' ? 1 : 'any'"
          :min="view.schema.minimum"
          :max="view.schema.maximum"
          :disabled="disabled"
          :aria-invalid="problem ? true : undefined"
          class="w-32 text-right tabular-nums"
          @update:model-value="input = String($event)"
        />
        <Select
          v-else-if="control === 'select'"
          :model-value="String(input)"
          :disabled="disabled"
          @update:model-value="input = String($event)"
        >
          <SelectTrigger :id="id" class="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="option in view.schema.enum" :key="String(option)" :value="String(option)">
              {{ option }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Input
          v-else-if="control === 'text'"
          :id="id"
          :model-value="String(input)"
          :maxlength="view.schema.maxLength"
          :disabled="disabled"
          :aria-invalid="problem ? true : undefined"
          class="w-64"
          @update:model-value="input = String($event)"
        />
        <code v-else :id="id" class="rounded bg-muted px-2 py-1 text-xs">{{ display(view.value) }}</code>

        <Button
          v-if="view.overridden"
          variant="ghost"
          size="icon"
          class="size-8"
          :disabled="disabled"
          :title="$t('systemSettings.resetToDefault')"
          @click="emit('reset')"
        >
          <RotateCcwIcon class="size-4" />
          <span class="sr-only">{{ $t('systemSettings.resetToDefault') }}</span>
        </Button>
      </div>
      <p v-if="problem" class="text-xs text-destructive">
        {{ $t(problem.message, problem.params ?? {}) }}
      </p>
    </div>
  </div>
</template>
