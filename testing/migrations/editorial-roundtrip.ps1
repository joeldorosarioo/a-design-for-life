$ErrorActionPreference = 'Stop'
$repositoryPath = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location $repositoryPath
$env:PATH = (Join-Path $repositoryPath '.toolchain/node-v24.22.2-win-x64') + ';' + $env:PATH
$env:COMPOSE_DISABLE_ENV_FILE = 'true'
$env:LOCAL_POSTGRES_PASSWORD = 'synthetic-unused-local-service-placeholder'
$env:APP_ENV = 'test'
$env:NODE_ENV = 'test'
$env:PAYLOAD_SECRET = 'synthetic-local-test-secret-for-isolated-payload-only'
$env:DATABASE_URI = 'postgres://adfl_test:synthetic-local-test-only@127.0.0.1:55433/adfl_test_base'
$env:SITE_ORIGIN = 'http://127.0.0.1:3100'
$env:MEDIA_BUCKET = 'adfl-test-files'
function Invoke-Payload([string[]]$CommandArgs) {
  & node --conditions=react-server ./node_modules/payload/bin.js @CommandArgs
  if ($LASTEXITCODE -ne 0) { throw "Native Payload command failed: $($CommandArgs[0])" }
}
# Exclusive use of the disposable integration fixture; never targets postgres-local.
try {
  docker compose -f compose.local.yaml up -d --wait postgres-test
  if ($LASTEXITCODE -ne 0) { throw 'Test fixture start failed' }
  $containerId = docker compose -f compose.local.yaml ps -q postgres-test
  $container = (docker inspect $containerId | ConvertFrom-Json)[0]
  if ($container.HostConfig.PortBindings.'5432/tcp'[0].HostPort -ne '55433' -or
      $container.HostConfig.PortBindings.'5432/tcp'[0].HostIp -ne '127.0.0.1' -or
      $container.HostConfig.Tmpfs.PSObject.Properties.Name -notcontains '/var/lib/postgresql/data' -or
      $container.Config.Env -notcontains 'POSTGRES_DB=adfl_test_base' -or
      $container.Config.Labels.'com.docker.compose.service' -ne 'postgres-test') {
    throw 'Isolation guard refused rollback'
  }
  Write-Output 'Verified own postgres-test: loopback55433, adfl_test_base, tmpfs; only this fixture receives rollback.'
  Invoke-Payload -CommandArgs @('migrate')
  Invoke-Payload -CommandArgs @('run', 'src/config/provision-structural-documents.cli.ts')
  Invoke-Payload -CommandArgs @('run', 'testing/fixtures/check-editorial-roundtrip.ts')
  Invoke-Payload -CommandArgs @('migrate:down')
  Invoke-Payload -CommandArgs @('migrate')
  Invoke-Payload -CommandArgs @('run', 'src/config/provision-structural-documents.cli.ts')
  Invoke-Payload -CommandArgs @('run', 'testing/fixtures/check-editorial-roundtrip.ts')
} finally {
  docker compose -f compose.local.yaml rm --stop --force postgres-test
}
