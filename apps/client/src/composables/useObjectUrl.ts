import type { Ref } from 'vue'
import { onScopeDispose, shallowRef, watch } from 'vue'

/** Object URL for a local file preview; revoked when the file changes or the scope ends. */
export function useObjectUrl(file: Ref<Blob | null | undefined>) {
  const url = shallowRef<string>()

  function release() {
    if (url.value)
      URL.revokeObjectURL(url.value)
    url.value = undefined
  }

  watch(file, (value) => {
    release()
    if (value)
      url.value = URL.createObjectURL(value)
  }, { immediate: true })

  onScopeDispose(release)
  return url
}
