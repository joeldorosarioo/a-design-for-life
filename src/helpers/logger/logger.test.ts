import { describe, expect, it } from 'vitest';
import { createLogger } from './logger';
import { redact } from './redact';

const correlationId = 'f073d942-e73d-47eb-a5a2-a389c61c154e';

describe('safe operational logger', () => {
  // Break caught: dropping required metadata or emitting non-JSON/multiple lines.
  it('writes one JSON line with required metadata and preserves a valid correlation', () => {
    let output = '';
    const logger = createLogger({
      now: () => new Date('2026-11-03T12:34:56.000Z'),
      write: (line) => {
        output += line;
        return true;
      },
    });

    const receipt = logger.info({
      operation: 'publication.confirm',
      result: 'success',
      correlationId,
      context: { durationMs: 12, statusCode: 200 },
    });

    expect(output.split('\n')).toHaveLength(2);
    expect(output.endsWith('\n')).toBe(true);
    expect(JSON.parse(output)).toEqual({
      dateISO: '2026-11-03T12:34:56.000Z',
      level: 'info',
      operation: 'publication.confirm',
      result: 'success',
      correlationId,
      context: { durationMs: 12, statusCode: 200 },
    });
    expect(receipt).toEqual({ written: true, correlationId });
  });

  // Break caught: serializing raw context or only filtering obvious secret keys.
  it('emits only validated technical context, omitting secrets and private content', () => {
    let output = '';
    const logger = createLogger({
      write: (line) => {
        output += line;
        return true;
      },
    });
    const privateValue = 'PRIVATE_SENTINEL';

    logger.error({
      operation: 'cache.refresh',
      result: 'unavailable',
      correlationId,
      context: {
        dependency: 'postgresql',
        retryable: true,
        errorCode: 'timeout',
        durationMs: 27,
        password: privateValue,
        token: privateValue,
        authorization: privateValue,
        cookies: privateValue,
        apiKey: privateValue,
        resetURL: privateValue,
        email: privateValue,
        name: privateValue,
        content: { body: privateValue },
        error: new Error(privateValue),
        unrecognized: privateValue,
      },
    });

    expect(output.length).toBeGreaterThan(0);
    expect(output).not.toContain(privateValue);
    expect(JSON.parse(output)).toMatchObject({
      level: 'error',
      context: {
        dependency: 'postgresql',
        retryable: true,
        errorCode: 'timeout',
        durationMs: 27,
      },
    });
    expect(Object.keys(JSON.parse(output).context).sort()).toEqual([
      'dependency',
      'durationMs',
      'errorCode',
      'retryable',
    ]);
    expect(output).not.toContain('stack');
  });

  // Break caught: allowing arbitrary nested values through a known key.
  it('redacts unknown values and nested cycles without evaluating getters', () => {
    const cycle: Record<string, unknown> = { durationMs: { secret: 'PRIVATE_SENTINEL' } };
    cycle.self = cycle;
    Object.defineProperty(cycle, 'statusCode', {
      get() {
        throw new Error('GETTER_MUST_NOT_RUN');
      },
    });

    expect(redact(cycle)).toEqual({});
    expect(redact([cycle, [cycle]])).toBe('[REDACTED]');
    expect(redact(new Error('PRIVATE_SENTINEL'))).toBe('[REDACTED]');
    expect(redact('PRIVATE_SENTINEL')).toBe('[REDACTED]');
  });

  // Break caught: accepting untrusted text as metadata, including a fake correlation.
  it.each([
    'publication.confirm\nPRIVATE_SENTINEL',
    'https://private.invalid/reset?token=PRIVATE_SENTINEL',
    'PRIVATE_SENTINEL@private.invalid',
    'x'.repeat(65),
  ])('replaces malformed metadata instead of serializing it: %s', (operation) => {
    let output = '';
    const logger = createLogger({
      write: (line) => {
        output += line;
        return true;
      },
    });

    const receipt = logger.error({
      operation,
      result: 'PRIVATE_SENTINEL' as 'failure',
      correlationId: 'PRIVATE_SENTINEL',
    });

    expect(output).not.toContain('PRIVATE_SENTINEL');
    expect(JSON.parse(output)).toMatchObject({ operation: 'invalid-operation', result: 'failure' });
    expect(receipt.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(JSON.parse(output).correlationId).toBe(receipt.correlationId);
  });

  // Break caught: an exception from a raw metadata getter escaping or leaking.
  it('accepts hostile event objects without evaluating accessors', () => {
    let output = '';
    const logger = createLogger({
      write: (line) => {
        output += line;
        return true;
      },
    });
    const event = {
      get operation(): string {
        throw new Error('PRIVATE_SENTINEL');
      },
      result: 'failure' as const,
      context: new Proxy(
        {},
        {
          getOwnPropertyDescriptor: () => {
            throw new Error('PRIVATE_SENTINEL');
          },
        },
      ),
    };

    expect(() => logger.error(event)).not.toThrow();
    expect(JSON.parse(output)).toMatchObject({
      operation: 'invalid-operation',
      context: '[REDACTED]',
    });
    expect(output).not.toContain('PRIVATE_SENTINEL');
  });

  // Break caught: logging can throw a private writer error or claim a failed write succeeded.
  it('returns an honest failure receipt when the writer throws without logging the error', () => {
    const logger = createLogger({
      write: () => {
        throw new Error('PRIVATE_SENTINEL');
      },
    });

    expect(() =>
      logger.error({ operation: 'cache.refresh', result: 'failure', correlationId }),
    ).not.toThrow();
    expect(logger.error({ operation: 'cache.refresh', result: 'failure', correlationId })).toEqual({
      written: false,
      correlationId,
    });
  });

  // Break caught: treating a non-acknowledging/async writer as a successful synchronous sink.
  it.each([false, undefined, Promise.resolve(true)])(
    'requires the writer to acknowledge synchronously: %s',
    (acknowledgement) => {
      const logger = createLogger({ write: (() => acknowledgement) as () => boolean });
      expect(logger.info({ operation: 'cache.read', result: 'success', correlationId })).toEqual({
        written: false,
        correlationId,
      });
    },
  );

  // Break caught: an invalid clock making application logging throw or emit a non-ISO date.
  it.each([
    () => new Date(Number.NaN),
    () => {
      throw new Error('PRIVATE_SENTINEL');
    },
  ])('falls back to a valid timestamp if the clock fails', (now) => {
    let output = '';
    const logger = createLogger({
      now,
      write: (line) => {
        output += line;
        return true;
      },
    });

    expect(() =>
      logger.info({ operation: 'cache.read', result: 'success', correlationId }),
    ).not.toThrow();
    expect(JSON.parse(output).dateISO).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(output).not.toContain('PRIVATE_SENTINEL');
  });

  // Break caught: invalid numeric magnitudes, coercible strings or nested context escaping.
  it('drops malformed and unbounded technical values rather than coercing them', () => {
    expect(
      redact({
        durationMs: 86_400_001,
        statusCode: '200',
        retryable: 'true',
        dependency: ['r2'],
        errorCode: { toString: () => 'timeout' },
      }),
    ).toEqual({});
  });
});
