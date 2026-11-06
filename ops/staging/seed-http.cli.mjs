import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parse } from 'dotenv';
import { fileURLToPath } from 'node:url';
import {
  createDemoPdf,
  NativeSeedClient,
  newSeedState,
  seedStagingContent,
  sha256,
  StagingSeedError,
  stagingSeedSettings,
  validateApprovedPlan,
} from './seed-http.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function fail(code) {
  throw new StagingSeedError(code);
}
function unlinkedFile(file) {
  const stat = lstatSync(file);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    realpathSync(file).toLowerCase() !== file.toLowerCase()
  )
    fail('unlinked-file-required');
}
function underWork(file) {
  const base = realpathSync(path.join(root, '.work'));
  const selected = realpathSync(file);
  if (!selected.toLowerCase().startsWith(base.toLowerCase() + path.sep))
    fail('owned-work-file-required');
  unlinkedFile(file);
}
function privateDirectory(directory) {
  const stat = lstatSync(directory);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    realpathSync(directory).toLowerCase() !== directory.toLowerCase()
  )
    fail('private-directory-required');
  if (process.platform === 'win32') {
    const escaped = directory.replace(/'/g, "''");
    const result = execFileSync(
      path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $a=Get-Acl -LiteralPath '${escaped}'; [ordered]@{allowed=@($a.Access|Where-Object{$_.AccessControlType -eq 'Allow'}|ForEach-Object{$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value});owner=$sid}|ConvertTo-Json -Compress`,
      ],
      { encoding: 'utf8', windowsHide: true },
    );
    const acl = JSON.parse(result);
    if (!acl.allowed.length || !acl.allowed.every((value) => value === acl.owner))
      fail('owner-only-directory-required');
  } else if (stat.mode & 0o077) fail('owner-only-directory-required');
}
function savePrivate(file, value) {
  if (existsSync(file)) unlinkedFile(file);
  const temporary = path.join(path.dirname(file), '.' + path.basename(file) + '-' + randomUUID());
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  renameSync(temporary, file);
}
function options(argv) {
  if (argv.length === 1 && argv[0] === '--help') return { help: true };
  const output = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (
      !['--database', '--runtime-file', '--editor-file'].includes(key) ||
      !argv[index + 1] ||
      output[key]
    )
      fail('invalid-arguments');
    output[key] = argv[index + 1];
  }
  if (!output['--database']) fail('database-confirmation-required');
  return output;
}

try {
  const args = options(process.argv.slice(2));
  if (args.help)
    console.log(
      'pnpm seed:staging --database <exact-database-name> [--runtime-file <owned-.work-file>] [--editor-file <project-.env-or-owned-.work-file>]',
    );
  else {
    const runtimeFile = path.resolve(
      root,
      args['--runtime-file'] ?? '.work/coolify-staging/staging-variables.txt',
    );
    const editorFile = path.resolve(root, args['--editor-file'] ?? '.env');
    underWork(runtimeFile);
    if (editorFile === path.join(root, '.env')) unlinkedFile(editorFile);
    else underWork(editorFile);
    const directory = path.dirname(runtimeFile);
    privateDirectory(directory);
    const receiptFile = path.join(directory, 'initialization-receipt.json');
    unlinkedFile(receiptFile);
    const runtime = parse(readFileSync(runtimeFile));
    const source = parse(readFileSync(editorFile));
    const receipt = JSON.parse(readFileSync(receiptFile, 'utf8'));
    const settings = stagingSeedSettings(runtime, source, receipt, args['--database']);
    const planFile = path.resolve(
      source.STAGING_SEED_PLAN ??
        'C:/Users/joeld/Documents/Codex/2026-11-03/quero-retomar-e-concluir-a-etapa/work/visual-fixture-resume-20261103/plan.v5.private.json',
    );
    const assetsRoot = realpathSync(
      path.resolve(
        source.STAGING_SEED_ASSETS_ROOT ??
          'C:/Users/joeld/Documents/Codex/2026-10-29/quero-iniciar-a-implementa-o-do/work/stage2-reference',
      ),
    );
    unlinkedFile(planFile);
    const planBytes = readFileSync(planFile);
    const plan = JSON.parse(planBytes.toString('utf8'));
    validateApprovedPlan(planBytes, plan);
    const assets = [];
    for (const item of plan.media) {
      const file = path.join(assetsRoot, item.file);
      unlinkedFile(file);
      if (
        !realpathSync(file)
          .toLowerCase()
          .startsWith(assetsRoot.toLowerCase() + path.sep)
      )
        fail('asset-outside-approved-root');
      const bytes = readFileSync(file);
      if (sha256(bytes) !== item.sha256) fail('approved-image-integrity');
      assets.push({
        role: item.role,
        bytes,
        sha256: item.sha256,
        type: item.format === 'jpeg' ? 'image/jpeg' : 'image/png',
        name: path.basename(item.file),
      });
    }
    for (const locale of ['pt', 'en']) {
      const bytes = createDemoPdf(locale);
      assets.push({
        role: `resume-${locale}`,
        bytes,
        sha256: sha256(bytes),
        type: 'application/pdf',
        name: `lorem-ipsum-${locale}.pdf`,
      });
    }
    const stateFile = path.join(directory, 'lorem-seed-state.private.json');
    let state;
    if (existsSync(stateFile)) {
      unlinkedFile(stateFile);
      state = JSON.parse(readFileSync(stateFile, 'utf8'));
    } else {
      state = newSeedState(settings);
      savePrivate(stateFile, state);
    }
    const result = await seedStagingContent({
      settings,
      plan,
      assets,
      state,
      save: async (value) => savePrivate(stateFile, value),
      client: new NativeSeedClient(settings),
    });
    savePrivate(path.join(directory, 'lorem-seed-receipt.json'), {
      version: 1,
      environment: 'staging',
      database: settings.database,
      origin: settings.origin,
      scope: settings.scope,
      ...result,
      completedAt: new Date().toISOString(),
    });
    console.log(JSON.stringify(result));
  }
} catch (error) {
  console.error(
    JSON.stringify({
      status: 'stopped',
      stage: error instanceof StagingSeedError ? error.code : 'source-or-transport-unavailable',
      ...(error instanceof StagingSeedError && error.status ? { statusCode: error.status } : {}),
    }),
  );
  process.exitCode = 1;
}
