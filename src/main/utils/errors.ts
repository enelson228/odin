export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function logError(context: string, err: unknown): void {
  const message = getErrorMessage(err);
  console.error(`[${context}] ${message}`, err);
}

export async function tryCatch<T>(
  fn: () => Promise<T>,
  fallback: T,
  context?: string,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (context) logError(context, err);
    return fallback;
  }
}
