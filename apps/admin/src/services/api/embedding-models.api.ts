import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { apiFetch } from '@/lib/api-client'

export type EmbeddingProvider = 'openai_compatible'

export interface IEmbeddingModel {
  id: string
  name: string
  provider: EmbeddingProvider
  /** API root that serves `/embeddings`, e.g. `http://localhost:11434/v1`. */
  baseUrl: string
  model: string
  dimensions: number
  batchSize: number
  enabled: boolean
  /** Used by new knowledge bases; exactly one model is the default. */
  isDefault: boolean
  /** API keys are stored encrypted and never returned. */
  hasApiKey: boolean
  createdAt: string
  updatedAt: string
}

export interface ICreateEmbeddingModelBody {
  name: string
  provider?: EmbeddingProvider
  baseUrl: string
  model: string
  dimensions: number
  apiKey?: string
  batchSize?: number
  enabled?: boolean
  isDefault?: boolean
}

export interface IUpdateEmbeddingModelBody {
  name?: string
  baseUrl?: string
  /** `model` and `dimensions` are locked once a knowledge base uses the model. */
  model?: string
  dimensions?: number
  /** Omit to keep the stored key, `null` to clear it. */
  apiKey?: string | null
  batchSize?: number
  enabled?: boolean
}

export interface ITestEmbeddingConfigBody {
  baseUrl: string
  model: string
  dimensions: number
  apiKey?: string
}

export interface IEmbeddingTestResult {
  ok: boolean
  dimensions?: number
  latencyMs: number
  error?: string
}

const BASE = '/ai/embedding-models'
/** The server waits up to 60 s for the provider. */
const TEST_TIMEOUT = 65_000

// Transport layer (permissions: `embedding-model:read|manage`)
export function fetchEmbeddingModels() {
  return apiFetch<IEmbeddingModel[]>(BASE, { method: 'get' })
}

export function createEmbeddingModel(body: ICreateEmbeddingModelBody) {
  return apiFetch<IEmbeddingModel>(BASE, { method: 'post', body })
}

export function updateEmbeddingModel(id: string, body: IUpdateEmbeddingModelBody) {
  return apiFetch<IEmbeddingModel>(`${BASE}/${id}`, { method: 'patch', body })
}

export function setDefaultEmbeddingModel(id: string) {
  return apiFetch<IEmbeddingModel>(`${BASE}/${id}/default`, { method: 'post' })
}

/** Embeds a probe text with a saved model. */
export function testEmbeddingModel(id: string) {
  return apiFetch<IEmbeddingTestResult>(`${BASE}/${id}/test`, { method: 'post', timeout: TEST_TIMEOUT })
}

/** Tests an unsaved configuration. */
export function testEmbeddingConfig(body: ITestEmbeddingConfigBody) {
  return apiFetch<IEmbeddingTestResult>(`${BASE}/test`, { method: 'post', body, timeout: TEST_TIMEOUT })
}

export function deleteEmbeddingModel(id: string) {
  return apiFetch<void>(`${BASE}/${id}`, { method: 'delete' })
}

// Query/mutation hooks
export function useEmbeddingModelsQuery() {
  return useQuery({ queryKey: ['embeddingModels'], queryFn: fetchEmbeddingModels, staleTime: 0 })
}

function useEmbeddingModelMutation<V, R>(key: string, mutationFn: (variables: V) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: [key],
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['embeddingModels'] }),
  })
}

export type SaveEmbeddingModelVariables
  = | { id?: undefined, body: ICreateEmbeddingModelBody }
    | { id: string, body: IUpdateEmbeddingModelBody }

export function useSaveEmbeddingModelMutation() {
  return useEmbeddingModelMutation('saveEmbeddingModel', (variables: SaveEmbeddingModelVariables) =>
    variables.id === undefined
      ? createEmbeddingModel(variables.body)
      : updateEmbeddingModel(variables.id, variables.body))
}

export function useSetDefaultEmbeddingModelMutation() {
  return useEmbeddingModelMutation('setDefaultEmbeddingModel', setDefaultEmbeddingModel)
}

export function useDeleteEmbeddingModelMutation() {
  return useEmbeddingModelMutation('deleteEmbeddingModel', deleteEmbeddingModel)
}

export function useTestEmbeddingModelMutation() {
  return useMutation({ mutationKey: ['testEmbeddingModel'], mutationFn: testEmbeddingModel })
}

export function useTestEmbeddingConfigMutation() {
  return useMutation({ mutationKey: ['testEmbeddingConfig'], mutationFn: testEmbeddingConfig })
}
