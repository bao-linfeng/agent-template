import { createServer } from 'node:net'
import type { AddressInfo } from 'node:net'
import {
  FAKE_MALWARE,
  startFakeClamd,
  type FakeClamd,
} from '../../../test/support/fake-clamd.js'
import { parseReply, scanBuffer } from './clamd.js'

describe('parseReply', () => {
  it('parses clean, infected and error replies', () => {
    expect(parseReply('stream: OK\0')).toEqual({ infected: false })
    expect(parseReply('stream: Win.Test.EICAR_HDB-1 FOUND\0')).toEqual({
      infected: true,
      signature: 'Win.Test.EICAR_HDB-1',
    })
    expect(() => parseReply('INSTREAM size limit exceeded. ERROR\0')).toThrow(
      'clamd: INSTREAM size limit exceeded. ERROR',
    )
    expect(() => parseReply('')).toThrow('clamd: empty reply')
  })
})

describe('scanBuffer', () => {
  let clamd: FakeClamd | undefined

  afterEach(async () => {
    await clamd?.close()
    clamd = undefined
  })

  const options = () => ({
    host: clamd!.host,
    port: clamd!.port,
    timeoutMs: 2_000,
  })

  it('streams the file in chunks and reports clean files', async () => {
    clamd = await startFakeClamd()
    const file = Buffer.alloc(200 * 1024, 7)

    await expect(scanBuffer(file, options())).resolves.toEqual({
      infected: false,
    })
    expect(clamd.scanned[0]!.equals(file)).toBe(true)
  })

  it('scans empty files', async () => {
    clamd = await startFakeClamd()

    await expect(scanBuffer(Buffer.alloc(0), options())).resolves.toEqual({
      infected: false,
    })
  })

  it('reports the signature of infected files', async () => {
    clamd = await startFakeClamd()

    await expect(
      scanBuffer(Buffer.from(`hello ${FAKE_MALWARE}`), options()),
    ).resolves.toEqual({ infected: true, signature: 'Fake.Test.Signature' })
  })

  it('throws on clamd errors, timeouts and unreachable hosts', async () => {
    clamd = await startFakeClamd(() => 'INSTREAM size limit exceeded. ERROR')
    await expect(scanBuffer(Buffer.from('x'), options())).rejects.toThrow(
      'size limit exceeded',
    )
    await clamd.close()

    clamd = await startFakeClamd(() => undefined)
    await expect(
      scanBuffer(Buffer.from('x'), { ...options(), timeoutMs: 100 }),
    ).rejects.toThrow('did not answer within 100 ms')
    await clamd.close()
    clamd = undefined

    const closed = createServer()
    await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve))
    const { port } = closed.address() as AddressInfo
    await new Promise((resolve) => closed.close(resolve))
    await expect(
      scanBuffer(Buffer.from('x'), {
        host: '127.0.0.1',
        port,
        timeoutMs: 2_000,
      }),
    ).rejects.toThrow(/ECONNREFUSED/)
  })
})
