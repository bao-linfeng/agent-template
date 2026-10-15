<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Button } from '@repo/ui/components/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@repo/ui/components/dropdown-menu'
import { useI18n } from 'vue-i18n'

import { setLocale } from '@/plugins/i18n'

const { locale } = useI18n()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="outline"
        size="icon-sm"
        :aria-label="$t('header.changeLanguage')"
        :title="$t('header.changeLanguage')"
      >
        <Icon icon="mdi:translate" />
        <span class="sr-only">{{ $t('header.changeLanguage') }}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuRadioGroup
        :model-value="locale"
        @update:model-value="setLocale"
      >
        <DropdownMenuRadioItem value="en">
          <Icon icon="flag:us-4x3" />
          <span>English</span>
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="zh">
          <Icon icon="flag:cn-4x3" />
          <span>中文</span>
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
