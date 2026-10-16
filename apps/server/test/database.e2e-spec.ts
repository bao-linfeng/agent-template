import type { Pool } from 'pg'
import { createPool } from '../src/database/database.js'
import { createTestApp, waitFor, type TestApp } from './support/test-app.js'

describe('database connection limits (e2e)', () => {
  let t: TestApp
  const pools: Pool[] = []
  const pool = (options: Parameters<typeof createPool>[1]) => {
    const created = createPool(process.env.DATABASE_URL!, options)
    pools.push(created)
    return created
  }

  beforeAll(async () => {
    t = await createTestApp()
  })

  afterAll(async () => {
    await Promise.all(pools.map((p) => p.end()))
    await t.close()
  })

  it('opens application sessions with the configured server timeouts', async () => {
    const { rows } = await t.pool.query<{
      statement: string
      idle: string
    }>(
      `SELECT current_setting('statement_timeout') AS statement,
              current_setting('idle_in_transaction_session_timeout') AS idle`,
    )
    expect(rows[0]).toEqual({ statement: '30s', idle: '1min' })
  })

  it('cancels statements that run longer than the statement timeout', async () => {
    const limited = pool({ statementTimeoutMs: 200 })
    await expect(limited.query('SELECT pg_sleep(2)')).rejects.toMatchObject({
      code: '57014',
    })
    await expect(limited.query('SELECT 1 AS ok')).resolves.toMatchObject({
      rows: [{ ok: 1 }],
    })
  })

  it('ends sessions idle in a transaction without crashing and keeps the pool usable', async () => {
    const onError = vi.fn()
    const limited = pool({ max: 1, idleInTransactionTimeoutMs: 200, onError })
    const client = await limited.connect()
    await client.query('BEGIN')

    await waitFor(() => onError.mock.calls.length > 0)
    expect((onError.mock.calls[0]![0] as Error).message).toMatch(
      /idle-in-transaction timeout/,
    )
    await expect(client.query('SELECT 1')).rejects.toThrow()
    client.release()

    // The dead connection was dropped; the next query gets a fresh one.
    await expect(limited.query('SELECT 1 AS ok')).resolves.toMatchObject({
      rows: [{ ok: 1 }],
    })
  })

  it('fails instead of waiting forever when the pool is exhausted', async () => {
    const limited = pool({ max: 1, connectionTimeoutMs: 200 })
    const client = await limited.connect()
    try {
      await expect(limited.query('SELECT 1')).rejects.toThrow(/timeout/i)
    } finally {
      client.release()
    }
  })
})
