'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const files = [];
function walk(directory) { for (const item of fs.readdirSync(directory, { withFileTypes: true })) { const file = path.join(directory, item.name); if (item.isDirectory()) walk(file); else if (file.endsWith('.js')) files.push(file); } }
for (const directory of ['src', 'scripts', 'tests']) walk(directory);
for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
const source = fs.readdirSync('src/main').map(file => fs.readFileSync(path.join('src/main', file), 'utf8')).join('\n');
// The complete free suite has native tools; check their safeguards, not just their names.
// The user explicitly authorized this policy update for the restored suite.
for (const forbidden of ['no-sandbox', 'ExecutionPolicy Bypass', '-EncodedCommand', 'AmsiUtils', 'amsiInitFailed', 'Add-MpPreference', 'Set-MpPreference', 'estimatedCpuTemp', 'Math.sin(Date.now()']) {
  if (source.includes(forbidden)) throw new Error(`Comportamiento excluido de v1: ${forbidden}`);
}
const html = fs.readFileSync('src/renderer/index.html', 'utf8');
if (!html.includes('Content-Security-Policy') || /<script[^>]*>\s*[^<\s]/i.test(html) || /\son\w+=/i.test(html) || /<(?:script|link|img)[^>]+(?:src|href)=["']https?:/i.test(html)) throw new Error('La UI debe ser local y compatible con una CSP estricta.');
if (/(?:freed|freedMB|totalFreed)\s*=.*Math\.random\(/.test(source)) throw new Error('No se permiten mediciones de memoria inventadas.');
const { TWEAKS_DATA } = require('../src/main/tweaksData');
const { getResources } = require('../src/main/restorationResources');
for (const tweak of TWEAKS_DATA.filter(item => item.category !== 'clean')) {
  const resources = getResources(tweak.id);
  if (!tweak.free || !Object.values(resources).some(value => Array.isArray(value) ? value.length : Boolean(value))) throw new Error(`Falta acceso libre o respaldo: ${tweak.id}`);
  if (/\bbcdedit(?:\.exe)?\b/i.test(tweak.applyScript) && (!['hpet_timer','dynamic_tick','bcd_clean_timers'].includes(tweak.id) || tweak.risk !== 'Avanzado' || !resources.bcd.length)) throw new Error(`Cambio de arranque sin clasificación y respaldo explícitos: ${tweak.id}`);
}
const cleanup = fs.readFileSync('src/main/safeCleanup.js', 'utf8');
for (const required of ['ReparsePoint','AutoRecover','BlenderAutosaves','Projects','LastWriteTime','-ErrorAction Stop']) if (!cleanup.includes(required)) throw new Error(`Falta protección del limpiador: ${required}`);
const memory = fs.readFileSync('src/main/memoryCleanerService.js', 'utf8');
for (const required of ['Number.isInteger(pid)','CloseHandle(h)','autoCleanConfig = { enabled: false']) if (!memory.includes(required)) throw new Error(`Falta protección de memoria: ${required}`);
const main = fs.readFileSync('src/main/index.js', 'utf8');
for (const required of ['app.enableSandbox()','contextIsolation:true','nodeIntegration:false','trustedSender','router.invoke']) if (!main.includes(required)) throw new Error(`Falta protección del proceso principal: ${required}`);
const router = fs.readFileSync('src/main/runtimeRouter.js', 'utf8');
if (!router.includes('if(simulated&&mutation)return simulation.mutate')) throw new Error('Las pruebas no pueden ejecutar acciones de Windows.');
console.log(`Sintaxis y política de versión verificadas: ${files.length} archivos JavaScript.`);
