$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'android-env.ps1')

Set-Location (Join-Path $repoRoot 'android')
.\gradlew.bat :app:assembleDebug
