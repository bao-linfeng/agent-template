import { MetricsService } from '../src/infra/metrics/metrics.service.js'
import {
  ADMIN_API,
  API,
  createTestApp,
  registerUser,
  waitFor,
  type TestApp,
} from './support/test-app.js'

describe('metrics (e2e)', () => {
  let t: TestApp
  let metricsUrl: string

  const scrape = async () => {
    const response = await fetch(`${metricsUrl}/metrics`)
    expect(response.status).toBe(200)
    return response.text()
  }

  beforeAll(async () => {
    t = await createTestApp()
    const address = t.app.get(MetricsService).address()
    metricsUrl = `http://127.0.0.1:${address!.port}`
  })

  afterAll(async () => {
    await t.close()
  })

  it('records HTTP requests by route pattern and realm', async () => {
    await t.http().get(`${ADMIN_API}/me`).expect(401)
    await t.http().get(`${API}/nope/123`).expect(404)
    await t.http().get(`${API}/health`).expect(200)

    const body = await scrape()
    expect(body).toContain(
      `http_server_request_duration_seconds_count{method="GET",route="${ADMIN_API}/me",status_code="401",realm="admin"} 1`,
    )
    expect(body).toMatch(
      /http_server_request_duration_seconds_count\{method="GET",route="unmatched",status_code="404",realm="none"\} \d+/,
    )
    expect(body).not.toContain(`route="${API}/health"`)
    expect(body).not.toContain('/nope/123')
  })

  it('exports queue depth, job outcomes, pool usage and runtime metrics', async () => {
    // Registration emails a code through the `mail` queue.
    await registerUser(t)
    const body = await waitFor(async () => {
      const text = await scrape()
      return text.includes(
        'bullmq_jobs_processed_total{queue="mail",name="send",status="completed"}',
      )
        ? text
        : undefined
    })
    expect(body).toMatch(
      /bullmq_queue_jobs\{queue="mail",state="waiting"\} \d+/,
    )
    expect(body).toMatch(
      /bullmq_queue_jobs\{queue="rag-ingest",state="failed"\} \d+/,
    )
    expect(body).toMatch(
      /bullmq_job_last_success_timestamp_seconds\{queue="mail",name="send"\} \d+/,
    )
    expect(body).toMatch(/pg_pool_connections\{state="total"\} [1-9]/)
    expect(body).toContain('nodejs_eventloop_lag_p99_seconds')
  })

  it('is not reachable through the API listener', async () => {
    await t.http().get(`${API}/metrics`).expect(404)
    await t.http().get('/metrics').expect(404)
  })
})
