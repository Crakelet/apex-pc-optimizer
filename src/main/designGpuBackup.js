'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

function validateExePath(value) {
  if (typeof value !== 'string' || value.length > 32700 || !/^[a-z]:\\/i.test(value) || path.win32.extname(value).toLowerCase() !== '.exe' || /[\0-\x1f]/.test(value)) throw new Error('Selecciona la ruta absoluta de una aplicación .exe en una unidad local.');
  return path.win32.normalize(value);
}
function keyFor(value) { return createHash('sha256').update(validateExePath(value).toLowerCase()).digest('hex'); }
function validSnapshot(value) {
  return Boolean(value && typeof value.exists === 'boolean' && (value.exists ? ['String','ExpandString'].includes(value.kind) && typeof value.value === 'string' && value.value.length <= 32700 : value.kind === null && value.value === null));
}
function same(a, b) { return a.exists === b.exists && (!a.exists || (a.kind === b.kind && a.value === b.value)); }
function desiredValue(before) {
  const parts = before.exists ? before.value.split(';').filter(part => part && !/^\s*GpuPreference\s*=/i.test(part)) : [];
  parts.push('GpuPreference=2');
  return { exists: true, kind: before.exists ? before.kind : 'String', value: parts.join(';') + ';' };
}

class PowerShellGpuAdapter {
  constructor(execute = (script, data) => require('./systemInfo').runPowerShell(script, data)) { this.execute = execute; }
  async read(exePath) {
    const result = await this.execute(`
      $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\\Microsoft\\DirectX\\UserGpuPreferences')
      try {
        $exists = $null -ne $key -and @($key.GetValueNames() | Where-Object { [string]::Equals($_, [string]$data.exePath, [StringComparison]::OrdinalIgnoreCase) }).Count -gt 0
        if ($exists) {
          $kind = $key.GetValueKind([string]$data.exePath).ToString()
          if ($kind -notin @('String','ExpandString')) { throw 'La preferencia actual tiene un tipo no compatible; no se modificó.' }
          $value = $key.GetValue([string]$data.exePath, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
        } else { $kind = $null; $value = $null }
        @{exists=$exists;kind=$kind;value=$value} | ConvertTo-Json -Compress
      } finally { if ($key) { $key.Close() } }
    `, { exePath });
    if (!result.success) throw new Error(result.output || 'Windows no pudo leer la preferencia GPU.');
    const snapshot = JSON.parse(result.output);
    if (!validSnapshot(snapshot)) throw new Error('Windows devolvió una preferencia GPU no válida.');
    return snapshot;
  }
  async write(exePath, snapshot, requireExecutable = false) {
    if (!validSnapshot(snapshot)) throw new Error('El respaldo de GPU no es válido.');
    const result = await this.execute(`
      if ($data.requireExecutable -and -not (Test-Path -LiteralPath $data.exePath -PathType Leaf)) { throw 'La aplicación ya no existe en la ruta seleccionada.' }
      $relative = 'Software\\Microsoft\\DirectX\\UserGpuPreferences'
      if ($data.snapshot.exists) {
        $key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($relative)
        try {
          $kind = [Enum]::Parse([Microsoft.Win32.RegistryValueKind], [string]$data.snapshot.kind)
          $key.SetValue([string]$data.exePath, [string]$data.snapshot.value, $kind)
        } finally { $key.Close() }
      } else {
        $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($relative, $true)
        try { if ($key) { $key.DeleteValue([string]$data.exePath, $false) } }
        finally { if ($key) { $key.Close() } }
      }
      'OK'
    `, { exePath, snapshot, requireExecutable });
    if (!result.success) throw new Error(result.output || 'Windows no confirmó la preferencia GPU.');
  }
}

class DesignGpuManager {
  constructor({ file, adapter = new PowerShellGpuAdapter() }) { this.file = file; this.adapter = adapter; this.busy = false; }
  readStore() {
    let state;
    try {
      if (fs.statSync(this.file).size > 8 * 1024 * 1024) throw new Error('El respaldo GPU supera el límite permitido.');
      state = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch (error) { if (error.code === 'ENOENT') return { schema: 1, records: {} }; throw error; }
    if (!state || state.schema !== 1 || !state.records || typeof state.records !== 'object' || Array.isArray(state.records) || Object.keys(state.records).length > 10000) throw new Error('El archivo de respaldos GPU no es válido. No se modificó Windows.');
    for (const [id, record] of Object.entries(state.records)) {
      if (!record || keyFor(record.exePath) !== id || !validSnapshot(record.before) || !validSnapshot(record.after) || !['prepared','applied','failed','reverted'].includes(record.status) || typeof record.at !== 'string' || !Number.isFinite(Date.parse(record.at))) throw new Error('Hay un respaldo GPU no válido. Conserva el archivo para revisarlo.');
      if (!same(record.after, desiredValue(record.before))) throw new Error('Un respaldo GPU no coincide con el cambio permitido.');
    }
    return state;
  }
  save(state) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = this.file + '.' + randomUUID() + '.tmp'; let fd;
    try {
      fd = fs.openSync(temporary, 'wx', process.platform === 'win32' ? 0o666 : 0o600);
      fs.writeFileSync(fd, JSON.stringify(state, null, 2), 'utf8'); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
      fs.renameSync(temporary, this.file);
    } finally { if (fd !== undefined) fs.closeSync(fd); if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  status(exePath) {
    const record = this.readStore().records[keyFor(exePath)];
    return { hasBackup: Boolean(record && record.status !== 'reverted'), status: record?.status || null };
  }
  async exclusive(action) {
    if (this.busy) throw new Error('Ya hay una operación de GPU en curso. Espera a que termine.');
    this.busy = true; try { return await action(); } finally { this.busy = false; }
  }
  async assign(value) {
    return this.exclusive(async () => {
      const exePath = validateExePath(value), id = keyFor(exePath), state = this.readStore();
      const current = await this.adapter.read(exePath);
      if (!validSnapshot(current)) throw new Error('No se pudo respaldar la preferencia GPU actual.');
      let record = state.records[id];
      if (record && record.status !== 'reverted') {
        if (same(current, record.after)) return { success: true, skipped: true, hasBackup: true, message: 'La preferencia de alto rendimiento ya está aplicada y conserva su respaldo original.' };
        if (!same(current, record.before)) throw new Error('Otra aplicación cambió la preferencia GPU. No se sobrescribió; conserva el respaldo para revisar el conflicto.');
      } else {
        const after = desiredValue(current);
        if (same(current, after)) return { success: true, skipped: true, hasBackup: false, message: 'La preferencia ya estaba configurada. Apex no la adoptó como un cambio propio.' };
        record = { exePath, before: current, after, at: new Date().toISOString(), status: 'prepared' };
        state.records[id] = record;
      }
      record.status = 'prepared'; this.save(state);
      try {
        if (!same(await this.adapter.read(exePath), current)) throw new Error('La preferencia cambió mientras se preparaba el respaldo. No se sobrescribió.');
        await this.adapter.write(exePath, record.after, true);
        if (!same(await this.adapter.read(exePath), record.after)) throw new Error('Windows no confirmó la preferencia GPU. El respaldo se conserva para revisar o restaurar.');
        record.status = 'applied'; delete record.error; this.save(state);
        return { success: true, hasBackup: true, message: 'Preferencia GPU guardada y verificada. Puedes restaurar su valor original; la aplicación decide cómo utilizar la GPU.' };
      } catch (error) {
        record.status = 'failed'; record.error = error.message;
        try { this.save(state); } catch { /* A prepared record already contains the original value. */ }
        throw error;
      }
    });
  }
  async restore(value) {
    return this.exclusive(async () => {
      const exePath = validateExePath(value), id = keyFor(exePath), state = this.readStore(), record = state.records[id];
      if (!record || record.status === 'reverted') throw new Error('No hay un respaldo activo de GPU para esta aplicación.');
      const current = await this.adapter.read(record.exePath);
      if (!same(current, record.before)) {
        if (!same(current, record.after)) throw new Error('La preferencia GPU cambió fuera de Apex. La restauración se detuvo para no sobrescribir ese cambio.');
        await this.adapter.write(record.exePath, record.before, false);
      }
      if (!same(await this.adapter.read(record.exePath), record.before)) throw new Error('No se pudo verificar la restauración GPU. El respaldo sigue disponible.');
      record.status = 'reverted'; record.revertedAt = new Date().toISOString(); delete record.error; this.save(state);
      return { success: true, hasBackup: false, message: 'Se restauró y verificó la preferencia GPU original de esta aplicación.' };
    });
  }
}

let manager;
function getManager() {
  if (!manager) {
    const app = require('electron').app;
    if (!app?.getPath) throw new Error('Las preferencias GPU solo se modifican desde Apex.');
    manager = new DesignGpuManager({ file: path.join(app.getPath('userData'), 'design-gpu-backups-v1.json') });
  }
  return manager;
}
async function assign(exePath) { try { return await getManager().assign(exePath); } catch (error) { return { success: false, message: error.message }; } }
async function restore(exePath) { try { return await getManager().restore(exePath); } catch (error) { return { success: false, message: error.message }; } }
function status(exePath) { try { return { success: true, ...getManager().status(exePath) }; } catch (error) { return { success: false, hasBackup: false, message: error.message }; } }
module.exports = { DesignGpuManager, PowerShellGpuAdapter, validateExePath, keyFor, validSnapshot, same, desiredValue, assign, restore, status };
