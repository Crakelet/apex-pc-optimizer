const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Ejecuta un script de PowerShell canalizado por stdin para evitar limitaciones de longitud
 */
async function runPsStdin(script) {
  const result = await require('./systemInfo').runPowerShell(script);
  return { success: result.success, output: result.success ? result.output : '', error: result.success ? '' : result.output };
}

/**
 * Resuelve un nombre comercial amigable para juegos reconocidos
 */
function resolveGameDisplayName(name, exePath) {
  const lowerPath = (exePath || '').toLowerCase();
  const lowerName = (name || '').toLowerCase();

  if (lowerPath.includes('the finals') || lowerName === 'discovery') return 'The Finals';
  if (lowerPath.includes('apex legends') || lowerName.includes('r5apex')) return 'Apex Legends';
  if (lowerPath.includes('counter-strike') || lowerName === 'cs2' || lowerName === 'csgo') return 'Counter-Strike 2';
  if (lowerPath.includes('valorant') || lowerName.includes('valorant')) return 'VALORANT';
  if (lowerPath.includes('fortnite') || lowerName.includes('fortniteclient')) return 'Fortnite';
  if (lowerPath.includes('gtav') || lowerPath.includes('gta v') || lowerName === 'gta5') return 'Grand Theft Auto V';
  if (lowerPath.includes('black ops iii') || lowerName === 'blackops3') return 'Call of Duty: Black Ops III';
  if (lowerPath.includes('black ops ii') || lowerName === 't6zm' || lowerName === 't6mp') return 'Call of Duty: Black Ops II';
  if (lowerPath.includes('genshin') || lowerName.includes('genshinimpact')) return 'Genshin Impact';
  if (lowerPath.includes('aim lab') || lowerName.includes('aimlab')) return 'Aim Lab';
  if (lowerName === 'osu!' || lowerName === 'osu') return 'osu!';
  if (lowerPath.includes('muse dash') || lowerName === 'musedash') return 'Muse Dash';
  if (lowerPath.includes('league of legends') || lowerName.includes('league of legends')) return 'League of Legends';
  if (lowerPath.includes('overwatch') || lowerName.includes('overwatch')) return 'Overwatch 2';
  if (lowerPath.includes('warzone') || lowerName.includes('cod')) return 'Call of Duty: Warzone';
  if (lowerPath.includes('rainbow six') || lowerName.includes('rainbowsix')) return 'Rainbow Six Siege';
  if (lowerPath.includes('cyberpunk') || lowerName.includes('cyberpunk2077')) return 'Cyberpunk 2077';

  // Si está en steamapps/common/<NombreJuego>/...
  const matchSteam = String(exePath || '').match(/steamapps[\\\/]common[\\\/]([^\\\/]+)/i);
  if (matchSteam && matchSteam[1]) {
    return matchSteam[1];
  }

  return name;
}

/**
 * Obtiene el diagnóstico completo de hardware gamer:
 * - RAM, Slots DIMM, XMP/EXPO y frecuencia real vs nominal
 * - Unidades de almacenamiento físicas (SSD vs HDD)
 * - Juegos instalados en HDD que causan micro-stuttering
 */
async function getHardwareReport() {
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'

    # --- 1. MEMORIA RAM & XMP/EXPO ---
    $sticks = @()
    try {
      $sticks = @(Get-CimInstance Win32_PhysicalMemory -ErrorAction Stop)
    } catch {
      try {
        $sticks = @(Get-WmiObject Win32_PhysicalMemory -ErrorAction Stop)
      } catch {}
    }

    $modules = @()
    $totalBytes = 0
    $minConfigured = 99999
    $maxRated = 0
    $channels = @()
    $hasMismatch = $false
    $ratedSpeeds = @()

    foreach ($s in $sticks) {
      $capGB = [math]::Round($s.Capacity / 1GB, 1)
      $totalBytes += $s.Capacity
      $cfg = [int]$s.ConfiguredClockSpeed
      $spd = [int]$s.Speed
      if ($cfg -gt 0 -and $cfg -lt $minConfigured) { $minConfigured = $cfg }
      if ($spd -gt $maxRated) { $maxRated = $spd }

      $loc = ('{0} {1}' -f $s.BankLabel, $s.DeviceLocator).Trim()
      if ($loc -match '(?i)Channel\\s*([A-H])') { $channels += $Matches[1].ToUpperInvariant() }
      elseif ($loc -match '(?i)Channel([A-H])') { $channels += $Matches[1].ToUpperInvariant() }

      $part = [string]$s.PartNumber.Trim()
      $partRated = 0
      
      # No se deduce una frecuencia certificada a partir de un número de pieza.
      if ($partRated -gt 0) {
        $ratedSpeeds += $partRated
        if ($partRated -gt $maxRated) { $maxRated = $partRated }
      } else {
        $ratedSpeeds += $spd
      }

      $modules += [PSCustomObject]@{
        Slot = if ($s.DeviceLocator) { $s.DeviceLocator } else { 'DIMM' }
        Bank = $s.BankLabel
        CapacityGB = $capGB
        ConfiguredSpeed = $cfg
        Speed = $spd
        PartRated = if ($partRated -gt 0) { $partRated } else { $spd }
        Manufacturer = if ($s.Manufacturer) { $s.Manufacturer.Trim() } else { 'Genérico' }
        PartNumber = $part
      }
    }

    $uniqueChannels = @($channels | Select-Object -Unique)
    $typeNum = if ($sticks.Count) { [int]$sticks[0].SMBIOSMemoryType } else { 0 }
    $ddr = switch ($typeNum) {
      34 { 'DDR5' }
      26 { 'DDR4' }
      24 { 'DDR3' }
      20 { 'DDR2' }
      default { 'No disponible' }
    }

    $cfgSpeedFinal = if ($minConfigured -eq 99999) { 0 } else { $minConfigured }
    
    # Análisis de issues y diagnóstico
    $issues = @()
    $status = if ($sticks.Count -gt 0) { 'OBSERVED' } else { 'UNKNOWN' }
    $uniqueRated = @($ratedSpeeds | Select-Object -Unique)
    
    if ($sticks.Count -eq 1) {
      $issues += 'Se detectó un módulo. El modo de canal no se puede confirmar con estos datos; consulta el manual de la placa.'
    }

    if ($uniqueRated.Count -gt 1) {
      $hasMismatch = $true
      $status = 'MISMATCHED_MODULES'
      $issues += 'Asimetría de frecuencia detectada: Tienes módulos de diferentes velocidades (' + ($uniqueRated -join ' MT/s, ') + ' MT/s). La placa madre reduce automáticamente la velocidad de todos los módulos a la del más lento (' + $cfgSpeedFinal + ' MT/s) para mantener estabilidad del sistema.'
    } elseif ($maxRated -gt 0 -and $cfgSpeedFinal -gt 0 -and $cfgSpeedFinal -lt ($maxRated - 100)) {
      $status = 'CLOCK_DIFFERENCE'
      $issues += 'La frecuencia configurada (' + $cfgSpeedFinal + ' MT/s) es inferior a la informada por Windows (' + $maxRated + ' MT/s). Esto no confirma el estado de XMP/EXPO; revisa la BIOS y las especificaciones del fabricante.'
    }

    # --- 2. ALMACENAMIENTO & JUEGOS EN HDD ---
    $rawDisks = @(Get-PhysicalDisk -ErrorAction SilentlyContinue | Where-Object {
      $_.Size -gt 0 -and
      $_.BusType -ne 'File Backed Virtual' -and
      $_.FriendlyName -notmatch '(?i)Virtual|File Backed'
    })
    $parts = @(Get-Partition -ErrorAction SilentlyContinue | Where-Object { $_.DriveLetter } | Select-Object DiskNumber, DriveLetter)

    $diskLettersMap = @{}
    $driveMediaMap = @{}
    $driveNameMap = @{}

    foreach ($p in $parts) {
      $dNum = [string]$p.DiskNumber
      $dLtr = ([string]$p.DriveLetter).ToUpperInvariant()
      if (-not $diskLettersMap.ContainsKey($dNum)) { $diskLettersMap[$dNum] = @() }
      $diskLettersMap[$dNum] += ($dLtr + ':')

      $diskObj = $rawDisks | Where-Object { [string]$_.DeviceId -eq $dNum } | Select-Object -First 1
      if ($diskObj) {
        $driveMediaMap[$dLtr] = [string]$diskObj.MediaType
        $driveNameMap[$dLtr] = [string]$diskObj.FriendlyName
      }
    }

    $disks = @()
    foreach ($d in $rawDisks) {
      $dNum = [string]$d.DeviceId
      $letters = if ($diskLettersMap.ContainsKey($dNum)) { ($diskLettersMap[$dNum] -join ', ') } else { '' }
      $mType = if ($d.MediaType) { [string]$d.MediaType } else { 'Unknown' }
      $sizeGB = [math]::Round($d.Size / 1GB)
      $sizeDisplay = if ($sizeGB -ge 1000) { ('{0:N1} TB' -f ($sizeGB / 1024)) } else { ('{0} GB' -f $sizeGB) }

      $disks += [PSCustomObject]@{
        DeviceId = $d.DeviceId
        FriendlyName = [string]$d.FriendlyName
        MediaType = $mType
        BusType = [string]$d.BusType
        SizeGB = $sizeGB
        SizeDisplay = $sizeDisplay
        DriveLetters = $letters
      }
    }

    $gamesOnHdd = @()
    $gamesOnSsd = @()
    $seenPaths = @{}

    # Juegos registrados por GameConfigStore
    foreach ($k in @(Get-ChildItem 'HKCU:\\System\\GameConfigStore\\Children' -ErrorAction SilentlyContinue)) {
      $exe = [string](Get-ItemProperty -LiteralPath $k.PSPath -Name 'MatchedExeFullPath' -ErrorAction SilentlyContinue).MatchedExeFullPath
      if ($exe -and (Test-Path $exe)) {
        $exeUpper = $exe.ToUpperInvariant()
        if ($seenPaths.ContainsKey($exeUpper)) { continue }
        $seenPaths[$exeUpper] = $true

        $letter = $exe.Substring(0,1).ToUpperInvariant()
        $mType = if ($driveMediaMap.ContainsKey($letter)) { $driveMediaMap[$letter] } else { 'Unknown' }
        $gameName = [System.IO.Path]::GetFileNameWithoutExtension($exe)
        
        $item = [PSCustomObject]@{
          Name = $gameName
          Path = $exe
          Drive = $letter
          DriveName = if ($driveNameMap.ContainsKey($letter)) { $driveNameMap[$letter] } else { '' }
          MediaType = $mType
        }
        if ($mType -eq 'HDD') { $gamesOnHdd += $item }
        elseif ($mType -eq 'SSD') { $gamesOnSsd += $item }
      }
    }

    # Juegos populares en rutas conocidas (Riot, Epic, etc.)
    $extraKnown = @()
    try {
      $riotInfo = Get-Content -LiteralPath (Join-Path $env:ProgramData 'Riot Games\\RiotClientInstalls.json') -Raw -ErrorAction Stop | ConvertFrom-Json
      $vl = [string]$riotInfo.product_install_full_path.'valorant.live'
      if ($vl) { $extraKnown += (Join-Path (Split-Path $vl) 'ShooterGame\\Binaries\\Win64\\VALORANT-Win64-Shipping.exe') }
    } catch {}
    foreach ($r in @("$env:ProgramFiles\\Riot Games", 'C:\\Riot Games', 'D:\\Riot Games', 'D:\\Games\\Riot Games')) {
      $extraKnown += (Join-Path $r 'VALORANT\\live\\ShooterGame\\Binaries\\Win64\\VALORANT-Win64-Shipping.exe')
    }
    foreach ($r in @("$env:ProgramFiles\\Epic Games", (Join-Path $env:SystemDrive 'Program Files (x86)\\Epic Games'), 'D:\\Epic Games', 'D:\\Games\\Epic Games', 'D:\\Games\\Fortnite')) {
      $extraKnown += (Join-Path $r 'Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe')
      $extraKnown += (Join-Path $r 'FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe')
    }

    foreach ($exe in $extraKnown) {
      if ($exe -and (Test-Path $exe)) {
        $exeUpper = $exe.ToUpperInvariant()
        if ($seenPaths.ContainsKey($exeUpper)) { continue }
        $seenPaths[$exeUpper] = $true

        $letter = $exe.Substring(0,1).ToUpperInvariant()
        $mType = if ($driveMediaMap.ContainsKey($letter)) { $driveMediaMap[$letter] } else { 'Unknown' }
        $gameName = [System.IO.Path]::GetFileNameWithoutExtension($exe)
        
        $item = [PSCustomObject]@{
          Name = $gameName
          Path = $exe
          Drive = $letter
          DriveName = if ($driveNameMap.ContainsKey($letter)) { $driveNameMap[$letter] } else { '' }
          MediaType = $mType
        }
        if ($mType -eq 'HDD') { $gamesOnHdd += $item }
        elseif ($mType -eq 'SSD') { $gamesOnSsd += $item }
      }
    }

    # Salida JSON
    [PSCustomObject]@{
      RAM = @{
        TotalGB = [math]::Round($totalBytes / 1GB, 1)
        DdrType = $ddr
        ModuleCount = $sticks.Count
        ConfiguredSpeed = $cfgSpeedFinal
        MaxRatedSpeed = $maxRated
        ChannelCount = $uniqueChannels.Count
        ChannelMode = 'No confirmado por CIM'
        Status = $status
        HasMismatch = $hasMismatch
        Issues = $issues
        Modules = $modules
      }
      Storage = @{
        Disks = $disks
        DriveMediaMap = $driveMediaMap
        GamesOnHddCount = $gamesOnHdd.Count
        GamesOnHdd = $gamesOnHdd
        GamesOnSsdCount = $gamesOnSsd.Count
        GamesOnSsd = $gamesOnSsd
      }
    } | ConvertTo-Json -Depth 6
  `;

  try {
    const res = await runPsStdin(script);
    if (!res.output) {
      return {
        success: false,
        error: res.error || 'No se obtuvieron datos de hardware'
      };
    }
    const data = JSON.parse(res.output);

    // Enriquecer nombres de juegos para presentación gamer
    if (data.Storage && Array.isArray(data.Storage.GamesOnHdd)) {
      data.Storage.GamesOnHdd = data.Storage.GamesOnHdd.map(g => ({
        ...g,
        DisplayName: resolveGameDisplayName(g.Name, g.Path)
      }));
    }
    if (data.Storage && Array.isArray(data.Storage.GamesOnSsd)) {
      data.Storage.GamesOnSsd = data.Storage.GamesOnSsd.map(g => ({
        ...g,
        DisplayName: resolveGameDisplayName(g.Name, g.Path)
      }));
    }

    return {
      success: true,
      report: data
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Consulta si la suspensión selectiva de USB está desactivada (Ultra-baja latencia para Mouse/Teclado)
 */
async function getUsbLatencyStatus() {
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    $lines = @(& powercfg /query SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226)
    $val = $null
    $hex = $null
    foreach ($l in $lines) {
      if ($l -match '(?i)(?:corriente alterna|Current AC)' -and $l -match '(0x[0-9a-fA-F]+|\\d+)\\s*$') {
        $hex = $Matches[1]
        $val = [Convert]::ToInt32($hex, 16)
        break
      }
    }
    [PSCustomObject]@{
      RawVal = $hex
      Val = $val
      IsLowLatency = if ($null -eq $val) { $null } else { $val -eq 0 }
    } | ConvertTo-Json
  `;

  try {
    const res = await runPsStdin(script);
    let isLowLatency = null;
    let hexVal = null;
    if (res.output) {
      try {
        const parsed = JSON.parse(res.output);
        isLowLatency = typeof parsed.IsLowLatency === 'boolean' ? parsed.IsLowLatency : null;
        hexVal = parsed.RawVal || hexVal;
      } catch (e) {}
    }
    return {
      success: isLowLatency !== null,
      isLowLatencyEnabled: isLowLatency,
      acValue: hexVal,
      error: isLowLatency === null ? 'Windows no informó el estado de suspensión selectiva USB.' : null,
      statusLabel: isLowLatency === null ? 'No se pudo determinar la suspensión selectiva USB' : isLowLatency ? 'Suspensión selectiva USB desactivada' : 'Suspensión selectiva USB activada'
    };
  } catch (err) {
    return {
      success: false,
      isLowLatencyEnabled: false,
      error: err.message
    };
  }
}

/**
 * Aplica o restaura la preferencia USB mediante el motor con respaldo.
 */
async function setUsbLowLatency(enable, engine) {
  if (typeof enable !== 'boolean') return { success: false, message: 'El estado USB solicitado no es válido.' };
  if (!engine || typeof engine.applyTweak !== 'function' || typeof engine.revertTweak !== 'function') {
    return { success: false, message: 'El motor con respaldo no está disponible. No se modificó la configuración USB.' };
  }
  const result = await engine[enable ? 'applyTweak' : 'revertTweak']('power_usb_selective');
  if (!result.success) return result;
  const observed = await getUsbLatencyStatus();
  return { ...observed, partial: !observed.success, message: observed.success ? result.message : 'La operación terminó, pero no se pudo consultar el estado USB. El respaldo se conserva. ' + (observed.error || '') };
}

module.exports = {
  getHardwareReport,
  getUsbLatencyStatus,
  setUsbLowLatency
};
