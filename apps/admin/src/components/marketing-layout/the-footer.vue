<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Avatar, AvatarImage } from '@repo/ui/components/avatar'
import { Button } from '@repo/ui/components/button'
import { useColorMode } from '@vueuse/core'

import { SITE_CONFIG } from '@/config/site'

const mode = useColorMode()

const links = [
  {
    name: 'github',
    icon: 'simple-icons:github',
    url: 'https://github.com/bao-linfeng/agent-template',
  },
]
</script>

<template>
  <footer class="min-h-18 flex items-center justify-between">
    <Avatar>
      <AvatarImage :src="`${mode === 'dark' ? SITE_CONFIG.logo.dark : SITE_CONFIG.logo.light}`" alt="Logo" />
    </Avatar>

    <div>© Agent Template</div>

    <div class="flex items-center gap-2">
      <Button
        v-for="link in links"
        :key="link.name"
        variant="outline"
        size="icon"
        as="a"
        :href="link.url"
        target="_blank"
      >
        <Icon :icon="link.icon" />
      </Button>
    </div>
  </footer>
</template>
