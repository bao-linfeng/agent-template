/** PostgreSQL error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html */
function pgCode(error: unknown): string | undefined {
  // Drizzle wraps driver errors in DrizzleQueryError with the original as `cause`.
  for (
    let current = error;
    current && typeof current === 'object';
    current = (current as { cause?: unknown }).cause
  ) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) {
      return code;
    }
  }
  return undefined;
}

export const isUniqueViolation = (error: unknown) => pgCode(error) === '23505';
/** 23503 foreign_key_violation (NO ACTION) or 23001 restrict_violation (ON DELETE RESTRICT). */
export const isForeignKeyViolation = (error: unknown) =>
  ['23503', '23001'].includes(pgCode(error) ?? '');
