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
  const pending = toast.loading(`Testing ${model.name}...`)
  test.mutate(model.id, {
    onSuccess: (result) => {
      if (result.ok)
        toast.success(`${model.name}: ${result.dimensions} dimensions in ${result.latencyMs} ms.`, { id: pending })
      else
        toast.error(`${model.name}: ${result.error ?? 'invalid response'}`, { id: pending })
    },
    onError: () => toast.dismiss(pending),
  })
}

function makeDefault(model: IEmbeddingModel) {
  setDefault.mutate(model.id, { onSuccess: () => toast.success(`${model.name} is now the default model.`) })
}

function askDelete(model: IEmbeddingModel) {
  deleting.value = model
  confirmOpen.value = true
}

function confirmDelete() {
  const model = deleting.value
  if (model)
    remove.mutate(model.id, { onSuccess: () => toast.success(`${model.name} deleted.`) })
}
</script>

<template>
  <BasicPage
    title="Embedding Models"
    description="Models that turn knowledge base documents into vectors. New knowledge bases use the default model."
    sticky
  >
    <template #actions>
      <Button v-if="canManage" @click="openDialog()">
        <PlusIcon />
        New model
      </Button>
    </template>

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Endpoint</TableHead>
            <TableHead class="text-right">
              Dimensions
            </TableHead>
            <TableHead class="text-right">
              Batch
            </TableHead>
            <TableHead>Status</TableHead>
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
              No embedding model yet.
            </TableCell>
          </TableRow>
          <TableRow v-for="model in models" :key="model.id">
            <TableCell>
              <div class="flex items-center gap-2 font-medium">
                {{ model.name }}
                <Badge v-if="model.isDefault" class="gap-1">
                  <StarIcon class="size-3" />
                  Default
                </Badge>
              </div>
              <code class="text-xs text-muted-foreground">{{ model.model }}</code>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <code class="text-xs">{{ model.baseUrl }}</code>
                <KeyRoundIcon v-if="model.hasApiKey" class="size-3.5 text-muted-foreground" aria-label="API key stored" />
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
                {{ model.enabled ? 'Enabled' : 'Disabled' }}
              </Badge>
            </TableCell>
            <TableCell v-if="canManage" class="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="size-8">
                    <EllipsisIcon class="size-4" />
                    <span class="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="openDialog(model)">
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem :disabled="test.isPending.value" @click="runTest(model)">
                    Test connection
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="!model.isDefault" :disabled="!model.enabled" @click="makeDefault(model)">
                    Set as default
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem :disabled="model.isDefault" class="text-destructive" @click="askDelete(model)">
                    Delete
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
      confirm-button-text="Delete"
      :is-loading="remove.isPending.value"
      @confirm="confirmDelete"
    >
      <template #title>
        Delete {{ deleting?.name }}?
      </template>
      <template #description>
        <p>Models used by a knowledge base cannot be deleted.</p>
      </template>
    </ConfirmDialog>
  </BasicPage>
</template>

<route lang="yaml">
meta:
  permission: embedding-model:read
</route>
