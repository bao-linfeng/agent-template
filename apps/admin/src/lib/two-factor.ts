import QRCode from 'qrcode'

/** `otpauth://` URI as an `<img src>` (SVG data URL), so no canvas or `v-html` is needed. */
export async function qrCodeDataUrl(uri: string): Promise<string> {
  const svg = await QRCode.toString(uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Base32 secret in groups of four for manual entry, e.g. `JBSW Y3DP EHPK 3PXP`. */
export function formatTotpSecret(secret: string): string {
  return secret.replace(/(.{4})(?=.)/g, '$1 ')
}

/** Plain-text file content for saving recovery codes. */
export function recoveryCodesText(codes: string[], options: { account: string, issuer: string, generatedAt?: Date }): string {
  const generatedAt = (options.generatedAt ?? new Date()).toISOString()
  return [
    `${options.issuer} recovery codes`,
    `Account: ${options.account}`,
    `Generated: ${generatedAt}`,
    '',
    'Each code works once. Keep them somewhere safe; generating new codes invalidates these.',
    '',
    ...codes,
    '',
  ].join('\n')
}

export function recoveryCodesFilename(account: string): string {
  return `recovery-codes-${account.replace(/[^\w.-]+/g, '_')}.txt`
}

/** Saves `text` as a file through a temporary link. */
export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
