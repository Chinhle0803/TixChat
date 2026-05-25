param(
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'android-env.ps1')

$keystorePath = Join-Path $repoRoot 'android\app\tixchat-release.keystore'
$propertiesPath = Join-Path $repoRoot 'android\signing-local.properties'

if ((Test-Path $keystorePath) -and !$Force) {
  throw "Release keystore already exists at $keystorePath. Re-run with -Force only if you intend to replace it."
}

function New-ReleasePassword {
  $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return -join (1..32 | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

$password = New-ReleasePassword
$keytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe'

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'

& $keytool `
  -genkeypair `
  -v `
  -keystore $keystorePath `
  -storetype PKCS12 `
  -storepass $password `
  -keypass $password `
  -alias 'tixchat-release' `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -dname 'CN=TixChat Mobile, OU=Internal, O=TixChat, L=Ho Chi Minh, ST=Ho Chi Minh, C=VN' 2>&1 | Out-Null

$keytoolExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference

if ($keytoolExitCode -ne 0) {
  throw "keytool failed with exit code $keytoolExitCode"
}

Set-Content -Path $propertiesPath -Encoding ASCII -Value @(
  'TIXCHAT_RELEASE_STORE_FILE=app/tixchat-release.keystore',
  'TIXCHAT_RELEASE_KEY_ALIAS=tixchat-release',
  "TIXCHAT_RELEASE_STORE_PASSWORD=$password",
  "TIXCHAT_RELEASE_KEY_PASSWORD=$password"
)

Write-Host 'Release keystore and local signing properties created.'
