import { connect } from 'node:net'

export interface ClamdOptions {
  host: string
  port: number
  /** Whole-scan deadline: connect, upload and verdict. */
  timeoutMs: number
}

export type ScanVerdict =
  { infected: false } | { infected: true; signature: string }

const CHUNK_BYTES = 64 * 1024

/**
 * Streams `buffer` to clamd with `zINSTREAM` (length-prefixed chunks, zero-length terminator) and
 * returns its verdict. Throws when clamd is unreachable, too slow or answers with an error (for
 * example `INSTREAM size limit exceeded` when the file is larger than its `StreamMaxLength`).
 */
export function scanBuffer(
  buffer: Buffer,
  options: ClamdOptions,
): Promise<ScanVerdict> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: options.host, port: options.port })
    const replies: Buffer[] = []
    let settled = false
    const finish = (outcome: () => ScanVerdict) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      socket.destroy()
      try {
        resolve(outcome())
      } catch (error) {
        reject(error as Error)
      }
    }
    const timer = setTimeout(
      () =>
        finish(() => {
          throw new Error(`clamd did not answer within ${options.timeoutMs} ms`)
        }),
      options.timeoutMs,
    )

    socket.on('connect', () => {
      socket.write('zINSTREAM\0')
      for (let offset = 0; offset < buffer.length; offset += CHUNK_BYTES) {
        const chunk = buffer.subarray(offset, offset + CHUNK_BYTES)
        const size = Buffer.alloc(4)
        size.writeUInt32BE(chunk.length)
        socket.write(size)
        socket.write(chunk)
      }
      socket.write(Buffer.alloc(4))
    })
    socket.on('data', (data: Buffer) => {
      replies.push(data)
      if (data.includes(0)) {
        finish(() => parseReply(Buffer.concat(replies).toString('utf8')))
      }
    })
    // clamd may close right after an error reply (writes then fail with EPIPE/ECONNRESET), so a
    // received reply wins over the socket error.
    socket.on('end', () =>
      finish(() => parseReply(Buffer.concat(replies).toString('utf8'))),
    )
    socket.on('error', (error) =>
      finish(() => {
        if (replies.length > 0) {
          return parseReply(Buffer.concat(replies).toString('utf8'))
        }
        throw error
      }),
    )
  })
}

/** Parses a clamd stream reply: `stream: OK`, `stream: <signature> FOUND` or `<reason> ERROR`. */
export function parseReply(reply: string): ScanVerdict {
  const text = reply.split('\0')[0]!.trim()
  if (text === 'stream: OK') {
    return { infected: false }
  }
  const found = /^stream: (.+) FOUND$/.exec(text)
  if (found) {
    return { infected: true, signature: found[1]! }
  }
  throw new Error(`clamd: ${text || 'empty reply'}`)
}
