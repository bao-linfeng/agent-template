<script setup lang="ts">
import { Button } from '@repo/ui/components/button'
</script>

<template>
  <Button type="button" variant="link" class="text-muted-foreground" @click="$router.push('/auth/forgot-password')">
    {{ $t('forgotPassword') }}
  </Button>
</template>
