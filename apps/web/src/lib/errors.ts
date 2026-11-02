import { isAxiosError } from '../services/api';

interface ErrorBody {
  message?: string;
  errors?: Record<string, string[]>;
}

function bodyOf(error: unknown): ErrorBody | undefined {
  if (!isAxiosError(error)) return undefined;
  return error.response?.data as ErrorBody | undefined;
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
    if (!error.response) return 'Cannot reach the server. Check your connection and try again.';
    return bodyOf(error)?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function getErrorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}

/** Maps backend Zod field errors to a flat object for form setError(). */
export function getFieldErrors(error: unknown): Record<string, string> {
  const errors = bodyOf(error)?.errors;
  if (!errors) return {};
  const flat: Record<string, string> = {};
  for (const [field, messages] of Object.entries(errors)) {
    if (messages.length > 0) flat[field] = messages[0];
  }
  return flat;
}

export function isForbidden(error: unknown): boolean {
  return getErrorStatus(error) === 403;
}

export function isNotFound(error: unknown): boolean {
  return getErrorStatus(error) === 404;
}

export function isConflict(error: unknown): boolean {
  return getErrorStatus(error) === 409;
}
