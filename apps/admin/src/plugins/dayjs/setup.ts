import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

// The locale follows the app language, see `setLocale` in `@/plugins/i18n`.
export function setupDayjs() {
  dayjs.extend(relativeTime)
}
