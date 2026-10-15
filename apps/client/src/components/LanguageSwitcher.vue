<script setup lang="ts">
import { Languages } from '@lucide/vue'
import { Button } from '@repo/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'
import { useI18n } from 'vue-i18n'
import { isLocale, LOCALE_LABELS, setLocale, SUPPORTED_LOCALES } from '@/i18n'

const { t, locale } = useI18n()

function onSelect(value: unknown) {
  if (isLocale(value))
    setLocale(value)
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="icon"
        class="rounded-full size-9"
        :aria-label="t('common.changeLanguage')"
        :title="t('common.changeLanguage')"
      >
        <Languages class="size-[1.1rem]" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuLabel>{{ t('common.language') }}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup :model-value="locale" @update:model-value="onSelect">
        <DropdownMenuRadioItem v-for="code in SUPPORTED_LOCALES" :key="code" :value="code" :lang="code">
          {{ LOCALE_LABELS[code] }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
