<script setup lang="ts">
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { Checkbox } from '@repo/ui/components/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@repo/ui/components/dialog'
import { Label } from '@repo/ui/components/label'
import { Spinner } from '@repo/ui/components/spinner'
import { useForm } from '@tanstack/vue-form'
import { toast } from 'vue-sonner'
import { z } from 'zod'

import type { IEmbeddingModel, IEmbeddingTestResult } from '@/services/api/embedding-models.api'

import FormTextField from '@/components/form-text-field.vue'
import { t } from '@/plugins/i18n'
import {
  useSaveEmbeddingModelMutation,
  useTestEmbeddingConfigMutation,
  useTestEmbeddingModelMutation,
} from '@/services/api/embedding-models.api'

/** `model` undefined creates a new model. */
const props = defineProps<{ model?: IEmbeddingModel }>()
const open = defineModel<boolean>('open', { default: false })

/** Local Ollama (`docker compose --profile ai up -d`). */
const OLLAMA_BASE_URL = 'http://localhost:11434/v1'

const save = useSaveEmbeddingModelMutation()
const testConfig = useTestEmbeddingConfigMutation()
const testSaved = useTestEmbeddingModelMutation()
const testing = computed(() => testConfig.isPending.value || testSaved.isPending.value)
const testResult = shallowRef<IEmbeddingTestResult>()

// Limits mirror apps/server/src/modules/ai/dto/embedding-model.dto.ts.
const validator = z.object({
  name: z.string().trim().min(1, { error: () => t('validation.nameRequired') }).max(100),
  baseUrl: z.url({ protocol: /^https?$/, error: () => t('validation.baseUrl') }),
  model: z.string().trim().min(1, { error: () => t('validation.modelIdRequired') }).max(200),
  dimensions: z.number({ error: () => t('validation.required') }).int().min(1).max(2000, { error: () => t('validation.maxDimensions') }),
  batchSize: z.number({ error: () => t('validation.required') }).int().min(1).max(512),
  apiKey: z.string().max(500),
  clearApiKey: z.boolean(),
  enabled: z.boolean(),
  isDefault: z.boolean(),
})
type Values = z.infer<typeof validator>

function initialValues(model?: IEmbeddingModel): Values {
  return {
    name: model?.name ?? '',
    baseUrl: model?.baseUrl ?? OLLAMA_BASE_URL,
    model: model?.model ?? '',
    dimensions: model?.dimensions ?? 1024,
    batchSize: model?.batchSize ?? 32,
    apiKey: '',
    clearApiKey: false,
    enabled: model?.enabled ?? true,
    isDefault: false,
  }
}

const form = useForm({
  defaultValues: initialValues(props.model),
  validators: { onSubmit: validator },
  onSubmit: async ({ value }) => {
    const common = {
      name: value.name.trim(),
      baseUrl: value.baseUrl.trim(),
      model: value.model.trim(),
      dimensions: value.dimensions,
      batchSize: value.batchSize,
      enabled: value.enabled,
    }
    try {
      if (props.model) {
        // Blank key keeps the stored one.
        const apiKey = value.clearApiKey ? null : value.apiKey.trim() || undefined
        await save.mutateAsync({ id: props.model.id, body: { ...common, apiKey } })
      }
      else {
        await save.mutateAsync({ body: { ...common, apiKey: value.apiKey.trim() || undefined, isDefault: value.isDefault } })
      }
    }
    catch {
      return // Toasted by the global mutation handler (e.g. 409 when the model is in use).
    }
    toast.success(props.model ? t('embeddingModels.updated') : t('embeddingModels.created'))
    open.value = false
  },
})

watch(open, (isOpen) => {
  if (isOpen) {
    form.reset(initialValues(props.model))
    testResult.value = undefined
  }
})

const values = form.useStore(state => state.values)

async function runTest() {
  const { baseUrl, model, dimensions, apiKey, clearApiKey } = values.value
  const saved = props.model
  // The stored key never leaves the server, so an unchanged configuration is tested as saved.
  const unchanged = saved && !apiKey.trim() && !clearApiKey
    && baseUrl.trim() === saved.baseUrl && model.trim() === saved.model && dimensions === saved.dimensions
  testResult.value = undefined
  try {
    testResult.value = unchanged
      ? await testSaved.mutateAsync(saved.id)
      : await testConfig.mutateAsync({
          baseUrl: baseUrl.trim(),
          model: model.trim(),
          dimensions,
          apiKey: apiKey.trim() || undefined,
        })
  }
  catch {
    // Toasted (validation errors are listed by the server).
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{{ model ? $t('embeddingModels.editTitle') : $t('embeddingModels.newTitle') }}</DialogTitle>
        <DialogDescription>
          {{ $t('embeddingModels.dialogDescription') }}
        </DialogDescription>
      </DialogHeader>

      <form id="embedding-model-form" class="grid gap-4" novalidate @submit.prevent="form.handleSubmit">
        <form.Field name="name">
          <template #default="{ field }">
            <FormTextField :field="field" :label="$t('fields.name')" placeholder="bge-m3 (Ollama)" />
          </template>
        </form.Field>
        <form.Field name="baseUrl">
          <template #default="{ field }">
            <FormTextField
              :field="field"
              :label="$t('embeddingModels.baseUrl')"
              :placeholder="OLLAMA_BASE_URL"
              :description="$t('embeddingModels.baseUrlHint')"
            />
          </template>
        </form.Field>
        <div class="grid grid-cols-2 gap-4">
          <form.Field name="model">
            <template #default="{ field }">
              <FormTextField :field="field" :label="$t('embeddingModels.model')" placeholder="bge-m3" />
            </template>
          </form.Field>
          <form.Field name="dimensions">
            <template #default="{ field }">
              <FormTextField :field="field" :label="$t('embeddingModels.dimensions')" type="number" placeholder="1024" />
            </template>
          </form.Field>
        </div>
        <p v-if="model" class="-mt-2 text-xs text-muted-foreground">
          {{ $t('embeddingModels.lockedHint') }}
        </p>
        <form.Field name="apiKey">
          <template #default="{ field }">
            <FormTextField
              :field="field"
              :label="$t('embeddingModels.apiKey')"
              type="password"
              autocomplete="off"
              :disabled="values.clearApiKey"
              :placeholder="model?.hasApiKey ? $t('embeddingModels.apiKeyKeepPlaceholder') : $t('common.optional')"
              :description="$t('embeddingModels.apiKeyHint')"
            />
          </template>
        </form.Field>
        <form.Field v-if="model?.hasApiKey" name="clearApiKey">
          <template #default="{ field }">
            <Label class="flex items-center gap-2 font-normal">
              <Checkbox :model-value="field.state.value" @update:model-value="field.handleChange($event === true)" />
              {{ $t('embeddingModels.removeApiKey') }}
            </Label>
          </template>
        </form.Field>
        <form.Field name="batchSize">
          <template #default="{ field }">
            <FormTextField :field="field" :label="$t('embeddingModels.batchSize')" type="number" :description="$t('embeddingModels.batchSizeHint')" />
          </template>
        </form.Field>
        <div class="flex flex-wrap gap-6">
          <form.Field name="enabled">
            <template #default="{ field }">
              <Label class="flex items-center gap-2 font-normal">
                <Checkbox
                  :model-value="field.state.value"
                  :disabled="model?.isDefault"
                  @update:model-value="field.handleChange($event === true)"
                />
                {{ $t('common.enabled') }}
              </Label>
            </template>
          </form.Field>
          <form.Field v-if="!model" name="isDefault">
            <template #default="{ field }">
              <Label class="flex items-center gap-2 font-normal">
                <Checkbox :model-value="field.state.value" @update:model-value="field.handleChange($event === true)" />
                {{ $t('embeddingModels.useAsDefault') }}
              </Label>
            </template>
          </form.Field>
        </div>

        <Alert v-if="testResult" :variant="testResult.ok ? 'default' : 'destructive'">
          <AlertDescription>
            <template v-if="testResult.ok">
              {{ $t('embeddingModels.connected', { dimensions: testResult.dimensions, latency: testResult.latencyMs }) }}
            </template>
            <template v-else>
              {{ testResult.error ?? $t('embeddingModels.noValidEmbedding') }}
            </template>
          </AlertDescription>
        </Alert>
      </form>

      <DialogFooter class="gap-2 sm:justify-between">
        <Button type="button" variant="outline" :disabled="testing" @click="runTest">
          <Spinner v-if="testing" class="mr-2" />
          {{ $t('embeddingModels.testConnection') }}
        </Button>
        <div class="flex gap-2">
          <Button type="button" variant="outline" @click="open = false">
            {{ $t('common.cancel') }}
          </Button>
          <Button type="submit" form="embedding-model-form" :disabled="save.isPending.value">
            <Spinner v-if="save.isPending.value" class="mr-2" />
            {{ $t('common.save') }}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
