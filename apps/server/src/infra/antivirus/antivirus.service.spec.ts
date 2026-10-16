import type { ConfigService } from '@nestjs/config'
import { Registry } from 'prom-client'
import {
  FAKE_MALWARE,
  startFakeClamd,
  type FakeClamd,
} from '../../../test/support/fake-clamd.js'
import { AppException } from '../../common/errors/app.exception.js'
import type { Env } from '../../config/env.js'
import type { MetricsService } from '../metrics/metrics.service.js'
import { AntivirusService } from './antivirus.service.js'

function createService(env: Partial<Env>) {
  const config = {
    get: (key: keyof Env) =>
      ({ CLAMAV_PORT: 3310, CLAMAV_TIMEOUT_MS: 2_000, ...env })[key],
  } as ConfigService<Env, true>
  const registry = new Registry()
  const service = new AntivirusService(config, {
    enabled: true,
    registry,
  } as unknown as MetricsService)
  return { service, registry }
}

async function scanCount(registry: Registry, result: string) {
  const metric = await registry.getSingleMetric('upload_scans_total')!.get()
  return metric.values.find((value) => value.labels.result === result)?.value
}

describe('AntivirusService', () => {
  let clamd: FakeClamd | undefined

  afterEach(async () => {
    await clamd?.close()
    clamd = undefined
  })

  it('accepts every file while CLAMAV_HOST is unset', async () => {
    const { service } = createService({})

    await expect(
      service.assertClean(Buffer.from(FAKE_MALWARE)),
    ).resolves.toBeUndefined()
  })

  it('passes clean files and rejects infected ones', async () => {
    clamd = await startFakeClamd()
    const { service, registry } = createService({
      CLAMAV_HOST: clamd.host,
      CLAMAV_PORT: clamd.port,
    })

    await service.assertClean(Buffer.from('hello'))
    const rejected = service.assertClean(Buffer.from(FAKE_MALWARE))

    await expect(rejected).rejects.toBeInstanceOf(AppException)
    await expect(rejected).rejects.toMatchObject({ code: 'UPLOAD_INFECTED' })
    expect(await scanCount(registry, 'clean')).toBe(1)
    expect(await scanCount(registry, 'infected')).toBe(1)
  })

  it('fails closed when clamd cannot scan', async () => {
    clamd = await startFakeClamd(() => 'INSTREAM size limit exceeded. ERROR')
    const { service, registry } = createService({
      CLAMAV_HOST: clamd.host,
      CLAMAV_PORT: clamd.port,
    })

    await expect(
      service.assertClean(Buffer.from('hello')),
    ).rejects.toMatchObject({ code: 'UPLOAD_SCAN_UNAVAILABLE' })
    expect(await scanCount(registry, 'error')).toBe(1)
  })
})
