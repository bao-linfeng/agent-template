<script setup lang="ts">
import { Button } from '@repo/ui/components/button'
import { Checkbox } from '@repo/ui/components/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@repo/ui/components/dialog'
import { FieldDescription, FieldError } from '@repo/ui/components/field'
import { FormItem } from '@repo/ui/components/form'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select'
import { Spinner } from '@repo/ui/components/spinner'
import { Textarea } from '@repo/ui/components/textarea'
import { useForm } from '@tanstack/vue-form'
import { toast } from 'vue-sonner'

import type { AnnouncementFormValues } from '@/lib/announcements'
import type { AnnouncementAudience, IAnnouncement } from '@/services/api/announcements.api'
import type { AnnouncementLevel } from '@/services/api/notifications.api'

import FormTextField from '@/components/form-text-field.vue'
import { announcementChanges, toCreateBody, toFormValues } from '@/lib/announcements'
import { t } from '@/plugins/i18n'
import { useCreateAnnouncementMutation, useUpdateAnnouncementMutation } from '@/services/api/announcements.api'

import { announcementAudiences, announcementLevels } from '../data/data'
import { announcementValidator } from '../validators/announcement.validator'

/** Creates an announcement when `announcement` is omitted, otherwise edits it (keeping its publication state). */
const props = defineProps<{ announcement?: IAnnouncement }>()
const open = defineModel<boolean>('open', { default: false })

const create = useCreateAnnouncementMutation()
const update = useUpdateAnnouncementMutation()
const pending = computed(() => create.isPending.value || update.isPending.value)
const publishNow = shallowRef(false)

async function save(value: AnnouncementFormValues) {
  if (!props.announcement) {
    await create.mutateAsync({ ...toCreateBody(value), publish: publishNow.value })
    toast.success(publishNow.value ? t('announcements.published') : t('announcements.created'))
    return
  }
  const changes = announcementChanges(props.announcement, value)
  if (Object.keys(changes).length > 0)
    await update.mutateAsync({ id: props.announcement.id, ...changes })
  toast.success(t('announcements.updated'))
}

const form = useForm({
  defaultValues: toFormValues(props.announcement),
  validators: { onSubmit: announcementValidator },
  onSubmit: async ({ value }) => {
    try {
      await save(value)
    }
    catch {
      return // Toasted by the global mutation handler.
    }
    open.value = false
  },
})

watch(open, (isOpen) => {
  if (isOpen) {
    form.reset(toFormValues(props.announcement))
    publishNow.value = false
  }
})

function invalid(meta: { isTouched: boolean, errors: unknown[] }) {
  return meta.isTouched && meta.errors.length > 0
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ announcement ? $t('announcements.editTitle') : $t('announcements.new') }}</DialogTitle>
        <DialogDescription>
          {{ announcement ? $t(`announcements.statuses.${announcement.status}`) : $t('announcements.createDescription') }}
        </DialogDescription>
      </DialogHeader>

      <form id="announcement-form" class="grid gap-5" novalidate @submit.prevent="form.handleSubmit">
        <form.Field name="title">
          <template #default="{ field }">
            <FormTextField :field="field" :label="$t('announcements.fields.title')" />
          </template>
        </form.Field>

        <form.Field name="body">
          <template #default="{ field }">
            <FormItem>
              <Label for="announcement-body" :data-error="invalid(field.state.meta)" class="data-[error=true]:text-destructive">
                {{ $t('announcements.fields.body') }}
              </Label>
              <Textarea
                id="announcement-body"
                rows="5"
                :model-value="field.state.value"
                :aria-invalid="invalid(field.state.meta) || undefined"
                @update:model-value="field.handleChange(String($event))"
                @blur="field.handleBlur"
              />
              <FieldDescription>{{ $t('announcements.fields.bodyHint') }}</FieldDescription>
              <FieldError v-if="invalid(field.state.meta)" :errors="field.state.meta.errors" />
            </FormItem>
          </template>
        </form.Field>

        <div class="grid gap-5 sm:grid-cols-2">
          <form.Field name="level">
            <template #default="{ field }">
              <FormItem>
                <Label>{{ $t('announcements.fields.level') }}</Label>
                <Select :model-value="field.state.value" @update:model-value="field.handleChange($event as AnnouncementLevel)">
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="level in announcementLevels" :key="level.value" :value="level.value">
                      {{ $t(level.label) }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            </template>
          </form.Field>
          <form.Field name="audience">
            <template #default="{ field }">
              <FormItem>
                <Label>{{ $t('announcements.fields.audience') }}</Label>
                <Select :model-value="field.state.value" @update:model-value="field.handleChange($event as AnnouncementAudience)">
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="audience in announcementAudiences" :key="audience.value" :value="audience.value">
                      {{ $t(audience.label) }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            </template>
          </form.Field>
        </div>

        <form.Field name="expiresAt">
          <template #default="{ field }">
            <FormItem>
              <Label for="announcement-expires" :data-error="invalid(field.state.meta)" class="data-[error=true]:text-destructive">
                {{ $t('announcements.fields.expiresAt') }}
              </Label>
              <Input
                id="announcement-expires"
                type="datetime-local"
                :model-value="field.state.value"
                :aria-invalid="invalid(field.state.meta) || undefined"
                @update:model-value="field.handleChange(String($event))"
                @blur="field.handleBlur"
              />
              <FieldDescription>{{ $t('announcements.fields.expiresAtHint') }}</FieldDescription>
              <FieldError v-if="invalid(field.state.meta)" :errors="field.state.meta.errors" />
            </FormItem>
          </template>
        </form.Field>

        <label v-if="!announcement" class="flex items-center gap-2 text-sm">
          <Checkbox v-model="publishNow" />
          {{ $t('announcements.publishNow') }}
        </label>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" @click="open = false">
          {{ $t('common.cancel') }}
        </Button>
        <Button type="submit" form="announcement-form" :disabled="pending">
          <Spinner v-if="pending" class="mr-2" />
          <template v-if="announcement">
            {{ $t('common.saveChanges') }}
          </template>
          <template v-else>
            {{ publishNow ? $t('announcements.createAndPublish') : $t('announcements.saveDraft') }}
          </template>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
