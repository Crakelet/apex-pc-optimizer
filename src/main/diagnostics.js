'use strict';
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { runPowerShell } = require('./powerShell');
let previousCpu = null, gpuCache = null, gpuAt = 0, gpuPending = null;
function cpuUsage() {
  const sum = os.cpus().reduce((a, cpu) => { a.idle += cpu.times.idle; a.total += Object.values(cpu.times).reduce((n, value) => n + value, 0); return a; }, { idle: 0, total: 0 });
  const old = previousCpu; previousCpu = sum;
  return old && sum.total > old.total ? Math.round(100 * (1 - (sum.idle - old.idle) / (sum.total - old.total))) : null;
}
async function gpuTelemetry() {
  if (gpuAt && Date.now() - gpuAt < 10000) return gpuCache;
  if (gpuPending) return gpuPending;
  gpuPending = new Promise(resolve => {
    const executable = [path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'nvidia-smi.exe'), path.join(process.env.ProgramW6432 || 'C:\\Program Files', 'NVIDIA Corporation', 'NVSMI', 'nvidia-smi.exe')].find(file => fs.existsSync(file));
    if (!executable) return resolve(null);
    execFile(executable, ['--query-gpu=name,utilization.gpu,temperature.gpu', '--format=csv,noheader,nounits'], { windowsHide: true, timeout: 2500, maxBuffer: 65536 }, (error, stdout) => {
      if (error) return resolve(null);
      const parts = stdout.trim().split(/\r?\n/)[0]?.split(',').map(part => part.trim());
      const usage = Number(parts?.[1]), temp = Number(parts?.[2]);
      resolve(parts?.length === 3 ? { name: parts[0], percent: Number.isFinite(usage) && usage >= 0 && usage <= 100 ? usage : null, temp: Number.isFinite(temp) && temp >= 0 && temp < 150 ? temp : null } : null);
    });
  });
  try { gpuCache = await gpuPending; gpuAt = Date.now(); return gpuCache; } finally { gpuPending = null; }
}
async function telemetry() {
  const total = os.totalmem(), used = total - os.freemem();
  let disk = null;
  try {
    const drive = /^[a-z]:$/i.test(process.env.SystemDrive || '') ? process.env.SystemDrive : 'C:';
    const data = fs.statfsSync(`${drive}\\`), size = data.bsize * data.blocks, free = data.bsize * data.bavail;
    if (size > 0) disk = { drive, total: size, free, percent: Math.round((1 - free / size) * 100) };
  } catch { /* Unavailable is not zero or an invented fallback. */ }
  return { at: new Date().toISOString(), cpu: { percent: cpuUsage(), temp: null }, ram: { total, used, percent: Math.round(used / total * 100) }, disk, gpu: await gpuTelemetry() };
}
async function systemInfo() {
  const basic = { cpu: os.cpus()[0]?.model || 'No disponible', threads: os.cpus().length, memory: os.totalmem(), os: `Windows ${os.release()}`, gpu: null, driver: null, board: null, error: null };
  try {
    const data = await runPowerShell(`
      $gpu = Get-CimInstance Win32_VideoController | Select-Object -First 1 Name, DriverVersion
      $board = Get-CimInstance Win32_BaseBoard | Select-Object -First 1 Manufacturer, Product
      $windows = Get-CimInstance Win32_OperatingSystem | Select-Object -First 1 Caption, BuildNumber
      @{ gpu = $gpu.Name; driver = $gpu.DriverVersion; board = "$($board.Manufacturer) $($board.Product)"; os = "$($windows.Caption) (compilación $($windows.BuildNumber))" } | ConvertTo-Json -Compress
    `);
    if (data) return { ...basic, ...data };
  } catch (error) { basic.error = error.message; }
  return basic;
}
async function startupPrograms() {
  const data = await runPowerShell(`
    @(Get-CimInstance Win32_StartupCommand | Select-Object Name, Command, Location, User) | ConvertTo-Json -Compress
  `);
  return (Array.isArray(data) ? data : data ? [data] : []).map(item => ({ name: item.Name, command: item.Command, location: item.Location }));
}
module.exports = { telemetry, systemInfo, startupPrograms, cpuUsage };
