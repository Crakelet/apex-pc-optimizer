'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

async function runReleaseStartupTest(window) {
  const output = app.isPackaged
    ? path.join(app.getPath('temp'), 'ApexPCOptimizer-release-check')
    : path.join(app.getAppPath(), 'scratch');
  fs.mkdirSync(output, { recursive: true });
  const reportFile = path.join(output, 'release-startup-report.json');
  const errors = [];
  const onConsole = event => { if (event.level === 'error' || event.level === 3) errors.push(String(event.message)); };
  window.webContents.on('console-message', onConsole);
  window.showInactive();
  try {
    const started = Date.now();
    let ready = false;
    while (Date.now() - started < 90000) {
      ready = await window.webContents.executeJavaScript('document.body.dataset.ready === "true"');
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    if (!ready) throw new Error('La interfaz de la versión normal no terminó de cargar.');
    // Only read-only preload APIs are used below. The sole action control is cancelled.
    const report = await window.webContents.executeJavaScript(`(async () => {
      const assert = (value, message) => { if (!value) throw new Error(message); };
      assert(typeof require === 'undefined' && window.api, 'El renderer debe permanecer aislado');
      const info = await window.api.getAppInfo();
      assert(info.simulated === false, 'La verificación debe arrancar el backend normal');
      assert(info.verificationReadOnly === true, 'La verificación debe bloquear mutaciones');
      assert(info.allToolsFree === true && info.simulationOperations === 0, 'Suite gratuita sin acciones simuladas');
      assert(document.getElementById('test-mode-banner').hidden, 'La versión normal no debe mostrar el modo de pruebas');
      assert(typeof window.api.getOperationState === 'function' && typeof window.api.getRecoverySummary === 'function', 'APIs de actividad y recuperación disponibles');
      const before = await window.api.getOperationState();
      assert(before.current === null && Array.isArray(before.history), 'Sin operación en curso al iniciar');
      const recovery = await window.api.getRecoverySummary();
      assert(recovery.success === true && Array.isArray(recovery.entries), 'Resumen de respaldos disponible');
      const tweaks = await window.api.getTweaks();
      const games = await window.api.getGamesList();
      const admin = await window.api.getAdminStatus();
      assert(tweaks.length === 50 && tweaks.every(item => item.free === true), 'Catálogo general completo y gratuito');
      assert(games.length === 5, 'Cinco juegos disponibles');
      const valorant=games.find(game=>game.id==='valorant');
      assert(Array.isArray(valorant.configProfiles),'Lista de perfiles de VALORANT disponible');
      assert(valorant.configProfiles.every(profile=>/^[a-f0-9]{64}$/.test(profile.id)&&typeof profile.readOnly==='boolean'),'Perfiles identificados sin rutas arbitrarias');
      document.querySelector('[data-tab="games"]').click();
      const picker=document.getElementById('valorant-config-profile');
      assert(picker&&document.querySelector('label[for="valorant-config-profile"]'),'Selector de perfil accesible');
      if(valorant.configProfiles.length>1)assert(picker.value==='','No se elige una cuenta automáticamente');
      const selectable=valorant.configProfiles.find(profile=>!profile.readOnly);
      if(selectable){
        picker.value=selectable.id;picker.dispatchEvent(new Event('change'));
        for(let attempt=0;attempt<150;attempt++){const current=document.getElementById('valorant-config-profile');if(current&&!current.disabled&&current.value===selectable.id)break;await new Promise(resolve=>setTimeout(resolve,100));}
        const selected=document.getElementById('valorant-config-profile');
        assert(selected&&!selected.disabled&&selected.value===selectable.id,'El perfil elegido se conserva al actualizar estados');
        const scopedGames=await window.api.getGamesList(selectable.id);
        assert(scopedGames.find(game=>game.id==='valorant').selectedConfigProfileId===selectable.id,'El backend resuelve el perfil por identificador opaco');
      }
      let profileRejected=false;try{await window.api.getGamesList('../GameUserSettings.ini');}catch{profileRejected=true;}
      assert(profileRejected,'No se aceptan rutas de configuración enviadas por el renderer');
      assert(typeof admin.isAdmin === 'boolean' && admin.simulated !== true, 'Permisos reales consultados');
      const buttons = [...document.querySelectorAll('.nav-item[data-tab]')];
      assert(buttons.length === 14, 'Las 14 secciones deben estar disponibles');
      for (const button of buttons) {
        button.click();
        assert(document.getElementById('view-' + button.dataset.tab).classList.contains('active'), 'Navegación: ' + button.dataset.tab);
      }
      document.querySelector('[data-tab="gaming"]').click();
      const advisor = document.querySelector('[data-performance-category="gaming"]');
      advisor.querySelector('.performance-analyze').click();
      for(let attempt=0;attempt<200&&advisor.getAttribute('aria-busy')==='true';attempt++)await new Promise(resolve=>setTimeout(resolve,100));
      assert(advisor.getAttribute('aria-busy')!=='true' && !advisor.querySelector('.performance-analyze').disabled, 'El asistente termina y recupera el control');
      const gamingRecommendations=advisor.querySelectorAll('.performance-recommendations>li').length;
      const designRecommendations=document.querySelectorAll('[data-performance-category="design"] .performance-recommendations>li').length;
      assert(gamingRecommendations>=3&&designRecommendations>=3,'Guías de gaming y diseño disponibles');
      assert(advisor.querySelectorAll('.performance-facts dd').length>=4,'Datos de rendimiento visibles');
      advisor.querySelector('details').open=true;
      assert(advisor.querySelector('details li').textContent.length>10,'Pasos concretos accesibles');
      const toggle = document.querySelector('input[data-id="game_mode_windows"]');
      assert(toggle && !toggle.disabled, 'Control de Modo Juego disponible');
      const checked = toggle.checked;
      toggle.click();
      await new Promise(resolve => setTimeout(resolve, 80));
      const modal = document.getElementById('action-confirm-modal');
      const rect = modal.getBoundingClientRect();
      assert(modal.classList.contains('active') && getComputedStyle(modal).display === 'flex' && rect.width > 300, 'Confirmación visible antes de ejecutar');
      assert(!/DWord|Solicitado|Valor no definido/.test(modal.textContent), 'Confirmación legible');
      document.getElementById('btn-cancel-confirm-action').click();
      await new Promise(resolve => setTimeout(resolve, 80));
      assert(!modal.classList.contains('active') && toggle.checked === checked, 'Cancelar conserva el estado del control');
      const after = await window.api.getOperationState();
      assert(after.current === null && JSON.stringify(after.history) === JSON.stringify(before.history), 'Cancelar no crea operaciones ni cambia el historial');
      assert((await window.api.getAppInfo()).simulationOperations === 0, 'No se ejecutaron acciones simuladas');
      return {
        ok: true, version: info.version, mode: 'real', verificationReadOnly: true,
        sections: buttons.length, tweaks: tweaks.length, games: games.length,
        gameTweaks: games.reduce((count, game) => count + game.tweaks.length, 0),
        performanceAdvisor:{gamingRecommendations,designRecommendations,readOnly:true},
        gameProfiles:{count:valorant.configProfiles.length,explicitSelection:valorant.configProfiles.length>1,readOnly:true},
        mutationsInvoked: 0, journalUnchanged: true, recoveryEntries: recovery.entries.length,
        checks: ['arranque normal', 'catálogo gratuito', 'permisos reales', 'actividad y recuperación', 'confirmación y cancelación', 'navegación', 'sin mutaciones']
      };
    })()`);
    const preferences = window.webContents.getLastWebPreferences();
    if (!preferences.sandbox || !preferences.contextIsolation || preferences.nodeIntegration) throw new Error('El aislamiento de la versión normal no es correcto.');
    for (const tab of ['dashboard', 'backup', 'gaming', 'design', 'games']) {
      await window.webContents.executeJavaScript(`document.querySelector('[data-tab="${tab}"]').click()`);
      await new Promise(resolve => setTimeout(resolve, 500));
      fs.writeFileSync(path.join(output, `release-${tab}.png`), (await window.webContents.capturePage()).toPNG());
    }
    window.setSize(1040,740);
    await new Promise(resolve=>setTimeout(resolve,450));
    fs.writeFileSync(path.join(output,'release-games-compact.png'),(await window.webContents.capturePage()).toPNG());
    if (errors.length) throw new Error(errors.join('; '));
    fs.writeFileSync(reportFile, JSON.stringify({ ...report, sandbox: true, errors }, null, 2) + '\n');
    console.log('RELEASE_STARTUP_OK ' + JSON.stringify(report));
    return report;
  } catch (error) {
    fs.writeFileSync(reportFile, JSON.stringify({ ok: false, verificationReadOnly: true, error: error.message, errors }, null, 2) + '\n');
    throw error;
  } finally {
    window.webContents.removeListener('console-message', onConsole);
  }
}

module.exports = { runReleaseStartupTest };
