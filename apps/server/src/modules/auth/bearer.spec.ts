import { AppException } from '../../common/errors/app.exception.js'
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
    const codeOf = (run: () => unknown) => {
      try {
        run()
      } catch (error) {
        return error instanceof AppException ? error.code : error
      }
      return undefined
    }
    expect(
      codeOf(() =>
        usesBearerTransport(
          withHeaders({ 'x-auth-transport': 'bearer' }),
          'admin',
        ),
      ),
    ).toBe('AUTH_BEARER_UNSUPPORTED')
    expect(
      codeOf(() =>
        usesBearerTransport(
          withHeaders({ 'x-auth-transport': 'token' }),
          'user',
        ),
      ),
    ).toBe('AUTH_TRANSPORT_INVALID')
    expect(
      codeOf(() =>
        usesBearerTransport(
          withHeaders({ 'x-auth-transport': ['bearer', 'bearer'] }),
          'user',
        ),
      ),
    ).toBe('AUTH_TRANSPORT_INVALID')
  })
})
