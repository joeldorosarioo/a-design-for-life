import 'server-only';
import type { Config } from 'payload';
import { randomUUID } from 'node:crypto';
import { writeSync } from 'node:fs';
import { redact } from './redact';

export type LogEvent = {
  operation: string;
  result: 'success' | 'failure' | 'unavailable' | 'skipped' | 'started';
  correlationId?: string;
  context?: unknown;
};

export type LoggerOptions = {
  now?: () => Date;
  /** Synchronous sink: return true only after accepting the entire line. */
  write?: (line: string) => boolean;
};

export type LogReceipt = { written: boolean; correlationId: string };

const results = new Set(['success', 'failure', 'unavailable', 'skipped', 'started']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ownValue(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function timestamp(now: () => Date): string {
  try {
    return Date.prototype.toISOString.call(now());
  } catch {
    return new Date().toISOString();
  }
}

function writeStdout(line: string): boolean {
  const bytes = Buffer.from(line);
  let offset = 0;
  while (offset < bytes.length) {
    const written = writeSync(1, bytes, offset, bytes.length - offset);
    if (written <= 0) return false;
    offset += written;
  }
  return true;
}

export function createLogger(options: LoggerOptions = {}) {
  const write = options.write ?? writeStdout;
  const now = options.now ?? (() => new Date());
  function emit(level: 'info' | 'error', event: LogEvent): LogReceipt {
    const candidate = ownValue(event, 'correlationId');
    const correlationId =
      typeof candidate === 'string' && uuid.test(candidate)
        ? candidate.toLowerCase()
        : randomUUID();
    const operation = ownValue(event, 'operation');
    const result = ownValue(event, 'result');
    const line = `${JSON.stringify({
      dateISO: timestamp(now),
      level,
      // Callers must use static operation names, never values from content/errors.
      operation:
        typeof operation === 'string' &&
        operation.length <= 64 &&
        /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(operation)
          ? operation
          : 'invalid-operation',
      result: typeof result === 'string' && results.has(result) ? result : 'failure',
      correlationId,
      context: redact(ownValue(event, 'context')),
    })}\n`;
    try {
      return { written: write(line) === true, correlationId };
    } catch {
      // Do not log the writer error: it may contain private data and recurse.
      return { written: false, correlationId };
    }
  }
  return {
    info: (event: LogEvent) => emit('info', event),
    error: (event: LogEvent) => emit('error', event),
  };
}

export const logger = createLogger();

export function payloadRuntimeLoggerOptions(
  environment: 'local' | 'test' | 'staging' | 'production',
  sink = logger,
): Config['logger'] {
  if (environment !== 'staging' && environment !== 'production') return undefined;
  return {
    options: {
      level: 'warn',
      hooks: {
        logMethod(args) {
          // Do not forward Pino's raw arguments or child bindings to its destination.
          const fields: unknown = args[0];
          const statusCode =
            ownValue(ownValue(fields, 'err'), 'status') ?? ownValue(fields, 'statusCode');
          sink.error({ operation: 'payload.runtime', result: 'failure', context: { statusCode } });
        },
      },
    },
  };
}
