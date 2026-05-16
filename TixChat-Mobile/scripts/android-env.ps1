$ErrorActionPreference = 'Stop'

$javaHome = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot'
$androidHome = Join-Path $env:LOCALAPPDATA 'Android\Sdk'

if (!(Test-Path (Join-Path $javaHome 'bin\java.exe'))) {
  throw "JDK 17 not found at $javaHome"
}

if (!(Test-Path $androidHome)) {
  throw "Android SDK not found at $androidHome"
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $androidHome
$env:ANDROID_SDK_ROOT = $androidHome
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"

Write-Host "JAVA_HOME=$env:JAVA_HOME"
Write-Host "ANDROID_HOME=$env:ANDROID_HOME"
