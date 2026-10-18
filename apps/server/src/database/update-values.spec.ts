import { hasValues } from './update-values.js'

describe('hasValues', () => {
  it('ignores undefined values like Drizzle does', () => {
    expect(hasValues({})).toBe(false)
    expect(hasValues({ name: undefined, status: undefined })).toBe(false)
    expect(hasValues({ name: undefined, enabled: false })).toBe(true)
    expect(hasValues({ description: null })).toBe(true)
  })
})
