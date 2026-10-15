import { BadRequestException } from '@nestjs/common'
import type { HttpRequest } from '../../common/http/request.js'
import { readBearerToken, usesBearerTransport } from './bearer.js'

const withHeaders = (headers: Record<string, string | string[]>) =>
  ({ headers }) as unknown as HttpRequest

describe('readBearerToken', () => {
  it('reads the token of a Bearer authorization header', () => {
    expect(
      readBearerToken(withHeaders({ authorization: 'Bearer abc.def' })),
    ).toBe('abc.def')
    expect(readBearerToken(withHeaders({ authorization: 'bearer abc' }))).toBe(
      'abc',
    )
  })

  it('ignores missing, empty and other schemes', () => {
    expect(readBearerToken(withHeaders({}))).toBeUndefined()
    expect(
      readBearerToken(withHeaders({ authorization: 'Bearer ' })),
    ).toBeUndefined()
    expect(
      readBearerToken(withHeaders({ authorization: 'Basic dXNlcg==' })),
    ).toBeUndefined()
    expect(
      readBearerToken(withHeaders({ authorization: 'Bearer a b' })),
    ).toBeUndefined()
  })
})

describe('usesBearerTransport', () => {
  it('keeps cookies without the header or with "cookie"', () => {
    expect(usesBearerTransport(withHeaders({}), 'user')).toBe(false)
    expect(
      usesBearerTransport(
        withHeaders({ 'x-auth-transport': 'cookie' }),
        'admin',
      ),
    ).toBe(false)
  })

  it('switches bearer realms to body tokens', () => {
    expect(
      usesBearerTransport(
        withHeaders({ 'x-auth-transport': 'bearer' }),
        'user',
      ),
    ).toBe(true)
  })

  it('rejects bearer on cookie-only realms and unknown values', () => {
    expect(() =>
      usesBearerTransport(
        withHeaders({ 'x-auth-transport': 'bearer' }),
        'admin',
      ),
    ).toThrow(BadRequestException)
    expect(() =>
      usesBearerTransport(withHeaders({ 'x-auth-transport': 'token' }), 'user'),
    ).toThrow(BadRequestException)
    expect(() =>
      usesBearerTransport(
        withHeaders({ 'x-auth-transport': ['bearer', 'bearer'] }),
        'user',
      ),
    ).toThrow(BadRequestException)
  })
})
