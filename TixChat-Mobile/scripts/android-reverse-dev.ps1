$ErrorActionPreference = 'Stop'

. "$PSScriptRoot\android-env.ps1"

adb reverse tcp:8081 tcp:8081
adb reverse tcp:5000 tcp:5000

adb reverse --list
