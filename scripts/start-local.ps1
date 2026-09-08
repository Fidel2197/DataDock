$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (!(Test-Path -LiteralPath $pythonExe)) { throw 'Create the .venv and install backend requirements first. See README.md.' }
$localDir = Join-Path $projectRoot '.local'
New-Item -ItemType Directory -Force -Path $localDir | Out-Null
$apiProcess = Start-Process -FilePath $pythonExe -WorkingDirectory $projectRoot -ArgumentList @('-m','uvicorn','app.main:app','--app-dir','backend','--host','127.0.0.1','--port','8010') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $localDir 'api.log') -RedirectStandardError (Join-Path $localDir 'api-error.log')
$nodeExe = (Get-Command node -ErrorAction Stop).Source
$webProcess = Start-Process -FilePath $nodeExe -WorkingDirectory (Join-Path $projectRoot 'frontend') -ArgumentList @('node_modules/vite/bin/vite.js','--host','127.0.0.1') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $localDir 'web.log') -RedirectStandardError (Join-Path $localDir 'web-error.log')
@{ api = $apiProcess.Id; web = $webProcess.Id } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $localDir 'processes.json')
Write-Output 'DataDock is starting at http://127.0.0.1:5178/. Logs are in .local/.'
