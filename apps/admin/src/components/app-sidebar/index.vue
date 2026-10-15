<script setup lang="ts">
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from '@repo/ui/components/sidebar'

import { filterByPermission } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth'

import type { NavGroup, User } from './types'

import { sidebarData } from './data/sidebar-data'
import NavFooter from './nav-footer.vue'
import NavTeam from './nav-team.vue'
import TeamSwitcher from './team-switcher.vue'

const authStore = useAuthStore()

const navMain = computed<NavGroup[]>(() => sidebarData.navMain.flatMap((group) => {
  const items = filterByPermission(group.items, authStore.can)
  return items.length ? [{ ...group, items }] : []
}))

const user = computed<User>(() => ({
  name: authStore.user?.nickname ?? '',
  email: authStore.user?.email ?? '',
  avatar: authStore.user?.avatarUrl ?? null,
}))
</script>

<template>
  <Sidebar collapsible="icon" class="z-50">
    <SidebarHeader class="border-b h-14 py-1 group-data-[collapsible=icon]:justify-center">
      <TeamSwitcher :teams="sidebarData.teams" />
    </SidebarHeader>

    <SidebarContent>
      <NavTeam :key="authStore.user?.id" :nav-main="navMain" />
    </SidebarContent>

    <SidebarFooter class="border-t h-14 py-1 group-data-[collapsible=icon]:justify-center">
      <NavFooter :user="user" />
    </SidebarFooter>

    <SidebarRail />
  </Sidebar>
</template>
