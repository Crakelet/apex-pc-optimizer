'use strict';
const { runPowerShell } = require('./powerShell');
function validSnapshot(snapshot) {
  if (!snapshot || typeof snapshot.exists !== 'boolean' || typeof snapshot.keyExists !== 'boolean') return false;
  if (!snapshot.exists) return snapshot.value === null && snapshot.kind === null;
  if (!snapshot.keyExists) return false;
  return (snapshot.kind === 'DWord' && Number.isInteger(snapshot.value) && snapshot.value >= 0 && snapshot.value <= 4294967295) || (snapshot.kind === 'String' && typeof snapshot.value === 'string' && snapshot.value.length <= 16384);
}
function sameValue(a, b) { return a.exists === b.exists && (!a.exists || (a.kind === b.kind && a.value === b.value)); }
class RegistryAdapter {
  async read(setting) {
    const result = await runPowerShell(`
      $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey([string]$data.relative)
      try {
        $exists = $null -ne $key -and $key.GetValueNames() -contains $data.name
        $kind = $null; $value = $null
        if ($exists) {
          $kind = $key.GetValueKind($data.name).ToString()
          $value = $key.GetValue($data.name)
          if ($kind -eq 'DWord') { $value = [long]$value -band 0xFFFFFFFFL }
        }
        @{ keyExists = ($null -ne $key); exists = $exists; kind = $kind; value = $value } | ConvertTo-Json -Compress
      } finally { if ($key) { $key.Close() } }
    `, { relative: setting.path.slice(6), name: setting.name });
    if (!validSnapshot(result)) throw new Error('El valor actual tiene un tipo no compatible. No se modificó.');
    return result;
  }
  async write(setting, snapshot) {
    if (!validSnapshot(snapshot)) throw new Error('El respaldo del ajuste no es válido.');
    await runPowerShell(`
      if ($data.snapshot.exists) {
        $key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey([string]$data.relative)
        try {
          $kind = [Enum]::Parse([Microsoft.Win32.RegistryValueKind], [string]$data.snapshot.kind)
          if ($data.snapshot.kind -eq 'DWord') { $value = [BitConverter]::ToInt32([BitConverter]::GetBytes([uint32]$data.snapshot.value), 0) }
          else { $value = [string]$data.snapshot.value }
          $key.SetValue([string]$data.name, $value, $kind)
        } finally { $key.Close() }
      } else {
        $key = Get-Item -LiteralPath $data.path -ErrorAction SilentlyContinue
        if ($key) {
          if ($key.GetValueNames() -contains $data.name) { Remove-ItemProperty -LiteralPath $data.path -Name ([string]$data.name) -ErrorAction Stop }
          if (-not $data.snapshot.keyExists -and $key.GetValueNames().Count -eq 0 -and $key.GetSubKeyNames().Count -eq 0) { $key.Close(); Remove-Item -LiteralPath $data.path }
        }
      }
      @{ success = $true } | ConvertTo-Json -Compress
    `, { path: setting.path, relative: setting.path.slice(6), name: setting.name, snapshot });
  }
}
class SimulatedRegistryAdapter {
  constructor(values = []) { this.values = new Map(values); }
  async read(setting) { return structuredClone(this.values.get(setting.id) || { keyExists: false, exists: false, kind: null, value: null }); }
  async write(setting, snapshot) { this.values.set(setting.id, structuredClone(snapshot)); }
}
module.exports = { RegistryAdapter, SimulatedRegistryAdapter, sameValue, validSnapshot };
