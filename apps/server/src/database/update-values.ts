/**
 * Whether an object passed to Drizzle's `update().set()` has something to write. Drizzle drops
 * `undefined` values and throws "No values to set" when none are left, which would turn an empty
 * PATCH body into a 500; check it first and skip the update instead.
 */
export function hasValues(values: object): boolean {
  return Object.values(values).some((value) => value !== undefined)
}
