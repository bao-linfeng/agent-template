import { Injectable } from '@nestjs/common'
import { AppException } from '../../common/errors/app.exception.js'

export interface EmbeddingTarget {
  baseUrl: string
  model: string
  dimensions: number
  apiKey?: string | null
  batchSize: number
}

interface EmbeddingsResponse {
  data?: { index?: number; embedding?: unknown }[]
}

const REQUEST_TIMEOUT_MS = 60_000

/**
 * Client for OpenAI-compatible `POST {baseUrl}/embeddings` endpoints (OpenAI, Ollama `/v1`, vLLM,
 * Xinference, TEI, SiliconFlow, ...). Inputs are sent in batches of `batchSize`.
 */
@Injectable()
export class EmbeddingClient {
  async embed(target: EmbeddingTarget, inputs: string[]): Promise<number[][]> {
    const vectors: number[][] = []
    for (let start = 0; start < inputs.length; start += target.batchSize) {
      vectors.push(
        ...(await this.request(
          target,
          inputs.slice(start, start + target.batchSize),
        )),
      )
    }
    return vectors
  }

  private async request(
    target: EmbeddingTarget,
    input: string[],
  ): Promise<number[][]> {
    const url = `${target.baseUrl.replace(/\/+$/, '')}/embeddings`
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(target.apiKey
            ? { Authorization: `Bearer ${target.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          model: target.model,
          input,
          encoding_format: 'float',
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (error) {
      throw new AppException('EMBEDDING_PROVIDER_UNREACHABLE', {
        message: `Embedding provider unreachable: ${(error as Error).message}`,
        params: { reason: (error as Error).message },
        cause: error,
      })
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300)
      throw new AppException('EMBEDDING_PROVIDER_ERROR', {
        message: `Embedding provider returned ${response.status}: ${detail}`,
        params: { status: response.status, detail },
      })
    }

    const body = (await response.json()) as EmbeddingsResponse
    const data = [...(body.data ?? [])].sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0),
    )
    if (data.length !== input.length) {
      throw new AppException('EMBEDDING_PROVIDER_INVALID_RESPONSE', {
        message: `Embedding provider returned ${data.length} vectors for ${input.length} inputs`,
      })
    }
    return data.map(({ embedding }) => {
      if (
        !Array.isArray(embedding) ||
        !embedding.every(
          (value) => typeof value === 'number' && Number.isFinite(value),
        )
      ) {
        throw new AppException('EMBEDDING_PROVIDER_INVALID_RESPONSE')
      }
      if (embedding.length !== target.dimensions) {
        throw new AppException('EMBEDDING_DIMENSIONS_MISMATCH', {
          message: `Model returned ${embedding.length}-dimensional vectors but ${target.dimensions} are configured`,
          params: { actual: embedding.length, expected: target.dimensions },
        })
      }
      return embedding as number[]
    })
  }
}
