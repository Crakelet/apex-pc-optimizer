'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { runPowerShell } = require('./systemInfo');
const locks = new Set();

function userDataPath() {
  try { const { app } = require('electron'); if (app?.getPath) return app.getPath('userData'); } catch {}
  return path.join(process.env.APPDATA || os.homedir(), 'ApexPCOptimizer');
}
function atomicWrite(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx');
    fs.writeFileSync(descriptor, JSON.stringify(data, null, 2)); fs.fsyncSync(descriptor); fs.closeSync(descriptor); descriptor = undefined;
    fs.renameSync(temporary, file);
  } finally { if (descriptor !== undefined) fs.closeSync(descriptor); if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

// Descriptors are compiled application data. Snapshots never supply executable scripts.
const REGISTRY_FUNCTIONS = `
function Open-ApexRegistryKey($Path, [bool]$Writable = $false, [bool]$Create = $false) {
  $normalized = $Path -replace '\\\\+', '\\'
  if ($normalized.StartsWith('HKCU:\\', [StringComparison]::OrdinalIgnoreCase)) { $base = [Microsoft.Win32.Registry]::CurrentUser }
  elseif ($normalized.StartsWith('HKLM:\\', [StringComparison]::OrdinalIgnoreCase)) { $base = [Microsoft.Win32.Registry]::LocalMachine }
  else { throw 'Ruta de registro no admitida.' }
  if ($Create) { return $base.CreateSubKey($normalized.Substring(6)) }
  return $base.OpenSubKey($normalized.Substring(6), $Writable)
}
function Get-ApexRegistryValue($Resource) {
  $key = Open-ApexRegistryKey $Resource.path
  try {
    $exists = $null -ne $key -and $key.GetValueNames() -contains [string]$Resource.name
    $kind = $null; $value = $null
    if ($exists) {
      $kind = $key.GetValueKind([string]$Resource.name).ToString()
      $value = $key.GetValue([string]$Resource.name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
      if ($kind -in @('DWord','QWord')) { $value = $value.ToString([Globalization.CultureInfo]::InvariantCulture) }
      elseif ($kind -in @('Binary','None')) { $value = [Convert]::ToBase64String($value) }
      elseif ($kind -eq 'MultiString') { $value = @($value) }
    }
    return @{ path = [string]$Resource.path; name = [string]$Resource.name; exists = $exists; kind = $kind; value = $value }
  } finally { if ($key) { $key.Close() } }
}
function Set-ApexRegistryValue($Snapshot) {
  if ($Snapshot.exists) {
    $key = Open-ApexRegistryKey $Snapshot.path $true $true
    try {
      $kind = [Enum]::Parse([Microsoft.Win32.RegistryValueKind], [string]$Snapshot.kind)
      $value = switch ([string]$Snapshot.kind) {
        'DWord' { [int]::Parse([string]$Snapshot.value, [Globalization.CultureInfo]::InvariantCulture) }
        'QWord' { [long]::Parse([string]$Snapshot.value, [Globalization.CultureInfo]::InvariantCulture) }
        'Binary' { ,([Convert]::FromBase64String([string]$Snapshot.value)) }
        'None' { ,([Convert]::FromBase64String([string]$Snapshot.value)) }
        'MultiString' { ,([string[]]$Snapshot.value) }
        default { [string]$Snapshot.value }
      }
      $key.SetValue([string]$Snapshot.name, $value, $kind)
    } finally { $key.Close() }
  } else {
    $key = Open-ApexRegistryKey $Snapshot.path $true
    try { if ($key) { $key.DeleteValue([string]$Snapshot.name, $false) } } finally { if ($key) { $key.Close() } }
  }
}
`;

const CAPTURE_SCRIPT = `${REGISTRY_FUNCTIONS}
$result = @{ registry = @(); services = @(); bcd = @(); adapters = @(); tcp = @(); rss = @(); power = $null }
foreach ($r in @($data.resources.registry)) { $result.registry += Get-ApexRegistryValue $r }
if (@($data.resources.registryInterfaces).Count -gt 0) {
  foreach ($iface in @(Get-ChildItem -LiteralPath 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces' | Sort-Object PSChildName)) {
    foreach ($name in @($data.resources.registryInterfaces)) { $result.registry += Get-ApexRegistryValue @{ path = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\' + $iface.PSChildName; name = $name } }
  }
}
foreach ($name in @($data.resources.services)) {
  $service = Get-Service -Name $name -ErrorAction SilentlyContinue
  $start = if ($service) { (Get-ItemProperty -LiteralPath ('HKLM:\\SYSTEM\\CurrentControlSet\\Services\\' + $name) -Name Start).Start } else { $null }
  $result.services += @{ name = [string]$name; exists = ($null -ne $service); status = if ($service) { $service.Status.ToString() } else { $null }; start = $start }
}
if (@($data.resources.bcd).Count -gt 0) {
  $bcdText = (& bcdedit.exe /enum '{current}' 2>&1 | Out-String)
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo respaldar la configuración de arranque. Se requieren permisos de administrador.' }
  foreach ($name in @($data.resources.bcd)) {
    $m = [regex]::Match($bcdText, ('(?im)^\\s*' + [regex]::Escape([string]$name) + '\\s+(\\S+)'))
    $result.bcd += @{ name = [string]$name; exists = $m.Success; value = if ($m.Success) { $m.Groups[1].Value } else { $null } }
  }
}
if ($data.resources.power) {
  $text = (& powercfg.exe /getactivescheme | Out-String)
  if ($LASTEXITCODE -ne 0 -or $text -notmatch '[a-fA-F0-9-]{36}') { throw 'No se pudo respaldar el plan de energía.' }
  $result.power = @{ guid = $Matches[0]; usbAC = $null; usbDC = $null }
  if ($data.resources.power -eq 'usb') {
    $query = (& powercfg.exe /query $result.power.guid '2a737441-1930-4402-8d77-b2bebba308a3' '48e6b7a6-50f5-4782-a5d4-53bb8f07e226' | Out-String)
    $values = [regex]::Matches($query, '0x[0-9a-fA-F]+')
    if ($LASTEXITCODE -ne 0 -or $values.Count -lt 2) { throw 'No se pudo respaldar la suspensión selectiva USB.' }
    $result.power.usbAC = [Convert]::ToInt32($values[$values.Count - 2].Value.Substring(2), 16)
    $result.power.usbDC = [Convert]::ToInt32($values[$values.Count - 1].Value.Substring(2), 16)
  }
}
if (@($data.resources.tcp).Count -gt 0) {
  $internet = Get-NetTCPSetting -SettingName Internet -ErrorAction Stop
  foreach ($name in @($data.resources.tcp)) {
    $value = switch ($name) {
      'autotuning' { $internet.AutoTuningLevelLocal.ToString().ToLowerInvariant() }
      'ecn' { $internet.EcnCapability.ToString().ToLowerInvariant() }
      'rss' { (Get-NetOffloadGlobalSetting).ReceiveSideScaling.ToString().ToLowerInvariant() }
      'heuristics' {
        $text = (& netsh.exe interface tcp show heuristics | Out-String)
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo respaldar la heurística TCP.' }
        if ($text -match '(?i)disabled|deshabilitad[ao]') { 'disabled' } elseif ($text -match '(?i)enabled|habilitad[ao]') { 'enabled' } else { throw 'Windows no devolvió un estado de heurística TCP reconocible; no se aplicarán cambios.' }
      }
    }
    if ($value -notmatch '^(disabled|enabled|normal|restricted|highlyrestricted|experimental|default|appdecide)$') { throw 'Estado TCP no compatible con restauración.' }
    $result.tcp += @{ name = [string]$name; value = $value }
  }
}
if ($data.resources.adapterRss) { $result.rss = @(Get-NetAdapterRss | Sort-Object Name | ForEach-Object { @{ name = $_.Name; enabled = $_.Enabled } }) }
if (@($data.resources.adapterPatterns).Count -gt 0) {
  $properties = @(Get-NetAdapterAdvancedProperty -AllProperties | Where-Object {
    $property = $_; $match = $false
    foreach ($pattern in @($data.resources.adapterPatterns)) { if ($property.RegistryKeyword -like $pattern -or $property.DisplayName -like $pattern) { $match = $true } }
    $match
  } | Sort-Object Name, RegistryKeyword)
  $result.adapters = @($properties | ForEach-Object { @{ name = $_.Name; keyword = $_.RegistryKeyword; value = @($_.RegistryValue) } })
}
$result | ConvertTo-Json -Depth 20 -Compress
`;

const RESTORE_SCRIPT = `${REGISTRY_FUNCTIONS}
foreach ($service in @($data.snapshot.services)) {
  if ($service.exists) {
    $startup = switch ([int]$service.start) { 2 { 'Automatic' } 3 { 'Manual' } 4 { 'Disabled' } default { throw 'Tipo de inicio de servicio no compatible con restauración.' } }
    if ($service.status -in @('Running','Paused')) {
      Set-Service -Name $service.name -StartupType $(if ($startup -eq 'Disabled') { 'Manual' } else { $startup })
      $current = Get-Service -Name $service.name
      if ($current.Status -eq 'Paused') { Resume-Service -Name $service.name }
      elseif ($current.Status -ne 'Running') { Start-Service -Name $service.name }
      if ($service.status -eq 'Paused') { Suspend-Service -Name $service.name }
      if ($startup -eq 'Disabled') { Set-Service -Name $service.name -StartupType Disabled }
    } else { Stop-Service -Name $service.name -ErrorAction Stop; Set-Service -Name $service.name -StartupType $startup }
  }
}
foreach ($r in @($data.snapshot.registry)) { Set-ApexRegistryValue $r }
foreach ($entry in @($data.snapshot.bcd)) {
  if ($entry.exists) { & bcdedit.exe /set '{current}' $entry.name $entry.value | Out-Null }
  else { & bcdedit.exe /deletevalue '{current}' $entry.name | Out-Null }
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo restaurar una opción de arranque.' }
}
foreach ($entry in @($data.snapshot.tcp)) {
  switch ($entry.name) {
    'heuristics' { & netsh.exe interface tcp set heuristics $entry.value | Out-Null }
    'autotuning' { & netsh.exe interface tcp set global ('autotuninglevel=' + $entry.value) | Out-Null }
    'ecn' { $v = if ($entry.value -eq 'appdecide') { 'default' } else { $entry.value }; & netsh.exe interface tcp set global ('ecncapability=' + $v) | Out-Null }
    'rss' { & netsh.exe interface tcp set global ('rss=' + $entry.value) | Out-Null }
  }
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo restaurar una opción TCP.' }
}
foreach ($entry in @($data.snapshot.rss)) { Set-NetAdapterRss -Name $entry.name -Enabled ([bool]$entry.enabled) }
foreach ($entry in @($data.snapshot.adapters)) { Set-NetAdapterAdvancedProperty -Name $entry.name -RegistryKeyword $entry.keyword -RegistryValue ([string[]]$entry.value) }
if ($data.snapshot.power) {
  $p = $data.snapshot.power
  if ($null -ne $p.usbAC) {
    & powercfg.exe /setacvalueindex $p.guid '2a737441-1930-4402-8d77-b2bebba308a3' '48e6b7a6-50f5-4782-a5d4-53bb8f07e226' $p.usbAC | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo restaurar la preferencia USB con corriente.' }
    & powercfg.exe /setdcvalueindex $p.guid '2a737441-1930-4402-8d77-b2bebba308a3' '48e6b7a6-50f5-4782-a5d4-53bb8f07e226' $p.usbDC | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo restaurar la preferencia USB con batería.' }
  }
  & powercfg.exe /setactive $p.guid | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo restaurar el plan de energía original.' }
}
'OK'
`;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function snapshotTargets(snapshot) {
  const normalize = value => String(value).replace(/\\+/g, '\\').toLowerCase();
  const targets = new Set();
  for (const item of snapshot.registry) targets.add('registry:' + normalize(item.path) + '|' + normalize(item.name));
  for (const section of ['services','bcd','tcp','rss']) for (const item of snapshot[section]) targets.add(section + ':' + normalize(item.name));
  for (const item of snapshot.adapters) targets.add('adapter:' + normalize(item.name) + '|' + normalize(item.keyword));
  if (snapshot.power) targets.add('power:active');
  return targets;
}
function validateSnapshot(snapshot, resources) {
  const arrays = ['registry','services','bcd','adapters','tcp','rss'];
  if (!snapshot || arrays.some(name => !Array.isArray(snapshot[name]) || snapshot[name].length > 2000)) throw new Error('El respaldo no tiene el formato esperado.');
  const identity = item => `${String(item.path).replace(/\\+/g, '\\').toLowerCase()}|${String(item.name).toLowerCase()}`;
  const allowed = new Set(resources.registry.map(identity)), seen = new Set();
  for (const item of snapshot.registry) {
    const key = identity(item);
    const dynamic = resources.registryInterfaces.includes(item.name) && /^HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\\{[a-f0-9-]{36}\}$/i.test(item.path);
    if ((!allowed.has(key) && !dynamic) || seen.has(key) || typeof item.exists !== 'boolean') throw new Error('El respaldo contiene un destino ajeno al ajuste.');
    seen.add(key);
    if (!item.exists) { if (item.kind !== null || item.value !== null) throw new Error('Valor ausente de respaldo no válido.'); continue; }
    if (!['String','ExpandString','DWord','QWord','Binary','None','MultiString'].includes(item.kind)) throw new Error('Tipo de registro no compatible.');
    if (['DWord','QWord'].includes(item.kind)) {
      if (typeof item.value !== 'string' || !/^-?\d{1,20}$/.test(item.value)) throw new Error('Número de respaldo no válido.');
      const value = BigInt(item.value), bits = item.kind === 'DWord' ? 32n : 64n;
      if (value < -(1n << (bits - 1n)) || value >= (1n << (bits - 1n))) throw new Error('Número de respaldo fuera de rango.');
    } else if (item.kind === 'MultiString') {
      if (!Array.isArray(item.value) || item.value.length > 2000 || item.value.some(value => typeof value !== 'string' || value.length > 65536)) throw new Error('Lista de respaldo no válida.');
    } else if (typeof item.value !== 'string' || item.value.length > 1024 * 1024) throw new Error('Texto de respaldo no válido.');
  }
  if ([...allowed].some(key => !seen.has(key))) throw new Error('El respaldo está incompleto.');
  for (const section of ['services','bcd','tcp','rss','adapters']) {
    const identities = snapshot[section].map(item => String(item.name).toLowerCase() + (section === 'adapters' ? '|' + String(item.keyword).toLowerCase() : ''));
    if (new Set(identities).size !== identities.length) throw new Error('El respaldo contiene recursos duplicados.');
  }
  for (const item of snapshot.services) if (!resources.services.includes(item.name) || typeof item.exists !== 'boolean' || (item.exists && (![2,3,4].includes(item.start) || !['Running','Stopped','Paused'].includes(item.status)))) throw new Error('Servicio de respaldo no válido o en transición.');
  if (snapshot.services.length !== resources.services.length) throw new Error('Respaldo de servicios incompleto.');
  for (const item of snapshot.bcd) if (!resources.bcd.includes(item.name) || typeof item.exists !== 'boolean' || (item.exists && !/^(Yes|No|True|False|Sí|Si|Default|Legacy|Enhanced)$/i.test(item.value))) throw new Error('Opción de arranque no válida en el respaldo.');
  if (snapshot.bcd.length !== resources.bcd.length) throw new Error('Respaldo de arranque incompleto.');
  for (const item of snapshot.tcp) if (!resources.tcp.includes(item.name) || !/^(disabled|enabled|normal|restricted|highlyrestricted|experimental|default|appdecide)$/.test(item.value)) throw new Error('Estado TCP de respaldo no válido.');
  if (snapshot.tcp.length !== resources.tcp.length) throw new Error('Respaldo TCP incompleto.');
  if (!resources.adapterRss && snapshot.rss.length) throw new Error('Respaldo RSS ajeno al ajuste.');
  for (const item of snapshot.rss) if (typeof item.name !== 'string' || item.name.length > 256 || typeof item.enabled !== 'boolean') throw new Error('Adaptador RSS de respaldo no válido.');
  if (!resources.adapterPatterns.length && snapshot.adapters.length) throw new Error('Respaldo de adaptador ajeno al ajuste.');
  for (const item of snapshot.adapters) if (typeof item.name !== 'string' || typeof item.keyword !== 'string' || !Array.isArray(item.value) || item.value.some(value => typeof value !== 'string')) throw new Error('Propiedad de adaptador no válida en el respaldo.');
  if (resources.power) {
    if (!snapshot.power || !/^[a-f0-9-]{36}$/i.test(snapshot.power.guid) || ['usbAC','usbDC'].some(key => snapshot.power[key] !== null && (!Number.isInteger(snapshot.power[key]) || snapshot.power[key] < 0 || snapshot.power[key] > 4294967295))) throw new Error('Plan de energía de respaldo no válido.');
  } else if (snapshot.power !== null) throw new Error('Plan de energía ajeno al ajuste.');
  return snapshot;
}
class RestorationManager {
  constructor({ file = path.join(userDataPath(), 'restoration-v1.json'), runner = runPowerShell } = {}) { this.file = file; this.runner = runner; }
  read() {
    try {
      const value = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (!value || value.schema !== 1 || !Array.isArray(value.entries) || value.entries.length > 10000 || value.entries.some(entry => !entry || typeof entry.id !== 'string' || !/^[a-z][\w:-]{0,159}$/i.test(entry.id) || !['prepared','applied','failed','reverted'].includes(entry.status) || !entry.before || typeof entry.before !== 'object')) throw new Error('El historial de respaldo no es válido. Conserva el archivo para revisar los respaldos.');
      return value;
    } catch (error) { if (error.code === 'ENOENT') return { schema: 1, entries: [] }; throw error; }
  }
  async capture(resources) {
    const result = await this.runner(CAPTURE_SCRIPT, { resources });
    if (!result.success) throw new Error(result.output || 'No se pudo guardar la configuración actual. No se aplicaron cambios.');
    let parsed;
    try { parsed = JSON.parse(result.output); } catch { throw new Error('El respaldo no se pudo interpretar. No se aplicarán cambios.'); }
    return validateSnapshot(parsed, resources);
  }
  active(id) { return this.read().entries.find(entry => entry.id === id && ['prepared','applied','failed'].includes(entry.status)); }
  async exclusive(action) {
    if (locks.has(this.file)) throw new Error('Espera a que termine la operación anterior.');
    locks.add(this.file); try { return await action(); } finally { locks.delete(this.file); }
  }
  async apply(id, resources, script, checkScript) {
    return this.exclusive(async () => {
      const history = this.read();
      if (history.entries.some(entry => entry.id === id && ['prepared','applied','failed'].includes(entry.status))) return { success: false, message: 'Este ajuste ya tiene un respaldo activo. Deshazlo antes de volver a aplicarlo.' };
      const before = await this.capture(resources);
      const record = { id, status: 'prepared', at: new Date().toISOString(), before, after: null };
      history.entries.push(record); atomicWrite(this.file, history);
      let applied;
      try {
        if (canonical(await this.capture(resources)) !== canonical(before)) throw new Error('La configuración cambió mientras se guardaba el respaldo. No se sobrescribió.');
        applied = await this.runner(script);
        try { record.after = await this.capture(resources); } catch {}
        if (!applied.success) throw new Error(applied.output || 'Windows rechazó el cambio.');
        if (!record.after) throw new Error('No se pudo verificar el estado posterior. Conserva el respaldo y revisa el historial.');
        if (checkScript) {
          const verified = await this.runner(checkScript);
          if (!verified.success || verified.output.trim().toLowerCase() !== 'true') throw new Error('El ajuste no se pudo verificar en este equipo. El respaldo original permanece disponible.');
        }
        record.status = 'applied'; atomicWrite(this.file, history);
        return { success: true, backedUp: true, message: 'Cambio aplicado y verificado. Se conservó la configuración original.' };
      } catch (error) {
        record.status = 'failed'; record.error = error.message;
        try { atomicWrite(this.file, history); } catch {}
        return { success: false, backedUp: true, message: error.message };
      }
    });
  }
  async revert(id, resources) {
    return this.exclusive(async () => {
      const history = this.read(), record = history.entries.find(entry => entry.id === id && ['prepared','applied','failed'].includes(entry.status));
      if (!record) return { success: false, message: 'Apex no tiene un respaldo propio de este ajuste. No se modificó la configuración existente.' };
      validateSnapshot(record.before, resources);
      if (record.after) validateSnapshot(record.after, resources);
      const targets = snapshotTargets(record.before);
      const later = history.entries.slice(history.entries.indexOf(record) + 1).find(entry => {
        if (!['prepared','applied','failed'].includes(entry.status)) return false;
        const other = snapshotTargets(entry.before);
        return [...other].some(target => targets.has(target));
      });
      if (later) return { success: false, conflict: true, blockedBy: later.id, message: `Deshaz primero el ajuste posterior «${later.id}», que comparte una configuración con este respaldo.` };
      const current = await this.capture(resources);
      // Dynamic adapter/interface names must still belong to the freshly detected scope.
      // An edited backup cannot authorize a target just by changing its saved "after" values.
      if (canonical([...snapshotTargets(current)].sort()) !== canonical([...targets].sort())) return { success: false, conflict: true, message: 'Cambió el conjunto de dispositivos o destinos del ajuste. No se restauró un respaldo con destinos diferentes.' };
      if (canonical(current) !== canonical(record.before)) {
        if (!record.after || canonical(current) !== canonical(record.after)) return { success: false, conflict: true, message: 'La configuración cambió fuera de Apex o no se pudo verificar. No se sobrescribió; conserva el respaldo para revisarlo.' };
        const result = await this.runner(RESTORE_SCRIPT, { snapshot: record.before });
        if (!result.success) return { success: false, message: result.output || 'No se pudo restaurar la configuración original.' };
      }
      if (canonical(await this.capture(resources)) !== canonical(record.before)) return { success: false, message: 'No se pudo verificar toda la restauración. El respaldo sigue disponible.' };
      record.status = 'reverted'; record.revertedAt = new Date().toISOString(); atomicWrite(this.file, history);
      return { success: true, message: 'Se restauró y verificó la configuración original guardada.' };
    });
  }
}
module.exports = { RestorationManager, userDataPath, atomicWrite, canonical, validateSnapshot, CAPTURE_SCRIPT, RESTORE_SCRIPT };
