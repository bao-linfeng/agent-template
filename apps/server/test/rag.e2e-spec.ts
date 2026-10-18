import {
  ADMIN_API,
  CLIENT_API,
  createTestApp,
  E2E_ADMIN,
  loginAdmin,
  registerUser,
  waitFor,
  type Agent,
  type TestApp,
} from './support/test-app.js'

const DOCS = {
  cats: 'Cats are small domesticated felines. Cats purr, chase mice and sleep most of the day.',
  rockets:
    'Rockets burn propellant to produce thrust. Orbital rockets need multiple stages to reach space.',
}

describe('embedding models & RAG (e2e)', () => {
  let t: TestApp
  let admin: Agent
  const fakeUrl = () => process.env.FAKE_EMBEDDINGS_URL!

  beforeAll(async () => {
    t = await createTestApp()
    admin = await loginAdmin(t, E2E_ADMIN)
  })

  afterAll(async () => {
    await t.close()
  })

  async function waitForDocument(
    agent: Agent,
    kbId: string,
    documentId: string,
    status = 'ready',
  ) {
    return waitFor(async () => {
      const response = await agent
        .get(
          `${CLIENT_API}/rag/knowledge-bases/${kbId}/documents/${documentId}`,
        )
        .expect(200)
      return response.body.status === status ? response.body : undefined
    })
  }

  it('manages embedding models from the admin console without leaking API keys', async () => {
    const list = await admin.get(`${ADMIN_API}/ai/embedding-models`).expect(200)
    expect(list.body).toContainEqual(
      expect.objectContaining({
        name: 'bge-m3',
        dimensions: 1024,
        isDefault: true,
      }),
    )

    const created = await admin
      .post(`${ADMIN_API}/ai/embedding-models`)
      .send({
        name: 'small-768',
        baseUrl: fakeUrl(),
        model: 'fake-768',
        dimensions: 768,
        apiKey: 'sk-secret',
      })
      .expect(201)
    expect(created.body).toMatchObject({
      hasApiKey: true,
      isDefault: false,
      enabled: true,
    })
    expect(JSON.stringify(created.body)).not.toContain('sk-secret')
    expect(created.body).not.toHaveProperty('apiKeyEncrypted')

    const stored = await t.pool.query<{ api_key_encrypted: string }>(
      'select api_key_encrypted from ai_embedding_models where id = $1',
      [created.body.id],
    )
    expect(stored.rows[0]!.api_key_encrypted).toMatch(/^v1\./)

    // A dimension-specific ANN index is created for new dimensions.
    const index = await t.pool.query(
      `select 1 from pg_indexes where indexname = 'rag_chunks_embedding_768_hnsw'`,
    )
    expect(index.rowCount).toBe(1)

    expect(
      (
        await admin
          .post(`${ADMIN_API}/ai/embedding-models/${created.body.id}/test`)
          .expect(200)
      ).body,
    ).toMatchObject({ ok: true, dimensions: 768 })
    const mismatch = await admin
      .post(`${ADMIN_API}/ai/embedding-models/test`)
      .send({ baseUrl: fakeUrl(), model: 'fake-768', dimensions: 512 })
      .expect(200)
    expect(mismatch.body).toMatchObject({
      ok: false,
      error: expect.stringContaining('768-dimensional'),
    })
    const broken = await admin
      .post(`${ADMIN_API}/ai/embedding-models/test`)
      .send({ baseUrl: fakeUrl(), model: 'broken', dimensions: 8 })
      .expect(200)
    expect(broken.body.ok).toBe(false)

    const cleared = await admin
      .patch(`${ADMIN_API}/ai/embedding-models/${created.body.id}`)
      .send({ apiKey: null })
      .expect(200)
    expect(cleared.body.hasApiKey).toBe(false)
    // An empty change is a no-op, not a 500.
    const unchanged = await admin
      .patch(`${ADMIN_API}/ai/embedding-models/${created.body.id}`)
      .send({})
      .expect(200)
    expect(unchanged.body).toMatchObject({
      id: created.body.id,
      hasApiKey: false,
    })

    await admin
      .post(`${ADMIN_API}/ai/embedding-models/${created.body.id}/default`)
      .expect(200)
    const defaults = (
      await admin.get(`${ADMIN_API}/ai/embedding-models`).expect(200)
    ).body.filter((m: { isDefault: boolean }) => m.isDefault)
    expect(defaults).toHaveLength(1)
    await admin
      .delete(`${ADMIN_API}/ai/embedding-models/${created.body.id}`)
      .expect(400)

    const bge = list.body.find((m: { name: string }) => m.name === 'bge-m3')
    await admin
      .post(`${ADMIN_API}/ai/embedding-models/${bge.id}/default`)
      .expect(200)
    await admin
      .delete(`${ADMIN_API}/ai/embedding-models/${created.body.id}`)
      .expect(204)
  })

  it('indexes documents in the background and retrieves the most relevant chunks', async () => {
    const { agent } = await registerUser(t)
    const kb = await agent
      .post(`${CLIENT_API}/rag/knowledge-bases`)
      .send({ name: 'Zoo', chunkSize: 200, chunkOverlap: 20 })
      .expect(201)
    expect(kb.body.embeddingModel).toMatchObject({
      name: 'bge-m3',
      dimensions: 1024,
    })
    const kbId = kb.body.id as string

    const cats = await agent
      .post(`${CLIENT_API}/rag/knowledge-bases/${kbId}/documents/text`)
      .send({ title: 'Cats', content: DOCS.cats })
      .expect(201)
    expect(cats.body.status).toBe('pending')
    const rockets = await agent
      .post(`${CLIENT_API}/rag/knowledge-bases/${kbId}/documents`)
      .field('title', 'Rockets')
      .attach('file', Buffer.from(`# Rockets\n\n${DOCS.rockets}`), 'rockets.md')
      .expect(201)
    expect(rockets.body).toMatchObject({
      title: 'Rockets',
      mimeType: 'text/markdown',
      source: 'file',
    })

    expect(await waitForDocument(agent, kbId, cats.body.id)).toMatchObject({
      chunkCount: 1,
    })
    await waitForDocument(agent, kbId, rockets.body.id)

    const results = await agent
      .post(`${CLIENT_API}/rag/knowledge-bases/${kbId}/search`)
      .send({ query: 'why do cats purr', topK: 2 })
      .expect(200)
    expect(results.body).toHaveLength(2)
    expect(results.body[0]).toMatchObject({
      documentTitle: 'Cats',
      documentId: cats.body.id,
    })
    expect(results.body[0].score).toBeGreaterThan(results.body[1].score)

    const filtered = await agent
      .post(`${CLIENT_API}/rag/knowledge-bases/${kbId}/search`)
      .send({ query: 'orbital rockets stages', minScore: 0.3 })
      .expect(200)
    expect(
      filtered.body.map(
        (chunk: { documentTitle: string }) => chunk.documentTitle,
      ),
    ).toEqual(['Rockets'])

    await agent
      .post(`${CLIENT_API}/rag/knowledge-bases/${kbId}/documents`)
      .attach('file', Buffer.from('%PDF-1.7'), 'paper.pdf')
      .expect(400)

    await agent
      .post(
        `${CLIENT_API}/rag/knowledge-bases/${kbId}/documents/${cats.body.id}/reindex`,
      )
      .expect(202)
    await waitForDocument(agent, kbId, cats.body.id)

    await agent
      .delete(
        `${CLIENT_API}/rag/knowledge-bases/${kbId}/documents/${cats.body.id}`,
      )
      .expect(204)
    const chunks = await t.pool.query(
      'select count(*)::int as n from rag_chunks where document_id = $1',
      [cats.body.id],
    )
    expect(chunks.rows[0].n).toBe(0)

    const listed = await agent
      .get(`${CLIENT_API}/rag/knowledge-bases/${kbId}/documents`)
      .expect(200)
    expect(listed.body.total).toBe(1)
  })

  it('marks documents as failed when the embedding provider rejects them permanently', async () => {
    const { agent } = await registerUser(t)
    const broken = await admin
      .post(`${ADMIN_API}/ai/embedding-models`)
      .send({
        name: 'broken-model',
        baseUrl: fakeUrl(),
        model: 'broken',
        dimensions: 1024,
      })
      .expect(201)
    const kb = await agent
      .post(`${CLIENT_API}/rag/knowledge-bases`)
      .send({ name: 'Broken', embeddingModelId: broken.body.id })
      .expect(201)

    // Disabled models fail immediately (no retries).
    await admin
      .patch(`${ADMIN_API}/ai/embedding-models/${broken.body.id}`)
      .send({ enabled: false })
      .expect(200)
    const document = await agent
      .post(`${CLIENT_API}/rag/knowledge-bases/${kb.body.id}/documents/text`)
      .send({ title: 'x', content: 'hello' })
      .expect(201)
    const failed = await waitForDocument(
      agent,
      kb.body.id,
      document.body.id,
      'failed',
    )
    expect(failed.error).toContain('disabled')

    await admin
      .delete(`${ADMIN_API}/ai/embedding-models/${broken.body.id}`)
      .expect(409)
    await agent
      .delete(`${CLIENT_API}/rag/knowledge-bases/${kb.body.id}`)
      .expect(204)
    await admin
      .delete(`${ADMIN_API}/ai/embedding-models/${broken.body.id}`)
      .expect(204)
  })

  it('scopes knowledge bases to their owners; administrators use the admin routes', async () => {
    const owner = await registerUser(t)
    const stranger = await registerUser(t)
    const kb = await owner.agent
      .post(`${CLIENT_API}/rag/knowledge-bases`)
      .send({ name: 'Private' })
      .expect(201)
    expect(kb.body.ownerId).toBe(owner.user.id)

    // Other users' knowledge bases look like missing ones.
    await stranger.agent
      .get(`${CLIENT_API}/rag/knowledge-bases/${kb.body.id}`)
      .expect(404)
    await stranger.agent
      .post(`${CLIENT_API}/rag/knowledge-bases/${kb.body.id}/search`)
      .send({ query: 'x' })
      .expect(404)
    await stranger.agent
      .delete(`${CLIENT_API}/rag/knowledge-bases/${kb.body.id}`)
      .expect(404)
    expect(
      (
        await stranger.agent
          .get(`${CLIENT_API}/rag/knowledge-bases`)
          .expect(200)
      ).body.items,
    ).toEqual([])

    // Admin sessions do not open client routes; the admin routes list every user's knowledge bases.
    await admin.get(`${CLIENT_API}/rag/knowledge-bases`).expect(401)
    await owner.agent.get(`${ADMIN_API}/rag/knowledge-bases`).expect(401)
    await admin
      .get(`${ADMIN_API}/rag/knowledge-bases/${kb.body.id}`)
      .expect(200)
    const mine = await admin
      .get(`${ADMIN_API}/rag/knowledge-bases`)
      .query({ ownerId: owner.user.id })
      .expect(200)
    expect(mine.body.items.map((item: { id: string }) => item.id)).toEqual([
      kb.body.id,
    ])
    await admin
      .get(`${ADMIN_API}/rag/knowledge-bases/${kb.body.id}/documents`)
      .expect(200)

    await owner.agent
      .patch(`${CLIENT_API}/rag/knowledge-bases/${kb.body.id}`)
      .send({ chunkSize: 400, chunkOverlap: 300 })
      .expect(400)
    const unchanged = await owner.agent
      .patch(`${CLIENT_API}/rag/knowledge-bases/${kb.body.id}`)
      .send({})
      .expect(200)
    expect(unchanged.body).toMatchObject({
      id: kb.body.id,
      name: kb.body.name,
      chunkSize: kb.body.chunkSize,
    })
    await admin
      .delete(`${ADMIN_API}/rag/knowledge-bases/${kb.body.id}`)
      .expect(204)
    await owner.agent
      .get(`${CLIENT_API}/rag/knowledge-bases/${kb.body.id}`)
      .expect(404)
  })

  it('answers similarity queries from the per-dimension HNSW index', async () => {
    const client = await t.pool.connect()
    try {
      await client.query('begin')
      await client.query('set local enable_seqscan = off')
      const vector = `[${Array.from({ length: 1024 }, (_, i) => (i === 0 ? 1 : 0)).join(',')}]`
      const plan = await client.query<{ 'QUERY PLAN': string }>(
        `explain select id from rag_chunks c where c.dimensions = 1024
         order by (c.embedding::vector(1024) <=> $1::vector(1024)) limit 5`,
        [vector],
      )
      expect(plan.rows.map((row) => row['QUERY PLAN']).join('\n')).toContain(
        'rag_chunks_embedding_1024_hnsw',
      )
    } finally {
      await client.query('rollback')
      client.release()
    }
  })
})
