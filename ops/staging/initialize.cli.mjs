import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertUnlinkedWorkspacePath } from '../../src/config/next-dist.ts';
import { loadStagingInitialization } from './initialize-config.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = path.join(root, '.work/coolify-staging');
const receiptPath = path.join(directory, 'initialization-receipt.json');

export function validInitializationReceipt(value, selected) {
  const base =
    value &&
    value.version === 1 &&
    value.environment === 'staging' &&
    value.database === selected.database &&
    value.origin === selected.origin &&
    value.migrations === 16 &&
    /^[a-f0-9]{64}$/.test(value.migrationLedgerSha256 ?? '') &&
    Array.isArray(value.structural);
  if (!base) return false;
  if (value.status === 'pending-first-access') {
    return (
      value.editorId === null &&
      value.structuralDocuments === 0 &&
      value.structural.length === 0 &&
      value.freshProvisioning === false
    );
  }
  return (
    /^[a-f0-9-]{36}$/i.test(value.editorId ?? '') &&
    value.structuralDocuments === 4 &&
    ['initialized', 'verified'].includes(value.status) &&
    typeof value.freshProvisioning === 'boolean' &&
    value.structural.length === 4 &&
    value.structural.every(
      (item) =>
        ['professional-profiles', 'site-navigation'].includes(item.collection) &&
        ['pt', 'en'].includes(item.locale) &&
        /^[a-f0-9-]{36}$/i.test(item.id ?? '') &&
        typeof item.updatedAt === 'string',
    )
  );
}

export function mergeInitializationReceipt(previous, result, selected) {
  if (!validInitializationReceipt(result, selected))
    throw new Error('Invalid initialization result.');
  if (!previous) return result;
  if (
    !validInitializationReceipt(previous, selected) ||
    previous.migrationLedgerSha256 !== result.migrationLedgerSha256
  )
    throw new Error('Previous initialization receipt belongs to another target.');
  if (previous.status === 'pending-first-access') return result;
  if (result.status === 'pending-first-access')
    throw new Error('A completed initialization cannot be downgraded to pending first access.');
  if (
    previous.editorId !== result.editorId ||
    previous.structural.some(
      (item) =>
        !result.structural.some(
          (current) =>
            current.collection === item.collection &&
            current.locale === item.locale &&
            current.id === item.id,
        ),
    )
  )
    throw new Error('Previous initialization receipt belongs to another target.');
  // Preserve the first baseline: verification never authorizes overwriting edits.
  return {
    ...result,
    structural: previous.structural,
    freshProvisioning: previous.freshProvisioning,
  };
}

export async function writeInitializationReceipt(result, selected) {
  if (!validInitializationReceipt(result, selected))
    throw new Error('Invalid initialization result.');
  assertUnlinkedWorkspacePath(receiptPath, root);
  let previous;
  try {
    if ((await stat(receiptPath)).size > 65536) throw new Error('Invalid initialization receipt.');
    previous = JSON.parse(await readFile(receiptPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  result = mergeInitializationReceipt(previous, result, selected);
  const temporary = path.join(directory, `initialization-receipt-${randomUUID()}.tmp`);
  assertUnlinkedWorkspacePath(temporary, root);
  try {
    await writeFile(temporary, JSON.stringify(result, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    assertUnlinkedWorkspacePath(receiptPath, root);
    await rename(temporary, receiptPath);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function main() {
  const importPath = path.join(directory, 'staging-variables.txt');
  const settings = await loadStagingInitialization(process.argv.slice(2), {
    async readRuntime() {
      assertUnlinkedWorkspacePath(importPath, root);
      return readFile(importPath, 'utf8');
    },
    async readEditorial() {
      const editorialPath = path.join(root, '.env');
      assertUnlinkedWorkspacePath(editorialPath, root);
      return readFile(editorialPath, 'utf8');
    },
  });
  await mkdir(directory, { recursive: true, mode: 0o700 });
  assertUnlinkedWorkspacePath(directory, root);
  const operator = await mkdtemp(path.join(directory, 'initialize-private-'));
  const inherited = Object.fromEntries(
    [
      'PATH',
      'SystemRoot',
      'SYSTEMROOT',
      'WINDIR',
      'PATHEXT',
      'TEMP',
      'TMP',
      'HOME',
      'USERPROFILE',
      'APPDATA',
      'LOCALAPPDATA',
      'COMSPEC',
    ]
      .filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key]]),
  );
  try {
    const result = spawnSync(
      process.execPath,
      [
        '--conditions=react-server',
        '--import',
        'tsx',
        path.join(root, 'ops/staging/initialize.native.ts'),
      ],
      {
        cwd: root,
        windowsHide: true,
        encoding: 'utf8',
        timeout: 180000,
        maxBuffer: 1024 * 1024,
        env: {
          ...inherited,
          ...settings.environment,
          TSX_TSCONFIG_PATH: path.join(root, 'tsconfig.json'),
          STAGING_OPERATOR_WORKDIR: operator,
          STAGING_INITIALIZATION_DATABASE: settings.database,
          STAGING_INITIALIZATION_MODE: settings.mode,
          ...(settings.editor
            ? {
                STAGING_EDITOR_EMAIL: settings.editor.email,
                STAGING_EDITOR_PASSWORD: settings.editor.password,
              }
            : {}),
        },
      },
    );
    if (result.error || result.status !== 0) throw new Error('Initialization failed.');
    const receipt = JSON.parse(result.stdout);
    await writeInitializationReceipt(receipt, settings);
    writeSync(
      1,
      receipt.status === 'pending-first-access'
        ? `Staging schema prepared: ${receipt.migrations} migrations, zero editorial accounts and drafts. Create the first account in the browser.\n`
        : `Staging ${receipt.status}: ${receipt.migrations} migrations, editorial account ready, ${receipt.structuralDocuments} structural documents.\n`,
    );
  } finally {
    assertUnlinkedWorkspacePath(operator, root);
    await rm(operator, { recursive: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(() => {
    writeSync(
      2,
      'Staging initialization refused or incomplete. Keep database-only mode enabled; check the private import, confirmed target and SSH forward 55435.\n',
    );
    process.exitCode = 1;
  });
}
