<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useNotificationStream } from '@/composables/useNotificationStream'

// Open while a user is signed in, on every page (the navbar badge follows it).
useNotificationStream()
</script>

<template>
  <RouterView />
</template>
