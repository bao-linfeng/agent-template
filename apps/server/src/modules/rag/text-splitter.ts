export interface SplitOptions {
  /** Max characters per chunk. */
  chunkSize: number
  /** Characters repeated between consecutive chunks to keep context. Must be smaller than chunkSize. */
  chunkOverlap: number
}

/** Paragraph → line → sentence (CJK + Latin) → clause → word → character. */
const SEPARATORS = [
  '\n\n',
  '\n',
  '。',
  '！',
  '？',
  '. ',
  '! ',
  '? ',
  '；',
  '; ',
  '，',
  ', ',
  ' ',
  '',
]

/**
 * Recursive character splitter: breaks text on the coarsest separator that yields pieces no longer
 * than `chunkSize`, then greedily merges pieces into overlapping chunks.
 */
export function splitText(text: string, options: SplitOptions): string[] {
  const { chunkSize, chunkOverlap } = options
  if (chunkSize <= 0 || chunkOverlap < 0 || chunkOverlap >= chunkSize) {
    throw new Error(
      'Invalid split options: require 0 <= chunkOverlap < chunkSize',
    )
  }
  const normalized = text.replace(/\r\n?/g, '\n').trim()
  if (!normalized) {
    return []
  }
  return merge(
    splitRecursive(normalized, SEPARATORS, chunkSize),
    chunkSize,
    chunkOverlap,
  )
}

function splitRecursive(
  text: string,
  separators: readonly string[],
  size: number,
): string[] {
  if (text.length <= size) {
    return [text]
  }
  const index = separators.findIndex(
    (separator) => separator === '' || text.includes(separator),
  )
  const separator = separators[index] ?? ''
  if (separator === '') {
    const pieces: string[] = []
    for (let start = 0; start < text.length; start += size) {
      pieces.push(text.slice(start, start + size))
    }
    return pieces
  }
  const rest = separators.slice(index + 1)
  return splitKeepingSeparator(text, separator).flatMap((part) =>
    part.length <= size ? [part] : splitRecursive(part, rest, size),
  )
}

/** Keeps the separator attached to the end of each part so joined chunks read naturally. */
function splitKeepingSeparator(text: string, separator: string): string[] {
  const parts = text.split(separator)
  return parts
    .map((part, i) => (i < parts.length - 1 ? part + separator : part))
    .filter((part) => part.length > 0)
}

function merge(pieces: string[], size: number, overlap: number): string[] {
  const chunks: string[] = []
  let current: string[] = []
  let length = 0
  for (const piece of pieces) {
    if (length + piece.length > size && current.length > 0) {
      chunks.push(current.join(''))
      while (
        current.length > 0 &&
        (length > overlap || length + piece.length > size)
      ) {
        length -= current[0]!.length
        current.shift()
      }
    }
    current.push(piece)
    length += piece.length
  }
  if (current.length > 0) {
    chunks.push(current.join(''))
  }
  return chunks.map((chunk) => chunk.trim()).filter(Boolean)
}
