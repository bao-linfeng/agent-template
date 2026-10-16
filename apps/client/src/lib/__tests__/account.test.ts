import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { accountApi, exportFileName } from '../account'
import { formatBytes } from '../download'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

describe('data export helpers', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('downloads the export file unparsed as a JSON blob', async () => {
    const file = '{\n  "format": "agent-template/account-export",\n  "version": 1\n}\n'
    fetchMock.mockResolvedValue(new Response(file, { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }))

    const blob = await accountApi.downloadExport('e1')
    expect(new URL(fetchMock.mock.calls[0]![0] as string).pathname).toMatch(/\/v1\/client\/users\/me\/exports\/e1\/download$/)
    expect(blob.type).toBe('application/json')
    expect(await blob.text()).toBe(file)
  })

  it('requests exports with an idempotency key', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'e1', status: 'pending' }), { status: 202, headers: { 'Content-Type': 'application/json' } }))

    await accountApi.requestExport()
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('names files after the request date', () => {
    expect(exportFileName({ createdAt: '2026-10-16T03:04:05.000Z' })).toBe('account-export-2026-10-16.json')
  })

  it('formats sizes with binary units', () => {
    expect(formatBytes(512, 'en')).toBe('512 byte')
    expect(formatBytes(1536, 'en')).toBe('1.5 kB')
    expect(formatBytes(5 * 1024 * 1024, 'en')).toBe('5 MB')
  })
})
