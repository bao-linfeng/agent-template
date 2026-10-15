<script setup lang="ts">
import { Button } from '@repo/ui/components/button'
import { useI18n } from 'vue-i18n'
import {
  Hero,
  HeroActions,
  HeroContent,
  HeroDescription,
  HeroTitle,
} from '@/components/sections/hero'
import { MainNavigation } from '@/components/sections/navbar'

const { t } = useI18n()
</script>

<template>
  <main>
    <MainNavigation />
    <router-view />
    <Hero section-key="build_your_next_landing_page_with_shadcn_vue" layout="centered" height="nav">
      <HeroContent class="container mx-auto" padding="md">
        <HeroTitle as="h1">
          {{ t('demo.home.titleBefore') }} <br>
          <span class="text-primary">{{ t('demo.home.titleHighlight') }}</span><br>
          {{ t('demo.home.titleAfter') }}
        </HeroTitle>
        <HeroDescription>
          {{ t('demo.home.description') }}
        </HeroDescription>
        <HeroActions>
          <a href="#">
            <Button size="lg" class="text-white">{{ t('demo.actions.getStarted') }}</Button>
          </a>
          <a href="#">
            <Button size="lg" variant="outline">{{ t('demo.home.getUiBlocks') }}</Button>
          </a>
        </HeroActions>
      </HeroContent>
    </Hero>
  </main>
</template>
