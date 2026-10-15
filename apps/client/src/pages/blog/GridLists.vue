<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Container } from '@/components/layout'
import { BlogCardHorizontal, BlogGrid } from '@/components/sections/blog'
import { MainNavigation } from '@/components/sections/navbar'

const { t } = useI18n()

const placeholderLight = 'https://images.unsplash.com/photo-1542125387-c71274d94f0a?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=560&q=80'
const placeholderDark = 'https://images.unsplash.com/photo-1542125387-c71274d94f0a?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=560&q=80'

const posts = computed(() => [
  {
    title: t('demo.blog.posts.modernApps.title'),
    description: t('demo.blog.posts.modernApps.description'),
    category: t('demo.blog.categories.development'),
    date: '2024-03-15',
    href: '#',
    imageLight: placeholderLight,
    imageDark: placeholderDark,
  },
  {
    title: t('demo.blog.posts.futureAi.title'),
    description: t('demo.blog.posts.futureAi.description'),
    category: t('demo.blog.categories.technology'),
    date: '2024-03-14',
    href: '#',
    imageLight: placeholderLight,
    imageDark: placeholderDark,
  },
])
</script>

<template>
  <MainNavigation />
  <Container>
    <div class="mt-16" />
    <h2 class="text-2xl font-bold mb-8">
      {{ t('demo.blog.square') }}
    </h2>
    <!-- Square Images Layout -->
    <BlogGrid layout="horizontal" :columns="2">
      <BlogCardHorizontal
        v-for="post in posts"
        :key="post.title"
        v-bind="post"
        :image-props="{
          rounded: true,
          shadow: true,
          aspectRatio: 'square',
        }"
        :badge-props="{
          show: false,
        }"
      />
    </BlogGrid>

    <div class="mt-16" />
    <h2 class="text-2xl font-bold mb-8">
      {{ t('demo.blog.fullHeight') }}
    </h2>
    <!-- Full Height Images Layout -->
    <BlogGrid layout="horizontal" :columns="2">
      <BlogCardHorizontal
        v-for="post in posts"
        :key="post.title"
        v-bind="post"
        :image-props="{
          rounded: true,
          shadow: true,
          aspectRatio: 'square',
        }"
        :badge-props="{
          variant: 'outline',
          size: 'sm',
          show: true,
        }"
      />
    </BlogGrid>

    <div class="mt-16" />
    <h2 class="text-2xl font-bold mb-8">
      {{ t('demo.blog.glow') }}
    </h2>
    <!-- Rounded Images Layout with Glow Effect -->
    <BlogGrid layout="horizontal" :columns="2">
      <BlogCardHorizontal
        v-for="post in posts"
        :key="post.title"
        v-bind="post"
        :image-props="{
          rounded: true,
          aspectRatio: 'square',
        }"
        :badge-props="{
          variant: 'outline',
          size: 'sm',
          show: true,
        }"
        class="rounded-xl border-glow shadow-xs hover:shadow-lg p-4 md:p-6"
      />
    </BlogGrid>

    <div class="my-16">
      <h2 class="text-2xl font-bold mb-8">
        {{ t('demo.blog.glowAnimated') }}
      </h2>
      <!-- Rounded Images Layout with Glow Effect Animation -->
      <BlogGrid layout="horizontal" :columns="2">
        <BlogCardHorizontal
          v-for="post in posts"
          :key="post.title"
          v-bind="post"
          :image-props="{
            rounded: true,
            aspectRatio: 'square',
          }"
          :badge-props="{
            variant: 'outline',
            size: 'sm',
            show: true,
          }"
          class="rounded-xl border-glow-animated shadow-xs hover:shadow-lg p-4 md:p-6"
        />
      </BlogGrid>
    </div>
  </Container>
</template>
