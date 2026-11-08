import 'server-only';
import { APIError, type DatabaseAdapterObj } from 'payload';
import type { PostgresAdapter } from '@payloadcms/db-postgres';
type TransactionHost = {
  transaction: <T>(callback: (transaction: object) => Promise<T>, options?: unknown) => Promise<T>;
};
/** Compatibility guard for Payload/Drizzle 3.92.1's swallowed late COMMIT rejection. */
export function withConfirmedTransactions(
  factory: DatabaseAdapterObj<PostgresAdapter>,
): DatabaseAdapterObj<PostgresAdapter> {
  return {
    ...factory,
    init(args) {
      const adapter = factory.init(args);
      const outcomes = new WeakMap<object, Promise<boolean>>();
      const observed = new WeakSet<object>();
      const nativeBegin = adapter.beginTransaction.bind(adapter);
      const nativeCommit = adapter.commitTransaction.bind(adapter);
      adapter.beginTransaction = async (options) => {
        await adapter.initializing;
        const host = adapter.drizzle as unknown as TransactionHost;
        if (!observed.has(host)) {
          observed.add(host);
          const transaction = host.transaction.bind(host);
          host.transaction = <T>(
            callback: (session: object) => Promise<T>,
            options?: unknown,
          ): Promise<T> => {
            let settle!: (success: boolean) => void;
            const outcome = new Promise<boolean>((resolve) => {
              settle = resolve;
            });
            const raw = transaction(async (session) => {
              outcomes.set(session, outcome);
              return callback(session);
            }, options);
            // Observe the raw promise BEFORE native beginTransaction attaches its
            // consuming catch. Return it unchanged so Native keeps ownership.
            void raw.then(
              () => settle(true),
              () => settle(false),
            );
            return raw;
          };
        }
        return nativeBegin(options);
      };
      adapter.commitTransaction = async (incoming) => {
        const id = await incoming;
        const session = adapter.sessions[String(id)];
        if (!session) return nativeCommit(incoming);
        const outcome = outcomes.get(session.db);
        if (!outcome) {
          await adapter.rollbackTransaction(incoming);
          throw new APIError(
            'Não foi possível confirmar a gravação. Recarregue o documento.',
            503,
            undefined,
            true,
          );
        }
        try {
          await nativeCommit(incoming);
          if (!(await outcome))
            throw new APIError(
              'A gravação não foi confirmada no COMMIT. Recarregue o documento antes de tentar novamente.',
              503,
              undefined,
              true,
            );
        } finally {
          outcomes.delete(session.db);
        }
      };
      return adapter;
    },
  };
}
