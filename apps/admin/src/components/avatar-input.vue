<script setup lang="ts">
import { ImageUpIcon, Trash2Icon } from '@lucide/vue'
import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/avatar'
import { Button } from '@repo/ui/components/button'

import { AVATAR_TYPES, initialsOf, validateAvatarFile } from '@/lib/avatar'

const { src, name, loading, removable } = defineProps<{
  /** Current image (URL or object URL). */
  src?: string | null
  /** Used for the fallback initials. */
  name?: string
  loading?: boolean
  removable?: boolean
}>()

const emit = defineEmits<{
  /** A valid image was chosen. */
  select: [file: File]
  remove: []
}>()

const input = useTemplateRef<HTMLInputElement>('input')
const error = shallowRef('')

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file)
    return
  error.value = validateAvatarFile(file) ?? ''
  if (!error.value)
    emit('select', file)
}
</script>

<template>
  <div class="flex items-center gap-4">
    <Avatar class="size-16 rounded-full">
      <AvatarImage v-if="src" :src="src" :alt="name" class="object-cover" />
      <AvatarFallback class="text-lg">
        {{ initialsOf(name) }}
      </AvatarFallback>
    </Avatar>
    <div class="grid gap-2">
      <div class="flex gap-2">
        <Button type="button" variant="outline" size="sm" :disabled="loading" @click="input?.click()">
          <ImageUpIcon />
          {{ src ? 'Change avatar' : 'Upload avatar' }}
        </Button>
        <Button v-if="removable && src" type="button" variant="ghost" size="sm" :disabled="loading" @click="emit('remove')">
          <Trash2Icon />
          Remove
        </Button>
      </div>
      <p class="text-xs text-muted-foreground">
        PNG, JPEG, GIF or WebP, up to 2 MB.
      </p>
      <p v-if="error" role="alert" class="text-sm text-destructive">
        {{ error }}
      </p>
    </div>
    <input ref="input" type="file" class="hidden" :accept="AVATAR_TYPES.join(',')" @change="onChange">
  </div>
</template>
