<script setup lang="ts">
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { useI18n } from 'vue-i18n'
import {
  Hero,
  HeroActions,
  HeroContent,
  HeroDescription,
  HeroMedia,
  HeroTitle,
} from '@/components/sections/hero'
import { MainNavigation } from '@/components/sections/navbar'

const { t } = useI18n()

// Base64 заглушки для изображений
const placeholderLight = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iI2Q1ZjRkYyIvPjwvc3ZnPg=='
const placeholderDark = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iIzAxMGUwNCIvPjwvc3ZnPg=='
</script>

<template>
  <MainNavigation />

  <!-- Hero 1: Centered with background -->
  <Hero section-key="a_better_way_to_build_your_saas" layout="centered" height="nav" class="bg-linear-to-b from-muted/50 to-background dark:from-muted/10">
    <HeroContent class="container mx-auto" padding="md">
      <Badge>{{ t('demo.hero.saas.badge') }}</Badge>
      <HeroTitle>{{ t('demo.hero.saas.title') }}</HeroTitle>
      <HeroDescription>
        {{ t('demo.hero.saas.description') }}
      </HeroDescription>
      <HeroActions>
        <Button size="lg">
          {{ t('demo.actions.getStarted') }}
        </Button>
        <Button size="lg" variant="outline">
          {{ t('demo.actions.learnMore') }}
        </Button>
      </HeroActions>
    </HeroContent>
  </Hero>

  <!-- Hero 2: Split with image -->
  <Hero section-key="transform_your_workflow_one" layout="split" height="medium" spacing="md">
    <HeroContent align="left" padding="md">
      <HeroTitle>{{ t('demo.workflow.title') }}</HeroTitle>
      <HeroDescription>
        {{ t('demo.workflow.description') }}
      </HeroDescription>
      <HeroActions class="justify-start">
        <Button size="lg">
          {{ t('demo.actions.tryNow') }}
        </Button>
      </HeroActions>
    </HeroContent>

    <HeroMedia aspect-ratio="video">
      <img
        :src="placeholderLight"
        class="object-cover w-full h-full dark:hidden"
        :alt="t('common.placeholderImage')"
      >
      <img
        :src="placeholderDark"
        class="object-cover w-full h-full hidden dark:block"
        :alt="t('common.placeholderImage')"
      >
    </HeroMedia>
  </Hero>

  <!-- Hero 3: Minimal centered -->
  <Hero section-key="simple_fast_secure_" layout="centered" height="medium" spacing="sm">
    <HeroContent class="container mx-auto" padding="md">
      <HeroTitle>
        {{ t('demo.hero.simple.title') }}
      </HeroTitle>
      <HeroDescription class="max-w-xl">
        {{ t('demo.hero.simple.description') }}
      </HeroDescription>
      <HeroActions>
        <Button size="lg">
          {{ t('demo.actions.startFreeTrial') }}
        </Button>
      </HeroActions>
    </HeroContent>
  </Hero>

  <!-- Hero 4: Split with image -->
  <Hero section-key="transform_your_workflow_two" layout="split" height="medium" spacing="md">
    <HeroMedia aspect-ratio="video">
      <img
        :src="placeholderLight"
        class="object-cover w-full h-full dark:hidden"
        :alt="t('common.placeholderImage')"
      >
      <img
        :src="placeholderDark"
        class="object-cover w-full h-full hidden dark:block"
        :alt="t('common.placeholderImage')"
      >
    </HeroMedia>
    <HeroContent align="left" padding="md">
      <HeroTitle>{{ t('demo.workflow.title') }}</HeroTitle>
      <HeroDescription>
        {{ t('demo.workflow.description') }}
      </HeroDescription>
      <HeroActions class="justify-start">
        <Button size="lg">
          {{ t('demo.actions.tryNow') }}
        </Button>
      </HeroActions>
    </HeroContent>
  </Hero>

  <!-- Hero 5: Full screen with overlay -->
  <Hero section-key="build_the_future" layout="centered" height="screen" class="relative">
    <div class="absolute inset-0">
      <img
        :src="placeholderLight"
        class="object-cover w-full h-full dark:hidden"
        :alt="t('common.placeholderImage')"
      >
      <img
        :src="placeholderDark"
        class="object-cover w-full h-full hidden dark:block"
        :alt="t('common.placeholderImage')"
      >
      <div class="absolute inset-0 bg-background/80 backdrop-blur-xs" />
    </div>
    <HeroContent class="relative container mx-auto z-10" padding="md">
      <HeroTitle>{{ t('demo.hero.future.title') }}</HeroTitle>
      <HeroDescription>
        {{ t('demo.hero.future.description') }}
      </HeroDescription>
      <HeroActions>
        <Button size="lg" variant="default">
          {{ t('demo.actions.getStarted') }}
        </Button>
        <Button size="lg" variant="outline">
          {{ t('demo.actions.viewDemo') }}
        </Button>
      </HeroActions>
    </HeroContent>
  </Hero>
</template>
