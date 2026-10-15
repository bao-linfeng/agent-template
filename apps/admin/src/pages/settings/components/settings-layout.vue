<script setup lang="ts">
import { BasicPage, TwoColAside, TwoColLayout } from '@/components/global-layout'
import { settingsNavItems } from '@/constants/sidebar-data'
</script>

<template>
  <BasicPage
    :title="$t('settings.title')"
    :description="$t('settings.description')"
  >
    <TwoColLayout>
      <template #aside>
        <TwoColAside :nav="settingsNavItems" />
      </template>

      <slot />
    </TwoColLayout>
  </BasicPage>
</template>
