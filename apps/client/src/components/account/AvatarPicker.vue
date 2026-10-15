<script setup lang="ts">
import { ImageUp, Trash2 } from '@lucide/vue'
import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/avatar'
import { Button } from '@repo/ui/components/button'
import { computed, shallowRef, useTemplateRef } from 'vue'
import { AVATAR_TYPES, checkAvatar } from '@/lib/validation'

const props = defineProps<{
  /** Current image (URL or object URL). */
  src?: string | null
  /** Used for the fallback initials. */
  name?: string
  busy?: boolean
  removable?: boolean
}>()

const emit = defineEmits<{
  select: [file: File]
  remove: []
}>()

const input = useTemplateRef<HTMLInputElement>('input')
const error = shallowRef('')
const initials = computed(() => [...(props.name?.trim() || '?')].slice(0, 2).join('').toUpperCase())

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file)
    return
  error.value = checkAvatar(file) ?? ''
  if (!error.value)
    emit('select', file)
}
</script>

<template>
  <div class="flex items-center gap-4">
    <Avatar class="size-16">
      <AvatarImage v-if="src" :src="src" :alt="name" class="object-cover" />
      <AvatarFallback class="text-lg">
        {{ initials }}
      </AvatarFallback>
    </Avatar>
    <div class="grid gap-2">
      <div class="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" :disabled="busy" @click="input?.click()">
          <ImageUp class="size-4" />
          {{ src ? 'Change avatar' : 'Choose avatar' }}
        </Button>
        <Button v-if="removable && src" type="button" variant="ghost" size="sm" :disabled="busy" @click="emit('remove')">
          <Trash2 class="size-4" />
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
