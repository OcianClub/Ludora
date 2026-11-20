param(
  [string]$ApiUrl = 'http://10.154.217.152:3000',
  [string]$AndroidSdk = 'E:\Android\Sdk',
  [string]$BuildDirectory = 'E:\LudoraAPK',
  [switch]$SkipInstall
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$buildRoot = [IO.Path]::GetFullPath($BuildDirectory).TrimEnd('\')
if ($ApiUrl -notmatch '^http://(?:\d{1,3}\.){3}\d{1,3}:\d+/?$') {
  throw 'Informe a URL IPv4 e porta da API.'
}
if (!(Test-Path -LiteralPath $AndroidSdk -PathType Container)) {
  throw "Android SDK não encontrado: $AndroidSdk"
}
if ($buildRoot -match '\s' -or $buildRoot -eq $projectRoot -or $buildRoot.StartsWith($projectRoot + '\', [StringComparison]::OrdinalIgnoreCase) -or $projectRoot.StartsWith($buildRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Escolha uma pasta curta, sem espaços e fora da pasta original do projeto.'
}
# Never overwrite an existing directory unless it belongs to this build script.
$marker = Join-Path $buildRoot '.ludora-apk-workspace'
if (Test-Path -LiteralPath $buildRoot) {
  if (!(Test-Path -LiteralPath $marker) -or (Get-Content -LiteralPath $marker -Raw).Trim() -ne $projectRoot) {
    throw "A pasta $buildRoot já existe e não pertence a este build. Escolha outra com -BuildDirectory."
  }
} else {
  New-Item -ItemType Directory -Path $buildRoot | Out-Null
  Set-Content -LiteralPath $marker -Value $projectRoot
}
Write-Host "Copiando os arquivos atuais para $buildRoot..."
& robocopy.exe $projectRoot $buildRoot /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP /XD .git node_modules android ios .venv venv .gradle .cxx build dist test-results .expo .eas-inspect /XF *.log *.tsbuildinfo
if ($LASTEXITCODE -ge 8) { throw 'Não foi possível copiar os arquivos de compilação.' }
Push-Location $buildRoot
try {
  Add-Content -LiteralPath (Join-Path $buildRoot '.npmrc') -Value "`nnode-linker=hoisted"
  $env:CI = '1'
  # Hoisted dependencies avoid the long native paths created by the pnpm virtual store.
  if (!$SkipInstall) {
    & pnpm.cmd install --frozen-lockfile --prod=false --config.node-linker=hoisted
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível instalar as dependências da cópia de compilação.' }
  }
  $env:ANDROID_HOME = $AndroidSdk
  $env:ANDROID_SDK_ROOT = $AndroidSdk
  $env:NODE_ENV = 'production'
  $env:EXPO_NO_METRO_WORKSPACE_ROOT = '1'
  $env:LUDORA_APK_LOCAL = '1'
  $env:EXPO_PUBLIC_API_URL = $ApiUrl.TrimEnd('/')
  $metroConfig = Join-Path $buildRoot 'apps/mobile/metro.config.js'
  Add-Content -LiteralPath $metroConfig -Value @'

// Local Windows build: resolve shared workspace packages with the hoisted layout.
const buildPath = require('node:path');
module.exports.watchFolders = [buildPath.resolve(__dirname, '../../packages'), buildPath.resolve(__dirname, '../../node_modules')];
module.exports.resolver.nodeModulesPaths = [buildPath.resolve(__dirname, 'node_modules'), buildPath.resolve(__dirname, '../../node_modules')];
'@
  Set-Location -LiteralPath (Join-Path $buildRoot 'apps/mobile')
  & node (Join-Path $buildRoot 'node_modules/expo/bin/cli') prebuild --platform android --no-install
  if ($LASTEXITCODE -ne 0) { throw 'Não foi possível preparar o Android.' }
  Add-Content -LiteralPath (Join-Path $buildRoot 'apps/mobile/android/gradle.properties') -Value "`nexpo.useLegacyPackaging=true"
  $tools = Join-Path $buildRoot 'tools'
  $ninja = Join-Path $tools 'ninja.exe'
  if (!(Test-Path -LiteralPath $ninja)) {
    New-Item -ItemType Directory -Path $tools -Force | Out-Null
    $archive = Join-Path $tools 'ninja-win.zip'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/ninja-build/ninja/releases/download/v1.12.1/ninja-win.zip' -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath $tools -Force
  }
  $ninjaCmake = $ninja.Replace('\', '/')
  Add-Content -LiteralPath (Join-Path $buildRoot 'apps/mobile/android/app/build.gradle') -Value @"
android {
    defaultConfig {
        externalNativeBuild {
            cmake {
                arguments "-DCMAKE_MAKE_PROGRAM=$ninjaCmake", "-DCMAKE_OBJECT_PATH_MAX=180"
            }
        }
    }
}
"@
  Set-Location -LiteralPath (Join-Path $buildRoot 'apps/mobile/android')
  Write-Host "Gerando APK ARM64 para $ApiUrl..."
  & .\gradlew.bat assembleRelease '-PreactNativeArchitectures=arm64-v8a' --console=plain
  if ($LASTEXITCODE -ne 0) { throw 'A compilação falhou. Confira as últimas mensagens acima.' }
  $apk = Join-Path $buildRoot 'apps/mobile/android/app/build/outputs/apk/release/app-release.apk'
  if (!(Test-Path -LiteralPath $apk)) { throw 'O APK não foi encontrado.' }
  Write-Host "APK pronto: $apk"
} finally { Pop-Location }
