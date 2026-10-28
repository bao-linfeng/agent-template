import { S3Client } from '@aws-sdk/client-s3'
import { ConfigService } from '@nestjs/config'
import { validateEnv } from '../../config/env.js'
import { StorageService } from './storage.service.js'

describe('StorageService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('signs browser downloads with the public endpoint rather than the internal host', async () => {
    const storage = new StorageService(
      new ConfigService(
        validateEnv({
          STORAGE_ENDPOINT: 'http://silo:9000',
          STORAGE_PUBLIC_ENDPOINT: 'https://files.example.com',
        }),
      ),
    )
    try {
      const url = new URL(
        await storage.getPresignedUrl('rag/example/source.txt', 60),
      )
      expect(url.origin).toBe('https://files.example.com')
      expect(url.pathname).toBe('/app/rag/example/source.txt')
      expect(url.searchParams.get('X-Amz-Expires')).toBe('60')
      expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[a-f0-9]{64}$/)
    } finally {
      storage.onModuleDestroy()
    }
  })

  it('uses the read/write endpoint when no public endpoint is configured', async () => {
    const storage = new StorageService(
      new ConfigService(
        validateEnv({
          STORAGE_ENDPOINT: 'http://localhost:19000',
        }),
      ),
    )
    try {
      const url = new URL(await storage.getPresignedUrl('example.txt'))
      expect(url.origin).toBe('http://localhost:19000')
    } finally {
      storage.onModuleDestroy()
    }
  })

  it('destroys both clients on shutdown', () => {
    const destroy = vi.spyOn(S3Client.prototype, 'destroy')
    const storage = new StorageService(new ConfigService(validateEnv({})))
    storage.onModuleDestroy()
    expect(destroy).toHaveBeenCalledTimes(2)
  })
})
