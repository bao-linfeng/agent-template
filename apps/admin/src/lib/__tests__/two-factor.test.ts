// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { downloadText, formatTotpSecret, qrCodeDataUrl, recoveryCodesFilename, recoveryCodesText } from '../two-factor'

describe('two-factor helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the otpauth URI as an SVG data URL', async () => {
    const url = await qrCodeDataUrl('otpauth://totp/Agent%20Admin:ada%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Agent+Admin')
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    const svg = decodeURIComponent(url.slice(url.indexOf(',') + 1))
    expect(svg).toMatch(/^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
    expect(svg).toContain('<path')
  })

  it('groups the secret for manual entry', () => {
    expect(formatTotpSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP')
    expect(formatTotpSecret('ABCDEF')).toBe('ABCD EF')
    expect(formatTotpSecret('')).toBe('')
  })

  it('formats the recovery codes file', () => {
    const text = recoveryCodesText(['abcde-fghjk', 'mnpqr-stuvw'], {
      account: 'ada@example.com',
      issuer: 'Agent Admin',
      generatedAt: new Date('2026-10-16T08:00:00.000Z'),
    })
    expect(text).toBe([
      'Agent Admin recovery codes',
      'Account: ada@example.com',
      'Generated: 2026-10-16T08:00:00.000Z',
      '',
      'Each code works once. Keep them somewhere safe; generating new codes invalidates these.',
      '',
      'abcde-fghjk',
      'mnpqr-stuvw',
      '',
    ].join('\n'))
    expect(recoveryCodesFilename('ada+ops@example.com')).toBe('recovery-codes-ada_ops_example.com.txt')
  })

  it('downloads text through a temporary object URL', () => {
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL }
    const createObjectURL = vi.fn(() => 'blob:codes')
    const revokeObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    try {
      downloadText('codes.txt', 'abc')
    }
    finally {
      URL.createObjectURL = original.create
      URL.revokeObjectURL = original.revoke
    }

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalledTimes(1)
    const link = click.mock.contexts[0] as HTMLAnchorElement
    expect(link.download).toBe('codes.txt')
    expect(link.href).toBe('blob:codes')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:codes')
  })
})
