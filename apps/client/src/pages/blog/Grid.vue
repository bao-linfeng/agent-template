<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Container } from '@/components/layout'
import { BlogCard, BlogGrid } from '@/components/sections/blog'
import { MainNavigation } from '@/components/sections/navbar'

const { t } = useI18n()

const posts = computed(() => [
  {
    title: t('demo.blog.posts.modernApps.title'),
    description: t('demo.blog.posts.modernApps.description'),
    category: t('demo.blog.categories.development'),
    date: '2024-03-15',
    href: '#',
  },
  {
    title: t('demo.blog.posts.futureAi.title'),
    description: t('demo.blog.posts.futureAi.description'),
    category: t('demo.blog.categories.technology'),
    date: '2024-03-14',
    href: '#',
  },
  {
    title: t('demo.blog.posts.designSystems.title'),
    description: t('demo.blog.posts.designSystems.description'),
    category: t('demo.blog.categories.design'),
    date: '2024-03-13',
    href: '#',
  },
  {
    title: t('demo.blog.posts.futureWeb.title'),
    description: t('demo.blog.posts.futureWeb.description'),
    category: t('demo.blog.categories.development'),
    date: '2024-03-12',
    href: '#',
  },
])
</script>

<template>
  <MainNavigation />
  <Container>
    <div class="my-16" />
    <h2 class="text-2xl font-bold mb-4">
      {{ t('demo.blog.grid') }}
    </h2>
    <!-- Grid Layout -->
    <BlogGrid
      class="min-h-[45vh] mb-16"
    >
      <BlogCard
        v-for="post in posts.slice(0, 3)"
        :key="post.title"
        v-bind="post"
      />
    </BlogGrid>

    <div class="mb-16" />
    <h2 class="text-2xl font-bold mb-4">
      {{ t('demo.blog.featured') }}
    </h2>
    <!-- Featured Layout -->
    <BlogGrid
      :columns="2"
      class="min-h-[40vh] mb-16"
      layout="featured"
    >
      <BlogCard
        v-for="post in posts.slice(0, 2)"
        :key="post.title"
        v-bind="post"
      />
    </BlogGrid>

    <div class="mb-32">
      <h2 class="text-2xl font-bold mb-4">
        {{ t('demo.blog.singleColumn') }}
      </h2>
      <!-- Single Column Layout -->
      <BlogGrid
        :columns="4"
        class="min-h-[50vh]"
      >
        <BlogCard
          v-for="post in posts"
          :key="post.title"
          v-bind="post"
        />
      </BlogGrid>
    </div>
  </Container>
</template>
