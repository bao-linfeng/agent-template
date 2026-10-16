import {
  ForbiddenException,
  NotFoundException,
  type ValidationError,
} from '@nestjs/common'
import { ThrottlerException } from '@nestjs/throttler'
import { AppException } from './app.exception.js'
import { codeForStatus, ERRORS } from './error-codes.js'
import { toErrorBody, validationException } from './exception.filter.js'

describe('error catalog', () => {
  it('uses UPPER_SNAKE codes with an error status and a message', () => {
    for (const [code, { status, message }] of Object.entries(ERRORS)) {
      expect(code).toMatch(/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/)
      expect(status).toBeGreaterThanOrEqual(400)
      expect(message).not.toBe('')
    }
  })

  it('maps statuses to generic codes', () => {
    expect(codeForStatus(404)).toBe('NOT_FOUND')
    expect(codeForStatus(429)).toBe('TOO_MANY_REQUESTS')
    expect(codeForStatus(418)).toBe('BAD_REQUEST')
    expect(codeForStatus(504)).toBe('INTERNAL_ERROR')
  })
})

describe('AppException', () => {
  it('takes status and message from the catalog', () => {
    const error = new AppException('ACCOUNT_EMAIL_TAKEN')
    expect(error.getStatus()).toBe(409)
    expect(error.message).toBe('Email is already registered')
    expect(error.getResponse()).toEqual({
      statusCode: 409,
      code: 'ACCOUNT_EMAIL_TAKEN',
      message: 'Email is already registered',
    })
  })

  it('carries message overrides, params and details', () => {
    const error = new AppException('UPLOAD_TOO_LARGE', {
      message: 'File exceeds the 10 byte limit',
      params: { maxBytes: 10 },
      details: { field: 'file' },
    })
    expect(error.message).toBe('File exceeds the 10 byte limit')
    expect(toErrorBody(error)).toEqual({
      statusCode: 413,
      code: 'UPLOAD_TOO_LARGE',
      message: 'File exceeds the 10 byte limit',
      params: { maxBytes: 10 },
      details: { field: 'file' },
    })
  })
})

describe('toErrorBody', () => {
  it('gives plain HttpExceptions the generic code of their status', () => {
    expect(toErrorBody(new NotFoundException('Cannot GET /nope'))).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Cannot GET /nope',
    })
    expect(toErrorBody(new ForbiddenException())).toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'Forbidden',
    })
    expect(toErrorBody(new ThrottlerException())).toMatchObject({
      statusCode: 429,
      code: 'TOO_MANY_REQUESTS',
    })
  })

  it('keeps the status and message of Fastify client errors', () => {
    const error = Object.assign(new Error('Body is not valid JSON'), {
      statusCode: 400,
      code: 'FST_ERR_CTP_INVALID_JSON_BODY',
    })
    expect(toErrorBody(error)).toEqual({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Body is not valid JSON',
    })
  })

  it('hides unexpected errors behind INTERNAL_ERROR', () => {
    expect(toErrorBody(new Error('connection string leaked'))).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    })
    expect(
      toErrorBody(Object.assign(new Error('x'), { statusCode: 503 })),
    ).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' })
  })
})

describe('validationException', () => {
  it('flattens nested field errors into details', () => {
    const errors: ValidationError[] = [
      {
        property: 'email',
        constraints: { isEmail: 'email must be an email' },
        children: [],
      },
      {
        property: 'profile',
        children: [
          {
            property: 'name',
            constraints: { isString: 'name must be a string' },
            children: [],
          },
        ],
      },
    ]
    expect(validationException(errors).getResponse()).toEqual({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'email must be an email; name must be a string',
      details: [
        { field: 'email', constraints: { isEmail: 'email must be an email' } },
        {
          field: 'profile.name',
          constraints: { isString: 'name must be a string' },
        },
      ],
    })
  })
})
