import { extname } from 'node:path'

/**
 * Supported source formats. Only UTF-8 text formats are parsed today; to add PDF/DOCX, register an
 * entry whose `parse` extracts plain text (and add the parser dependency).
 */
const FORMATS = {
  '.txt': { mimeType: 'text/plain', parse: decodeUtf8 },
  '.md': { mimeType: 'text/markdown', parse: decodeUtf8 },
  '.markdown': { mimeType: 'text/markdown', parse: decodeUtf8 },
  '.csv': { mimeType: 'text/csv', parse: decodeUtf8 },
  '.json': { mimeType: 'application/json', parse: decodeUtf8 },
  '.html': {
    mimeType: 'text/html',
    parse: (buffer: Buffer) => stripHtml(decodeUtf8(buffer)),
  },
  '.htm': {
    mimeType: 'text/html',
    parse: (buffer: Buffer) => stripHtml(decodeUtf8(buffer)),
  },
} as const

export type SupportedExtension = keyof typeof FORMATS
export const SUPPORTED_EXTENSIONS = Object.keys(FORMATS) as SupportedExtension[]

export class UnsupportedDocumentError extends Error {}

export function resolveFormat(filename: string): {
  extension: SupportedExtension
  mimeType: string
} {
  const extension = extname(filename).toLowerCase()
  if (!Object.hasOwn(FORMATS, extension)) {
    throw new UnsupportedDocumentError(
      `Unsupported file type "${extension || filename}". Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`,
    )
  }
  const typed = extension as SupportedExtension
  return { extension: typed, mimeType: FORMATS[typed].mimeType }
}

/** Extracts plain text by MIME type (as stored on the document). */
export function parseDocument(buffer: Buffer, mimeType: string): string {
  const format = Object.values(FORMATS).find(
    (candidate) => candidate.mimeType === mimeType,
  )
  if (!format) {
    throw new UnsupportedDocumentError(`No parser for ${mimeType}`)
  }
  return format.parse(buffer)
}

function decodeUtf8(buffer: Buffer): string {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    throw new UnsupportedDocumentError('File is not valid UTF-8 text')
  }
  if (text.includes('\u0000')) {
    throw new UnsupportedDocumentError('File looks binary, not text')
  }
  return text.replace(/^\uFEFF/, '')
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
}
