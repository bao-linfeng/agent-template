<script setup lang="ts">
import { Button } from '@repo/ui/components/button'
</script>

<template>
  <Button as="a" href="/auth/sign-in">
    {{ $t('login') }}
  </Button>
</template>
