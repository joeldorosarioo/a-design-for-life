$ErrorActionPreference = 'Stop'
$repositoryPath = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location $repositoryPath
$env:PATH = (Join-Path $repositoryPath '.toolchain/node-v24.22.2-win-x64') + ';' + $env:PATH
# The shared lifecycle rejects existing/colliding resources and owns only its UUID-scoped test project.
& node --conditions=react-server --import tsx ./testing/setup/editorial-roundtrip.ts
if ($LASTEXITCODE -ne 0) { throw 'Isolated native migration roundtrip failed' }
