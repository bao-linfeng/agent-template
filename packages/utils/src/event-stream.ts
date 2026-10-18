/**
 * Reader for `text/event-stream` responses (server-sent events) on top of `fetch`, for apps/server
 * routes such as `GET /notifications/stream`. Unlike `EventSource`, the request goes through the app's
 * API client, so cookies, `Authorization` and the 401 refresh + retry work as for every other request.
 */

/** One dispatched event; `event` defaults to `message`, `data` is the raw (multi-line joined) text. */
export interface ServerSentEvent {
  event: string
  data: string
  id?: string
}

export interface EventStreamParser {
  /** Feeds decoded text; complete events are dispatched synchronously. */
  push: (chunk: string) => void
}

/**
 * Incremental parser for the event-stream format (https://html.spec.whatwg.org/multipage/server-sent-events.html):
 * `event`, `data`, `id` and `retry` fields, comment lines (`:`), any line ending, events end at a blank line.
 */
export function createEventStreamParser(
  onEvent: (event: ServerSentEvent) => void,
  onRetry?: (ms: number) => void,
): EventStreamParser {
  let buffer = ''
  let eventType = ''
  let data: string[] = []
  let id: string | undefined

  function dispatch(): void {
    if (data.length > 0)
      onEvent({ event: eventType || 'message', data: data.join('\n'), ...(id === undefined ? {} : { id }) })
    eventType = ''
    data = []
  }

  function line(text: string): void {
    if (text === '') {
      dispatch()
      return
    }
    if (text.startsWith(':'))
      return
    const colon = text.indexOf(':')
    const field = colon === -1 ? text : text.slice(0, colon)
    let value = colon === -1 ? '' : text.slice(colon + 1)
    if (value.startsWith(' '))
      value = value.slice(1)
    if (field === 'event')
      eventType = value
    else if (field === 'data')
      data.push(value)
    else if (field === 'id' && !value.includes('\0'))
      id = value
    else if (field === 'retry' && /^\d+$/.test(value))
      onRetry?.(Number(value))
  }

  return {
    push(chunk) {
      buffer += chunk
      for (;;) {
        const end = buffer.search(/\r\n|\r|\n/)
        // A lone `\r` at the end may be the first half of `\r\n`: wait for more text.
        if (end === -1 || (buffer[end] === '\r' && end === buffer.length - 1))
          return
        const length = buffer.startsWith('\r\n', end) ? 2 : 1
        line(buffer.slice(0, end))
        buffer = buffer.slice(end + length)
      }
    },
  }
}

export interface EventStreamOptions {
  /**
   * Opens one connection and resolves to the response body, e.g.
   * `signal => apiFetch('/notifications/stream', { responseType: 'stream', retry: 0, signal })`.
   * Passing `signal` also turns off ofetch's request timeout, which would otherwise end the stream.
   */
  open: (signal: AbortSignal) => Promise<ReadableStream<Uint8Array> | null | undefined>
  onEvent: (event: ServerSentEvent) => void
  /** Called when a connection attempt fails; return `false` to stop reconnecting (e.g. signed out). */
  onError?: (error: unknown) => boolean | void
  /** Delay before reconnecting after the server ended the stream (default 5 s); its `retry:` field wins. */
  retryMs?: number
  /** Cap of the exponential backoff after consecutive failures (default 60 s). */
  maxRetryMs?: number
  /** Source of the ±20 % jitter that spreads reconnects of many clients (tests pass a constant). */
  random?: () => number
}

export interface EventStreamConnection {
  /** Stops the stream and every pending reconnect. */
  close: () => void
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
    function done(): void {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
  })
}

/**
 * Keeps an event stream open until `close()`: reconnects after the server ends it (`retryMs`, or the
 * stream's `retry:`) and backs off exponentially while connecting fails, up to `maxRetryMs`.
 */
export function connectEventStream(options: EventStreamOptions): EventStreamConnection {
  const controller = new AbortController()
  const { signal } = controller
  const maxRetryMs = options.maxRetryMs ?? 60_000
  const random = options.random ?? Math.random
  let retryMs = options.retryMs ?? 5000
  let failures = 0

  async function readOnce(): Promise<void> {
    const body = await options.open(signal)
    if (!body)
      throw new Error('The event stream response has no body')
    failures = 0
    const parser = createEventStreamParser(options.onEvent, (ms) => {
      retryMs = ms
    })
    const reader = body.getReader()
    const decoder = new TextDecoder()
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done)
          break
        parser.push(decoder.decode(value, { stream: true }))
      }
    }
    finally {
      reader.releaseLock()
    }
  }

  async function run(): Promise<void> {
    while (!signal.aborted) {
      try {
        await readOnce()
      }
      catch (error) {
        if (signal.aborted)
          return
        failures++
        if (options.onError?.(error) === false)
          return
      }
      if (signal.aborted)
        return
      const delay = failures === 0 ? retryMs : Math.min(retryMs * 2 ** (failures - 1), maxRetryMs)
      await sleep(delay * (0.8 + random() * 0.4), signal)
    }
  }

  void run()
  return { close: () => controller.abort() }
}
