import 'server-only';
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres';
import {
  Forbidden,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeOperationHook,
  type Payload,
  type PayloadRequest,
} from 'payload';

export type EditorialFirstAccessOptions = {
  enabled: boolean;
  appEnv: string;
  publicSiteEnabled: boolean;
  databaseUri: string;
  mediaBucket: string;
  provisionStructuralDocuments: (req: PayloadRequest) => Promise<void>;
};
type Reservation = {
  payload: Payload;
  transaction: string | number;
  session: object;
  authorized: boolean;
};

function permittedEnvironment(site: URL, options?: EditorialFirstAccessOptions): boolean {
  if (
    options?.enabled !== true ||
    options.publicSiteEnabled !== false ||
    typeof options.provisionStructuralDocuments !== 'function' ||
    site.username ||
    site.password ||
    site.pathname !== '/' ||
    site.search ||
    site.hash
  )
    return false;
  if (options.appEnv === 'staging') return site.protocol === 'https:';
  if (options.appEnv !== 'test') return false;
  try {
    const database = new URL(options.databaseUri);
    return (
      site.protocol === 'http:' &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(site.hostname) &&
      ['postgres:', 'postgresql:'].includes(database.protocol) &&
      database.hostname === '127.0.0.1' &&
      database.port === '55434' &&
      database.username === 'adfl_test' &&
      database.pathname === '/adfl_test_runner' &&
      !database.search &&
      !database.hash &&
      options.mediaBucket === 'adfl-test-runner'
    );
  } catch {
    return false;
  }
}
function nativeFirstRegistration(req: PayloadRequest): boolean {
  try {
    return (
      req.method === 'POST' &&
      req.routeParams?.collection === 'users' &&
      !req.routeParams.id &&
      new URL(req.url!).pathname === '/api/users/first-register'
    );
  } catch {
    return false;
  }
}

/** The Native operation owns the transaction, password hashing, login and cookie. */
export function editorialFirstAccess(
  siteOrigin: string,
  options?: EditorialFirstAccessOptions,
): {
  beforeOperation: CollectionBeforeOperationHook;
  beforeChange: CollectionBeforeChangeHook;
  afterChange: CollectionAfterChangeHook;
} {
  const site = new URL(siteOrigin);
  const reservations = new WeakMap<PayloadRequest, Reservation>();
  async function currentReservation(req: PayloadRequest) {
    const owned = reservations.get(req);
    const transaction = await req.transactionID;
    const adapter = req.payload.db as unknown as PostgresAdapter;
    if (
      !owned ||
      owned.payload !== req.payload ||
      owned.transaction !== transaction ||
      adapter.sessions?.[String(transaction)]?.db !== owned.session
    )
      return;
    return owned;
  }
  return {
    beforeOperation: async ({ operation, req }) => {
      if (
        operation !== 'create' ||
        req.user?.collection === 'users' ||
        req.context.trustedAccountProvisioning === true ||
        !nativeFirstRegistration(req)
      )
        return;
      req.responseHeaders ??= new Headers();
      req.responseHeaders.set('Cache-Control', 'no-store, max-age=0');
      if (!permittedEnvironment(site, options) || req.headers.get('origin') !== site.origin)
        throw new Forbidden(req.t);
      const transaction = await req.transactionID;
      const adapter = req.payload.db as unknown as PostgresAdapter;
      const session = transaction && adapter.sessions?.[String(transaction)]?.db;
      if (!transaction || !session) throw new Forbidden(req.t);
      const locked = await session.execute(
        sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${'a-design-for-life:editorial-first-access:users'}, 0)) AS acquired`,
      );
      if (locked.rows[0]?.acquired !== true) throw new Forbidden(req.t);
      // Native checks before calling create. Recheck under the transaction lock
      // because two first-register requests may both have observed an empty DB.
      const existing = await req.payload.db.findOne({ collection: 'users', req, where: {} });
      if (existing) throw new Forbidden(req.t);
      reservations.set(req, { payload: req.payload, transaction, session, authorized: false });
    },
    beforeChange: async ({ operation, req }) => {
      if (
        operation !== 'create' ||
        req.user?.collection === 'users' ||
        req.context.trustedAccountProvisioning === true
      )
        return;
      const owned = await currentReservation(req);
      if (!owned || owned.authorized) throw new Forbidden(req.t);
      owned.authorized = true;
    },
    afterChange: async ({ operation, req, doc }) => {
      if (operation !== 'create' || !reservations.has(req)) return doc;
      const owned = await currentReservation(req);
      if (!owned?.authorized || typeof doc.id !== 'string' || !options) throw new Forbidden(req.t);
      const previousUser = req.user;
      const previousContext = req.context;
      try {
        req.user = { ...doc, collection: 'users' };
        req.context = { ...previousContext, trustedStructuralProvisioning: true };
        await options.provisionStructuralDocuments(req);
        return doc;
      } finally {
        req.user = previousUser;
        req.context = previousContext;
        reservations.delete(req);
      }
    },
  };
}
