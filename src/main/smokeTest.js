'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');
async function runSmokeTest(window, engine) {
  if (!engine.simulated) throw new Error('La prueba de humo exige simulación.');
  const errors = [];
  window.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const started = Date.now();
  while (Date.now() - started < 45000) {
    if (await window.webContents.executeJavaScript('document.body.dataset.ready === "true"')) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const report = await window.webContents.executeJavaScript(`(async () => {
    const assert = (value, text) => { if (!value) throw new Error(text); };
    assert(document.body.dataset.ready === 'true', 'La interfaz no terminó de cargar');
    assert(window.api && typeof require === 'undefined', 'Aislamiento del renderer');
    assert(!document.getElementById('test-banner').hidden, 'El modo de pruebas no es visible');
    const info = await window.api.info(); assert(info.simulated, 'Debe simular cambios');
    assert(!document.getElementById('refresh-system').disabled, 'Consulta inicial completada');
    assert(!document.getElementById('system-info').textContent.includes('Cargando'), 'Diagnóstico inicial visible');
    const settings = await window.api.settings(); assert(settings.length === 5, 'Catálogo esperado');
    const history = await window.api.history();
    for (const item of history.filter(item => item.status !== 'reverted')) await window.api.revert(item.id);
    const before = (await window.api.settings()).find(item => item.id === 'game-mode').current;
    const applied = await window.api.apply('game-mode', before); assert(applied.status === 'applied', 'Aplicación simulada');
    const active = (await window.api.history()).find(item => item.settingId === 'game-mode' && item.status === 'applied');
    assert(active && active.before && active.after, 'Respaldo original');
    assert((await window.api.revert(active.id)).status === 'reverted', 'Restauración simulada');
    let rejected = false; try { await window.api.apply('bcdedit'); } catch { rejected = true; } assert(rejected, 'ID desconocido bloqueado');
    rejected = false; try { await window.api.ping('bad\";$(Get-Process)'); } catch { rejected = true; } assert(rejected, 'Entrada PowerShell rechazada');
    rejected = false; try { await window.api.openExternal('https://example.com'); } catch { rejected = true; } assert(rejected, 'URL externa no autorizada bloqueada');
    for (const name of ['settings','tools','history','future','about','home']) { document.querySelector('[data-view="' + name + '"]').click(); assert(!document.getElementById('view-' + name).hidden, 'Navegación ' + name); }
    document.querySelector('[data-view="settings"]').click();
    await new Promise(resolve => setTimeout(resolve, 150));
    document.querySelector('[data-setting="game-mode"]').click();
    assert(document.getElementById('action-dialog').open, 'Revisión modal accesible');
    assert(document.getElementById('dialog-mode').textContent.includes('simulada'), 'La revisión identifica la simulación');
    document.getElementById('dialog-confirm').click();
    for (let i = 0; i < 100 && document.getElementById('action-dialog').open; i++) await new Promise(resolve => setTimeout(resolve, 30));
    assert(!document.getElementById('action-dialog').open, 'Confirmación del cambio en UI');
    const uiEntry = (await window.api.history()).find(item => item.settingId === 'game-mode' && item.status === 'applied');
    assert(uiEntry, 'Cambio de UI respaldado');
    await window.api.revert(uiEntry.id);
    assert(document.querySelectorAll('.future-item').length === 7, 'Módulos próximos visibles');
    assert(document.querySelectorAll('.future-item button').length === 0, 'Módulos próximos no ejecutables');
    assert(document.querySelectorAll('[onclick]').length === 0, 'Sin acciones inline');
    return { ok: true, version: info.version, settings: settings.length, future: 7, simulation: true, checked: ['arranque', 'aislamiento', 'navegación', 'respaldar/aplicar/restaurar', 'IPC', 'entrada de red', 'enlaces', 'módulos bloqueados'] };
  })()`);
  const output = app.isPackaged ? path.join(app.getPath('temp'), 'ApexPCOptimizer-tests') : path.join(app.getAppPath(), 'scratch');
  fs.mkdirSync(output, { recursive: true });
  const preferences = window.webContents.getLastWebPreferences();
  if (!preferences.sandbox || !preferences.contextIsolation || preferences.nodeIntegration) throw new Error('Preferencias de aislamiento inseguras.');
  // Let Chromium paint the settled async content before capturing evidence.
  await new Promise(resolve => setTimeout(resolve, 700));
  for (const view of ['home', 'settings', 'tools', 'history', 'future', 'about']) {
    await window.webContents.executeJavaScript(`document.querySelector('[data-view="${view}"]').click()`);
    await new Promise(resolve => setTimeout(resolve, 350));
    const screenshot = await window.webContents.capturePage();
    fs.writeFileSync(path.join(output, `smoke-${view}.png`), screenshot.toPNG());
  }
  await window.setSize(900, 680);
  await window.webContents.executeJavaScript('document.querySelector(\'[data-view="settings"]\').click()');
  await new Promise(resolve => setTimeout(resolve, 350));
  fs.writeFileSync(path.join(output, 'smoke-compact.png'), (await window.webContents.capturePage()).toPNG());
  fs.writeFileSync(path.join(output, 'smoke-report.json'), JSON.stringify({ ...report, errors, sandbox: preferences.sandbox }, null, 2));
  if (errors.length) throw new Error(`Errores de renderer: ${errors.join('; ')}`);
  console.log(`SMOKE_OK ${JSON.stringify(report)}`);
}
module.exports = { runSmokeTest };
