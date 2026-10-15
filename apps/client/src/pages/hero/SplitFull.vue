<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/avatar'
import { Badge } from '@repo/ui/components/badge'
import { Card } from '@repo/ui/components/card'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/layers/button'
import {
  Hero,
  HeroContent,
  HeroDescription,
  HeroMedia,
  HeroTitle,
} from '@/components/sections/hero'
import { MainNavigation } from '@/components/sections/navbar'

const { t } = useI18n()

// Заглушки изображений
const placeholderLight = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iI2Q1ZjRkYyIvPjwvc3ZnPg=='
const placeholderDark = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iIzAxMGUwNCIvPjwvc3ZnPg=='
</script>

<template>
  <MainNavigation />

  <!-- Секция 1: Дашборд Preview -->
  <Hero section-key="powerful_analytics" layout="split" height="nav">
    <HeroContent
      align="left"
      padding="md"
      width="lg"
      class="space-y-8"
    >
      <Badge variant="outline">
        {{ t('demo.splitFull.analytics.badge') }}
      </Badge>
      <HeroTitle size="3xl">
        {{ t('demo.splitFull.analytics.title') }}
      </HeroTitle>
      <HeroDescription>
        {{ t('demo.splitFull.analytics.description') }}
      </HeroDescription>
      <div class="grid grid-cols-2 gap-4">
        <Card class="p-4 space-y-2">
          <div class="text-2xl font-bold text-primary">
            84%
          </div>
          <p class="text-xs text-muted-foreground">
            {{ t('demo.splitFull.analytics.conversion') }}
          </p>
        </Card>
        <Card class="p-4 space-y-2">
          <div class="text-2xl font-bold text-primary">
            12.5k
          </div>
          <p class="text-xs text-muted-foreground">
            {{ t('demo.splitFull.analytics.activeUsers') }}
          </p>
        </Card>
      </div>
    </HeroContent>
    <HeroMedia
      rounded="none"
      aspect-ratio="auto"
      class="h-full bg-linear-to-br from-primary/5 to-primary/10"
    >
      <img
        :src="placeholderLight"
        class="object-cover w-full h-full dark:hidden"
        :alt="t('demo.split.enterprise.imageAlt')"
      >
      <img
        :src="placeholderDark"
        class="object-cover w-full h-full hidden dark:block"
        :alt="t('demo.split.enterprise.imageAlt')"
      >
    </HeroMedia>
  </Hero>

  <!-- Секция 2: Feature Comparison -->
  <Hero section-key="basic_plan" layout="split" height="nav">
    <HeroMedia
      rounded="none"
      class="relative h-full bg-secondary/50"
    >
      <div class="absolute inset-0 bg-linear-to-tr from-primary/20 to-primary/5" />
      <div class="relative h-full flex items-center">
        <div class="w-full max-w-2xl mx-auto grid grid-cols-2 gap-4 p-8">
          <Card class="p-6 space-y-4 bg-background/80 backdrop-blur-xs">
            <h3 class="font-semibold">
              {{ t('demo.splitFull.plans.basic') }}
            </h3>
            <ul class="space-y-2 text-sm">
              <li class="flex items-center gap-2">
                <div class="h-2 w-2 rounded-full bg-primary" />
                <span>{{ t('demo.splitFull.plans.basicProjects') }}</span>
              </li>
              <li class="flex items-center gap-2">
                <div class="h-2 w-2 rounded-full bg-primary" />
                <span>{{ t('demo.splitFull.plans.basicAnalytics') }}</span>
              </li>
            </ul>
          </Card>
          <Card class="p-6 space-y-4 bg-background/80 backdrop-blur-xs">
            <h3 class="font-semibold">
              {{ t('demo.splitFull.plans.pro') }}
            </h3>
            <ul class="space-y-2 text-sm">
              <li class="flex items-center gap-2">
                <div class="h-2 w-2 rounded-full bg-primary" />
                <span>{{ t('demo.splitFull.plans.proProjects') }}</span>
              </li>
              <li class="flex items-center gap-2">
                <div class="h-2 w-2 rounded-full bg-primary" />
                <span>{{ t('demo.splitFull.plans.proAnalytics') }}</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </HeroMedia>
    <HeroContent
      align="left"
      padding="md"
      width="lg"
    >
      <HeroTitle>{{ t('demo.splitFull.plans.title') }}</HeroTitle>
      <HeroDescription>
        {{ t('demo.splitFull.plans.description') }}
      </HeroDescription>
      <div class="mt-8 space-y-4">
        <Button class="w-full" size="lg">
          {{ t('demo.actions.startFreeTrial') }}
        </Button>
        <p class="text-sm text-center text-muted-foreground">
          {{ t('demo.splitFull.plans.noCard') }}
        </p>
      </div>
    </HeroContent>
  </Hero>

  <!-- Секция 3: Testimonial Split -->
  <Hero section-key="hero_3" layout="split" height="nav">
    <HeroContent
      align="left"
      padding="md"
      width="lg"
      class="space-y-8"
    >
      <div class="space-y-4">
        <Badge class="dark:text-secondary-foreground">
          {{ t('demo.splitFull.story.badge') }}
        </Badge>
        <blockquote class="text-2xl font-serif italic">
          {{ t('demo.splitFull.story.quote') }}
        </blockquote>
      </div>
      <div class="flex items-center gap-4">
        <Avatar class="h-12 w-12">
          <AvatarImage src="https://github.com/shadcn.png" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
        <div>
          <div class="font-semibold">
            {{ t('demo.splitFull.story.name') }}
          </div>
          <div class="text-sm text-muted-foreground">
            {{ t('demo.splitFull.story.role') }}
          </div>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-4">
        <Card class="p-4 text-center">
          <div class="text-2xl font-bold text-primary">
            250%
          </div>
          <p class="text-sm text-muted-foreground">
            {{ t('demo.splitFull.story.roi') }}
          </p>
        </Card>
        <Card class="p-4 text-center">
          <div class="text-2xl font-bold text-primary">
            10x
          </div>
          <p class="text-sm text-muted-foreground">
            {{ t('demo.splitFull.story.faster') }}
          </p>
        </Card>
        <Card class="p-4 text-center">
          <div class="text-2xl font-bold text-primary">
            24/7
          </div>
          <p class="text-sm text-muted-foreground">
            {{ t('demo.splitFull.story.support') }}
          </p>
        </Card>
      </div>
    </HeroContent>
    <HeroMedia
      rounded="none"
      class="relative h-full"
    >
      <div class="absolute inset-0 bg-linear-to-br from-primary/20 via-primary/10 to-transparent" />
      <div class="relative h-full flex items-center justify-center p-12">
        <div class="relative w-full max-w-lg">
          <div class="absolute -inset-4 bg-primary/5 blur-2xl rounded-[2rem]" />
          <img
            :src="placeholderLight"
            class="relative dark:hidden rounded-2xl shadow-2xl"
            :alt="t('demo.splitFull.story.screenshot')"
          >
          <img
            :src="placeholderDark"
            class="relative hidden dark:block rounded-2xl shadow-2xl"
            :alt="t('demo.splitFull.story.screenshot')"
          >
        </div>
      </div>
    </HeroMedia>
  </Hero>
</template>
