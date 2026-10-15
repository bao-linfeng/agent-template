import { AVATAR_FILE_PATTERN, detectImageType } from './avatar.js'

const pad = (bytes: number[]) =>
  Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)])

describe('detectImageType', () => {
  it('detects raster formats from magic bytes', () => {
    expect(
      detectImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        ?.ext,
    ).toBe('png')
    expect(detectImageType(pad([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe('jpg')
    expect(
      detectImageType(Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(10)]))
        ?.ext,
    ).toBe('gif')
    expect(
      detectImageType(
        Buffer.concat([
          Buffer.from('RIFF'),
          Buffer.alloc(4),
          Buffer.from('WEBPVP8 '),
        ]),
      )?.ext,
    ).toBe('webp')
  })

  it('rejects SVG, text and truncated files', () => {
    expect(
      detectImageType(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      ),
    ).toBeUndefined()
    expect(detectImageType(Buffer.from([0x89, 0x50]))).toBeUndefined()
  })
})

describe('AVATAR_FILE_PATTERN', () => {
  it('only matches generated file names', () => {
    expect(
      AVATAR_FILE_PATTERN.test('0f8fad5b-d9cb-469f-a165-70867728950e.png'),
    ).toBe(true)
    expect(AVATAR_FILE_PATTERN.test('../secret.png')).toBe(false)
    expect(
      AVATAR_FILE_PATTERN.test('0f8fad5b-d9cb-469f-a165-70867728950e.svg'),
    ).toBe(false)
  })
})
