import { EventEmitter } from 'node:events'
import { createPool } from './database.js'

describe('createPool', () => {
  it('passes the timeouts to pg and leaves unset ones disabled', async () => {
    const configured = createPool('postgres://app:app@localhost:5432/app', {
      max: 3,
      statementTimeoutMs: 30_000,
      idleInTransactionTimeoutMs: 60_000,
      connectionTimeoutMs: 5_000,
    })
    expect(configured.options).toMatchObject({
      max: 3,
      statement_timeout: 30_000,
      idle_in_transaction_session_timeout: 60_000,
      connectionTimeoutMillis: 5_000,
    })

    const defaults = createPool('postgres://app:app@localhost:5432/app')
    expect(defaults.options).toMatchObject({
      max: 10,
      statement_timeout: 0,
      idle_in_transaction_session_timeout: 0,
      connectionTimeoutMillis: 0,
    })
    await Promise.all([configured.end(), defaults.end()])
  })

  it('reports connection errors instead of crashing on unhandled error events', async () => {
    const onError = vi.fn()
    const pool = createPool('postgres://app:app@localhost:5432/app', {
      onError,
    })
    const client = new EventEmitter()
    pool.emit('connect', client)

    const error = new Error(
      'terminating connection due to idle-in-transaction timeout',
    )
    client.emit('error', error)
    expect(onError).toHaveBeenCalledWith(error)
    // Errors of idle connections are re-emitted by the pool; they must not throw either.
    expect(() => pool.emit('error', error, client)).not.toThrow()
    expect(onError).toHaveBeenCalledTimes(1)
    await pool.end()
  })
})
