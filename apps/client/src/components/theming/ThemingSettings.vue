<script setup lang="ts">
import { LoaderCircle, Palette, Puzzle } from '@lucide/vue'
import { Button } from '@repo/ui/components/button'
import { Label } from '@repo/ui/components/label'
import { ScrollArea } from '@repo/ui/components/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@repo/ui/components/sheet'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { applyThemeState, getStoredThemeState } from './themeManager'

const router = useRouter()

const formatRadius = (value: string) => value.replace('rem', '')

const isOpen = ref(false)

const sheetContent = {
  header: {
    title: 'UI BuildY',
    btntitle: 'Go to BuildY',
    description: 'Manage application appearance and go to Tailwind Page Builder',
  },
  collections: {
    title: 'Welcome to UI BuildY',
    items: [
      {
        id: 'getBuildy',
        icon: Puzzle,
        label: 'Go to BuildY',
        action: () => router.push('/buildy'),
        class: 'bg-primary text-white',
      },
      {
        icon: LoaderCircle,
        label: 'Maintenance',
        action: () => router.push('#'),
        class: 'border-2 border-secondary-foreground/50',
      },
    ],
  },
  theme: {
    title: 'Theme Settings',
    sections: [
      {
        label: 'Color Scheme',
        type: 'colors',
        options: ['red', 'rose', 'orange', 'green', 'blue', 'violet'],
      },
      {
        label: 'Corner Radius',
        type: 'radius',
        options: ['0rem', '0.3rem', '0.5rem', '0.75rem', '1rem'],
      },
      {
        label: 'Font Family',
        type: 'font',
        options: [
          'Nunito',
          'Inter',
          'Roboto',
          'Lato',
          'Lexend',
          'Urbanist',
          'Kanit',
          'Fira Sans',
          'Karla',
          'Prompt',
          'Saira',
          'Geologica',
          'Bai Jamjuree',
          'Niramit',
          'Livvic',
          'Exo',
          'K2D',
          'Jura',
          'Philosopher',
          'Montserrat',
          'Open Sans',
          'Rubik',
          'Oswald',
          'Work Sans',
          'Mulish',
          'Barlow',
          'Heebo',
          'Titillium Web',
          'Libre Franklin',
          'Josefin Sans',
          'Jost',
          'Outfit',
          'Figtree',
          'Overpass',
          'Chivo',
          'Alegreya Sans',
          'Fahkwang',
        ],
      },
    ],
  },
}

const stored = getStoredThemeState()
const selectedFont = ref(stored.font)
const selectedColor = ref(stored.theme)
const selectedRadius = ref(stored.radius)

function updateTheme() {
  return applyThemeState({
    theme: selectedColor.value,
    radius: selectedRadius.value,
    font: selectedFont.value,
  })
}
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetTrigger as-child>
      <Button variant="ghost" class="items-center justify-center rounded-full transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9">
        <Palette class="w-[1.1rem]! h-[1.1rem]!" />
      </Button>
    </SheetTrigger>
    <SheetContent class="w-full sm:w-[400px] max-w-[calc(100vw-32px)] border-secondary-foreground/20 p-0">
      <!-- Static header section -->
      <div class="p-6">
        <SheetHeader>
          <SheetTitle class="text-xl text-start">
            {{ sheetContent.header.title }}
          </SheetTitle>
          <SheetDescription class="flex items-center gap-4">
            <p class="text-sm text-left">
              {{ sheetContent.header.description }}
            </p>
          </SheetDescription>
        </SheetHeader>
      </div>

      <!-- BuildY Section -->
      <div class="px-6">
        <div class="grid grid-cols-2 gap-2">
          <Button
            v-for="item in sheetContent.collections.items"
            :id="item.id"
            :key="item.label"
            variant="outline"
            class="justify-start" :class="[
              item.class,
            ]"
            @click="item.action"
          >
            <component :is="item.icon" class="mr-2 h-4 w-4" />
            <span>{{ item.label }}</span>
          </Button>
        </div>
      </div>

      <!-- Scrollable content -->
      <ScrollArea class="h-[calc(100%-120px)]">
        <!-- Adjust height to account for header -->
        <div class="p-6">
          <div class="space-y-6">
            <!-- Theme Settings Section -->
            <div class="space-y-4">
              <h4 class="text-lg font-bold">
                {{ sheetContent.theme.title }}
              </h4>
              <div class="space-y-4">
                <template v-for="section in sheetContent.theme.sections" :key="section.label">
                  <div class="space-y-2">
                    <Label>{{ section.label }}</Label>

                    <div v-if="section.type === 'colors'" class="grid grid-cols-2 gap-2">
                      <Button
                        v-for="color in section.options"
                        :key="color"
                        variant="outline"
                        class="relative pl-8"
                        :class="{ 'border-2 border-primary': selectedColor === color }"
                        @click="selectedColor = color; updateTheme()"
                      >
                        <span
                          class="absolute left-2 h-4 w-4 rounded-full"
                          :class="`bg-${color}-500`"
                        />
                        <span class="flex-1 text-center capitalize">{{ color }}</span>
                      </Button>
                    </div>

                    <div v-else-if="section.type === 'radius'" class="grid grid-cols-5 gap-2">
                      <Button
                        v-for="radius in section.options"
                        :key="radius"
                        variant="outline"
                        :class="{ 'border-2 border-primary': selectedRadius === radius }"
                        @click="selectedRadius = radius; updateTheme()"
                      >
                        {{ formatRadius(radius) }}
                      </Button>
                    </div>

                    <Select
                      v-else-if="section.type === 'font'"
                      v-model="selectedFont"
                      @update:model-value="updateTheme"
                    >
                      <SelectTrigger class="w-full">
                        <SelectValue :placeholder="selectedFont" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="font in section.options"
                          :key="font"
                          :value="font"
                        >
                          <span :style="{ fontFamily: font }">{{ font }}</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </SheetContent>
  </Sheet>
</template>
