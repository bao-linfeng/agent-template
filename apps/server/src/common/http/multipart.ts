import {
  BadRequestException,
  HttpException,
  PayloadTooLargeException,
} from '@nestjs/common'
import type { HttpRequest } from './request.js'

export interface UploadedFile {
  buffer: Buffer
  filename: string
  mimetype: string
  /** Text fields sent *before* the file part. */
  fields: Record<string, string>
}

/**
 * Reads exactly one file from a multipart request (field name `file`), fully buffered.
 * Fastify multipart errors are mapped to proper HTTP exceptions.
 */
export async function readSingleFile(
  request: HttpRequest,
  maxBytes: number,
): Promise<UploadedFile> {
  if (!request.isMultipart()) {
    throw new BadRequestException('Expected multipart/form-data')
  }
  try {
    const part = await request.file({
      limits: { fileSize: maxBytes, files: 1 },
    })
    if (!part || part.fieldname !== 'file') {
      throw new BadRequestException('Form field "file" is required')
    }
    const buffer = await part.toBuffer()
    const fields: Record<string, string> = {}
    for (const [name, value] of Object.entries(part.fields)) {
      const field = Array.isArray(value) ? value[0] : value
      if (field && field.type === 'field' && typeof field.value === 'string') {
        fields[name] = field.value
      }
    }
    return { buffer, filename: part.filename, mimetype: part.mimetype, fields }
  } catch (error) {
    if (error instanceof HttpException) {
      throw error
    }
    const code = (error as { code?: string }).code
    if (code === 'FST_REQ_FILE_TOO_LARGE' || code === 'FST_FILES_LIMIT') {
      throw new PayloadTooLargeException(
        `File exceeds the ${maxBytes} byte limit`,
      )
    }
    if (code?.startsWith('FST_')) {
      throw new BadRequestException((error as Error).message)
    }
    throw error
  }
}
