// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

// The composable keeps module-level state; load a fresh copy for each test
async function loadUseCollecty() {
  vi.resetModules()
  return (await import('../useCollecty')).useCollecty
}

function stored() {
  return JSON.parse(localStorage.getItem('uiCollection') ?? 'null')
}

describe('useCollecty', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('adds, detects and removes sections by their base id', async () => {
    const useCollecty = await loadUseCollecty()
    const { collection, isInCollection, addToCollection, removeFromCollection } = useCollecty()

    addToCollection('hero__build_the_future', '/hero/base')
    addToCollection('hero__build_the_future', '/hero/base')

    expect(collection.value).toHaveLength(1)
    expect(collection.value[0]).toMatchObject({ path: '/hero/base' })
    expect(collection.value[0]?.id).toMatch(/^build_the_future_[a-z0-9]+$/)
    expect(isInCollection('hero__build_the_future')).toBe(true)
    expect(isInCollection('hero__build_the')).toBe(false)

    removeFromCollection('hero__build_the_future')
    expect(collection.value).toEqual([])
  })

  it('restores a saved collection and ignores invalid data', async () => {
    localStorage.setItem('uiCollection', JSON.stringify([{ id: 'saved_ab12', path: '/', timestamp: 1 }]))
    expect((await loadUseCollecty())().isInCollection('hero__saved')).toBe(true)

    localStorage.setItem('uiCollection', '{broken')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await loadUseCollecty())().collection.value).toEqual([])
  })

  it('persists changes once, no matter how many callers use it', async () => {
    const useCollecty = await loadUseCollecty()
    const setItem = vi.spyOn(localStorage, 'setItem')

    const first = useCollecty()
    useCollecty()
    useCollecty()
    first.addToCollection('hero__pricing', '/hero/promo')
    await nextTick()

    expect(setItem).toHaveBeenCalledTimes(1)
    expect(stored()).toHaveLength(1)
    setItem.mockRestore()
  })
})
