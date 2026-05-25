$ErrorActionPreference = 'Stop'

$javaCandidates = @(
  $env:JAVA_HOME,
  'C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot',
  'C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot'
) | Where-Object { $_ -and (Test-Path (Join-Path $_ 'bin\java.exe')) }

$javaHome = $javaCandidates | Select-Object -First 1
$androidHome = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$cmdlineToolsCandidates = @(
  (Join-Path $androidHome 'cmdline-tools\latest'),
  (Join-Path $androidHome 'cmdline-tools\latest-2')
) | Where-Object { Test-Path (Join-Path $_ 'bin\sdkmanager.bat') }
$cmdlineToolsHome = $cmdlineToolsCandidates | Select-Object -First 1

if (!$javaHome) {
  throw 'JDK 17 not found. Install Temurin JDK 17 or set JAVA_HOME to a JDK 17 directory.'
}

if (!(Test-Path $androidHome)) {
  throw "Android SDK not found at $androidHome"
}

if (!$cmdlineToolsHome) {
  throw "Android SDK cmdline-tools not found under $androidHome\cmdline-tools"
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $androidHome
$env:ANDROID_SDK_ROOT = $androidHome
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$cmdlineToolsHome\bin;$env:Path"

Write-Host "JAVA_HOME=$env:JAVA_HOME"
Write-Host "ANDROID_HOME=$env:ANDROID_HOME"
Write-Host "ANDROID_CMDLINE_TOOLS=$cmdlineToolsHome"
