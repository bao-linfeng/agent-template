import { onScopeDispose, readonly, shallowRef } from 'vue'

/**
 * Whole seconds left until a deadline (e.g. "send again in 42s"). Counts against the clock, so a
 * throttled background tab still shows the right value; stops at 0 and when the scope ends.
 */
export function useCountdown() {
  const remaining = shallowRef(0)
  let timer: ReturnType<typeof setInterval> | undefined
  let deadline = 0

  function stop() {
    clearInterval(timer)
    timer = undefined
    remaining.value = 0
  }

  function tick() {
    remaining.value = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
    if (!remaining.value)
      stop()
  }

  function start(seconds: number) {
    stop()
    deadline = Date.now() + seconds * 1000
    tick()
    if (remaining.value)
      timer = setInterval(tick, 1000)
  }

  onScopeDispose(stop)
  return { remaining: readonly(remaining), start, stop }
}
