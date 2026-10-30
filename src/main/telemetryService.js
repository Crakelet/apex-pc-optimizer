'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { telemetry } = require('./diagnostics');
const { runPowerShell } = require('./powerShell');
let gpuHistory = [], ascensionBusy = false;
function dataDirectory() { try { const { app } = require('electron'); if (app?.getPath) return app.getPath('userData'); } catch {} return path.join(os.homedir(), '.apex-pc-optimizer'); }
function stateFile() { return path.join(dataDirectory(), 'ascension-priority-backup-v1.json'); }
function readState() {
  try {
    const state = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    if (!state || state.schema !== 1 || typeof state.active !== 'boolean' || !Array.isArray(state.processes) || state.processes.length > 1000 || state.processes.some(p => !p || !Number.isInteger(p.id) || p.id <= 0 || p.id > 2147483647 || typeof p.started !== 'string' || !/^\d{1,20}$/.test(p.started) || !['Idle','BelowNormal','Normal','AboveNormal','High','RealTime'].includes(p.priority))) throw new Error('El respaldo de prioridades no es válido.');
    return state;
  } catch (error) { if (error.code === 'ENOENT') return { schema: 1, processes: [], active: false }; throw error; }
}
function saveState(state) {
  fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
  const temporary = stateFile() + '.tmp'; fs.writeFileSync(temporary, JSON.stringify(state, null, 2)); fs.renameSync(temporary, stateFile());
}
async function getRealtimeTelemetry() {
  const data = await telemetry();
  let ascensionActive = false, ascensionError = null;
  try { ascensionActive = await getAscensionStatus(); } catch (error) { ascensionError = error.message; }
  if (Number.isFinite(data.gpu?.temp)) { gpuHistory.push(data.gpu.temp); gpuHistory = gpuHistory.slice(-25); }
  return {
    cpu: { percent: data.cpu.percent, temp: null, history: [], temperatureAvailable: false },
    gpu: { percent: data.gpu?.percent ?? null, temp: data.gpu?.temp ?? null, history: [...gpuHistory], available: data.gpu !== null },
    ram: { percent: data.ram.percent, usedGB: (data.ram.used / 1024 ** 3).toFixed(1), totalGB: (data.ram.total / 1024 ** 3).toFixed(1) },
    disk: data.disk ? { percent: data.disk.percent, usedGB: ((data.disk.total - data.disk.free) / 1024 ** 3).toFixed(0), totalGB: (data.disk.total / 1024 ** 3).toFixed(0), available: true } : { percent: null, usedGB: null, totalGB: null, available: false },
    ascensionActive, ascensionError, measuredAt: data.at
  };
}
async function getAscensionStatus() {
  const state = readState();
  if (!state.active || !state.processes.length) return false;
  try {
    const result = await runPowerShell([
      '$active = 0',
      'foreach ($item in $data.processes) {',
      '$p = Get-Process -Id ([int]$item.id) -ErrorAction SilentlyContinue',
      'if ($p) { try { if ($p.StartTime.ToUniversalTime().Ticks.ToString() -eq $item.started -and $p.PriorityClass.ToString() -eq "Idle") { $active++ } } catch {} }',
      '}',
      '@{ active = ($active -gt 0) } | ConvertTo-Json -Compress'
    ].join('\n'), { processes: state.processes });
    return result.active === true;
  } catch { return false; }
}
async function toggleWindowsAscension(enable) {
  if (typeof enable !== 'boolean') return { success: false, active: false, message: 'Estado de activación no válido.' };
  if (ascensionBusy) return { success: false, active: false, message: 'Ya hay un cambio de prioridades en curso.' };
  ascensionBusy = true;
  try {
    let state = readState();
    if (enable) {
      if (state.active) return { success: true, active: await getAscensionStatus(), message: 'Hay prioridades guardadas. Desactiva el modo antes de volver a activarlo.' };
      const captured = await runPowerShell([
        '$items = @()',
        '$sessionId = (Get-Process -Id $PID).SessionId',
        'foreach ($p in @(Get-Process | Where-Object { $_.SessionId -eq $sessionId -and $_.ProcessName -match "^(SearchIndexer|OneDrive|Teams|Dropbox|MicrosoftEdgeUpdate|GoogleUpdate)$" })) {',
        'try { $items += @{ id = [int]$p.Id; started = $p.StartTime.ToUniversalTime().Ticks.ToString(); priority = $p.PriorityClass.ToString() } } catch {}',
        '}',
        '@{ processes = $items } | ConvertTo-Json -Depth 4 -Compress'
      ].join('\n'));
      state = { schema: 1, at: new Date().toISOString(), active: true, processes: captured.processes || [] };
      saveState(state); // Save exact priorities and process start times before modification.
    }
    if (!state.processes.length) { state.active = false; saveState(state); return { success: true, active: false, message: 'No hay procesos de fondo coincidentes para modificar.' }; }
    const result = await runPowerShell([
      '$results = @()',
      'foreach ($item in $data.processes) {',
      '$p = Get-Process -Id ([int]$item.id) -ErrorAction SilentlyContinue',
      'if (-not $p) { $results += @{ id = $item.id; success = $true; skipped = $true }; continue }',
      'try {',
      'if ($p.StartTime.ToUniversalTime().Ticks.ToString() -ne $item.started) { $results += @{ id = $item.id; success = $true; skipped = $true }; continue }',
      'if ($data.enable) {',
      'if ($p.PriorityClass.ToString() -ne $item.priority) { throw "La prioridad cambió después del respaldo; no se sobrescribió." }',
      '$wanted = "Idle"',
      '} else {',
      'if ($p.PriorityClass.ToString() -ne "Idle" -and $p.PriorityClass.ToString() -ne $item.priority) { throw "La prioridad cambió externamente; no se sobrescribió." }',
      '$wanted = [string]$item.priority',
      '}',
      '$p.PriorityClass = [Enum]::Parse([System.Diagnostics.ProcessPriorityClass], $wanted)',
      '$p.Refresh()',
      '$results += @{ id = $item.id; success = ($p.PriorityClass.ToString() -eq $wanted); skipped = $false }',
      '} catch { $results += @{ id = $item.id; success = $false; error = $_.Exception.Message } }',
      '}',
      '@{ results = $results } | ConvertTo-Json -Depth 5 -Compress'
    ].join('\n'), { enable, processes: state.processes });
    const failed = result.results.filter(item => !item.success);
    if (!enable && !failed.length) { state.active = false; state.processes = []; saveState(state); }
    return { success: failed.length === 0, active: await getAscensionStatus(), results: result.results, message: failed.length ? 'Algunas prioridades no pudieron modificarse o restaurarse. Se conservaron sus respaldos.' : enable ? 'Prioridades de procesos de fondo ajustadas y verificadas. No se modificó el arranque ni la resolución de temporizadores.' : 'Prioridades originales restauradas en los procesos que siguen activos.' };
  } catch (error) { return { success: false, active: false, message: error.message }; } finally { ascensionBusy = false; }
}
async function shutdownSession() {
  try {
    const state = readState();
    if (!state.active) return { success: true, active: false, skipped: true, message: 'No hay prioridades de sesión pendientes.' };
    return await toggleWindowsAscension(false);
  } catch (error) { return { success: false, active: false, message: error.message }; }
}
module.exports = { getRealtimeTelemetry, toggleWindowsAscension, getAscensionStatus, shutdownSession };
