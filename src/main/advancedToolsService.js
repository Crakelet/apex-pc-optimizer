const { exec } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

function cleanClixml(str) {
  if (!str) return '';
  if (str.includes('#< CLIXML')) {
    const errorMatches = str.match(/<S S="Error">([\s\S]*?)<\/S>/gi);
    if (errorMatches && errorMatches.length > 0) {
      const extracted = errorMatches
        .map(m => m.replace(/<\/?S[^>]*>/gi, '')
                   .replace(/_x000D__x000A_/g, '\n')
                   .replace(/_x001B_\[\d+m/g, '')
                   .trim())
        .filter(Boolean)
        .join('\n');
      if (extracted) return extracted;
    }
  }
  return str.replace(/#< CLIXML[\s\S]*?<\/Objs>/gi, '').replace(/<[^>]+>/g, '').trim();
}

async function runPsScript(script, input = {}) {
  const res = await require('./systemInfo').runPowerShell(require('./safeCleanup').CLEANUP_SCRIPT + '\n' + script, input && typeof input === 'object' ? input : {});
  if (!res.success) throw new Error(res.output || 'Windows no pudo completar la operación.');
  return res.output || '';
}

// =========================================================================
// 1. GESTOR DE APLICACIONES DE INICIO (STARTUP MANAGER - ESTILO OPTIMIZER)
// =========================================================================

/**
 * Lista las aplicaciones registradas para iniciar con Windows en HKCU, HKLM y carpeta Inicio
 */
async function getStartupPrograms() {
  const script = `
    $items = @()
    foreach ($scope in @('HKCU','HKLM')) {
      $run = if ($scope -eq 'HKCU') { 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' } else { 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run' }
      $key = Get-Item -LiteralPath $run -ErrorAction SilentlyContinue
      if ($key) {
        foreach ($name in $key.GetValueNames()) {
          $items += [pscustomobject]@{name=$name;command=[string]$key.GetValue($name);location=($scope+'\\Run');scope=$scope;enabled=$true}
        }
      }
      $disabled = 'HKCU:\\Software\\ApexOptimizer\\DisabledStartupV2\\' + $scope
      $saved = Get-Item -LiteralPath $disabled -ErrorAction SilentlyContinue
      if ($saved) {
        foreach ($name in $saved.GetValueNames()) {
          $record = $saved.GetValue($name) | ConvertFrom-Json
          $items += [pscustomobject]@{name=$name;command=$record.Command;location=($scope+'\\Run');scope=$scope;enabled=$false}
        }
      }
    }
    $startup = [Environment]::GetFolderPath('Startup')
    foreach ($disabled in @($false,$true)) {
      $folder = if ($disabled) { Join-Path $startup 'ApexDisabled' } else { $startup }
      foreach ($file in @(Get-ChildItem -LiteralPath $folder -Filter '*.lnk' -File -ErrorAction SilentlyContinue)) {
        if ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
        $items += [pscustomobject]@{name=$file.BaseName;command=$file.FullName;location='StartupFolder';scope='Carpeta Inicio';enabled=(-not $disabled)}
      }
    }
    ConvertTo-Json -InputObject @($items) -Depth 4 -Compress
  `;
  const out = await runPsScript(script);
  const parsed = JSON.parse(out || '[]');
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function toggleStartupProgram(name, location, enable) {
  if (typeof name !== 'string' || !name || name.length > 240 || /[\\/\0]/.test(name) ||
      !['HKCU\\Run','HKLM\\Run','StartupFolder'].includes(location) || typeof enable !== 'boolean') {
    return { success: false, message: 'El nombre o el origen del programa de inicio no es válido.' };
  }
  const script = `
    $name = [string]$data.name
    if ($data.location -eq 'StartupFolder') {
      $startup = [Environment]::GetFolderPath('Startup')
      $disabled = Join-Path $startup 'ApexDisabled'
      if (-not (Test-Path -LiteralPath $disabled)) { New-Item -ItemType Directory -Path $disabled | Out-Null }
      $live = Join-Path $startup ($name + '.lnk')
      $saved = Join-Path $disabled ($name + '.lnk')
      $from = if ($data.enable) { $saved } else { $live }
      $to = if ($data.enable) { $live } else { $saved }
      if (Test-Path -LiteralPath $to) { throw 'Ya existe una entrada con ese nombre en el destino.' }
      $file = Get-Item -LiteralPath $from -ErrorAction Stop
      if ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'No se modifican enlaces de sistema.' }
      Move-Item -LiteralPath $from -Destination $to -ErrorAction Stop
    } else {
      $scope = if ($data.location -eq 'HKLM\\Run') { 'HKLM' } else { 'HKCU' }
      $run = if ($scope -eq 'HKLM') { 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run' } else { 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' }
      $backup = 'HKCU:\\Software\\ApexOptimizer\\DisabledStartupV2\\' + $scope
      New-ApexRegistryKey -Path $backup | Out-Null
      if ($data.enable) {
        $saved = Get-Item -LiteralPath $backup
        if ($saved.GetValueNames() -notcontains $name) { throw 'No hay respaldo de esta entrada en su origen.' }
        $record = $saved.GetValue($name) | ConvertFrom-Json
        $live = Get-Item -LiteralPath $run -ErrorAction SilentlyContinue
        if ($live -and $live.GetValueNames() -contains $name) { throw 'Otra entrada ya ocupa ese nombre; no se sobrescribió.' }
        New-ApexRegistryKey -Path $run | Out-Null
        New-ItemProperty -LiteralPath $run -Name $name -PropertyType $record.Kind -Value $record.Command -ErrorAction Stop | Out-Null
        Remove-ItemProperty -LiteralPath $backup -Name $name -ErrorAction Stop
      } else {
        $live = Get-Item -LiteralPath $run -ErrorAction Stop
        if ($live.GetValueNames() -notcontains $name) { throw 'La entrada ya no existe en su origen.' }
        $existing = Get-Item -LiteralPath $backup
        if ($existing.GetValueNames() -contains $name) { throw 'Ya hay un respaldo activo de esta entrada.' }
        $record = @{Command=$live.GetValue($name,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames);Kind=$live.GetValueKind($name).ToString()} | ConvertTo-Json -Compress
        New-ItemProperty -LiteralPath $backup -Name $name -PropertyType String -Value $record -ErrorAction Stop | Out-Null
        Remove-ItemProperty -LiteralPath $run -Name $name -ErrorAction Stop
      }
    }
    'OK'
  `;
  try {
    await runPsScript(script, { name, location, enable });
    return { success: true, message: enable ? 'Entrada restaurada en su ubicación de inicio original.' : 'Entrada deshabilitada con respaldo de su origen.' };
  } catch (err) { return { success: false, message: err.message }; }
}

// =========================================================================
// 2. ESCUDO ANTI-RASTREO HOSTS (ANTI-TELEMETRY SHIELD - ESTILO OPTIMIZER)
// =========================================================================

// Do not block endpoints shared by Windows Update, Defender or certificate checks.
// https://learn.microsoft.com/en-us/defender-endpoint/configure-network-connections-microsoft-defender-antivirus
const PROTECTED_SERVICE_DOMAINS = Object.freeze([
  'windowsupdate.com', 'update.microsoft.com', 'delivery.mp.microsoft.com',
  'download.microsoft.com', 'definitionupdates.microsoft.com', 'go.microsoft.com',
  'wdcp.microsoft.com', 'wdcpalt.microsoft.com', 'wd.microsoft.com',
  'settings-win.data.microsoft.com', 'vortex-win.data.microsoft.com',
  'crl.microsoft.com', 'ctldl.windowsupdate.com', 'wpc.v0cdn.net'
]);
function validateHostsDomains(domains) {
  if (!Array.isArray(domains) || !domains.length) throw new Error('La lista HOSTS no es válida.');
  const normalized = domains.map(domain => {
    if (typeof domain !== 'string') throw new Error('Dominio HOSTS no válido.');
    const host = domain.toLowerCase().replace(/\.$/, '');
    if (host.length > 253 || !host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) throw new Error('Dominio HOSTS no válido.');
    if (PROTECTED_SERVICE_DOMAINS.some(service => host === service || host.endsWith('.' + service))) throw new Error('La lista HOSTS contiene un servicio protegido de actualizaciones o seguridad.');
    return host;
  });
  if (new Set(normalized).size !== normalized.length) throw new Error('La lista HOSTS contiene dominios duplicados.');
  return normalized;
}
const TELEMETRY_DOMAINS = Object.freeze(validateHostsDomains([
  'v10.events.data.microsoft.com',
  'v20.events.data.microsoft.com',
  'telemetry.microsoft.com',
  'watson.telemetry.microsoft.com',
  'watson.microsoft.com',
  'diagnostics.support.microsoft.com',
  'feedback.windows.com',
  'telemetry.urs.microsoft.com',
  'oca.telemetry.microsoft.com',
  'sqm.telemetry.microsoft.com',
  'df.telemetry.microsoft.com',
  'reports.wes.df.telemetry.microsoft.com',
  'vortex.data.microsoft.com',
  'telecommand.telemetry.microsoft.com',
  'cortana.ai.office.com',
  'bingads.microsoft.com'
]));

const HOSTS_OWNED_BLOCK_PATTERN = '(?ms)^# APEX_OPTIMIZER_TELEMETRY_BLOCK\\r?\\n.*?^# END_APEX_OPTIMIZER_TELEMETRY_BLOCK(?:\\r?\\n|$)';

/**
 * Comprueba si el escudo anti-rastreo HOSTS está activo
 */
async function getHostsShieldStatus() {
  const hostsPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts');
  try {
    if (fs.existsSync(hostsPath)) {
      const content = fs.readFileSync(hostsPath, 'utf8');
      const isActive = content.includes('# APEX_OPTIMIZER_TELEMETRY_BLOCK');
      return { active: isActive, count: TELEMETRY_DOMAINS.length };
    }
  } catch (err) {
    console.warn('[AdvancedTools] Error leyendo hosts:', err.message);
  }
  return { active: false, count: TELEMETRY_DOMAINS.length };
}

/**
 * Aplica el bloqueo anti-telemetría en el archivo hosts con copia de seguridad
 */
async function applyHostsShield() {
  const domains = validateHostsDomains(TELEMETRY_DOMAINS);
  const script = `
    $hosts = Join-Path $env:SystemRoot 'System32\\drivers\\etc\\hosts'
    $backup = Join-Path $env:SystemRoot 'System32\\drivers\\etc\\hosts.apex_backup'

    $current = if (Test-Path -LiteralPath $hosts) { [IO.File]::ReadAllText($hosts) } else { "" }
    $pattern = '${HOSTS_OWNED_BLOCK_PATTERN}'
    $starts = [regex]::Matches($current, '(?m)^# APEX_OPTIMIZER_TELEMETRY_BLOCK\\r?$').Count
    $ends = [regex]::Matches($current, '(?m)^# END_APEX_OPTIMIZER_TELEMETRY_BLOCK\\r?$').Count
    $owned = [regex]::Matches($current, $pattern)
    if ($starts -ne $ends -or $starts -gt 1 -or $owned.Count -ne $starts) { throw 'El bloque HOSTS de Apex está incompleto o repetido. No se modificó el archivo.' }
    $block = "# APEX_OPTIMIZER_TELEMETRY_BLOCK\`r\`n"
    foreach ($domain in @($data.domains)) { $block += "0.0.0.0 $domain\`r\`n" }
    $block += "# END_APEX_OPTIMIZER_TELEMETRY_BLOCK\`r\`n"
    if ($owned.Count) {
      # Refresh only the intact Apex block, including blocks from previous releases.
      $updated = $current.Substring(0, $owned[0].Index) + $block + $current.Substring($owned[0].Index + $owned[0].Length)
    } else {
      $separator = if ($current.Length -gt 0 -and -not $current.EndsWith("\`n")) { "\`r\`n" } else { "" }
      $updated = $current + $separator + $block
    }
    if (-not (Test-Path -LiteralPath $backup) -and (Test-Path -LiteralPath $hosts)) { Copy-Item -LiteralPath $hosts -Destination $backup -ErrorAction Stop }
    [IO.File]::WriteAllText($hosts, $updated, (New-Object System.Text.UTF8Encoding($false)))
    if ([IO.File]::ReadAllText($hosts) -cne $updated) { throw 'No se pudo verificar el bloque HOSTS guardado.' }
    ipconfig /flushdns | Out-Null
    "OK"
  `;

  try {
    await runPsScript(script, { domains });
    return {
      success: true,
      message: `Filtro HOSTS actualizado con ${domains.length} dominios. El bloque de Apex conserva el acceso a los servicios protegidos de actualizaciones y seguridad.`
    };
  } catch (err) {
    return { success: false, message: `Error activando escudo: ${err.message}` };
  }
}

/**
 * Revierte el bloqueo anti-telemetría restaurando el archivo hosts
 */
async function revertHostsShield() {
  const script = `
    $hosts = Join-Path $env:SystemRoot 'System32\\drivers\\etc\\hosts'
    $backup = Join-Path $env:SystemRoot 'System32\\drivers\\etc\\hosts.apex_backup'

    if (Test-Path -LiteralPath $hosts) {
      $content = [IO.File]::ReadAllText($hosts)
      $pattern = '${HOSTS_OWNED_BLOCK_PATTERN}'
      $starts = [regex]::Matches($content, '(?m)^# APEX_OPTIMIZER_TELEMETRY_BLOCK\\r?$').Count
      $ends = [regex]::Matches($content, '(?m)^# END_APEX_OPTIMIZER_TELEMETRY_BLOCK\\r?$').Count
      $owned = [regex]::Matches($content, $pattern)
      if ($starts -ne $ends -or $starts -gt 1 -or $owned.Count -ne $starts) { throw 'El bloque HOSTS de Apex está incompleto o repetido. No se modificó el archivo.' }
      if ($owned.Count) {
        $clean = $content.Substring(0, $owned[0].Index) + $content.Substring($owned[0].Index + $owned[0].Length)
        [IO.File]::WriteAllText($hosts, $clean, (New-Object System.Text.UTF8Encoding($false)))
        if ([IO.File]::ReadAllText($hosts) -cne $clean) { throw 'No se pudo verificar la restauración HOSTS.' }
      }
    }
    ipconfig /flushdns | Out-Null
    "OK"
  `;

  try {
    await runPsScript(script);
    return {
      success: true,
      message: 'Se retiró el bloque de Apex conservando las demás entradas actuales de HOSTS.'
    };
  } catch (err) {
    return { success: false, message: `Error revirtiendo escudo: ${err.message}` };
  }
}

// =========================================================================
// 3. LIMPIADOR EXTENDIDO DE APLICACIONES Y NAVEGADORES (OPTIMIZER CLEANER)
// =========================================================================

/**
 * Analiza el estado y tamaño real de caché pendiente en disco para cada limpiador
 */
async function getCleanersStatus() {
  const script = `
    $fso = New-Object -ComObject Scripting.FileSystemObject

    function Get-FolderSizeMB($path) {
      if (Test-Path $path) {
        try {
          $sz = (@(Get-ApexCacheFiles -Root $path) | Measure-Object -Property Length -Sum).Sum
          return [math]::Round($sz / 1MB, 1)
        } catch { return 0 }
      }
      return 0
    }

    # 1. Discord
    $discMB = 0
    $discTargets = @(
      (Join-Path $env:APPDATA 'discord\\Cache'),
      (Join-Path $env:APPDATA 'discord\\Code Cache'),
      (Join-Path $env:APPDATA 'discord\\GPUCache')
    )
    foreach ($t in $discTargets) { $discMB += (Get-FolderSizeMB $t) }

    # 2. Browsers
    $browserMB = 0
    $browserTargets = @(
      (Join-Path $env:LOCALAPPDATA 'Google\\Chrome\\User Data\\Default\\Cache'),
      (Join-Path $env:LOCALAPPDATA 'Google\\Chrome\\User Data\\Default\\Code Cache'),
      (Join-Path $env:LOCALAPPDATA 'Microsoft\\Edge\\User Data\\Default\\Cache'),
      (Join-Path $env:LOCALAPPDATA 'Microsoft\\Edge\\User Data\\Default\\Code Cache'),
      (Join-Path $env:LOCALAPPDATA 'BraveSoftware\\Brave-Browser\\User Data\\Default\\Cache')
    )
    foreach ($t in $browserTargets) { $browserMB += (Get-FolderSizeMB $t) }

    # 3. Crash Dumps
    $dumpsMB = 0
    $dumpTargets = @(
      (Join-Path $env:LOCALAPPDATA 'CrashDumps'),
      (Join-Path $env:SystemRoot 'Minidump'),
      (Join-Path $env:ProgramData 'Microsoft\\Windows\\WER\\ReportArchive'),
      (Join-Path $env:ProgramData 'Microsoft\\Windows\\WER\\ReportQueue')
    )
    foreach ($t in $dumpTargets) { $dumpsMB += (Get-FolderSizeMB $t) }
    $mem = Join-Path $env:SystemRoot 'MEMORY.DMP'
    if (Test-Path $mem) { try { $dumpsMB += [math]::Round((Get-Item $mem).Length / 1MB, 1) } catch {} }

    # 4. Delivery Optimization
    $delivMB = 0
    $delivTarget = Join-Path $env:SystemRoot 'SoftwareDistribution\\DeliveryOptimization'
    $delivMB = Get-FolderSizeMB $delivTarget

    # 5. NPM, Yarn & PNPM Cache (Dev & Web Tooling)
    $npmMB = 0
    $npmTargets = @(
      (Join-Path $env:LOCALAPPDATA 'npm-cache'),
      (Join-Path $env:APPDATA 'npm-cache'),
      (Join-Path $env:USERPROFILE '.npm'),
      (Join-Path $env:LOCALAPPDATA 'Yarn\\Cache'),
      (Join-Path $env:LOCALAPPDATA 'pnpm\\cache')
    )
    foreach ($t in $npmTargets) { $npmMB += (Get-FolderSizeMB $t) }

    # 6. VS Code & Code Editors Cache
    $vscodeMB = 0
    $vscodeTargets = @(
      (Join-Path $env:APPDATA 'Code\\Cache'),
      (Join-Path $env:APPDATA 'Code\\CachedData'),
      (Join-Path $env:APPDATA 'Code\\CachedExtensionVSIXs'),
      (Join-Path $env:APPDATA 'Code\\Service Worker\\CacheStorage')
    )
    foreach ($t in $vscodeTargets) { $vscodeMB += (Get-FolderSizeMB $t) }

    # 7. Python Pip & Cargo Cache
    $pipMB = 0
    $pipTargets = @(
      (Join-Path $env:LOCALAPPDATA 'pip\\cache'),
      (Join-Path $env:USERPROFILE '.cargo\\registry\\cache')
    )
    foreach ($t in $pipTargets) { $pipMB += (Get-FolderSizeMB $t) }

    # 8. Gradle & Android Studio Cache
    $gradleMB = 0
    $gradleTargets = @(
      (Join-Path $env:USERPROFILE '.gradle\\caches\\build-cache-1'),
      (Join-Path $env:USERPROFILE '.gradle\\caches\\transforms-1'),
      (Join-Path $env:USERPROFILE '.gradle\\caches\\transforms-2'),
      (Join-Path $env:USERPROFILE '.gradle\\caches\\transforms-3'),
      (Join-Path $env:USERPROFILE '.gradle\\caches\\transforms-4'),
      (Join-Path $env:USERPROFILE '.gradle\\caches\\jars-1'),
      (Join-Path $env:USERPROFILE '.gradle\\caches\\jars-2'),
      (Join-Path $env:USERPROFILE '.gradle\\caches\\jars-3')
    )
    foreach ($t in $gradleTargets) { $gradleMB += (Get-FolderSizeMB $t) }

    # 9. Spotify & Media Streaming Cache
    $spotifyMB = 0
    $spotifyTargets = @(
      (Join-Path $env:LOCALAPPDATA 'Spotify\\Storage'),
      (Join-Path $env:LOCALAPPDATA 'Spotify\\Data'),
      (Join-Path $env:APPDATA 'Telegram Desktop\\tdata\\user_data\\cache')
    )
    foreach ($t in $spotifyTargets) { $spotifyMB += (Get-FolderSizeMB $t) }

    # 10. Game Launchers Web Cache (Steam & Epic Games)
    $launchersMB = 0
    $launchersTargets = @(
      (Join-Path $env:LOCALAPPDATA 'Steam\\htmlcache'),
      (Join-Path $env:LOCALAPPDATA 'EpicGamesLauncher\\Saved\\webcache'),
      (Join-Path $env:LOCALAPPDATA 'EpicGamesLauncher\\Saved\\webcache_4147')
    )
    foreach ($t in $launchersTargets) { $launchersMB += (Get-FolderSizeMB $t) }

    $totalAppsMB = $discMB + $browserMB + $dumpsMB + $delivMB + $npmMB + $vscodeMB + $pipMB + $gradleMB + $spotifyMB + $launchersMB

    [PSCustomObject]@{
      discord = @{ sizeMB = [math]::Round($discMB, 1); requiresClean = ($discMB -gt 5) }
      browsers = @{ sizeMB = [math]::Round($browserMB, 1); requiresClean = ($browserMB -gt 15) }
      dumps = @{ sizeMB = [math]::Round($dumpsMB, 1); requiresClean = ($dumpsMB -gt 1) }
      delivery = @{ sizeMB = [math]::Round($delivMB, 1); requiresClean = ($delivMB -gt 5) }
      npm = @{ sizeMB = [math]::Round($npmMB, 1); requiresClean = ($npmMB -gt 10) }
      vscode = @{ sizeMB = [math]::Round($vscodeMB, 1); requiresClean = ($vscodeMB -gt 10) }
      pip = @{ sizeMB = [math]::Round($pipMB, 1); requiresClean = ($pipMB -gt 5) }
      gradle = @{ sizeMB = [math]::Round($gradleMB, 1); requiresClean = ($gradleMB -gt 15) }
      spotify = @{ sizeMB = [math]::Round($spotifyMB, 1); requiresClean = ($spotifyMB -gt 10) }
      launchers = @{ sizeMB = [math]::Round($launchersMB, 1); requiresClean = ($launchersMB -gt 10) }
      totalAppsMB = [math]::Round($totalAppsMB, 1)
      requiresClean = ($totalAppsMB -gt 15)
    } | ConvertTo-Json
  `;

  try {
    const out = await runPsScript(script);
    if (!out) return null;
    const parsed = JSON.parse(out);
    parsed.success = true;
    const ghostDevices = await getGhostDevices();
    parsed.ghost = {
      count: ghostDevices.length,
      sizeMB: 0,
      requiresClean: ghostDevices.length > 0
    };
    return parsed;
  } catch (err) {
    console.error('[AdvancedTools] Error al obtener estado de limpiadores:', err);
    return {
      success: false,
      error: err.message,
      discord: { sizeMB: 0, requiresClean: false },
      browsers: { sizeMB: 0, requiresClean: false },
      dumps: { sizeMB: 0, requiresClean: false },
      delivery: { sizeMB: 0, requiresClean: false },
      ghost: { count: 0, sizeMB: 0, requiresClean: false }
    };
  }
}

/**
 * Analiza el estado y tamaño real de los limpiadores de disco del sistema (%TEMP%, Windows Temp, Shaders, etc.)
 */
async function getDiskCleanupStatus() {
  const script = `
    $fso = New-Object -ComObject Scripting.FileSystemObject

    function Get-FolderSizeMB($path) {
      if (Test-Path $path) {
        try {
          $sz = (@(Get-ApexCacheFiles -Root $path) | Measure-Object -Property Length -Sum).Sum
          return [math]::Round($sz / 1MB, 1)
        } catch { return 0 }
      }
      return 0
    }

    # 1. User Temp
    $userTemp = Get-FolderSizeMB $env:TEMP

    # 2. Windows Temp
    $winTemp = Get-FolderSizeMB "$env:SystemRoot\\Temp"

    # 3. Software Distribution Download
    $swDist = Get-FolderSizeMB "$env:SystemRoot\\SoftwareDistribution\\Download"

    # 4. Shader Caches
    $d3dCache = (Get-FolderSizeMB "$env:LOCALAPPDATA\\D3DSCache") + 
                 (Get-FolderSizeMB "$env:LOCALAPPDATA\\NVIDIA\\DXCache") + 
                 (Get-FolderSizeMB "$env:LOCALAPPDATA\\NVIDIA\\GLCache") + 
                 (Get-FolderSizeMB "$env:LOCALAPPDATA\\AMD\\DxCache")

    # 5. Thumbnails
    $thumbMB = 0
    Get-ChildItem -Path "$env:LOCALAPPDATA\\Microsoft\\Windows\\Explorer" -Filter "thumbcache_*.db" -Force -ErrorAction SilentlyContinue | ForEach-Object { $thumbMB += $_.Length }
    $thumbMB = [math]::Round($thumbMB / 1MB, 1)

    $totalMB = $userTemp + $winTemp + $swDist + $d3dCache + $thumbMB

    [PSCustomObject]@{
      clean_temp_files = @{ sizeMB = [math]::Round($userTemp, 1); requiresClean = ($userTemp -gt 2) }
      clean_windows_temp = @{ sizeMB = [math]::Round($winTemp, 1); requiresClean = ($winTemp -gt 2) }
      clean_software_distribution = @{ sizeMB = [math]::Round($swDist, 1); requiresClean = ($swDist -gt 5) }
      clean_shader_cache = @{ sizeMB = [math]::Round($d3dCache, 1); requiresClean = ($d3dCache -gt 5) }
      clean_thumbnail_cache = @{ sizeMB = [math]::Round($thumbMB, 1); requiresClean = ($thumbMB -gt 2) }
      totalMB = [math]::Round($totalMB, 1)
      requiresClean = ($totalMB -gt 5)
    } | ConvertTo-Json
  `;

  try {
    const out = await runPsScript(script);
    if (!out) throw new Error('No output from disk scan');
    return { ...JSON.parse(out), success: true };
  } catch (err) {
    console.error('[AdvancedTools] Error al obtener estado de limpieza de disco:', err);
    return {
      success: false,
      error: err.message,
      clean_temp_files: { sizeMB: 0, requiresClean: false },
      clean_windows_temp: { sizeMB: 0, requiresClean: false },
      clean_software_distribution: { sizeMB: 0, requiresClean: false },
      clean_shader_cache: { sizeMB: 0, requiresClean: false },
      clean_thumbnail_cache: { sizeMB: 0, requiresClean: false },
      totalMB: 0,
      requiresClean: false
    };
  }
}

/**
 * Escanea dispositivos fantasma (desconectados) acumulados en el árbol PnP de Windows (RionTool)
 */
async function getGhostDevices() {
  return new Promise((resolve, reject) => {
    exec('pnputil /enum-devices /disconnected', { windowsHide: true, timeout: 20000, maxBuffer: 1024 * 1024 * 5 }, (err, stdout) => {
      if (err) return reject(new Error('Windows no pudo consultar los dispositivos desconectados.'));
      const text = stdout || '';
      const blocks = text.split(/\r?\n\r?\n/);
      const devices = [];
      const allowedBuses = /^(USB|USBSTOR|HID|BTHENUM|BTHLE|BTHLEDEVICE|BTH|MONITOR)/i;
      const blockedClasses = /^(System|SoftwareDevice|SoftwareComponent|Computer|Processor|Volume|VolumeSnapshot|Firmware|SecurityDevices|LegacyDriver|Extension|Battery)$/i;

      for (const b of blocks) {
        const idMatch = b.match(/(?:Id\.\s*de\s*instancia|Instance\s*ID)\s*:\s*(.+)/i);
        const nameMatch = b.match(/(?:Descripci[^\r\n:]+|Device\s*Description)\s*:\s*(.+)/i);
        const classMatch = b.match(/(?:Nombre\s*de\s*clase|Class\s*Name)\s*:\s*(.+)/i);

        if (idMatch) {
          const id = (idMatch[1] || '').trim();
          const name = nameMatch ? (nameMatch[1] || '').trim() : 'Dispositivo desconectado';
          const cls = classMatch ? (classMatch[1] || '').trim() : '';

          if (allowedBuses.test(id) && !blockedClasses.test(cls)) {
            devices.push({ id, name, class: cls });
          }
        }
      }
      resolve(devices);
    });
  });
}

/**
 * Elimina de forma segura los dispositivos fantasma desconectados utilizando pnputil (RionTool)
 */
async function purgeGhostDevices() {
  const devices = await getGhostDevices();
  if (devices.length === 0) {
    return {
      success: true,
      removed: 0,
      cleanedAt: Date.now(),
      message: 'No se encontraron dispositivos fantasma desconectados (El sistema ya está limpio).'
    };
  }

  const ids = devices.map(d => d.id);
  const script = `
    $ids = @(
      ${ids.map(id => `'${id.replace(/'/g, "''")}'`).join(',\n      ')}
    )
    $ok = 0
    foreach ($id in $ids) {
      $out = & pnputil.exe /remove-device $id 2>&1
      if ($LASTEXITCODE -eq 0) { $ok++ }
    }
    $ok
  `;

  try {
    const out = await runPsScript(script, true);
    const count = Number.parseInt(out, 10);
    if (!Number.isFinite(count)) throw new Error('Windows no devolvió un conteo válido.');
    return {
      success: true,
      removed: count,
      cleanedAt: Date.now(),
      message: `¡Árbol PnP optimizado! Se purgaron con éxito ${count} dispositivo(s) fantasma desconectados.`
    };
  } catch (err) {
    return {
      success: false,
      removed: 0,
      message: err.message
    };
  }
}

/**
 * Limpia la caché de Discord (Cache, Code Cache, GPUCache)
 */
async function cleanDiscordCache() {
  const script = `
    $targets = @(
      (Join-Path $env:APPDATA 'discord\\Cache'),
      (Join-Path $env:APPDATA 'discord\\Code Cache'),
      (Join-Path $env:APPDATA 'discord\\GPUCache')
    )
    $freedBytes = 0
    $fso = New-Object -ComObject Scripting.FileSystemObject
    foreach ($t in $targets) {
      if (Test-Path $t) {
        $freedBytes += Remove-ApexCache -Root $t
      }
    }
    [math]::Round($freedBytes / 1MB, 1)
  `;

  try {
    const out = await runPsScript(script);
    const mb = !isNaN(parseFloat(out)) ? parseFloat(out) : 0;
    const msg = mb > 0 
      ? `¡Caché de Discord limpiada! Se liberaron ~${mb} MB de espacio.`
      : `Caché de Discord verificada: ya se encuentra completamente limpia (0 MB pendientes).`;
    return {
      success: true,
      freedMB: mb,
      cleanedAt: Date.now(),
      message: msg
    };
  } catch (err) {
    return { success: false, freedMB: 0, message: err.message || 'No se pudo completar la limpieza.' };
  }
}

/**
 * Limpia la caché de Chrome, Edge y Brave
 */
async function cleanBrowserCaches() {
  const script = `
    $targets = @(
      (Join-Path $env:LOCALAPPDATA 'Google\\Chrome\\User Data\\Default\\Cache'),
      (Join-Path $env:LOCALAPPDATA 'Google\\Chrome\\User Data\\Default\\Code Cache'),
      (Join-Path $env:LOCALAPPDATA 'Microsoft\\Edge\\User Data\\Default\\Cache'),
      (Join-Path $env:LOCALAPPDATA 'Microsoft\\Edge\\User Data\\Default\\Code Cache'),
      (Join-Path $env:LOCALAPPDATA 'BraveSoftware\\Brave-Browser\\User Data\\Default\\Cache')
    )
    $freedBytes = 0
    $fso = New-Object -ComObject Scripting.FileSystemObject
    foreach ($t in $targets) {
      if (Test-Path $t) {
        $freedBytes += Remove-ApexCache -Root $t
      }
    }
    [math]::Round($freedBytes / 1MB, 1)
  `;

  try {
    const out = await runPsScript(script);
    const mb = !isNaN(parseFloat(out)) ? parseFloat(out) : 0;
    const msg = mb > 0
      ? `¡Caché de navegadores web limpiada! Se liberaron ~${mb} MB de disco.`
      : `Navegadores verificados: ya se encuentran completamente limpios (0 MB pendientes).`;
    return {
      success: true,
      freedMB: mb,
      cleanedAt: Date.now(),
      message: msg
    };
  } catch (err) {
    return { success: false, freedMB: 0, message: err.message || 'No se pudo completar la limpieza.' };
  }
}

/**
 * Limpia volcados de errores y registros de Windows Error Reporting (*.dmp, Minidump, WER)
 */
async function cleanCrashDumps() {
  const script = `
    $targets = @(
      (Join-Path $env:LOCALAPPDATA 'CrashDumps'),
      (Join-Path $env:SystemRoot 'Minidump'),
      (Join-Path $env:ProgramData 'Microsoft\\Windows\\WER\\ReportArchive'),
      (Join-Path $env:ProgramData 'Microsoft\\Windows\\WER\\ReportQueue')
    )
    $freedBytes = 0
    $fso = New-Object -ComObject Scripting.FileSystemObject
    foreach ($t in $targets) {
      if (Test-Path $t) {
        $freedBytes += Remove-ApexCache -Root $t
      }
    }
    # Eliminar MEMORY.DMP en raíz de Windows si existe
    $memDmp = Join-Path $env:SystemRoot 'MEMORY.DMP'
    if (Test-Path $memDmp) {
      try {
        $freedBytes += Remove-ApexCache -Root $env:SystemRoot -Filter 'MEMORY.DMP'
      } catch {}
    }
    [math]::Round($freedBytes / 1MB, 1)
  `;

  try {
    const out = await runPsScript(script);
    const mb = !isNaN(parseFloat(out)) ? parseFloat(out) : 0;
    const msg = mb > 0
      ? `¡Volcados de error (.dmp) eliminados! Se recuperaron ~${mb} MB de disco.`
      : `Volcados de error verificados: no hay registros ni volcados acumulados (0 MB).`;
    return {
      success: true,
      freedMB: mb,
      cleanedAt: Date.now(),
      message: msg
    };
  } catch (err) {
    return { success: false, freedMB: 0, message: err.message || 'No se pudo completar la limpieza.' };
  }
}

/**
 * Limpia la caché acumulada de Optimización de Entrega de Windows Update (Delivery Optimization)
 */
async function cleanDeliveryOptimizationCache() {
  const script = `
    $target = Join-Path $env:SystemRoot 'SoftwareDistribution\\DeliveryOptimization'
    $freedBytes = 0
    $fso = New-Object -ComObject Scripting.FileSystemObject
    if (Test-Path $target) {
      $freedBytes += Remove-ApexCache -Root $target
    }
    [math]::Round($freedBytes / 1MB, 1)
  `;

  try {
    const out = await runPsScript(script);
    const mb = !isNaN(parseFloat(out)) ? parseFloat(out) : 0;
    const msg = mb > 0
      ? `¡Caché de Delivery Optimization purgada! Se recuperaron ~${mb} MB.`
      : `Delivery Optimization verificada: no tiene residuos de actualizaciones (0 MB).`;
    return {
      success: true,
      freedMB: mb,
      cleanedAt: Date.now(),
      message: msg
    };
  } catch (err) {
    return { success: false, freedMB: 0, message: err.message || 'No se pudo completar la limpieza.' };
  }
}

/**
 * Limpia la caché de paquetes de desarrollo NPM, Yarn y PNPM (_cacache, tarballs)
 */
async function cleanNpmCache() {
  const script = `
    $targets = @(
      (Join-Path $env:LOCALAPPDATA 'npm-cache'),
      (Join-Path $env:APPDATA 'npm-cache'),
      (Join-Path $env:USERPROFILE '.npm'),
      (Join-Path $env:LOCALAPPDATA 'Yarn\\Cache'),
      (Join-Path $env:LOCALAPPDATA 'pnpm\\cache')
    )
    $freedBytes = 0
    $fso = New-Object -ComObject Scripting.FileSystemObject
    foreach ($t in $targets) {
      if (Test-Path $t) {
        $freedBytes += Remove-ApexCache -Root $t
      }
    }
    [math]::Round($freedBytes / 1MB, 1)
  `;

  try {
    const out = await runPsScript(script);
    const mb = !isNaN(parseFloat(out)) ? parseFloat(out) : 0;
    const msg = mb > 0 
      ? `¡Caché de paquetes NPM, Yarn y PNPM purgada! Se liberaron ~${mb} MB de disco.`
      : `Caché de NPM verificada: ya se encuentra completamente limpia (0 MB).`;
    return { success: true, freedMB: mb, cleanedAt: Date.now(), message: msg };
  } catch (err) {
    return { success: false, freedMB: 0, message: err.message || 'No se pudo completar la limpieza.' };
  }
}

/**
 * Limpia la caché de interfaz y datos de VS Code y editores basados en Electron
 */
async function cleanVscodeCache() {
  const script = `
    $targets = @(
      (Join-Path $env:APPDATA 'Code\\Cache'),
      (Join-Path $env:APPDATA 'Code\\CachedData'),
      (Join-Path $env:APPDATA 'Code\\CachedExtensionVSIXs'),
      (Join-Path $env:APPDATA 'Code\\Service Worker\\CacheStorage')
    )
    $freedBytes = 0
    $fso = New-Object -ComObject Scripting.FileSystemObject
    foreach ($t in $targets) {
      if (Test-Path $t) {
        $freedBytes += Remove-ApexCache -Root $t
      }
    }
    [math]::Round($freedBytes / 1MB, 1)
  `;

  try {
    const out = await runPsScript(script);
    const mb = !isNaN(parseFloat(out)) ? parseFloat(out) : 0;
    const msg = mb > 0 
      ? `¡Caché de VS Code purgada! Se recuperaron ~${mb} MB de espacio.`
      : `Caché de VS Code verificada: ya se encuentra completamente limpia (0 MB).`;
    return { success: true, freedMB: mb, cleanedAt: Date.now(), message: msg };
  } catch (err) {
    return { success: false, freedMB: 0, message: err.message || 'No se pudo completar la limpieza.' };
  }
}

/**
 * Limpia la caché de paquetes de Python Pip y Rust Cargo
 */
async function cleanPipCache() {
  const script = `
    $targets = @(
      (Join-Path $env:LOCALAPPDATA 'pip\\cache'),
      (Join-Path $env:USERPROFILE '.cargo\\registry\\cache')
    )
    $freedBytes = 0
    $fso = New-Object -ComObject Scripting.FileSystemObject
    foreach ($t in $targets) {
      if (Test-Path $t) {
        $freedBytes += Remove-ApexCache -Root $t
      }
    }
    [math]::Round($freedBytes / 1MB, 1)
  `;

  try {
    const out = await runPsScript(script);
    const mb = !isNaN(parseFloat(out)) ? parseFloat(out) : 0;
    const msg = mb > 0 
      ? `¡Caché de ruedas Pip y fuentes Cargo eliminada! Se liberaron ~${mb} MB.`
      : `Caché de Python/Rust verificada: ya se encuentra limpia (0 MB).`;
    return { success: true, freedMB: mb, cleanedAt: Date.now(), message: msg };
  } catch (err) {
    return { success: false, freedMB: 0, message: err.message || 'No se pudo completar la limpieza.' };
  }
}

/**
 * Limpia cachés de compilación intermedias de Gradle y Android Studio
 */
async function cleanGradleCache() {
  const script = `
    $targets = @(
      (Join-Path $env:USERPROFILE '.gradle\\caches\\build-cache-1'),
      (Join-Path $env:USERPROFILE '.gradle\\caches\\transforms-1'),
      (Join-Path $env:USERPROFILE '.gradle\\caches\\transforms-2'),
      (Join-Path $env:USERPROFILE '.gradle\\caches\\transforms-3'),
      (Join-Path $env:USERPROFILE '.gradle\\caches\\transforms-4'),
      (Join-Path $env:USERPROFILE '.gradle\\caches\\jars-1'),
      (Join-Path $env:USERPROFILE '.gradle\\caches\\jars-2'),
      (Join-Path $env:USERPROFILE '.gradle\\caches\\jars-3')
    )
    $freedBytes = 0
    $fso = New-Object -ComObject Scripting.FileSystemObject
    foreach ($t in $targets) {
      if (Test-Path $t) {
        $freedBytes += Remove-ApexCache -Root $t
      }
    }
    [math]::Round($freedBytes / 1MB, 1)
  `;

  try {
    const out = await runPsScript(script);
    const mb = !isNaN(parseFloat(out)) ? parseFloat(out) : 0;
    const msg = mb > 0 
      ? `¡Caché de transformadas y compilación Gradle purgada! Se recuperaron ~${mb} MB.`
      : `Caché de Gradle verificada: ya se encuentra limpia (0 MB).`;
    return { success: true, freedMB: mb, cleanedAt: Date.now(), message: msg };
  } catch (err) {
    return { success: false, freedMB: 0, message: err.message || 'No se pudo completar la limpieza.' };
  }
}

/**
 * Limpia la caché multimedia de Spotify y aplicaciones de mensajería (Telegram)
 */
async function cleanMediaCache() {
  const script = `
    $targets = @(
      (Join-Path $env:LOCALAPPDATA 'Spotify\\Storage'),
      (Join-Path $env:LOCALAPPDATA 'Spotify\\Data'),
      (Join-Path $env:APPDATA 'Telegram Desktop\\tdata\\user_data\\cache')
    )
    $freedBytes = 0
    $fso = New-Object -ComObject Scripting.FileSystemObject
    foreach ($t in $targets) {
      if (Test-Path $t) {
        $freedBytes += Remove-ApexCache -Root $t
      }
    }
    [math]::Round($freedBytes / 1MB, 1)
  `;

  try {
    const out = await runPsScript(script);
    const mb = !isNaN(parseFloat(out)) ? parseFloat(out) : 0;
    const msg = mb > 0 
      ? `¡Caché multimedia de Spotify y mensajería purgada! Se recuperaron ~${mb} MB.`
      : `Caché de medios verificada: ya se encuentra completamente limpia (0 MB).`;
    return { success: true, freedMB: mb, cleanedAt: Date.now(), message: msg };
  } catch (err) {
    return { success: false, freedMB: 0, message: err.message || 'No se pudo completar la limpieza.' };
  }
}

/**
 * Limpia la caché web de clientes de juegos (Steam htmlcache y Epic Games webcache)
 */
async function cleanLaunchersCache() {
  const script = `
    $targets = @(
      (Join-Path $env:LOCALAPPDATA 'Steam\\htmlcache'),
      (Join-Path $env:LOCALAPPDATA 'EpicGamesLauncher\\Saved\\webcache'),
      (Join-Path $env:LOCALAPPDATA 'EpicGamesLauncher\\Saved\\webcache_4147')
    )
    $freedBytes = 0
    $fso = New-Object -ComObject Scripting.FileSystemObject
    foreach ($t in $targets) {
      if (Test-Path $t) {
        $freedBytes += Remove-ApexCache -Root $t
      }
    }
    [math]::Round($freedBytes / 1MB, 1)
  `;

  try {
    const out = await runPsScript(script);
    const mb = !isNaN(parseFloat(out)) ? parseFloat(out) : 0;
    const msg = mb > 0 
      ? `¡Caché web de Steam y Epic Games eliminada! Se liberaron ~${mb} MB.`
      : `Caché de launchers verificada: ya se encuentra limpia (0 MB).`;
    return { success: true, freedMB: mb, cleanedAt: Date.now(), message: msg };
  } catch (err) {
    return { success: false, freedMB: 0, message: err.message || 'No se pudo completar la limpieza.' };
  }
}

/**
 * Limpieza universal de todas las cachés de aplicaciones seguras a la vez
 */
async function cleanAllAppCaches() {
  const script = `
    $targets = @(
      (Join-Path $env:APPDATA 'discord\\Cache'),
      (Join-Path $env:APPDATA 'discord\\Code Cache'),
      (Join-Path $env:APPDATA 'discord\\GPUCache'),
      (Join-Path $env:LOCALAPPDATA 'Google\\Chrome\\User Data\\Default\\Cache'),
      (Join-Path $env:LOCALAPPDATA 'Google\\Chrome\\User Data\\Default\\Code Cache'),
      (Join-Path $env:LOCALAPPDATA 'Microsoft\\Edge\\User Data\\Default\\Cache'),
      (Join-Path $env:LOCALAPPDATA 'Microsoft\\Edge\\User Data\\Default\\Code Cache'),
      (Join-Path $env:LOCALAPPDATA 'BraveSoftware\\Brave-Browser\\User Data\\Default\\Cache'),
      (Join-Path $env:LOCALAPPDATA 'CrashDumps'),
      (Join-Path $env:SystemRoot 'Minidump'),
      (Join-Path $env:SystemRoot 'SoftwareDistribution\\DeliveryOptimization'),
      (Join-Path $env:LOCALAPPDATA 'npm-cache'),
      (Join-Path $env:APPDATA 'npm-cache'),
      (Join-Path $env:USERPROFILE '.npm'),
      (Join-Path $env:LOCALAPPDATA 'Yarn\\Cache'),
      (Join-Path $env:LOCALAPPDATA 'pnpm\\cache'),
      (Join-Path $env:APPDATA 'Code\\Cache'),
      (Join-Path $env:APPDATA 'Code\\CachedData'),
      (Join-Path $env:APPDATA 'Code\\CachedExtensionVSIXs'),
      (Join-Path $env:APPDATA 'Code\\Service Worker\\CacheStorage'),
      (Join-Path $env:LOCALAPPDATA 'pip\\cache'),
      (Join-Path $env:USERPROFILE '.cargo\\registry\\cache'),
      (Join-Path $env:USERPROFILE '.gradle\\caches\\build-cache-1'),
      (Join-Path $env:USERPROFILE '.gradle\\caches\\transforms-1'),
      (Join-Path $env:USERPROFILE '.gradle\\caches\\transforms-2'),
      (Join-Path $env:USERPROFILE '.gradle\\caches\\transforms-3'),
      (Join-Path $env:USERPROFILE '.gradle\\caches\\transforms-4'),
      (Join-Path $env:LOCALAPPDATA 'Spotify\\Storage'),
      (Join-Path $env:LOCALAPPDATA 'Spotify\\Data'),
      (Join-Path $env:APPDATA 'Telegram Desktop\\tdata\\user_data\\cache'),
      (Join-Path $env:LOCALAPPDATA 'Steam\\htmlcache'),
      (Join-Path $env:LOCALAPPDATA 'EpicGamesLauncher\\Saved\\webcache')
    )
    $freedBytes = 0
    $fso = New-Object -ComObject Scripting.FileSystemObject
    foreach ($t in $targets) {
      if (Test-Path $t) {
        $freedBytes += Remove-ApexCache -Root $t
      }
    }
    [math]::Round($freedBytes / 1MB, 1)
  `;

  try {
    const out = await runPsScript(script);
    const mb = !isNaN(parseFloat(out)) ? parseFloat(out) : 0;
    return {
      success: true,
      freedMB: mb,
      cleanedAt: Date.now(),
      message: `¡Limpieza profunda de aplicaciones completada! Se liberaron ~${mb} MB de cachés residuales.`
    };
  } catch (err) {
    return { success: false, freedMB: 0, message: err.message || 'No se pudo completar la limpieza.' };
  }
}

module.exports = {
  hostsPolicy: Object.freeze({ domains: TELEMETRY_DOMAINS, validateDomains: validateHostsDomains }),
  getStartupPrograms,
  toggleStartupProgram,
  getHostsShieldStatus,
  applyHostsShield,
  revertHostsShield,
  getCleanersStatus,
  getDiskCleanupStatus,
  getGhostDevices,
  purgeGhostDevices,
  cleanDiscordCache,
  cleanBrowserCaches,
  cleanCrashDumps,
  cleanDeliveryOptimizationCache,
  cleanNpmCache,
  cleanVscodeCache,
  cleanPipCache,
  cleanGradleCache,
  cleanMediaCache,
  cleanLaunchersCache,
  cleanAllAppCaches
};
