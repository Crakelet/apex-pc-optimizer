'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { TWEAKS_DATA } = require('./tweaksData');
const { runPowerShell } = require('./systemInfo');
const { RestorationManager, userDataPath, atomicWrite } = require('./restorationStore');
const { getResources, getResourcesForRestore } = require('./restorationResources');
const { CLEANUP_SCRIPT } = require('./safeCleanup');

function cleanScript(id) {
  const bodies = {
    clean_shader_cache: `$removed = 0L
foreach ($root in @((Join-Path $env:LOCALAPPDATA 'D3DSCache'), (Join-Path $env:LOCALAPPDATA 'NVIDIA\\DXCache'), (Join-Path $env:LOCALAPPDATA 'NVIDIA\\GLCache'), (Join-Path $env:LOCALAPPDATA 'AMD\\DxCache'))) { $removed += Remove-ApexCache -Root $root }`,
    clean_temp_files: '$removed = Remove-ApexCache -Root $env:TEMP',
    clean_windows_temp: `$removed = Remove-ApexCache -Root (Join-Path $env:SystemRoot 'Temp')`,
    clean_thumbnail_cache: `$removed = Remove-ApexCache -Root (Join-Path $env:LOCALAPPDATA 'Microsoft\\Windows\\Explorer') -Filter 'thumbcache_*.db'`,
    clean_software_distribution: `$removed = 0L
$update = Get-Service -Name wuauserv
$stopped = $false
try {
  if ($update.Status -eq 'Running') { Stop-Service -Name wuauserv -ErrorAction Stop; $stopped = $true }
  $removed = Remove-ApexCache -Root (Join-Path $env:SystemRoot 'SoftwareDistribution\\Download')
} finally { if ($stopped) { Start-Service -Name wuauserv -ErrorAction Stop } }`
  };
  if (!bodies[id]) throw new Error('Limpieza no reconocida.');
  return `${CLEANUP_SCRIPT}\n${bodies[id]}\n@{ freedBytes = [long]$removed; freedMB = [math]::Round($removed / 1MB, 2) } | ConvertTo-Json -Compress`;
}
class OptimizerEngine {
  constructor(options = {}) {
    this.runner = options.runner || runPowerShell;
    this.directory = options.userDataPath || userDataPath();
    this.stateFile = path.join(this.directory, 'tweaks-state-v1.json');
    this.restoration = options.restoration || new RestorationManager({ file: path.join(this.directory, 'restoration-v1.json'), runner: this.runner });
    this.state = this.loadState(); this.busy = false;
  }
  loadState() {
    try {
      const state = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      if (!state || !state.appliedTweaks || typeof state.appliedTweaks !== 'object' || Array.isArray(state.appliedTweaks) || Object.values(state.appliedTweaks).some(value => typeof value !== 'boolean')) throw new Error('Estado de preferencias no válido.');
      this.stateWarning = null;
      return state;
    } catch (error) {
      this.stateWarning = error.code === 'ENOENT' ? null : 'No se pudo leer el estado auxiliar de preferencias. Se conserva el archivo original; los respaldos de restauración se comprueban por separado.';
      return { appliedTweaks: {}, activeProfile: null, lastUpdated: null };
    }
  }
  saveState() {
    // This file is optional UI metadata. A damaged copy must not block launch,
    // replace the restoration history, or be silently overwritten after a real change.
    if (this.stateWarning) return false;
    this.state.lastUpdated = new Date().toISOString();
    try { atomicWrite(this.stateFile, this.state); return true; }
    catch { this.stateWarning = 'El cambio se verificó y conserva su respaldo, pero no se pudo guardar el estado auxiliar de preferencias.'; return false; }
  }
  getTweak(id) { return TWEAKS_DATA.find(tweak => tweak.id === id); }
  async createRestorePoint(description = 'ApexOptimizer_AutoBackup') {
    if (typeof description !== 'string' || !description.trim() || description.length > 100) return { success: false, message: 'La descripción debe tener entre 1 y 100 caracteres.' };
    const result = await this.runner(`
$previous = @(Get-ComputerRestorePoint -ErrorAction Stop | Select-Object -ExpandProperty SequenceNumber)
$lastSequence = if ($previous.Count) { ($previous | Measure-Object -Maximum).Maximum } else { -1 }
Checkpoint-Computer -Description $data.description -RestorePointType MODIFY_SETTINGS -ErrorAction Stop
$created = @(Get-ComputerRestorePoint -ErrorAction Stop | Where-Object { $_.SequenceNumber -gt $lastSequence -and $_.Description -eq $data.description } | Sort-Object SequenceNumber -Descending)
if (-not $created.Count) { throw 'Windows no confirmó un punto nuevo. Comprueba la protección del sistema y el límite de frecuencia de puntos de restauración.' }
@{ sequenceNumber = [long]$created[0].SequenceNumber } | ConvertTo-Json -Compress
`, { description },{timeout:180000});
    if(!result.success)return{success:false,message:result.output||'No se pudo crear el punto de restauración. Comprueba la protección del sistema y los permisos.'};
    try{const data=JSON.parse(result.output);if(!Number.isSafeInteger(data.sequenceNumber)||data.sequenceNumber<0)throw new Error();return{success:true,sequenceNumber:data.sequenceNumber,message:'Punto de restauración nuevo creado y confirmado por Windows.'};}
    catch{return{success:false,message:'No se pudo verificar que Windows creara un punto nuevo. No se confirmó la creación.'};}
  }
  async checkAllStatuses() {
    const blocks = TWEAKS_DATA.filter(tweak => tweak.category !== 'clean').map(tweak => `
try { $answer = & { ${tweak.checkScript} }; $statuses['${tweak.id}'] = (($answer | Out-String).Trim().ToLowerInvariant() -eq 'true') } catch { $statuses['${tweak.id}'] = $false }
$global:LASTEXITCODE = 0
`).join('\n');
    const result = await this.runner(`$statuses = @{}\n${blocks}\n$statuses | ConvertTo-Json -Compress`);
    const statuses = Object.fromEntries(TWEAKS_DATA.map(tweak => [tweak.id, false]));
    if (result.success) {
      try { const actual = JSON.parse(result.output); for (const id of Object.keys(statuses)) statuses[id] = actual[id] === true; } catch {}
    }
    // Observed Windows values are not ownership or backups; never persist them as such.
    return statuses;
  }
  async applyTweak(id) {
    const tweak = this.getTweak(id);
    if (!tweak) return { success: false, message: 'Ajuste no encontrado.' };
    if (this.busy) return { success: false, message: 'Espera a que termine la operación anterior.' };
    this.busy = true;
    try {
      if (tweak.category === 'clean') {
        const result = await this.runner(cleanScript(id));
        if (!result.success) return { success: false, message: result.output || 'No se pudo completar la limpieza.' };
        const counts = JSON.parse(result.output);
        return { success: true, reversible: false, ...counts, message: `Limpieza terminada: ${counts.freedMB} MB eliminados. Los archivos recientes, proyectos y recuperación se conservaron. Los archivos en uso pueden haberse omitido.` };
      }
      const result = await this.restoration.apply(`tweak:${id}`, getResources(id), tweak.applyScript, tweak.checkScript);
      if (result.success) { this.state = this.loadState(); this.state.appliedTweaks[id] = true; this.saveState(); }
      return { ...result, message: result.success ? `Ajuste aplicado y verificado: ${tweak.title}. Se guardó el estado original.` : result.message };
    } catch (error) { return { success: false, message: error.message }; }
    finally { this.busy = false; }
  }
  async revertTweak(id) {
    const tweak = this.getTweak(id);
    if (!tweak) return { success: false, message: 'Ajuste no encontrado.' };
    if (tweak.category === 'clean') return { success: false, message: 'La limpieza elimina archivos regenerables y no tiene reversión automática.' };
    if (this.busy) return { success: false, message: 'Espera a que termine la operación anterior.' };
    this.busy = true;
    try {
      const record = id === 'game_bar_presence' ? this.restoration.active(`tweak:${id}`) : null;
      const result = await this.restoration.revert(`tweak:${id}`, getResourcesForRestore(id, record));
      if (result.success) { this.state = this.loadState(); this.state.appliedTweaks[id] = false; this.saveState(); }
      return result;
    } catch (error) { return { success: false, message: error.message }; }
    finally { this.busy = false; }
  }
  async applyProfile(category) {
    if (!['gaming','network','design','services','privacy'].includes(category)) return { success: false, message: 'Perfil no reconocido.' };
    const results = [];
    for (const tweak of TWEAKS_DATA.filter(item => item.category === category)) {
      const result = await this.applyTweak(tweak.id);
      results.push({ id: tweak.id, title: tweak.title, ...result });
    }
    this.state = this.loadState(); this.state.activeProfile = category; this.saveState();
    const failed = results.filter(result => !result.success).length;
    return { success: failed === 0, partial: failed > 0 && failed < results.length, results, activeProfile: category, message: failed ? `${results.length - failed} ajustes verificados y ${failed} con incidencias. Revisa los resultados.` : 'Perfil aplicado y verificado.' };
  }
  async revertAll() {
    const records = this.restoration.read().entries.filter(entry => /^(tweak:|snappy:|audit:)/.test(entry.id) && ['prepared','applied','failed'].includes(entry.status));
    const results = [];
    for (const record of [...records].reverse()) {
      if (record.id.startsWith('tweak:')) {
        const id = record.id.slice(6), tweak = this.getTweak(id);
        if (!tweak || tweak.category === 'clean') continue;
        results.push({ id, title: tweak.title, ...await this.revertTweak(id) });
      } else {
        const id = record.id.slice(record.id.indexOf(':') + 1);
        // Only descriptors bundled with this application may authorize a restore.
        const allowed = record.id.startsWith('snappy:') ? id.startsWith('ui_') : ['audit_cpu_priority','audit_telemetry','audit_copilot_widgets','audit_ui_delay'].includes(id);
        if (!allowed) continue;
        try { results.push({ id, ...await this.restoration.revert(record.id, getResources(id)) }); }
        catch (error) { results.push({ id, success: false, message: error.message }); }
      }
    }
    this.state = this.loadState(); this.state.activeProfile = null; this.saveState();
    return { success: results.every(result => result.success), results, message: results.length ? 'Se revisaron únicamente los cambios respaldados por Apex.' : 'No hay cambios propios que restaurar. Windows no se modificó.' };
  }
}
module.exports = { OptimizerEngine, cleanScript };
