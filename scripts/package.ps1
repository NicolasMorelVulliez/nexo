# Arma la carpeta de entrega de Nexo a partir de los builds:
#   npm run build            → dist\ (web)
#   npx tauri build          → src-tauri\target\release\ (exe + instaladores)
# Uso: powershell -ExecutionPolicy Bypass -File scripts\package.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$version = (Get-Content "$root\src-tauri\tauri.conf.json" -Raw | ConvertFrom-Json).version
$out = Join-Path (Split-Path -Parent $root) "entregas\Nexo-$version"
$rel = "$root\src-tauri\target\release"

if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Force $out | Out-Null

# 1) Instaladores
Copy-Item "$rel\bundle\nsis\*.exe" $out
Copy-Item "$rel\bundle\msi\*.msi" $out

# 2) Portable: exe + marcador "portable" (los datos quedan en NexoData junto al exe)
$port = Join-Path $out "Nexo-$version-portable"
New-Item -ItemType Directory -Force $port | Out-Null
Copy-Item "$rel\nexo.exe" "$port\Nexo.exe"
Set-Content -Path "$port\portable" -Value "Modo portable: Nexo guarda sus datos en la carpeta NexoData, al lado del exe." -Encoding utf8
@"
Nexo $version — versión portable

1. Descomprimí la carpeta donde quieras (por ejemplo un pendrive).
2. Abrí Nexo.exe. No instala nada ni toca el registro: los datos quedan en NexoData.
3. La batería aparece en la bandeja (al lado del reloj). Windows 11 la puede esconder
   en la flechita ^: arrastrala a la barra para dejarla siempre visible.

Requiere Windows 10/11 con WebView2 (ya viene en Windows 11).
"@ | Set-Content -Path "$port\LEEME.txt" -Encoding utf8
Compress-Archive -Path "$port\*" -DestinationPath "$out\Nexo-$version-portable.zip" -Force
Remove-Item $port -Recurse -Force

# 3) Web: sitio estático (se abre en Chrome o Edge; WebHID requiere https o localhost)
Compress-Archive -Path "$root\dist\*" -DestinationPath "$out\Nexo-$version-web.zip" -Force

Get-ChildItem $out | Select-Object Name, @{ n = "MB"; e = { [math]::Round($_.Length / 1MB, 2) } } | Format-Table -AutoSize
"Listo: $out"
