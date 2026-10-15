import { shallowRef } from 'vue'

export interface FlashMessage {
  type: 'success' | 'warning'
  text: string
}

/** One-shot message carried across a navigation (e.g. "password reset, please sign in"). */
const pending = shallowRef<FlashMessage | null>(null)

export function flash(message: FlashMessage) {
  pending.value = message
}

/** Returns the pending message once and clears it. */
export function takeFlash(): FlashMessage | null {
  const message = pending.value
  pending.value = null
  return message
}
