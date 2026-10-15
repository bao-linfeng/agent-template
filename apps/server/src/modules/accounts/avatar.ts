/** Raster formats accepted for avatars, detected from magic bytes (the client MIME type is ignored). SVG is rejected on purpose. */
const SIGNATURES = [
  {
    ext: 'png',
    mime: 'image/png',
    test: (b: Buffer) =>
      b
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    ext: 'jpg',
    mime: 'image/jpeg',
    test: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: 'gif',
    mime: 'image/gif',
    test: (b: Buffer) =>
      ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1')),
  },
  {
    ext: 'webp',
    mime: 'image/webp',
    test: (b: Buffer) =>
      b.subarray(0, 4).toString('latin1') === 'RIFF' &&
      b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
] as const

export type AvatarExtension = (typeof SIGNATURES)[number]['ext']

export function detectImageType(
  buffer: Buffer,
): { ext: AvatarExtension; mime: string } | undefined {
  const match = SIGNATURES.find(
    (signature) => buffer.length >= 12 && signature.test(buffer),
  )
  return match ? { ext: match.ext, mime: match.mime } : undefined
}

export const AVATAR_FILE_PATTERN = /^[0-9a-f-]{36}\.(png|jpg|gif|webp)$/

export const AVATAR_MIME_BY_EXT: Record<AvatarExtension, string> =
  Object.fromEntries(
    SIGNATURES.map((signature) => [signature.ext, signature.mime]),
  ) as Record<AvatarExtension, string>

export function avatarKey(userId: string, fileName: string): string {
  return `avatars/${userId}/${fileName}`
}
