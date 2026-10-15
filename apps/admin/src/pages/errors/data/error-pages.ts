import { t } from '@/plugins/i18n'

interface ErrorPage {
  code: number
  subtitle: string
  error: string
}

const ERROR_CODES = ['401', '403', '404', '500', '503'] as const

type ErrorCode = typeof ERROR_CODES[number]

const FALLBACK_ERROR_CODE: ErrorCode = '404'

function isErrorCode(code: string): code is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(code)
}

/** Texts come from the `errors.<code>` messages in the current locale. */
export function resolveErrorPage(code: string): ErrorPage {
  const resolvedCode = isErrorCode(code) ? code : FALLBACK_ERROR_CODE

  return {
    code: Number(resolvedCode),
    subtitle: t(`errors.${resolvedCode}.subtitle`),
    error: t(`errors.${resolvedCode}.error`),
  }
}
