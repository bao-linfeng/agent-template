import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useCountdown } from '../useCountdown'

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts down whole seconds and stops at zero', () => {
    const scope = effectScope()
    const { remaining, start } = scope.run(() => useCountdown())!

    start(3)
    expect(remaining.value).toBe(3)
    vi.advanceTimersByTime(1000)
    expect(remaining.value).toBe(2)
    vi.advanceTimersByTime(2000)
    expect(remaining.value).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    scope.stop()
  })

  it('restarts from the new value and clears the timer with its scope', () => {
    const scope = effectScope()
    const { remaining, start } = scope.run(() => useCountdown())!

    start(60)
    vi.advanceTimersByTime(10_000)
    start(5)
    expect(remaining.value).toBe(5)
    expect(vi.getTimerCount()).toBe(1)

    scope.stop()
    expect(remaining.value).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})
