import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StorageService } from '../src/infra/storage/storage.service.js'
import { createTestApp, type TestApp } from './support/test-app.js'

describe('Silo storage (e2e)', () => {
  let t: TestApp
  let storage: StorageService
  const prefix = `storage-tests/${randomUUID()}/`

  beforeAll(async () => {
    t = await createTestApp()
    storage = t.app.get(StorageService)
  })

  afterAll(async () => {
    await storage.deletePrefix(prefix)
    await t.close()
  })

  it('stores private objects and permits downloads only with a valid signature', async () => {
    const key = `${prefix}source.txt`
    await storage.putObject(key, Buffer.from('Silo download'), 'text/plain')
    expect(await storage.getObjectBuffer(key)).toEqual(
      Buffer.from('Silo download'),
    )

    const signedUrl = await storage.getPresignedUrl(key)
    const response = await fetch(signedUrl)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('Silo download')

    const unsignedUrl = new URL(signedUrl)
    unsignedUrl.search = ''
    const denied = await fetch(unsignedUrl)
    await denied.arrayBuffer()
    expect(denied.status).toBe(403)

    const tampered = new URL(signedUrl)
    tampered.searchParams.set('X-Amz-Signature', '0'.repeat(64))
    const invalid = await fetch(tampered)
    await invalid.arrayBuffer()
    expect(invalid.status).toBe(403)
  })

  it('uploads from disk, lists objects and deletes batches and prefixes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'silo-storage-'))
    const content = 'streamed file'
    const key = `${prefix}files/stream.txt`
    try {
      const path = join(dir, 'stream.txt')
      await writeFile(path, content)
      expect(await storage.putFile(key, path, 'text/plain')).toBe(
        Buffer.byteLength(content),
      )
      expect(await storage.getObjectBuffer(key)).toEqual(Buffer.from(content))

      const keys: string[] = []
      for await (const page of storage.listObjects(`${prefix}files/`)) {
        keys.push(...page.map((object) => object.key))
      }
      expect(keys).toEqual([key])
      expect(await storage.deleteObjects([key])).toBe(1)
      await expect(storage.getObject(key)).rejects.toMatchObject({
        code: 'FILE_NOT_FOUND',
      })

      await storage.putObject(key, Buffer.from(content), 'text/plain')
      await storage.deletePrefix(`${prefix}files/`)
      await expect(storage.getObject(key)).rejects.toMatchObject({
        code: 'FILE_NOT_FOUND',
      })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
