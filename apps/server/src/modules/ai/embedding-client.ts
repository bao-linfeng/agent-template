import { BadGatewayException, Injectable } from '@nestjs/common'

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
      throw new BadGatewayException(
        `Embedding provider unreachable: ${(error as Error).message}`,
      )
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300)
      throw new BadGatewayException(
        `Embedding provider returned ${response.status}: ${detail}`,
      )
    }

    const body = (await response.json()) as EmbeddingsResponse
    const data = [...(body.data ?? [])].sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0),
    )
    if (data.length !== input.length) {
      throw new BadGatewayException(
        `Embedding provider returned ${data.length} vectors for ${input.length} inputs`,
      )
    }
    return data.map(({ embedding }) => {
      if (
        !Array.isArray(embedding) ||
        !embedding.every(
          (value) => typeof value === 'number' && Number.isFinite(value),
        )
      ) {
        throw new BadGatewayException(
          'Embedding provider returned a malformed vector',
        )
      }
      if (embedding.length !== target.dimensions) {
        throw new BadGatewayException(
          `Model returned ${embedding.length}-dimensional vectors but ${target.dimensions} are configured`,
        )
      }
      return embedding as number[]
    })
  }
}
