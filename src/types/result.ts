export interface AppError {
  code: string;
  message: string;
  cause?: unknown;
}

/** Bkz. CLAUDE.md 1.3.4 — hata durumları exception değil union tip ile modellenir. */
export type Result<T, E = AppError> =
  | { ok: true; data: T }
  | { ok: false; error: E };
