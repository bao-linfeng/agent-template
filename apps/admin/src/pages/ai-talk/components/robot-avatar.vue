<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/avatar'
</script>

<template>
  <Avatar>
    <AvatarImage src="/robot.png" alt="robot" />
    <AvatarFallback>Robot</AvatarFallback>
  </Avatar>
</template>
