$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$runtimeEnv = Join-Path $repoRoot "server/.env.docker"
if (-not (Test-Path $runtimeEnv)) {
    throw "Missing server/.env.docker. Copy server/.env.docker.example there and replace the placeholders first."
}

Push-Location $repoRoot
try { docker compose --env-file .env.docker.example config --quiet }
finally { Pop-Location }
