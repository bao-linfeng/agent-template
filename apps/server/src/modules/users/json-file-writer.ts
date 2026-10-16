import { once } from 'node:events'
import { createWriteStream, type WriteStream } from 'node:fs'
import { finished } from 'node:stream/promises'

/**
 * Writes one pretty-printed JSON object to a file field by field. Array fields are consumed from async
 * iterables and written item by item, so exports of any size never sit in memory at once.
 */
export class JsonObjectFileWriter {
  private readonly out: WriteStream
  private fields = 0

  constructor(path: string) {
    this.out = createWriteStream(path, { encoding: 'utf8' })
    this.out.write('{')
  }

  async field(name: string, value: unknown): Promise<void> {
    await this.key(name)
    await this.write(indent(JSON.stringify(value ?? null, null, 2), 1))
  }

  /** Writes `name: [...]` from `items`; returns how many items were written. */
  async array(name: string, items: AsyncIterable<unknown>): Promise<number> {
    await this.key(name)
    let count = 0
    for await (const item of items) {
      await this.write(
        `${count === 0 ? '[' : ','}\n    ${indent(JSON.stringify(item ?? null, null, 2), 2)}`,
      )
      count++
    }
    await this.write(count === 0 ? '[]' : '\n  ]')
    return count
  }

  /** Finishes the object and waits until the file is flushed. */
  async close(): Promise<void> {
    this.out.end(this.fields === 0 ? '}\n' : '\n}\n')
    await finished(this.out)
  }

  /** Closes the file without completing it (the caller deletes it). */
  destroy(): void {
    this.out.destroy()
  }

  private async key(name: string): Promise<void> {
    await this.write(
      `${this.fields === 0 ? '' : ','}\n  ${JSON.stringify(name)}: `,
    )
    this.fields++
  }

  private async write(chunk: string): Promise<void> {
    if (!this.out.write(chunk)) {
      await once(this.out, 'drain')
    }
  }
}

/** JSON.stringify escapes newlines inside strings, so every raw newline is structure. */
function indent(json: string, level: number): string {
  return json.replaceAll('\n', `\n${'  '.repeat(level)}`)
}
