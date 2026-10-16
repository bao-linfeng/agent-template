import { AppException } from '../../common/errors/app.exception.js'
import { EmbeddingClient, type EmbeddingTarget } from './embedding-client.js'

const target: EmbeddingTarget = {
  baseUrl: 'http://embeddings.test/v1/',
  model: 'bge-m3',
  dimensions: 3,
  apiKey: 'sk-test',
  batchSize: 2,
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('EmbeddingClient', () => {
  const client = new EmbeddingClient()
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('batches inputs, sends auth and restores input order', async () => {
    fetchMock
      .mockResolvedValueOnce(
        respond({
          data: [
            { index: 1, embedding: [0, 1, 0] },
            { index: 0, embedding: [1, 0, 0] },
          ],
        }),
      )
      .mockResolvedValueOnce(
        respond({ data: [{ index: 0, embedding: [0, 0, 1] }] }),
      )

    const vectors = await client.embed(target, ['a', 'b', 'c'])

    expect(vectors).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('http://embeddings.test/v1/embeddings')
    expect((init!.headers as Record<string, string>).Authorization).toBe(
      'Bearer sk-test',
    )
    expect(JSON.parse(init!.body as string)).toEqual({
      model: 'bge-m3',
      input: ['a', 'b'],
      encoding_format: 'float',
    })
  })

  it('rejects vectors whose dimension does not match the configuration', async () => {
    fetchMock.mockResolvedValueOnce(
      respond({ data: [{ index: 0, embedding: [1, 0] }] }),
    )
    await expect(client.embed(target, ['a'])).rejects.toMatchObject({
      code: 'EMBEDDING_DIMENSIONS_MISMATCH',
      message: expect.stringMatching(/2-dimensional vectors but 3/),
    })
  })

  it('surfaces provider errors as 502', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('model not found', { status: 404 }),
    )
    const error = await client.embed(target, ['a']).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AppException)
    expect((error as AppException).getStatus()).toBe(502)
    expect((error as AppException).getResponse()).toMatchObject({
      code: 'EMBEDDING_PROVIDER_ERROR',
      params: { status: 404, detail: 'model not found' },
    })

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    await expect(client.embed(target, ['a'])).rejects.toMatchObject({
      code: 'EMBEDDING_PROVIDER_UNREACHABLE',
      message: expect.stringMatching(/unreachable/),
    })
  })
})
