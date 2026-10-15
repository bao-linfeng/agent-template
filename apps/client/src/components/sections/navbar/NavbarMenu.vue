<script setup lang="ts">
import { Menu } from '@lucide/vue'
import { Button } from '@repo/ui/components/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@repo/ui/components/sheet'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const isOpen = ref(false)
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetTrigger as-child>
      <Button variant="ghost" size="icon">
        <Menu class="h-5 w-5" />
        <span class="sr-only">{{ t('nav.toggleMenu') }}</span>
      </Button>
    </SheetTrigger>
    <SheetContent side="left" class="w-[280px] sm:w-[340px]">
      <SheetHeader>
        <SheetTitle>
          <slot name="title">
            {{ t('nav.menu') }}
          </slot>
        </SheetTitle>
        <SheetDescription>
          <slot name="description">
            {{ t('nav.navigationMenu') }}
          </slot>
        </SheetDescription>
      </SheetHeader>
      <div class="flex-1 overflow-y-auto px-4">
        <slot />
      </div>
      <SheetFooter>
        <slot name="footer" />
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
