<script setup lang="ts">
import { Button } from '@repo/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@repo/ui/components/dialog'
import { FieldDescription, FieldError } from '@repo/ui/components/field'
import { FormItem } from '@repo/ui/components/form'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'
import { Spinner } from '@repo/ui/components/spinner'
import { toast } from 'vue-sonner'

import type { IAnnouncement } from '@/services/api/announcements.api'

import { fromLocalInput, nextHourInput, scheduleError, toLocalInput } from '@/lib/announcements'
import { t } from '@/plugins/i18n'
import { usePublishAnnouncementMutation } from '@/services/api/announcements.api'

/** Schedules a draft or moves the publication time of a scheduled one (`POST /announcements/:id/publish`). */
const props = defineProps<{ announcement: IAnnouncement }>()
const open = defineModel<boolean>('open', { default: false })

const publish = usePublishAnnouncementMutation()
const publishAt = shallowRef('')
const submitted = shallowRef(false)

const ERROR_MESSAGES = {
  futureTime: 'validation.futureTime',
  beforeExpiry: 'announcements.publishAfterExpiry',
} as const
const error = computed(() => {
  const reason = scheduleError(publishAt.value, toLocalInput(props.announcement.expiresAt))
  return reason ? t(ERROR_MESSAGES[reason]) : null
})

watch(open, (isOpen) => {
  if (!isOpen)
    return
  submitted.value = false
  publishAt.value = props.announcement.status === 'scheduled'
    ? toLocalInput(props.announcement.publishedAt)
    : nextHourInput()
})

async function onSubmit() {
  submitted.value = true
  const iso = fromLocalInput(publishAt.value)
  if (error.value || !iso)
    return
  try {
    await publish.mutateAsync({ id: props.announcement.id, publishAt: iso })
  }
  catch {
    return // Toasted by the global mutation handler.
  }
  toast.success(t('announcements.scheduled'))
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ $t('announcements.scheduleTitle') }}</DialogTitle>
        <DialogDescription>{{ $t('announcements.scheduleDescription', { title: announcement.title }) }}</DialogDescription>
      </DialogHeader>

      <form id="announcement-schedule-form" novalidate @submit.prevent="onSubmit">
        <FormItem>
          <Label for="announcement-schedule-at" :data-error="submitted && !!error" class="data-[error=true]:text-destructive">
            {{ $t('announcements.fields.publishAt') }}
          </Label>
          <Input
            id="announcement-schedule-at"
            v-model="publishAt"
            type="datetime-local"
            :aria-invalid="(submitted && !!error) || undefined"
          />
          <FieldDescription>{{ $t('announcements.fields.publishAtHint') }}</FieldDescription>
          <FieldError v-if="submitted && error" :errors="[error]" />
        </FormItem>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" @click="open = false">
          {{ $t('common.cancel') }}
        </Button>
        <Button type="submit" form="announcement-schedule-form" :disabled="publish.isPending.value">
          <Spinner v-if="publish.isPending.value" class="mr-2" />
          {{ $t('announcements.submit.schedule') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
