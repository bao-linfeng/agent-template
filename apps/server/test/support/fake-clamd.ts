import { createServer, type Server } from 'node:net'
import type { AddressInfo } from 'node:net'

/** Files containing this marker are reported as infected (the real EICAR string would trip local antivirus). */
export const FAKE_MALWARE = 'FAKE-MALWARE-TEST-SIGNATURE'
/** Files containing this marker make clamd answer with an error. */
export const FAKE_SCAN_ERROR = 'FAKE-CLAMD-SCAN-ERROR'

export interface FakeClamd {
  host: string
  port: number
  /** Payloads received by `zINSTREAM`, reassembled from their chunks. */
  scanned: Buffer[]
  server: Server
  close: () => Promise<void>
}

/**
 * Minimal clamd speaking `zINSTREAM`: `verdict` maps each payload to the raw reply (`undefined` never
 * answers). By default payloads containing `FAKE_MALWARE` are `FOUND`, ones containing `FAKE_SCAN_ERROR`
 * get an `ERROR` reply and everything else is `OK`.
 */
export async function startFakeClamd(
  verdict: (payload: Buffer) => string | undefined = defaultVerdict,
): Promise<FakeClamd> {
  const scanned: Buffer[] = []
  const server = createServer((socket) => {
    let received = Buffer.alloc(0)
    socket.on('data', (data: Buffer) => {
      received = Buffer.concat([received, data])
      const payload = readInstream(received)
      if (!payload) {
        return
      }
      scanned.push(payload)
      const reply = verdict(payload)
      if (reply !== undefined) {
        socket.end(`${reply}\0`)
      }
    })
    socket.on('error', () => {})
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    host: '127.0.0.1',
    port,
    scanned,
    server,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve())
      }),
  }
}

function defaultVerdict(payload: Buffer): string {
  if (payload.includes(FAKE_MALWARE)) {
    return 'stream: Fake.Test.Signature FOUND'
  }
  if (payload.includes(FAKE_SCAN_ERROR)) {
    return "Can't allocate memory ERROR"
  }
  return 'stream: OK'
}

/** Returns the complete payload once the zero-length terminator chunk has arrived. */
function readInstream(data: Buffer): Buffer | undefined {
  const command = Buffer.from('zINSTREAM\0')
  if (data.length < command.length) {
    return undefined
  }
  if (!data.subarray(0, command.length).equals(command)) {
    throw new Error(`Unexpected clamd command: ${data.toString('latin1')}`)
  }
  const chunks: Buffer[] = []
  let offset = command.length
  while (offset + 4 <= data.length) {
    const size = data.readUInt32BE(offset)
    offset += 4
    if (size === 0) {
      return Buffer.concat(chunks)
    }
    if (offset + size > data.length) {
      return undefined
    }
    chunks.push(data.subarray(offset, offset + size))
    offset += size
  }
  return undefined
}
