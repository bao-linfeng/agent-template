<script setup lang="ts">
import { Badge } from '@repo/ui/components/badge'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/layers/button'
import {
  Hero,
  HeroActions,
  HeroContent,
  HeroDescription,
  HeroTitle,
} from '@/components/sections/hero'
import { MainNavigation } from '@/components/sections/navbar'

const { t } = useI18n()

// Заглушки изображений
const placeholders = {
  abstract: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImEiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMwMEIyRkY7c3RvcC1vcGFjaXR5OjEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMwMDY2Q0M7c3RvcC1vcGFjaXR5OjEiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cGF0aCBkPSJNMCAwaDgwMHY2MDBIMHoiIGZpbGw9InVybCgjYSkiLz48L3N2Zz4=',
  pattern: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIj48cGF0aCBkPSJNMCAwaDIwdjIwSDB6IiBmaWxsPSJub25lIi8+PGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iMiIgZmlsbD0icmdiYSgwLDAsMCwwLjEpIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==',
}
</script>

<template>
  <MainNavigation />

  <!-- Large Hero with gradient overlay -->
  <Hero section-key="transform_your_business_with_ai_powered_solutions" layout="centered" height="nav" class="bg-linear-to-br from-primary/20 via-primary/10 to-background">
    <div class="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.5))]" />
    <HeroContent class="relative z-10" padding="md">
      <Badge variant="outline" class="mb-4">
        {{ t('demo.promo.ai.badge') }}
      </Badge>
      <HeroTitle class="max-w-4xl">
        {{ t('demo.promo.ai.title') }}
      </HeroTitle>
      <HeroDescription>
        {{ t('demo.promo.ai.description') }}
      </HeroDescription>
      <HeroActions>
        <Button size="lg" variant="default">
          {{ t('demo.actions.startFreeTrial') }}
        </Button>
        <Button size="lg" variant="outline" class="bg-primary-foreground/50 hover:bg-primary-foreground">
          {{ t('demo.actions.watchDemo') }}
        </Button>
      </HeroActions>
    </HeroContent>
  </Hero>

  <!-- Medium Hero with abstract background -->
  <Hero section-key="50_off_for_early_birds" layout="centered" height="screen" class="relative overflow-hidden">
    <div
      class="absolute inset-0 bg-cover bg-center opacity-20"
      :style="{ backgroundImage: `url(${placeholders.abstract})` }"
    />
    <HeroContent class="relative z-10" padding="md">
      <Badge class="dark:text-secondary-foreground">
        {{ t('demo.earlyBird.badge') }}
      </Badge>
      <HeroTitle>{{ t('demo.earlyBird.title') }}</HeroTitle>
      <HeroDescription>
        {{ t('demo.earlyBird.description') }}
      </HeroDescription>
      <HeroActions>
        <Button variant="default" class="rounded-full my-8 py-6 px-10">
          {{ t('demo.actions.claimOffer') }}
        </Button>
      </HeroActions>
    </HeroContent>
  </Hero>

  <!-- Full screen Hero with image background -->
  <Hero section-key="build_the_future_today" layout="centered" height="screen" class="relative">
    <div class="absolute inset-0">
      <img :src="placeholders.abstract" class="object-cover w-full h-full" :alt="t('demo.promo.background')">
      <div class="absolute inset-0 bg-linear-to-t from-background via-background/80 to-background/20" />
    </div>
    <HeroContent class="relative z-10" padding="md">
      <HeroTitle>{{ t('demo.promo.future.title') }}</HeroTitle>
      <HeroDescription>
        {{ t('demo.promo.future.description') }}
      </HeroDescription>
      <HeroActions>
        <Button size="lg" variant="default">
          {{ t('demo.actions.getStarted') }}
        </Button>
        <Button size="lg" variant="outline" class="bg-background/50 hover:bg-background/20">
          {{ t('demo.actions.scheduleDemo') }}
        </Button>
      </HeroActions>
    </HeroContent>
  </Hero>

  <!-- Hero with overlay background -->
  <Hero section-key="30_off_for_early_birds" layout="centered" height="screen" background="overlay">
    <HeroContent class="relative z-10" padding="md">
      <Badge class="dark:text-secondary-foreground">
        {{ t('demo.earlyBird.badge') }}
      </Badge>
      <HeroTitle>{{ t('demo.earlyBird.title30') }}</HeroTitle>
      <HeroDescription>
        {{ t('demo.earlyBird.description') }}
      </HeroDescription>
      <HeroActions>
        <Button variant="default" class="rounded-full my-8 py-6 px-10">
          {{ t('demo.actions.claimOffer') }}
        </Button>
      </HeroActions>
    </HeroContent>
  </Hero>
</template>
