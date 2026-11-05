import { createHash, randomUUID } from 'node:crypto';
import http from 'node:http';

export const approvedPlanSha256 =
  '59a2f6d1b4e649bd616d160fd619fd292e01cc2e38bbe5dbd8e27ef3f6b88dfa';
export const seedHttpOrigin = 'http://127.0.0.1:55436';
export const publicSeedPaths = [
  '/pt',
  '/en',
  '/pt/sobre',
  '/en/about',
  '/pt/cases',
  '/en/cases',
  '/pt/cases/lorem-ipsum-01',
  '/en/cases/lorem-ipsum-01',
  '/pt/cases/lorem-ipsum-02',
  '/en/cases/lorem-ipsum-02',
];
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const collections = new Set([
  'media',
  'cases',
  'case-content',
  'professional-profiles',
  'site-navigation',
]);
export class StagingSeedError extends Error {
  constructor(code, status) {
    super(`Staging seed stopped: ${code}.`);
    this.name = 'StagingSeedError';
    this.code = code;
    this.status = status;
  }
}
function requireSeed(condition, code) {
  if (!condition) throw new StagingSeedError(code);
}
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, stable(value[key])]),
    );
  return value;
}
export const contentHash = (value) => sha256(JSON.stringify(stable(value)));
function project(actual, shape) {
  if (Array.isArray(shape))
    return Array.isArray(actual)
      ? actual.map((item, index) => project(item, shape[index] ?? shape[0]))
      : actual;
  if (shape && typeof shape === 'object')
    return actual && typeof actual === 'object'
      ? Object.fromEntries(Object.keys(shape).map((key) => [key, project(actual[key], shape[key])]))
      : actual;
  return actual;
}
function matches(document, desired) {
  return contentHash(project(document, desired)) === contentHash(desired);
}
function id(value) {
  requireSeed(typeof value === 'string' && uuid.test(value), 'invalid-native-id');
  return value;
}
function structuralKey(collection, locale) {
  return `${collection}:${locale}`;
}

export function stagingSeedSettings(runtime, editorSource, receipt, expectedDatabase) {
  requireSeed(
    runtime.APP_ENV === 'staging' && runtime.NODE_ENV === 'production',
    'staging-required',
  );
  requireSeed(runtime.STAGING_DATABASE_ONLY === 'false', 'application-mode-required');
  for (const key of [
    'PUBLIC_SITE_ENABLED',
    'PUBLICATION_RETRIES_ENABLED',
    'PUBLICATION_RETRY_WORKER_ENABLED',
    'PUBLICATION_HTTP_VERIFICATION_ENABLED',
  ])
    requireSeed(runtime[key] === 'false', 'private-initial-runtime-required');
  let origin, database;
  try {
    origin = new URL(runtime.SITE_ORIGIN);
    database = new URL(runtime.DATABASE_URI);
  } catch {
    throw new StagingSeedError('invalid-runtime-target');
  }
  requireSeed(
    origin.protocol === 'https:' &&
      origin.pathname === '/' &&
      !origin.username &&
      !origin.password &&
      !origin.search &&
      !origin.hash,
    'private-https-origin-required',
  );
  requireSeed(
    !['localhost', '127.0.0.1', 'panel.joeldorosarioo.dev'].includes(origin.hostname),
    'application-origin-required',
  );
  requireSeed(
    ['postgres:', 'postgresql:'].includes(database.protocol) &&
      ['localhost', '127.0.0.1'].includes(database.hostname) &&
      (!database.port || database.port === '5432') &&
      !database.search &&
      !database.hash,
    'embedded-database-required',
  );
  const databaseName = decodeURIComponent(database.pathname.slice(1));
  requireSeed(
    typeof expectedDatabase === 'string' &&
      expectedDatabase === databaseName &&
      /^[a-z_][a-z0-9_]{0,62}$/i.test(databaseName),
    'database-confirmation-required',
  );
  requireSeed(
    runtime.MEDIA_STORAGE_DRIVER === 'r2' &&
      runtime.MEDIA_BUCKET === runtime.R2_BUCKET &&
      typeof runtime.R2_MEDIA_PREFIX === 'string' &&
      runtime.R2_MEDIA_PREFIX.split('/').some((part) => /^staging(?:-|$)/.test(part)),
    'staging-media-namespace-required',
  );
  requireSeed(
    receipt?.version === 1 &&
      receipt.environment === 'staging' &&
      ['initialized', 'verified'].includes(receipt.status) &&
      receipt.database === databaseName &&
      receipt.origin === origin.origin &&
      receipt.migrations === 16,
    'initialization-receipt-required',
  );
  id(receipt.editorId);
  requireSeed(
    Array.isArray(receipt.structural) && receipt.structural.length === 4,
    'structural-baseline-required',
  );
  const baselines = new Map();
  for (const item of receipt.structural) {
    requireSeed(
      ['professional-profiles', 'site-navigation'].includes(item.collection) &&
        ['pt', 'en'].includes(item.locale) &&
        typeof item.updatedAt === 'string' &&
        item.updatedAt.length > 0,
      'invalid-structural-baseline',
    );
    id(item.id);
    requireSeed(
      !baselines.has(structuralKey(item.collection, item.locale)),
      'duplicate-structural-baseline',
    );
    baselines.set(structuralKey(item.collection, item.locale), item);
  }
  const selected =
    editorSource.STAGING_EDITOR_EMAIL !== undefined ||
    editorSource.STAGING_EDITOR_PASSWORD !== undefined
      ? ['STAGING_EDITOR_EMAIL', 'STAGING_EDITOR_PASSWORD']
      : ['LOCAL_EDITOR_EMAIL', 'LOCAL_EDITOR_PASSWORD'];
  const email = editorSource[selected[0]],
    password = editorSource[selected[1]];
  requireSeed(
    typeof email === 'string' &&
      email.trim() === email &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      typeof password === 'string' &&
      password.length >= 1 &&
      !/[\r\n\0]/.test(password),
    'editor-credentials-required',
  );
  return {
    origin: origin.origin,
    database: databaseName,
    editorId: receipt.editorId,
    baselines,
    freshProvisioning: receipt.freshProvisioning === true,
    email,
    password,
    scope: contentHash({
      origin: origin.origin,
      database: databaseName,
      editorId: receipt.editorId,
      bucket: runtime.R2_BUCKET,
      prefix: runtime.R2_MEDIA_PREFIX,
      plan: approvedPlanSha256,
    }),
  };
}

export function validateApprovedPlan(bytes, plan) {
  requireSeed(sha256(bytes) === approvedPlanSha256, 'unreviewed-plan');
  requireSeed(
    Array.isArray(plan.media) &&
      plan.media.length === 5 &&
      Array.isArray(plan.documents) &&
      plan.documents.length === 10,
    'invalid-approved-plan',
  );
  const expected = [
    'case01',
    'case02',
    'profile:pt',
    'profile:en',
    'navigation:pt',
    'navigation:en',
    'case01:pt',
    'case01:en',
    'case02:pt',
    'case02:en',
  ];
  requireSeed(
    new Set(plan.documents.map((item) => item.key)).size === expected.length &&
      expected.every((key) => plan.documents.some((item) => item.key === key)),
    'invalid-plan-documents',
  );
  for (const asset of plan.media)
    requireSeed(
      typeof asset.role === 'string' &&
        ['jpeg', 'png'].includes(asset.format) &&
        /^[a-f0-9]{64}$/.test(asset.sha256) &&
        /^original-file\/images\/[a-f0-9]+\.(?:jpg|png)$/.test(asset.file),
      'invalid-plan-asset',
    );
}

export function createDemoPdf(locale) {
  requireSeed(['pt', 'en'].includes(locale), 'invalid-demo-locale');
  const lines = [
    'Lorem ipsum - staging placeholder',
    locale === 'pt'
      ? 'Curriculo demonstrativo. Conteudo temporario.'
      : 'Sample resume. Temporary content.',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  ];
  const stream =
    'BT /F1 16 Tf 60 760 Td ' +
    lines.map((line, index) => (index ? '0 -32 Td ' : '') + `(${line}) Tj`).join('\n') +
    ' ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let data = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(data));
    data += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(data);
  data +=
    'xref\n0 6\n0000000000 65535 f \n' +
    offsets
      .slice(1)
      .map((offset) => String(offset).padStart(10, '0') + ' 00000 n \n')
      .join('') +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(data);
}

const words =
  'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(
    ' ',
  );
const structural = new Set([
  'locale',
  '_status',
  'readingKey',
  'blockType',
  'presentation',
  'coverPresentation',
  'type',
  'format',
  'mode',
  'style',
  'listType',
  'tag',
  'linkType',
  'url',
  'href',
  'target',
  'rel',
]);
function lorem(value, key = '') {
  if (Array.isArray(value)) return value.map((item) => lorem(item));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([name]) => name !== 'id')
        .map(([name, child]) => [name, lorem(child, name)]),
    );
  if (
    typeof value !== 'string' ||
    !value ||
    structural.has(key) ||
    key.startsWith('$') ||
    ['media', 'case', 'resume', 'slug'].includes(key)
  )
    return value;
  const count = Math.max(2, Math.min(90, value.trim().split(/\s+/).length));
  return (
    Array.from({ length: count }, (_, index) => words[index % words.length]).join(' ') +
    (/[.!?]$/.test(value) ? '.' : '')
  );
}
function materialize(value, state) {
  if (Array.isArray(value)) return value.map((item) => materialize(item, state));
  if (!value || typeof value !== 'object') return value;
  if (value.$case) return id(state.cases[value.$case].id);
  if (value.$asset) {
    const { $asset, ...rest } = value;
    return { media: id(state.media[$asset].id), ...rest };
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, materialize(child, state)]),
  );
}
export function desiredDocument(spec, plan, state) {
  const locale = spec.data.locale;
  requireSeed(['pt', 'en'].includes(locale), 'invalid-content-locale');
  let data;
  if (spec.collection === 'site-navigation') {
    data = structuredClone(spec.data);
    data.header.brandLabel = 'Lorem ipsum';
    data.footer.eyebrow = locale === 'pt' ? 'DEMONSTRAÇÃO DE HOMOLOGAÇÃO' : 'STAGING DEMONSTRATION';
    data.footer.description = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
    for (const group of ['header', 'footer', 'controls', 'messages'])
      for (const key of Object.keys(data[group]))
        if (!data[group][key]?.trim())
          data[group][key] =
            locale === 'pt'
              ? 'Lorem ipsum. Conteúdo temporário para revisão.'
              : 'Lorem ipsum. Temporary content for review.';
  } else if (spec.collection === 'professional-profiles') {
    data = lorem(spec.data);
    data.resume = id(state.media[`resume-${locale}`].id);
    data.identity = {
      name: 'Lorem ipsum',
      role: locale === 'pt' ? 'Conteúdo temporário' : 'Temporary content',
    };
    data.home.eyebrow = locale === 'pt' ? 'DEMONSTRAÇÃO DE HOMOLOGAÇÃO' : 'STAGING DEMONSTRATION';
    data.contacts = { email: 'lorem@example.invalid', linkedin: 'https://www.linkedin.com/' };
    data.homeAbout.aboutLabel = locale === 'pt' ? 'Sobre' : 'About';
    data.about.introductionHeading = 'Lorem ipsum';
    data.about.closingHeading = 'Dolor sit amet';
    const suffix = locale === 'pt' ? 'Demonstração PT' : 'Demonstration EN';
    data.seo = {
      ...data.seo,
      homeTitle: `${locale === 'pt' ? 'Início' : 'Home'} | Lorem ipsum | ${suffix}`,
      listingTitle: `${locale === 'pt' ? 'Projetos' : 'Projects'} | Lorem ipsum | ${suffix}`,
      aboutTitle: `${locale === 'pt' ? 'Sobre' : 'About'} | Lorem ipsum | ${suffix}`,
      homeDescription:
        locale === 'pt'
          ? 'Página inicial de demonstração com conteúdo temporário Lorem ipsum.'
          : 'Demonstration home page with temporary Lorem ipsum content.',
      listingDescription:
        locale === 'pt'
          ? 'Lista de projetos demonstrativos com conteúdo Lorem ipsum.'
          : 'Demonstration project list with Lorem ipsum content.',
      aboutDescription:
        locale === 'pt'
          ? 'Apresentação demonstrativa com conteúdo temporário Lorem ipsum.'
          : 'Demonstration about page with temporary Lorem ipsum content.',
    };
  } else {
    const first = spec.key.startsWith('case01');
    const source = structuredClone(spec.data);
    if (!source.sections?.length)
      source.sections = structuredClone(
        plan.documents.find((item) => item.key === 'case02:en').data.sections,
      );
    source.role ||= 'Lorem ipsum';
    data = lorem(source);
    data.slug = first ? 'lorem-ipsum-01' : 'lorem-ipsum-02';
    data.title = first ? 'Lorem ipsum' : 'Dolor sit amet';
    data.cardTitle = data.title;
    data.titleEmphasis = first ? 'dolor sit amet.' : 'consectetur adipiscing.';
    data.contextNote =
      locale === 'pt'
        ? 'Conteúdo de demonstração de homologação com Lorem ipsum. Substitua pelos dados do seu projeto.'
        : 'Staging demonstration with Lorem ipsum. Replace with your project content.';
    const number = first ? '01' : '02';
    data.seo = {
      ...data.seo,
      title: `${locale === 'pt' ? 'Case demonstrativo' : 'Demonstration case'} ${number} | Lorem ipsum | ${locale.toUpperCase()}`,
      description:
        locale === 'pt'
          ? `Case ${number} de demonstração com conteúdo temporário Lorem ipsum.`
          : `Demonstration case ${number} with temporary Lorem ipsum content.`,
    };
  }
  data._status = 'published';
  return materialize(data, state);
}

function multipart(label, file) {
  const boundary = 'adfl-staging-' + randomUUID();
  const name = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const before = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="_payload"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ label })}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${file.type}\r\n\r\n`,
  );
  return {
    body: Buffer.concat([before, file.bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]),
    type: `multipart/form-data; boundary=${boundary}`,
  };
}
/**
 * @param {string} method
 * @param {string} pathname
 * @param {{headers?: Record<string, string>, body?: Buffer}} [options]
 * @returns {Promise<{status: number, headers: import('node:http').IncomingHttpHeaders, bytes: Buffer}>}
 */
export function directLoopbackRequest(method, pathname, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    requireSeed(
      typeof pathname === 'string' &&
        pathname.startsWith('/') &&
        !pathname.startsWith('//') &&
        !/[\r\n]/.test(pathname),
      'invalid-native-path',
    );
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 55436,
        method,
        path: pathname,
        headers: { ...headers, ...(body ? { 'content-length': String(body.length) } : {}) },
        agent: false,
      },
      (response) => {
        const chunks = [];
        let length = 0;
        response.on('data', (chunk) => {
          length += chunk.length;
          if (length > 32 * 1024 * 1024) {
            response.destroy();
            reject(new StagingSeedError('response-limit'));
          } else chunks.push(chunk);
        });
        response.on('error', () => reject(new StagingSeedError('http-transport')));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            bytes: Buffer.concat(chunks),
          }),
        );
      },
    );
    req.setTimeout(45000, () => req.destroy());
    req.on('error', () => reject(new StagingSeedError('http-transport')));
    if (body) req.write(body);
    req.end();
  });
}
export class NativeSeedClient {
  #cookie = '';
  constructor(settings, send = directLoopbackRequest) {
    this.settings = settings;
    this.send = send;
  }
  /**
   * @param {string} method
   * @param {string} pathname
   * @param {{data?: Record<string, unknown>, headers?: Record<string, string>, file?: {name: string, type: string, bytes: Buffer}, label?: string, raw?: boolean}} [options]
   */
  async request(method, pathname, options = {}) {
    const { data, headers = {}, file, label, raw = false } = options;
    let body;
    const requestHeaders = {
      origin: this.settings.origin,
      ...(this.#cookie ? { cookie: this.#cookie } : {}),
      ...headers,
    };
    if (file) {
      const form = multipart(label, file);
      body = form.body;
      requestHeaders['content-type'] = form.type;
    } else if (data !== undefined) {
      body = Buffer.from(JSON.stringify(data));
      requestHeaders['content-type'] = 'application/json';
    }
    const response = await this.send(method, pathname, { headers: requestHeaders, body });
    if (response.status < 200 || response.status >= 300)
      throw new StagingSeedError('native-request', response.status);
    const cookies = response.headers['set-cookie'];
    if (cookies?.length)
      this.#cookie = (Array.isArray(cookies) ? cookies : [cookies])
        .map((value) => value.split(';')[0])
        .join('; ');
    if (raw) return response;
    let result;
    try {
      result = JSON.parse(response.bytes.toString('utf8'));
    } catch {
      throw new StagingSeedError('invalid-native-response');
    }
    return result;
  }
  async login() {
    const response = await this.send('OPTIONS', '/api/users/login', {
      headers: {
        origin: this.settings.origin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    requireSeed(
      [200, 204].includes(response.status) &&
        response.headers['access-control-allow-origin'] === this.settings.origin,
      'cors-target-mismatch',
    );
    try {
      await this.request('POST', '/api/users/login', {
        data: { email: this.settings.email, password: this.settings.password },
      });
      requireSeed(this.#cookie.length > 0, 'native-session-required');
      const me = await this.request('GET', '/api/users/me');
      requireSeed(me.user?.id === this.settings.editorId, 'editor-identity-mismatch');
    } catch (error) {
      try {
        await this.logout();
      } catch {
        /* Preserve the original refusal and clear the in-memory cookie. */
      }
      throw error;
    }
  }
  async logout() {
    try {
      if (this.#cookie) await this.request('POST', '/api/users/logout', { data: {} });
    } finally {
      this.#cookie = '';
    }
  }
  async list(collection, where = {}) {
    requireSeed(collections.has(collection), 'invalid-collection');
    const query = new URLSearchParams({ draft: 'true', depth: '0', limit: '100' });
    for (const [key, value] of Object.entries(where))
      query.set(`where[${key}][equals]`, String(value));
    const body = await this.request('GET', `/api/${collection}?${query}`);
    requireSeed(Array.isArray(body.docs) && body.totalDocs <= 100, 'bounded-native-list-required');
    return body.docs;
  }
  async document(collection, documentId) {
    return this.request('GET', `/api/${collection}/${id(documentId)}?draft=true&depth=0`);
  }
  async confirm(collection, documentId) {
    const status = await this.request(
      'GET',
      `/api/${collection}/${id(documentId)}/publication-status`,
    );
    requireSeed(status.receipt?.operationId, 'publication-receipt-required');
    if (status.receipt.state !== 'public') {
      const result = await this.request(
        'POST',
        `/api/${collection}/${documentId}/publication-retry`,
        { data: { operationId: status.receipt.operationId } },
      );
      requireSeed(result.ok && result.value?.state === 'public', 'publication-pending');
    }
  }
  async update(collection, documentId, data, expectedUpdatedAt) {
    const lease = await this.request(
      'POST',
      `/api/${collection}/${id(documentId)}/editorial-lease`,
      { data: { action: 'acquire' } },
    );
    requireSeed(lease.editable && lease.revision && lease.token, 'editorial-lease-held');
    try {
      const current = await this.document(collection, documentId);
      requireSeed(
        current._status === 'draft' && current.updatedAt === expectedUpdatedAt,
        'structural-draft-modified',
      );
      await this.request('PATCH', `/api/${collection}/${documentId}`, {
        data,
        headers: { 'x-editorial-revision': lease.revision, 'x-editorial-lease': lease.token },
      });
      await this.confirm(collection, documentId);
      return await this.document(collection, documentId);
    } finally {
      await this.request('POST', `/api/${collection}/${documentId}/editorial-lease`, {
        data: { action: 'release', token: lease.token },
      });
    }
  }
  async mediaBytes(documentId) {
    return (await this.request('GET', `/preview-media/${id(documentId)}/original`, { raw: true }))
      .bytes;
  }
}

/**
 * @typedef {{version: number, scope: string, nonce: string, media: Record<string, {id?: string, label: string, sha256: string}>, cases: Record<string, {id?: string, title: string, updatedAt?: string}>, documents: Record<string, {id?: string, collection: string, locale: string, hash: string, phase: string, caseId?: string, updatedAt?: string}>}} SeedState
 */
/** @returns {SeedState} */
export function newSeedState(settings) {
  requireSeed(settings.freshProvisioning, 'fresh-initialization-required');
  return {
    version: 1,
    scope: settings.scope,
    nonce: randomUUID(),
    media: {},
    cases: {},
    documents: {},
  };
}
function validateState(state, settings) {
  requireSeed(
    state?.version === 1 &&
      state.scope === settings.scope &&
      uuid.test(state.nonce) &&
      state.media &&
      state.cases &&
      state.documents,
    'checkpoint-scope-mismatch',
  );
}
/** @param {{settings: ReturnType<typeof stagingSeedSettings>, plan: unknown, assets: Array<{role: string, bytes: Buffer, sha256: string, name: string, type: string}>, state: SeedState, save: (state: SeedState) => Promise<unknown>, client?: Pick<NativeSeedClient, 'login' | 'logout' | 'request' | 'list' | 'document' | 'confirm' | 'update' | 'mediaBytes'>}} input */
export async function seedStagingContent({
  settings,
  plan,
  assets,
  state,
  save,
  client = new NativeSeedClient(settings),
}) {
  validateState(state, settings);
  requireSeed(
    assets.length === 7 && assets.every((asset) => sha256(asset.bytes) === asset.sha256),
    'source-asset-integrity',
  );
  await client.login();
  try {
    const mediaBefore = await client.list('media');
    const casesBefore = await client.list('cases');
    const contentBefore = await client.list('case-content');
    requireSeed(
      mediaBefore.every((document) =>
        Object.values(state.media).some(
          (item) => item.label === document.label && (!item.id || item.id === document.id),
        ),
      ),
      'unowned-media-present',
    );
    requireSeed(
      casesBefore.every((document) =>
        Object.values(state.cases).some(
          (item) => item.title === document.internalTitle && (!item.id || item.id === document.id),
        ),
      ),
      'unowned-cases-present',
    );
    requireSeed(
      contentBefore.every((document) =>
        Object.values(state.documents).some(
          (item) =>
            item.collection === 'case-content' &&
            (item.id === document.id ||
              (item.phase === 'intent' &&
                item.caseId === document.case &&
                item.locale === document.locale)),
        ),
      ),
      'unowned-case-content-present',
    );
    for (const asset of assets) {
      let item = state.media[asset.role];
      if (!item) {
        item = state.media[asset.role] = {
          label: `Staging Lorem ipsum / ${asset.role} / ${state.nonce}`,
          sha256: asset.sha256,
        };
        await save(state);
      }
      requireSeed(item.sha256 === asset.sha256, 'media-checkpoint-conflict');
      const documents = await client.list('media', { label: item.label });
      requireSeed(documents.length <= 1, 'ambiguous-owned-media');
      let document = documents[0];
      if (!document) {
        const result = await client.request('POST', '/api/media', {
          label: item.label,
          file: asset,
        });
        document = result.doc ?? result;
      }
      id(document.id);
      requireSeed(
        document.label === item.label &&
          sha256(await client.mediaBytes(document.id)) === asset.sha256,
        'media-bytes-conflict',
      );
      item.id = document.id;
      await save(state);
    }
    for (const key of ['case01', 'case02']) {
      let item = state.cases[key];
      if (!item) {
        item = state.cases[key] = {
          title: `Staging Lorem ipsum ${key === 'case01' ? '01' : '02'} / ${state.nonce}`,
        };
        await save(state);
      }
      const desired = {
        ...structuredClone(plan.documents.find((document) => document.key === key).data),
        internalTitle: item.title,
      };
      const documents = await client.list('cases', { internalTitle: item.title });
      requireSeed(documents.length <= 1, 'ambiguous-owned-case');
      let document = documents[0];
      if (!document) document = (await client.request('POST', '/api/cases', { data: desired })).doc;
      requireSeed(
        matches(document, desired) && (!item.updatedAt || item.updatedAt === document.updatedAt),
        'owned-case-modified',
      );
      item.id = id(document.id);
      await save(state);
      await client.confirm('cases', item.id);
      document = await client.document('cases', item.id);
      requireSeed(matches(document, desired), 'owned-case-modified');
      requireSeed(typeof document.updatedAt === 'string', 'native-timestamp-required');
      item.updatedAt = document.updatedAt;
      await save(state);
    }
    const ordered = [
      ...plan.documents.filter((item) =>
        ['professional-profiles', 'site-navigation'].includes(item.collection),
      ),
      ...plan.documents.filter((item) => item.collection === 'case-content'),
    ];
    for (const spec of ordered) {
      const desired = desiredDocument(spec, plan, state);
      const expectedHash = contentHash(desired);
      let item = state.documents[spec.key];
      requireSeed(!item || item.hash === expectedHash, 'desired-content-changed');
      if (!item) {
        item = state.documents[spec.key] = {
          collection: spec.collection,
          locale: spec.data.locale,
          hash: expectedHash,
          phase: 'intent',
          ...(spec.collection === 'case-content' ? { caseId: desired.case } : {}),
        };
        await save(state);
      }
      if (spec.collection === 'case-content') {
        const documents = await client.list(spec.collection, {
          case: desired.case,
          locale: spec.data.locale,
        });
        requireSeed(documents.length <= 1, 'ambiguous-case-translation');
        let document = documents[0];
        if (!document)
          document = (await client.request('POST', '/api/case-content?depth=0', { data: desired }))
            .doc;
        requireSeed(
          matches(document, desired) && (!item.updatedAt || item.updatedAt === document.updatedAt),
          'owned-document-modified',
        );
        item.id = id(document.id);
        await save(state);
        await client.confirm(spec.collection, item.id);
        document = await client.document(spec.collection, item.id);
        requireSeed(matches(document, desired), 'owned-document-modified');
        requireSeed(typeof document.updatedAt === 'string', 'native-timestamp-required');
        item.updatedAt = document.updatedAt;
      } else {
        const baseline = settings.baselines.get(structuralKey(spec.collection, spec.data.locale));
        requireSeed(baseline, 'structural-baseline-required');
        let document = await client.document(spec.collection, baseline.id);
        requireSeed(document.id === baseline.id, 'structural-identity-mismatch');
        requireSeed(
          !item.updatedAt || item.updatedAt === document.updatedAt,
          'owned-document-modified',
        );
        if (!matches(document, desired)) {
          requireSeed(
            !item.id && document._status === 'draft' && document.updatedAt === baseline.updatedAt,
            'structural-draft-modified',
          );
          document = await client.update(spec.collection, document.id, desired, baseline.updatedAt);
        } else await client.confirm(spec.collection, document.id);
        requireSeed(typeof document.updatedAt === 'string', 'native-timestamp-required');
        item.updatedAt = document.updatedAt;
        item.id = document.id;
      }
      item.phase = 'complete';
      await save(state);
    }
    for (const pathname of publicSeedPaths) {
      const result = await client.request('GET', pathname, { raw: true });
      const body = result.bytes.toString('utf8');
      requireSeed(
        result.status === 200 && body.includes(settings.origin) && /noindex/i.test(body),
        'public-route-verification',
      );
    }
    return {
      status: 'seeded',
      media: Object.keys(state.media).length,
      caseIdentities: Object.keys(state.cases).length,
      documents: Object.keys(state.documents).length,
      publicRoutes: publicSeedPaths.length,
      transport: 'Native HTTP session, leases and confirmed publication',
    };
  } finally {
    await client.logout();
  }
}
