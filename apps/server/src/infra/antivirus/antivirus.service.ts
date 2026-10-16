import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Counter } from 'prom-client'
import { AppException } from '../../common/errors/app.exception.js'
import type { Env } from '../../config/env.js'
import { MetricsService } from '../metrics/metrics.service.js'
import { type ClamdOptions, scanBuffer, type ScanVerdict } from './clamd.js'

/**
 * Malware scan of uploaded files through clamd (`CLAMAV_HOST`). Call `assertClean` after validating
 * the file type and before storing anything; it is a no-op while scanning is not configured.
 */
@Injectable()
export class AntivirusService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AntivirusService.name)
  private readonly clamd?: ClamdOptions
  private readonly scans: Counter<'result'>

  constructor(
    private readonly config: ConfigService<Env, true>,
    metrics: MetricsService,
  ) {
    const host = config.get('CLAMAV_HOST', { infer: true })
    if (host) {
      this.clamd = {
        host,
        port: config.get('CLAMAV_PORT', { infer: true }),
        timeoutMs: config.get('CLAMAV_TIMEOUT_MS', { infer: true }),
      }
    }
    this.scans = new Counter({
      name: 'upload_scans_total',
      help: 'Malware scans of uploaded files by result',
      labelNames: ['result'],
      registers: metrics.enabled ? [metrics.registry] : [],
    })
  }

  onApplicationBootstrap(): void {
    if (this.clamd) {
      this.logger.log(
        `Scanning uploads with clamd at ${this.clamd.host}:${this.clamd.port}`,
      )
    } else if (this.config.get('NODE_ENV', { infer: true }) === 'production') {
      this.logger.warn(
        'CLAMAV_HOST is not set: uploaded files are stored without a malware scan',
      )
    }
  }

  /** Throws 422 `UPLOAD_INFECTED` for flagged files and 503 `UPLOAD_SCAN_UNAVAILABLE` when clamd cannot scan. */
  async assertClean(buffer: Buffer): Promise<void> {
    if (!this.clamd) {
      return
    }
    let verdict: ScanVerdict
    try {
      verdict = await scanBuffer(buffer, this.clamd)
    } catch (error) {
      this.scans.inc({ result: 'error' })
      this.logger.error(`Upload scan failed: ${(error as Error).message}`)
      throw new AppException('UPLOAD_SCAN_UNAVAILABLE')
    }
    if (verdict.infected) {
      this.scans.inc({ result: 'infected' })
      this.logger.warn(
        `Rejected an upload of ${buffer.length} bytes: ${verdict.signature}`,
      )
      throw new AppException('UPLOAD_INFECTED')
    }
    this.scans.inc({ result: 'clean' })
  }
}
