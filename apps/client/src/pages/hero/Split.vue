<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/avatar'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'
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

const placeholders = {
  abstract: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImEiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMwMEIyRkY7c3RvcC1vcGFjaXR5OjEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMwMDY2Q0M7c3RvcC1vcGFjaXR5OjEiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cGF0aCBkPSJNMCAwaDgwMHY2MDBIMHoiIGZpbGw9InVybCgjYSkiLz48L3N2Zz4=',
}

// Base64 заглушки для изображений
const placeholderLight = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iI2Q1ZjRkYyIvPjwvc3ZnPg=='
const placeholderDark = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iIzAxMGUwNCIvPjwvc3ZnPg=='
</script>

<template>
  <MainNavigation />
  <!-- Секция 1: Изображение справа -->
  <Hero section-key="transform_your_workflow" layout="split" height="nav">
    <HeroContent align="left" class="container mx-auto" padding="md">
      <Badge variant="outline">
        {{ t('demo.split.workflow.badge') }}
      </Badge>
      <HeroTitle>{{ t('demo.workflow.title') }}</HeroTitle>
      <HeroDescription>
        {{ t('demo.workflow.description') }}
      </HeroDescription>
      <Card class="p-6">
        <div class="flex items-center gap-4">
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <blockquote class="italic">
            {{ t('demo.split.workflow.quote') }}
          </blockquote>
        </div>
      </Card>
      <HeroActions class="justify-center">
        <Button>{{ t('demo.actions.getStarted') }}</Button>
      </HeroActions>
    </HeroContent>
    <HeroMedia
      rounded="none"
      aspect-ratio="auto"
      class="h-full"
    >
      <img
        :src="placeholderLight"
        class="object-cover w-full h-full dark:hidden"
        :alt="t('demo.split.workflow.imageAlt')"
      >
      <img
        :src="placeholderDark"
        class="object-cover w-full h-full hidden dark:block"
        :alt="t('demo.split.workflow.imageAlt')"
      >
    </HeroMedia>
  </Hero>

  <!-- Секция 2: Изображение слева -->
  <Hero section-key="data_driven_insights" layout="split" height="large" spacing="lg">
    <HeroMedia>
      <img
        :src="placeholderLight"
        class="object-cover w-full h-full dark:hidden"
        :alt="t('demo.split.insights.imageAlt')"
      >
      <img
        :src="placeholderDark"
        class="object-cover w-full h-full hidden dark:block"
        :alt="t('demo.split.insights.imageAlt')"
      >
    </HeroMedia>
    <HeroContent align="left" class="container mx-auto" padding="md">
      <div>
        <HeroTitle>{{ t('demo.split.insights.title') }}</HeroTitle>
        <ul class="space-y-4 mt-6">
          <li class="flex items-center gap-2">
            <div class="h-2 w-2 rounded-full bg-primary" />
            <span>{{ t('demo.split.insights.realtime') }}</span>
          </li>
          <li class="flex items-center gap-2">
            <div class="h-2 w-2 rounded-full bg-primary" />
            <span>{{ t('demo.split.insights.reports') }}</span>
          </li>
          <li class="flex items-center gap-2">
            <div class="h-2 w-2 rounded-full bg-primary" />
            <span>{{ t('demo.split.insights.collaboration') }}</span>
          </li>
        </ul>
        <HeroActions size="lg" class="mt-8 justify-start">
          <Button variant="outline">
            {{ t('demo.actions.learnMore') }}
          </Button>
        </HeroActions>
      </div>
    </HeroContent>
  </Hero>

  <!-- Секция 3: Изображение справа -->
  <Hero section-key="enterprise_solutions" height="nav" background="gradient" class="flex items-center">
    <div
      class="absolute inset-0 bg-cover bg-center opacity-20 w-full h-full"
      :style="{ backgroundImage: `url(${placeholders.abstract})` }"
    />
    <div class="container mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 items-center py-12 sm:py-16 lg:py-24 px-6 sm:px-8 lg:px-12">
      <HeroContent align="left" class="relative z-10">
        <Badge variant="default">
          {{ t('demo.split.enterprise.badge') }}
        </Badge>
        <HeroTitle class="mt-4">
          {{ t('demo.split.enterprise.title') }}
        </HeroTitle>
        <HeroDescription>
          {{ t('demo.split.enterprise.description') }}
        </HeroDescription>
        <div class="grid grid-cols-2 gap-4 mt-8">
          <Card class="p-4">
            <h3 class="font-semibold">
              {{ t('demo.split.enterprise.support') }}
            </h3>
            <p class="text-sm text-secondary-foreground">
              {{ t('demo.split.enterprise.supportBody') }}
            </p>
          </Card>
          <Card class="p-4">
            <h3 class="font-semibold">
              {{ t('demo.split.enterprise.setup') }}
            </h3>
            <p class="text-sm text-secondary-foreground">
              {{ t('demo.split.enterprise.setupBody') }}
            </p>
          </Card>
        </div>
        <HeroActions class="justify-start">
          <Button size="lg" class="mt-8">
            {{ t('demo.actions.contactSales') }}
          </Button>
        </HeroActions>
      </HeroContent>
      <HeroMedia class="relative overflow-hidden p-0 sm:p-4 lg:p-8" aspect-ratio="auto">
        <div class="absolute inset-0 bg-linear-to-tr from-primary/20 to-primary/5 rounded-[2rem] m-0 sm:m-4 lg:m-8" />
        <img
          :src="placeholderLight"
          class="object-cover w-full h-full dark:hidden  rounded-[2rem] shadow-xl"
          :alt="t('demo.split.enterprise.imageAlt')"
        >
        <img
          :src="placeholderDark"
          class="object-cover w-full h-full hidden dark:block  rounded-[2rem] shadow-xl"
          :alt="t('demo.split.enterprise.imageAlt')"
        >
      </HeroMedia>
    </div>
  </Hero>
</template>
