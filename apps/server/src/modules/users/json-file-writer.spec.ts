import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JsonObjectFileWriter } from './json-file-writer.js'

async function* generate<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item
  }
}

describe('JsonObjectFileWriter', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'json-writer-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('writes fields and streamed arrays as one valid JSON document', async () => {
    const path = join(dir, 'out.json')
    const writer = new JsonObjectFileWriter(path)
    await writer.field('format', 'test')
    await writer.field('account', { id: 1, nested: { list: [1, 2] } })
    await writer.field('missing', undefined)
    const written = await writer.array(
      'items',
      generate([{ text: 'line 1\nline 2 "quoted"' }, { text: '中文' }]),
    )
    await writer.array('empty', generate([]))
    await writer.close()

    expect(written).toBe(2)
    const text = await readFile(path, 'utf8')
    expect(JSON.parse(text)).toEqual({
      format: 'test',
      account: { id: 1, nested: { list: [1, 2] } },
      missing: null,
      items: [{ text: 'line 1\nline 2 "quoted"' }, { text: '中文' }],
      empty: [],
    })
    // Pretty-printed: one top-level key per line.
    expect(text.split('\n')[1]).toBe('  "format": "test",')
  })

  it('writes an empty object when no field was added', async () => {
    const path = join(dir, 'empty.json')
    const writer = new JsonObjectFileWriter(path)
    await writer.close()
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({})
  })
})
