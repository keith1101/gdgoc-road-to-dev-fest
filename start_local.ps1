param(
    [switch]$SkipBuild,
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$WebDemoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrontendDir = Join-Path $WebDemoRoot "frontend"
$BackendDir = Join-Path $WebDemoRoot "backend"
$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"

if (-not $SkipBuild) {
    Write-Host "[1/2] Building React + Vite frontend..."
    Push-Location $FrontendDir
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
    } finally {
        Pop-Location
    }
}

Write-Host "[2/2] Starting single-origin FastAPI server on http://127.0.0.1:$Port ..."
Push-Location $BackendDir
try {
    & $VenvPython -m uvicorn app.main:app --host 127.0.0.1 --port $Port
} finally {
    Pop-Location
}
