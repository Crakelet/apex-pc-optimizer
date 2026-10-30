'use strict';
const os = require('node:os');
const { runPowerShell } = require('./powerShell');
let autoCleanConfig = { enabled: false, thresholdPercent: 85, intervalSeconds: 60, lastCleaned: null, lastError: null };
let autoCleanInterval = null, busy = false, autoCleanGeneration = 0, activeMemoryAction = null;
const MEMORY_NATIVE = [
  'Add-Type -TypeDefinition @"',
  'using System;',
  'using System.Runtime.InteropServices;',
  'public static class ApexMemoryNative {',
  '[DllImport("ntdll.dll")] public static extern uint NtSetSystemInformation(int cls, IntPtr data, int length);',
  '[DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr OpenProcess(uint access, bool inherit, int pid);',
  '[DllImport("psapi.dll", SetLastError=true)] public static extern bool EmptyWorkingSet(IntPtr process);',
  '[DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);',
  'public static uint Purge(int command) { IntPtr p=Marshal.AllocHGlobal(4); try { Marshal.WriteInt32(p, command); return NtSetSystemInformation(80,p,4); } finally { Marshal.FreeHGlobal(p); } }',
  'public static bool Trim(int pid) { IntPtr h=OpenProcess(0x0500,false,pid); if(h==IntPtr.Zero) return false; try{return EmptyWorkingSet(h);}finally{CloseHandle(h);} }',
  '}',
  '"@ -ErrorAction Stop'
].join('\n');
function getAutoCleanConfig() { return { ...autoCleanConfig }; }
function setAutoCleanConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Configuración de limpieza automática no válida.');
  if ('enabled' in config && typeof config.enabled !== 'boolean') throw new Error('La activación debe ser verdadera o falsa.');
  if ('thresholdPercent' in config && (!Number.isFinite(config.thresholdPercent) || config.thresholdPercent < 50 || config.thresholdPercent > 98)) throw new Error('El umbral debe estar entre 50 y 98 %.');
  if ('intervalSeconds' in config && (!Number.isInteger(config.intervalSeconds) || config.intervalSeconds < 30 || config.intervalSeconds > 3600)) throw new Error('El intervalo debe estar entre 30 y 3600 segundos.');
  for (const key of ['enabled', 'thresholdPercent', 'intervalSeconds']) if (key in config) autoCleanConfig[key] = config[key];
  const generation = ++autoCleanGeneration;
  if (autoCleanInterval) { clearInterval(autoCleanInterval); autoCleanInterval = null; }
  if (autoCleanConfig.enabled) {
    autoCleanInterval = setInterval(async () => {
      if (!autoCleanConfig.enabled || generation !== autoCleanGeneration || busy || (1 - os.freemem() / os.totalmem()) * 100 < autoCleanConfig.thresholdPercent) return;
      const result = await cleanAllMemory();
      if (result.success) { autoCleanConfig.lastCleaned = new Date().toLocaleTimeString(); autoCleanConfig.lastError = null; }
      else autoCleanConfig.lastError = result.message;
    }, autoCleanConfig.intervalSeconds * 1000);
    autoCleanInterval.unref?.();
  }
  return getAutoCleanConfig();
}
async function getMemoryStats() {
  const totalMB = Math.round(os.totalmem() / 1024 ** 2), freeMB = Math.round(os.freemem() / 1024 ** 2), usedMB = Math.max(0, totalMB - freeMB);
  let topProcesses = [], standbyEstimateMB = null, processReadError = null;
  try {
    const data = await runPowerShell([
      '$processes = @(Get-Process | Where-Object WorkingSet64 -gt 25MB | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 Name, Id, @{Name="WorkingSetMB"; Expression={[math]::Round($_.WorkingSet64 / 1MB, 1)}})',
      '$standby = $null',
      'try { $memory = Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory; if ($null -ne $memory.StandbyCacheCoreBytes -and $null -ne $memory.StandbyCacheNormalPriorityBytes -and $null -ne $memory.StandbyCacheReserveBytes) { $standby = [math]::Round(($memory.StandbyCacheCoreBytes + $memory.StandbyCacheNormalPriorityBytes + $memory.StandbyCacheReserveBytes) / 1MB) } } catch {}',
      '@{ processes = $processes; standbyMB = $standby } | ConvertTo-Json -Depth 4 -Compress'
    ].join('\n'));
    topProcesses = data.processes || []; standbyEstimateMB = Number.isFinite(data.standbyMB) ? data.standbyMB : null;
  } catch (error) { processReadError = error.message; }
  return { totalMB, freeMB, usedMB, usedPercent: Math.min(100, Math.round(usedMB / totalMB * 100)), standbyEstimateMB, standbyAvailable: standbyEstimateMB !== null, topProcesses, processReadError, autoClean: getAutoCleanConfig() };
}
async function executeMemoryAction(script, label) {
  const before = os.freemem();
  const details = await runPowerShell(MEMORY_NATIVE + '\n' + script);
  const observedDeltaMB = Math.round((os.freemem() - before) / 1024 ** 2);
  return { success: true, freedMB: Math.max(0, observedDeltaMB), observedDeltaMB, ...details, message: label + '. Variación observada de memoria disponible: ' + observedDeltaMB + ' MB; otras aplicaciones también influyen en esta lectura.' };
}
async function exclusive(action) {
  if (busy) return { success: false, freedMB: 0, message: 'Ya hay una operación de memoria en curso.' };
  busy = true;
  let release;
  activeMemoryAction = new Promise(resolve => { release = resolve; });
  try { return await action(); } catch (error) { return { success: false, freedMB: 0, message: error.message }; }
  finally { busy = false; activeMemoryAction = null; release(); }
}
function rawStandby() { return executeMemoryAction('$status = [ApexMemoryNative]::Purge(4)\nif ($status -ne 0) { throw ("Windows rechazó el vaciado de Standby (NTSTATUS 0x{0:X8}). Puede requerir permisos adicionales." -f $status) }\n@{ nativeStatus = $status } | ConvertTo-Json -Compress', 'Solicitud de vaciado de caché Standby completada'); }
function rawModified() { return executeMemoryAction('$status = [ApexMemoryNative]::Purge(3)\nif ($status -ne 0) { throw ("Windows rechazó el volcado de páginas modificadas (NTSTATUS 0x{0:X8})." -f $status) }\n@{ nativeStatus = $status } | ConvertTo-Json -Compress', 'Solicitud de volcado de páginas modificadas completada'); }
// Keep the native input separate from script text.
async function rawTrimWithInput(pid = null) {
  if (pid !== null && (!Number.isInteger(pid) || pid <= 0 || pid > 4294967295 || pid === process.pid)) throw new Error('Identificador de proceso no válido.');
  const before = os.freemem();
  const details = await runPowerShell(MEMORY_NATIVE + '\n' + [
    '$count = 0; $skipped = 0',
    '$sessionId = (Get-Process -Id $PID).SessionId',
    '$targets = if ($data.pid) { @(Get-Process -Id ([int]$data.pid)) } else { @(Get-Process | Where-Object { $_.SessionId -eq $sessionId -and $_.WorkingSet64 -gt 30MB }) }',
    'foreach ($p in $targets) {',
    'if ($p.Id -eq $PID -or $p.ProcessName -match "^(System|Idle|csrss|lsass|wininit|winlogon|services|smss|Registry|Memory Compression|electron|Apex PC Optimizer)$") { $skipped++; continue }',
    'if ([ApexMemoryNative]::Trim($p.Id)) { $count++ } else { $skipped++ }',
    '}',
    'if ($data.pid -and $count -eq 0) { throw "No se pudo reducir el conjunto de trabajo de este proceso; puede estar protegido o haber terminado." }',
    '@{ processesTrimmed = $count; processesSkipped = $skipped } | ConvertTo-Json -Compress'
  ].join('\n'), { pid });
  const observedDeltaMB = Math.round((os.freemem() - before) / 1024 ** 2);
  return { success: true, ...details, freedMB: Math.max(0, observedDeltaMB), observedDeltaMB, message: 'Procesos revisados: ' + details.processesTrimmed + ' modificados y ' + details.processesSkipped + ' omitidos. Variación disponible observada: ' + observedDeltaMB + ' MB. No garantiza mejor rendimiento.' };
}
function purgeStandbyList() { return exclusive(rawStandby); }
function trimWorkingSets() { return exclusive(() => rawTrimWithInput()); }
function flushModifiedPageList() { return exclusive(rawModified); }
function optimizeSingleProcess(pid) {
  if (!Number.isInteger(pid) || pid <= 0 || pid > 4294967295 || pid === process.pid) return Promise.resolve({ success: false, freedMB: 0, message: 'Identificador de proceso no válido.' });
  return exclusive(() => rawTrimWithInput(pid));
}
function cleanAllMemory() {
  return exclusive(async () => {
    const before = os.freemem(), results = [];
    for (const operation of [rawTrimWithInput, rawModified, rawStandby]) {
      try { results.push(await operation()); } catch (error) { results.push({ success: false, message: error.message }); }
    }
    const observedDeltaMB = Math.round((os.freemem() - before) / 1024 ** 2), failed = results.filter(item => !item.success).length;
    return { success: failed === 0, partial: failed > 0 && failed < results.length, freedMB: Math.max(0, observedDeltaMB), observedDeltaMB, results, message: failed ? 'La limpieza terminó con ' + failed + ' operaciones no completadas. Revisa sus resultados.' : 'Solicitudes de memoria completadas. Variación disponible observada: ' + observedDeltaMB + ' MB; puede variar por actividad de otras aplicaciones.' };
  });
}
async function shutdownSession() {
  setAutoCleanConfig({ enabled: false });
  if (activeMemoryAction) await activeMemoryAction;
  return { success: true, autoCleanDisabled: true };
}
module.exports = { getMemoryStats, purgeStandbyList, trimWorkingSets, flushModifiedPageList, cleanAllMemory, optimizeSingleProcess, getAutoCleanConfig, setAutoCleanConfig, shutdownSession };
