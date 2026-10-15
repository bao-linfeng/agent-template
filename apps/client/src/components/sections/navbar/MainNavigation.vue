<script setup lang="ts">
import type { Component } from 'vue'
import { AlignRight, ChevronsRight, CircleUser, Combine, Home, Layout, LogIn, PackageCheck } from '@lucide/vue'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@repo/ui/components/accordion'
import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/avatar'
import { Button } from '@repo/ui/components/button'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@repo/ui/components/navigation-menu'
import { ScrollArea } from '@repo/ui/components/scroll-area'
import { Separator } from '@repo/ui/components/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@repo/ui/components/sheet'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { DarkMode } from '@/components/darkMode'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import { ThemingSettings } from '@/components/theming'
import { useCollecty } from '@/composables/useCollecty'
import { useSession } from '@/composables/useSession'
import Navbar from './Navbar.vue'
import NavbarBrand from './NavbarBrand.vue'
import NavbarLayer from './NavbarLayer.vue'

const router = useRouter()
const { t } = useI18n()

const { collection } = useCollecty()
const isButtonVisible = computed(() => collection.value.length > 0)

const { user } = useSession()
const initials = computed(() => [...(user.value?.nickname.trim() || '?')].slice(0, 2).join('').toUpperCase())

interface RouteChild {
  name: string
  path: string
  title: string
  description?: string
  meta: {
    icon?: string
    title: string
    description?: string
  }
}

interface ParentRoute {
  name: string
  path: string
  title: string
  description?: string
  children?: RouteChild[]
}

// Titles and descriptions in route meta are i18n keys, translated in the template
const parentRoutes = router.getRoutes()
  .filter(route => route.meta?.isGroupParent)
  .map(route => ({
    name: String(route.name),
    path: route.path,
    title: route.meta?.title as string,
    description: route.meta?.description as string,
    children: route.children?.map(child => ({
      name: String(child.name),
      path: child.path,
      title: child.meta?.title as string,
      description: child.meta?.description as string,
      meta: {
        icon: child.meta?.icon as string,
        title: child.meta?.title as string,
        description: child.meta?.description as string,
      },
    })),
  })) as ParentRoute[]

const routeIcons: Record<string, Component> = { Home, Layout, ChevronsRight }

function getIcon(iconName?: string) {
  return (iconName && routeIcons[iconName]) || ChevronsRight
}

const sheetId = 'mobile-navigation'
</script>

<template>
  <Navbar class="border-b-[0.5px] border-gradient shadow-glow h-[64px]" style="--navbar-height: 64px;">
    <div class="flex container mx-auto px-2 md:px-4 lg:px-8">
      <NavbarLayer position="start" class="flex-1">
        <div class="flex items-center gap-6">
          <NavbarBrand class="text-primary">
            <PackageCheck class="w-6 h-6" />
            <span class="font-semibold">BuildY</span>
          </NavbarBrand>

          <!-- Обновляем десктопную навигацию -->
          <NavigationMenu class="hidden md:flex">
            <NavigationMenuList>
              <NavigationMenuItem v-for="parentRoute in parentRoutes" :key="parentRoute.path">
                <NavigationMenuTrigger>{{ t(parentRoute.title) }}</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul class="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                    <li v-for="child in parentRoute.children" :key="child.path">
                      <NavigationMenuLink as-child>
                        <router-link
                          :to="`${parentRoute.path}/${child.path}`"
                          class="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div class="text-sm font-medium leading-none">
                            {{ t(child.title) }}
                          </div>
                          <p v-if="child.description" class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            {{ t(child.description) }}
                          </p>
                        </router-link>
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
      </NavbarLayer>

      <!-- Правая часть: кнопки -->
      <NavbarLayer position="end" data-navbar-end>
        <div class="flex items-center gap-1 md:gap-2">
          <Button
            v-if="isButtonVisible"
            variant="default"
            size="sm"
            class="bg-primary text-white mr-2"
            :aria-label="t('nav.goToBuilder')"
            @click="router.push('/buildy')"
          >
            <Combine :stroke-width="2.5" class="w-3.5! h-3.5!" />
            <span class="font-base">BuildY</span>
          </Button>

          <LanguageSwitcher />
          <DarkMode data-dark-mode />
          <ThemingSettings />

          <RouterLink
            v-if="user"
            to="/account"
            class="ml-1 rounded-full focus-visible:outline-2 focus-visible:outline-primary"
            :aria-label="t('nav.myAccountOf', { name: user.nickname })"
            :title="user.nickname"
          >
            <Avatar class="size-8">
              <AvatarImage v-if="user.avatarUrl" :src="user.avatarUrl" :alt="user.nickname" class="object-cover" />
              <AvatarFallback class="text-xs">
                {{ initials }}
              </AvatarFallback>
            </Avatar>
          </RouterLink>
          <Button v-else variant="outline" size="sm" class="ml-1" @click="router.push({ path: '/login', query: { redirect: $route.fullPath } })">
            <LogIn class="size-4" />
            <span class="hidden sm:inline">{{ t('nav.signIn') }}</span>
          </Button>

          <!-- Мобильное меню -->
          <Sheet>
            <SheetTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="md:hidden"
                :aria-controls="sheetId"
                :aria-label="t('nav.openMenu')"
              >
                <AlignRight class="w-[1.5rem]! h-[1.5rem]!" />
                <span class="sr-only">{{ t('nav.toggleMenu') }}</span>
              </Button>
            </SheetTrigger>

            <SheetContent
              class="w-[300px] p-0 sheet-content border-r border-secondary-foreground/20 shadow-glow "
              side="left"
            >
              <SheetHeader class="p-4 sheet-header border-b-[0.3px] border-gradient shadow-glow">
                <SheetTitle class="flex items-center gap-2 text-base mb-2">
                  <NavbarBrand>
                    <PackageCheck class="w-6 h-6" />
                    <span class="font-semibold">BuildY</span>
                  </NavbarBrand>
                </SheetTitle>
                <SheetDescription class="text-sm text-muted-foreground">
                  {{ t('nav.menuDescription') }}
                </SheetDescription>
              </SheetHeader>

              <ScrollArea class="h-[calc(100vh-80px)]">
                <div class="p-4">
                  <router-link
                    to="/"
                    class="flex items-center gap-2 px-2 py-1.5 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground"
                    :aria-label="t('nav.goHome')"
                  >
                    <Home class="h-4 w-4" />
                    <span>{{ t('nav.home') }}</span>
                  </router-link>
                  <router-link
                    :to="user ? '/account' : '/login'"
                    class="flex items-center gap-2 px-2 py-1.5 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground"
                  >
                    <CircleUser class="h-4 w-4" />
                    <span>{{ user ? t('nav.myAccount') : t('nav.signIn') }}</span>
                  </router-link>

                  <Separator class="my-4" />

                  <Accordion
                    type="single"
                    collapsible
                    class="w-full"
                  >
                    <AccordionItem
                      v-for="route in parentRoutes"
                      :key="route.path"
                      :value="route.path"
                    >
                      <AccordionTrigger
                        class="text-sm no-underline"
                        :aria-label="t('nav.toggleSection', { title: t(route.title) })"
                      >
                        {{ t(route.title) }}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div class="pl-1 py-2 space-y-1">
                          <router-link
                            v-for="child in route.children"
                            :key="child.path"
                            :to="`${route.path}/${child.path}`"
                            class="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent hover:text-accent-foreground"
                            :class="[
                              route.path === $route.path ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
                            ]"
                            :aria-label="t('nav.goTo', { title: t(child.title) })"
                            :aria-current="route.path === $route.path ? 'page' : undefined"
                          >
                            <component
                              :is="getIcon(child.meta?.icon)"
                              class="h-4 w-4"
                              aria-hidden="true"
                            />
                            <div>
                              <div>{{ t(child.title) }}</div>
                              <p
                                v-if="child.description"
                                class="text-xs text-muted-foreground line-clamp-1"
                              >
                                {{ t(child.description) }}
                              </p>
                            </div>
                          </router-link>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </NavbarLayer>
    </div>
  </Navbar>
</template>

<style scoped>
/* Активная ссылка */
.router-link-active {
  color: var(--primary);
}

/* Градиентная граница */
.border-gradient {
  border-image: linear-gradient(
      to right,
      color-mix(in oklab, var(--primary) 10%, transparent),
      color-mix(in oklab, var(--primary) 40%, transparent),
      color-mix(in oklab, var(--primary) 10%, transparent)
    )
    1;
}

:global(.dark) .border-gradient {
  border-image: linear-gradient(
      to right,
      color-mix(in oklab, var(--primary) 20%, transparent),
      color-mix(in oklab, var(--primary) 50%, transparent),
      color-mix(in oklab, var(--primary) 20%, transparent)
    )
    1;
}

/* Тень с подсветкой */
.shadow-glow {
  box-shadow:
    0 1px 2px -1px color-mix(in oklab, var(--primary) 10%, transparent),
    0 0 0 1px color-mix(in oklab, var(--primary) 5%, transparent),
    0 1px 2px 0 color-mix(in oklab, var(--primary) 5%, transparent);
}

:global(.dark) .shadow-glow {
  box-shadow:
    0 1px 2px -1px color-mix(in oklab, var(--primary) 20%, transparent),
    0 0 0 1px color-mix(in oklab, var(--primary) 10%, transparent),
    0 1px 2px 0 color-mix(in oklab, var(--primary) 10%, transparent);
}

/* Эффект при наведении */
.shadow-glow:hover {
  box-shadow:
    0 2px 4px -2px color-mix(in oklab, var(--primary) 15%, transparent),
    0 0 0 1px color-mix(in oklab, var(--primary) 10%, transparent),
    0 1px 3px 0 color-mix(in oklab, var(--primary) 10%, transparent);
  transition: all 0.3s ease;
}

:global(.dark) .shadow-glow:hover {
  box-shadow:
    0 2px 4px -2px color-mix(in oklab, var(--primary) 25%, transparent),
    0 0 0 1px color-mix(in oklab, var(--primary) 15%, transparent),
    0 1px 3px 0 color-mix(in oklab, var(--primary) 15%, transparent);
}

/* Разделители аккордеона */
:deep([data-orientation='vertical'].border-b) {
  border-bottom-color: color-mix(in oklab, var(--border) 90%, transparent) !important;
}
</style>
