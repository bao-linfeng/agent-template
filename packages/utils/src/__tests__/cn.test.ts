import { describe, expect, it } from 'vitest'

import { cn } from '../cn'

describe('cn', () => {
  it('joins conditional class names', () => {
    expect(cn('px-2', false && 'hidden', { 'font-bold': true, 'italic': false })).toBe('px-2 font-bold')
  })

  it('lets later Tailwind classes override conflicting earlier ones', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })
})
