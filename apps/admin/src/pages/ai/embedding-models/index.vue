<script setup lang="ts">
import { EllipsisIcon, KeyRoundIcon, PlusIcon, StarIcon } from '@lucide/vue'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@repo/ui/components/dropdown-menu'
import { Skeleton } from '@repo/ui/components/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@repo/ui/components/table'
import { toast } from 'vue-sonner'

import type { IEmbeddingModel } from '@/services/api/embedding-models.api'

import ConfirmDialog from '@/components/confirm-dialog.vue'
import { BasicPage } from '@/components/global-layout'
import { t } from '@/plugins/i18n'
import {
  useDeleteEmbeddingModelMutation,
  useEmbeddingModelsQuery,
  useSetDefaultEmbeddingModelMutation,
  useTestEmbeddingModelMutation,
} from '@/services/api/embedding-models.api'
import { useAuthStore } from '@/stores/auth'

import EmbeddingModelDialog from './components/embedding-model-dialog.vue'

const authStore = useAuthStore()
const canManage = computed(() => authStore.can('embedding-model:manage'))

const { data: models, isPending } = useEmbeddingModelsQuery()
const setDefault = useSetDefaultEmbeddingModelMutation()
const remove = useDeleteEmbeddingModelMutation()
const test = useTestEmbeddingModelMutation()

const editing = shallowRef<IEmbeddingModel>()
const dialogOpen = shallowRef(false)
const deleting = shallowRef<IEmbeddingModel>()
const confirmOpen = shallowRef(false)

function openDialog(model?: IEmbeddingModel) {
  editing.value = model
  dialogOpen.value = true
}

function runTest(model: IEmbeddingModel) {
  const pending = toast.loading(t('embeddingModels.testing', { name: model.name }))
  test.mutate(model.id, {
    onSuccess: (result) => {
      if (result.ok)
        toast.success(t('embeddingModels.testOk', { name: model.name, dimensions: result.dimensions, latency: result.latencyMs }), { id: pending })
      else
        toast.error(t('embeddingModels.testFailed', { name: model.name, error: result.error ?? t('embeddingModels.invalidResponse') }), { id: pending })
    },
    onError: () => toast.dismiss(pending),
  })
}

function makeDefault(model: IEmbeddingModel) {
  setDefault.mutate(model.id, { onSuccess: () => toast.success(t('embeddingModels.nowDefault', { name: model.name })) })
}

function askDelete(model: IEmbeddingModel) {
  deleting.value = model
  confirmOpen.value = true
}

function confirmDelete() {
  const model = deleting.value
  if (model)
    remove.mutate(model.id, { onSuccess: () => toast.success(t('embeddingModels.deleted', { name: model.name })) })
}
</script>

<template>
  <BasicPage
    :title="$t('embeddingModels.title')"
    :description="$t('embeddingModels.description')"
    sticky
  >
    <template #actions>
      <Button v-if="canManage" @click="openDialog()">
        <PlusIcon />
        {{ $t('embeddingModels.newModel') }}
      </Button>
    </template>

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ $t('fields.name') }}</TableHead>
            <TableHead>{{ $t('embeddingModels.endpoint') }}</TableHead>
            <TableHead class="text-right">
              {{ $t('embeddingModels.dimensions') }}
            </TableHead>
            <TableHead class="text-right">
              {{ $t('embeddingModels.batch') }}
            </TableHead>
            <TableHead>{{ $t('fields.status') }}</TableHead>
            <TableHead v-if="canManage" class="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="isPending">
            <TableRow v-for="i in 2" :key="i">
              <TableCell :colspan="canManage ? 6 : 5">
                <Skeleton class="h-8 w-full" />
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else-if="!models?.length">
            <TableCell :colspan="canManage ? 6 : 5" class="h-24 text-center text-muted-foreground">
              {{ $t('embeddingModels.empty') }}
            </TableCell>
          </TableRow>
          <TableRow v-for="model in models" :key="model.id">
            <TableCell>
              <div class="flex items-center gap-2 font-medium">
                {{ model.name }}
                <Badge v-if="model.isDefault" class="gap-1">
                  <StarIcon class="size-3" />
                  {{ $t('embeddingModels.default') }}
                </Badge>
              </div>
              <code class="text-xs text-muted-foreground">{{ model.model }}</code>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <code class="text-xs">{{ model.baseUrl }}</code>
                <KeyRoundIcon v-if="model.hasApiKey" class="size-3.5 text-muted-foreground" :aria-label="$t('embeddingModels.apiKeyStored')" />
              </div>
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ model.dimensions }}
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ model.batchSize }}
            </TableCell>
            <TableCell>
              <Badge :variant="model.enabled ? 'outline' : 'secondary'">
                {{ model.enabled ? $t('common.enabled') : $t('common.disabled') }}
              </Badge>
            </TableCell>
            <TableCell v-if="canManage" class="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="size-8">
                    <EllipsisIcon class="size-4" />
                    <span class="sr-only">{{ $t('common.openMenu') }}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="openDialog(model)">
                    {{ $t('common.edit') }}
                  </DropdownMenuItem>
                  <DropdownMenuItem :disabled="test.isPending.value" @click="runTest(model)">
                    {{ $t('embeddingModels.testConnection') }}
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="!model.isDefault" :disabled="!model.enabled" @click="makeDefault(model)">
                    {{ $t('embeddingModels.setDefault') }}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem :disabled="model.isDefault" class="text-destructive" @click="askDelete(model)">
                    {{ $t('common.delete') }}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <EmbeddingModelDialog v-model:open="dialogOpen" :model="editing" />

    <ConfirmDialog
      v-model:open="confirmOpen"
      destructive
      :confirm-button-text="$t('common.delete')"
      :is-loading="remove.isPending.value"
      @confirm="confirmDelete"
    >
      <template #title>
        {{ $t('embeddingModels.deleteTitle', { name: deleting?.name }) }}
      </template>
      <template #description>
        <p>{{ $t('embeddingModels.deleteHint') }}</p>
      </template>
    </ConfirmDialog>
  </BasicPage>
</template>

<route lang="yaml">
meta:
  permission: embedding-model:read
</route>
