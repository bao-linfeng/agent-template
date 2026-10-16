import { HttpException } from '@nestjs/common'
import { AppException } from '../errors/app.exception.js'
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
    throw new AppException('UPLOAD_NOT_MULTIPART')
  }
  try {
    const part = await request.file({
      limits: { fileSize: maxBytes, files: 1 },
    })
    if (!part || part.fieldname !== 'file') {
      throw new AppException('UPLOAD_FILE_REQUIRED')
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
      throw new AppException('UPLOAD_TOO_LARGE', {
        message: `File exceeds the ${maxBytes} byte limit`,
        params: { maxBytes },
      })
    }
    if (code?.startsWith('FST_')) {
      throw new AppException('UPLOAD_INVALID', {
        message: (error as Error).message,
      })
    }
    throw error
  }
}
