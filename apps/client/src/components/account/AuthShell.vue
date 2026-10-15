<script setup lang="ts">
import { PackageCheck } from '@lucide/vue'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@repo/ui/components/card'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'

defineProps<{
  title: string
  description?: string
}>()

const { t } = useI18n()
</script>

<template>
  <!-- Sign-in pages skip the site navbar; only a home link and the language switcher remain. -->
  <main class="relative flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12">
    <div class="absolute right-4 top-4">
      <LanguageSwitcher />
    </div>
    <RouterLink
      to="/"
      class="flex items-center gap-2 text-primary transition-opacity hover:opacity-80"
      :aria-label="t('nav.goHome')"
    >
      <PackageCheck class="size-6" />
      <span class="font-semibold">BuildY</span>
    </RouterLink>
    <Card class="w-full max-w-md">
      <CardHeader>
        <CardTitle class="text-2xl">
          {{ title }}
        </CardTitle>
        <CardDescription v-if="description || $slots.description">
          <slot name="description">
            {{ description }}
          </slot>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <slot />
      </CardContent>
      <CardFooter v-if="$slots.footer" class="flex flex-wrap justify-center gap-1 text-sm text-muted-foreground">
        <slot name="footer" />
      </CardFooter>
    </Card>
  </main>
</template>
