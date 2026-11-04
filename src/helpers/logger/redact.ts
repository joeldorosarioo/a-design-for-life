import 'server-only';

const validators: Record<string, (value: unknown) => boolean> = {
  durationMs: (value) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 86_400_000,
  statusCode: (value) => Number.isInteger(value) && Number(value) >= 100 && Number(value) <= 599,
  retryable: (value) => typeof value === 'boolean',
  dependency: (value) => ['postgresql', 'r2', 'cache', 'mail'].includes(value as string),
  errorCode: (value) =>
    [
      'unexpected',
      'timeout',
      'unavailable',
      'invalid-input',
      'unauthorized',
      'conflict',
      'not-found',
    ].includes(value as string),
};

/** Project a closed, flat technical context. Unknown fields are never traversed. */
export function redact(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return '[REDACTED]';
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return '[REDACTED]';
    const safe: Record<string, unknown> = {};
    for (const [key, validate] of Object.entries(validators)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && 'value' in descriptor && validate(descriptor.value))
        safe[key] = descriptor.value;
    }
    return safe;
  } catch {
    return '[REDACTED]';
  }
}
