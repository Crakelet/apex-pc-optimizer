'use strict';
const { execFile, execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const {windowsPowerShellExecutable,windowsPowerShellEnvironment}=require('./windowsEnvironment');
const {powerShellArguments}=require('./powerShellTransport');

function checkIsAdmin() {
  try {
    execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'fltmc.exe'), [], { stdio: 'ignore', windowsHide: true, timeout: 3000 });
    return true;
  } catch { return false; }
}
function cleanClixml(text) {
  const source=String(text||'').trim();
  if(!source.startsWith('#< CLIXML'))return source;
  const errors=[...source.matchAll(/<S\b[^>]*\bS="Error"[^>]*>([\s\S]*?)<\/S>/gi)].map(match=>match[1]
    .replace(/<[^>]*>/g,'')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&')
    .replace(/_x([a-f0-9]{4})_/gi,(_match,hex)=>String.fromCharCode(parseInt(hex,16))).trim()).filter(Boolean);
  const plain=source.replace(/<Objs\b[\s\S]*?<\/Objs>/gi,'').replace(/#< CLIXML/g,'').trim();
  return [plain,...errors].filter(Boolean).join('\n');
}
const REGISTRY_HELPER = `
function New-ApexRegistryKey {
  param([Parameter(Mandatory=$true)][string]$Path, [switch]$Force)
  $normalized = $Path -replace '\\\\+', '\\'
  if ($normalized.StartsWith('HKCU:\\', [StringComparison]::OrdinalIgnoreCase)) { $base = [Microsoft.Win32.Registry]::CurrentUser }
  elseif ($normalized.StartsWith('HKLM:\\', [StringComparison]::OrdinalIgnoreCase)) { $base = [Microsoft.Win32.Registry]::LocalMachine }
  else { throw 'Ruta de registro no admitida.' }
  $key = $base.CreateSubKey($normalized.Substring(6))
  if ($key) { $key.Close() }
}
`;
function normalizeRegistryCreation(command) {
  const variables = new Set([...command.matchAll(/\$([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*["']HK(?:CU|LM):/g)].map(match => match[1].toLowerCase()));
  return command.replace(/\bNew-Item(?=\s+-Path\s+(["']HK(?:CU|LM):|\$([a-zA-Z_][a-zA-Z0-9_]*)))/g, (match, target, variable) => !variable || variables.has(variable.toLowerCase()) ? 'New-ApexRegistryKey' : match);
}
function runPowerShell(command, input = {}, options = {}) {
  if (typeof command !== 'string' || command.length > 256000) return Promise.resolve({ success: false, output: 'El comando solicitado no es válido.' });
  const source = `$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$WarningPreference = 'SilentlyContinue'
$InformationPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$data = ConvertFrom-Json $env:APEX_INPUT
$global:LASTEXITCODE = 0
${REGISTRY_HELPER}
try {
${normalizeRegistryCreation(command)}
if ($LASTEXITCODE -ne 0) { throw 'Una herramienta de Windows devolvió un error. No se confirmó la operación.' }
} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }
`;
  return new Promise(resolve => {
    const executable = windowsPowerShellExecutable();
    const child = execFile(executable, powerShellArguments(), { windowsHide: true, timeout: options.timeout || 45000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8', env: windowsPowerShellEnvironment({APEX_INPUT:JSON.stringify(input)}) }, (error, stdout, stderr) => {
      const output = cleanClixml(stdout), failure = cleanClixml(stderr);
      if (error || failure) {
        const first = failure.split(/\r?\n/).find(line => line.trim()) || (error?.killed ? 'La operación superó el tiempo de espera. Revisa su estado antes de volver a intentarla.' : 'Windows no pudo completar la operación.');
        return resolve({ success: false, output: first, code: error?.code || null });
      }
      resolve({ success: true, output });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(source, 'utf8');
  });
}
async function restartAsAdmin() {
  let app;
  try { app = require('electron').app; } catch {}
  if (!app) return { success: false, error: 'La elevación solo está disponible desde la aplicación.' };
  if (checkIsAdmin()) return { success: true, alreadyAdmin: true };
  const args = app.isPackaged ? [] : [app.getAppPath()];
  for (const flag of ['--test-mode','--smoke-test']) if (process.argv.includes(flag)) args.push(flag);
  // All strings travel as JSON data. No renderer value becomes PowerShell code.
  app.releaseSingleInstanceLock();
  const result = await runPowerShell(`
    $quoted = @($data.args | ForEach-Object { '"' + $_.Replace('"', '\\"') + '"' }) -join ' '
    $launch = @{ FilePath = $data.executable; WorkingDirectory = $data.directory; Verb = 'RunAs'; ErrorAction = 'Stop' }
    if (@($data.args).Count -gt 0) { $launch.ArgumentList = $quoted }
    Start-Process @launch | Out-Null
    'OK'
  `, { executable: process.execPath, directory: app.isPackaged ? path.dirname(process.execPath) : app.getAppPath(), args });
  if (!result.success) {
    app.requestSingleInstanceLock();
    return { success: false, cancelled: /cancel|1223/i.test(result.output), error: result.output };
  }
  setTimeout(() => app.quit(), 300);
  return { success: true };
}
async function getSystemSpecs() {
  const total = os.totalmem(), used = total - os.freemem();
  const basic = { cpu: os.cpus()[0]?.model || 'No disponible', cpuCores: `${os.cpus().length} hilos`, gpu: 'No disponible', os: `Windows ${os.release()}`, osVersion: '', totalRamGB: Math.round(total / 1024 ** 3), usedRamGB: Math.round(used / 1024 ** 3), ramPercent: Math.round(used / total * 100) };
  const result = await runPowerShell(`
    $gpu = @(Get-CimInstance Win32_VideoController -ErrorAction Stop | Select-Object -ExpandProperty Name)
    $windows = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
    @{ gpu = ($gpu -join ', '); os = $windows.Caption; osVersion = $windows.BuildNumber } | ConvertTo-Json -Compress
  `);
  if (!result.success) return { ...basic, partial: true };
  try { return { ...basic, ...JSON.parse(result.output) }; } catch { return { ...basic, partial: true }; }
}
module.exports = { getSystemSpecs, runPowerShell, checkIsAdmin, restartAsAdmin, cleanClixml, normalizeRegistryCreation };
