import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { Readable } from 'node:stream'
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppException } from '../../common/errors/app.exception.js'
import type { Env } from '../../config/env.js'

/** S3 DeleteObjects accepts at most this many keys per request. */
const DELETE_BATCH_SIZE = 1000

export interface ObjectSummary {
  key: string
  lastModified?: Date
}

export interface StoredObject {
  body: Readable
  contentType?: string
  contentLength?: number
}

/**
 * S3-compatible object storage (RustFS locally, any S3 provider in production).
 * Keys are opaque paths such as `avatars/<userId>/<uuid>.png`; never build them from raw user input.
 */
@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name)
  private readonly client: S3Client
  readonly bucket: string

  constructor(private readonly config: ConfigService<Env, true>) {
    this.bucket = config.get('STORAGE_BUCKET', { infer: true })
    this.client = new S3Client({
      endpoint: config.get('STORAGE_ENDPOINT', { infer: true }),
      region: config.get('STORAGE_REGION', { infer: true }),
      forcePathStyle: config.get('STORAGE_FORCE_PATH_STYLE', { infer: true }),
      credentials: {
        accessKeyId: config.get('STORAGE_ACCESS_KEY', { infer: true }),
        secretAccessKey: config.get('STORAGE_SECRET_KEY', { infer: true }),
      },
      // S3-compatible servers do not all support the SDK's default flexible checksums.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    })
  }

  async onModuleInit(): Promise<void> {
    if (!this.config.get('STORAGE_AUTO_CREATE_BUCKET', { infer: true })) {
      return
    }
    try {
      await this.ensureBucket()
    } catch (error) {
      // Storage being down must not block the API from starting; uploads will fail until it recovers.
      this.logger.warn(
        `Could not verify bucket "${this.bucket}": ${(error as Error).message}`,
      )
    }
  }

  onModuleDestroy(): void {
    this.client.destroy()
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }))
    } catch (error) {
      if (
        error instanceof S3ServiceException &&
        error.$metadata.httpStatusCode === 404
      ) {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }))
        this.logger.log(`Created bucket "${this.bucket}"`)
        return
      }
      throw error
    }
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    )
  }

  /** Streams a local file into storage (for large generated files); returns its size in bytes. */
  async putFile(
    key: string,
    path: string,
    contentType: string,
  ): Promise<number> {
    const { size } = await stat(path)
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: createReadStream(path),
        ContentLength: size,
        ContentType: contentType,
      }),
    )
    return size
  }

  async getObject(key: string): Promise<StoredObject> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      )
      return {
        body: result.Body as Readable,
        contentType: result.ContentType,
        contentLength: result.ContentLength,
      }
    } catch (error) {
      if (error instanceof NoSuchKey) {
        throw new AppException('FILE_NOT_FOUND')
      }
      throw error
    }
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    const { body } = await this.getObject(key)
    const parts: Buffer[] = []
    for await (const part of body) {
      parts.push(Buffer.isBuffer(part) ? part : Buffer.from(part as Uint8Array))
    }
    return Buffer.concat(parts)
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    )
  }

  /** Deletes every object under a prefix such as `rag/<kbId>/`. */
  async deletePrefix(prefix: string): Promise<void> {
    for await (const page of this.listObjects(prefix)) {
      await this.deleteObjects(page.map((item) => item.key))
    }
  }

  /** Lists the objects under a prefix one page (at most 1000 keys) at a time. */
  async *listObjects(prefix: string): AsyncGenerator<ObjectSummary[]> {
    let continuationToken: string | undefined
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      )
      yield (page.Contents ?? []).flatMap((item) =>
        item.Key ? [{ key: item.Key, lastModified: item.LastModified }] : [],
      )
      continuationToken = page.IsTruncated
        ? page.NextContinuationToken
        : undefined
    } while (continuationToken)
  }

  /** Deletes the given keys (missing keys count as deleted); returns how many were removed. */
  async deleteObjects(keys: readonly string[]): Promise<number> {
    let deleted = 0
    for (let offset = 0; offset < keys.length; offset += DELETE_BATCH_SIZE) {
      const batch = keys.slice(offset, offset + DELETE_BATCH_SIZE)
      const result = await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      )
      const failed = result.Errors ?? []
      for (const error of failed) {
        this.logger.warn(`Failed to delete ${error.Key}: ${error.Message}`)
      }
      deleted += batch.length - failed.length
    }
    return deleted
  }

  /** Time-limited direct download URL (the storage endpoint must be reachable by the client). */
  getPresignedUrl(key: string, expiresInSeconds = 300): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      {
        expiresIn: expiresInSeconds,
      },
    )
  }
}
