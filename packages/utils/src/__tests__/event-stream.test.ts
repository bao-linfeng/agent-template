import type { ServerSentEvent } from '../event-stream'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { connectEventStream, createEventStreamParser } from '../event-stream'

function parse(chunks: string[]) {
  const events: ServerSentEvent[] = []
  const retries: number[] = []
  const parser = createEventStreamParser(event => events.push(event), ms => retries.push(ms))
  chunks.forEach(chunk => parser.push(chunk))
  return { events, retries }
}

/** A response body that sends `chunks`, then stays open until `end()` (or errors with `fail()`). */
function body(chunks: string[]) {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
      const encoder = new TextEncoder()
      chunks.forEach(chunk => c.enqueue(encoder.encode(chunk)))
    },
  })
  return {
    stream,
    end: () => controller.close(),
    fail: (error: Error) => controller.error(error),
  }
}

describe('createEventStreamParser', () => {
  it('dispatches named events and skips comments and empty events', () => {
    const { events, retries } = parse([
      'retry: 5000\n\n',
      'event: ready\ndata: {}\n\n',
      ': ping\n\n',
      'event: sync\ndata: {"reason":"read"}\n\n',
    ])
    expect(retries).toEqual([5000])
    expect(events).toEqual([
      { event: 'ready', data: '{}' },
      { event: 'sync', data: '{"reason":"read"}' },
    ])
  })

  it('joins data lines, handles split chunks and every line ending', () => {
    const { events } = parse(['da', 'ta: a\r', '\ndata:b\r\rid: 7\ndata', ': c\n', '\n'])
    expect(events).toEqual([
      { event: 'message', data: 'a\nb' },
      { event: 'message', data: 'c', id: '7' },
    ])
  })
})

describe('connectEventStream', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads events and reconnects after the server ends the stream', async () => {
    vi.useFakeTimers()
    const first = body(['retry: 1000\n\nevent: ready\ndata: {}\n\n'])
    const second = body(['event: ready\ndata: {}\n\n'])
    const open = vi.fn()
      .mockResolvedValueOnce(first.stream)
      .mockResolvedValueOnce(second.stream)
    const onEvent = vi.fn()
    const connection = connectEventStream({ open, onEvent, random: () => 0.5 })

    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(1))
    first.end()
    await vi.advanceTimersByTimeAsync(999)
    expect(open).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(2))
    expect(open).toHaveBeenCalledTimes(2)

    connection.close()
    expect(open.mock.calls[1]![0].aborted).toBe(true)
  })

  it('backs off while connecting fails and stops when told to', async () => {
    vi.useFakeTimers()
    const open = vi.fn().mockRejectedValue(new Error('offline'))
    const onError = vi.fn((_error: unknown) => open.mock.calls.length < 3)
    connectEventStream({ open, onEvent: vi.fn(), onError, retryMs: 100, random: () => 0.5 })

    await vi.advanceTimersByTimeAsync(0)
    expect(open).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(100)
    expect(open).toHaveBeenCalledTimes(2)
    // Second failure doubles the delay.
    await vi.advanceTimersByTimeAsync(199)
    expect(open).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(open).toHaveBeenCalledTimes(3)
    // onError returned false on the third failure.
    await vi.advanceTimersByTimeAsync(10_000)
    expect(open).toHaveBeenCalledTimes(3)
    expect(onError).toHaveBeenLastCalledWith(new Error('offline'))
  })

  it('stops quietly when closed while connected', async () => {
    const stream = body([])
    const onError = vi.fn()
    const open = vi.fn((signal: AbortSignal) => {
      signal.addEventListener('abort', () => stream.fail(new DOMException('aborted', 'AbortError')))
      return Promise.resolve(stream.stream)
    })
    const connection = connectEventStream({ open, onEvent: vi.fn(), onError })
    await vi.waitFor(() => expect(open).toHaveBeenCalled())
    connection.close()
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(onError).not.toHaveBeenCalled()
    expect(open).toHaveBeenCalledTimes(1)
  })
})
