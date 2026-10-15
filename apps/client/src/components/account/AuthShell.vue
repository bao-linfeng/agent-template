<script setup lang="ts">
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@repo/ui/components/card'
import { MainNavigation } from '@/components/sections/navbar'

defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <main class="min-h-screen">
    <MainNavigation />
    <div class="container mx-auto flex justify-center px-4 py-12 md:py-20">
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
    </div>
  </main>
</template>
