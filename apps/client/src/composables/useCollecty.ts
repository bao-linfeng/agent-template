import { computed, effectScope, ref, watch } from 'vue'

interface CollectyItem {
  id: string
  path: string
  timestamp: number
}

// Global state shared by every caller
const STORAGE_KEY = 'uiCollection'
const SECTION_PREFIX = 'hero__'
const globalCollection = ref<CollectyItem[]>([])
let isInitialized = false

const toBaseId = (id: string) => id.replace(SECTION_PREFIX, '')

// Stored ids carry a random suffix (`<baseId>_<suffix>`) to stay unique
function formatCollectionId(id: string): string {
  const suffix = Math.random().toString(36).substring(2, 6)
  return `${toBaseId(id)}_${suffix}`
}

function storedBaseId(item: CollectyItem) {
  return item.id.split('_').slice(0, -1).join('_')
}

function loadCollection() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved)
      return

    const items = JSON.parse(saved) as CollectyItem[]
    if (Array.isArray(items) && items.every(item => item?.id)) {
      globalCollection.value = items
    }
    else {
      console.warn('Invalid collection format, resetting to empty array')
      globalCollection.value = []
    }
  }
  catch (error) {
    console.error('Failed to load collection:', error)
    globalCollection.value = []
  }
}

function initialize() {
  if (isInitialized)
    return
  isInitialized = true

  loadCollection()
  // A single, detached watcher: callers inside components must not add (or stop) one per instance
  effectScope(true).run(() => {
    watch(globalCollection, (items) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    }, { deep: true })
  })
}

export function useCollecty() {
  initialize()

  const isInCollection = (id: string): boolean => {
    if (!id)
      return false

    const baseId = toBaseId(id)
    return globalCollection.value.some(item => item?.id && storedBaseId(item) === baseId)
  }

  const addToCollection = (id: string, path: string) => {
    if (!id || !path) {
      console.warn('Invalid id or path provided')
      return
    }
    if (isInCollection(id))
      return

    globalCollection.value = [
      ...globalCollection.value,
      { id: formatCollectionId(id), path, timestamp: Date.now() },
    ]
  }

  const removeFromCollection = (id: string) => {
    if (!id)
      return

    const baseId = toBaseId(id)
    globalCollection.value = globalCollection.value.filter(item => item?.id && storedBaseId(item) !== baseId)
  }

  return {
    collection: computed(() => globalCollection.value),
    isInCollection,
    addToCollection,
    removeFromCollection,
  }
}
