'use strict';
const fs=require('node:fs'),path=require('node:path');
const {app}=require('electron');
async function runSmokeTest(window,{simulated,simulation}){
 if(!simulated)throw new Error('La prueba exige simulación.');
 window.showInactive();
 const errors=[];window.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
 const started=Date.now();
 while(Date.now()-started<90000){if(await window.webContents.executeJavaScript('document.body.dataset.ready === "true"'))break;await new Promise(r=>setTimeout(r,150));}
 const report=await window.webContents.executeJavaScript(`(async()=>{
 const assert=(value,message)=>{if(!value)throw new Error(message);};
 assert(document.body.dataset.ready==='true','La interfaz no terminó de cargar');
 assert(typeof require==='undefined'&&window.api,'Renderer aislado');
 const info=await window.api.getAppInfo();assert(info.simulated&&info.allToolsFree,'Suite gratuita en simulación');
 assert(document.querySelectorAll('.nav-item[data-tab]').length===14,'Las 14 secciones originales');
 assert(!document.getElementById('test-mode-banner').hidden,'Modo de pruebas visible');
 const tweaks=await window.api.getTweaks();assert(tweaks.length===50,'Catálogo completo de ajustes');
 const games=await window.api.getGamesList();assert(games.length===5,'Catálogo de juegos completo');
 const before=(await window.api.getAppInfo()).simulationOperations;
 assert((await window.api.applyTweak('game_mode_windows')).simulated,'Aplicación simulada');
 assert((await window.api.getStatuses()).game_mode_windows===true,'Estado de prueba coherente');
 assert((await window.api.revertTweak('game_mode_windows')).simulated,'Restauración simulada');
 for(const fn of ['cleanAllMemory','cleanBrowserCaches','purgeGhostDevices','applyHostsShield','applyApexPowerPlan','revertApexTools'])assert((await window.api[fn]()).simulated,'Simulación de '+fn);
 assert((await window.api.restoreGpuDesignApp('C:\\\\Apps\\\\Editor.exe')).simulated,'Restauración GPU simulada');
 assert((await window.api.getAppInfo()).simulationOperations===before+9,'Acciones interceptadas en simulación');
 for(const call of [()=>window.api.runPingBenchmark('bad";$(Get-Process)'),()=>window.api.optimizeSingleProcess(null),()=>window.api.openExternalUrl('https://evil.com')]){let rejected=false;try{await call();}catch{rejected=true;}assert(rejected,'Entrada peligrosa rechazada');}
 for(const button of document.querySelectorAll('.nav-item[data-tab]')){button.click();assert(document.getElementById('view-'+button.dataset.tab).classList.contains('active'),'Navegación '+button.dataset.tab);}
 assert(document.getElementById('btn-restore-apex'),'Restauración Apex accesible');
 assert(document.querySelector('[data-dns="original"]'),'Restauración DNS accesible');
 document.querySelector('[data-tab="gaming"]').click();await new Promise(r=>setTimeout(r,200));
 const toggle=document.querySelector('input[data-id="game_mode_windows"]');assert(toggle,'Control restaurado');toggle.click();
 assert(document.getElementById('action-confirm-modal').classList.contains('active'),'Confirmación previa visible');
 assert(!/DWord|Solicitado|Valor no definido/.test(document.getElementById('action-confirm-modal').textContent),'Confirmación en lenguaje de usuario');
 document.getElementById('btn-cancel-confirm-action').click();
 assert(!document.getElementById('action-confirm-modal').classList.contains('active'),'Cancelar no aplica cambios');
 return{ok:true,version:info.version,freeTools:true,sections:14,tweaks:tweaks.length,games:games.length,gameTweaks:games.reduce((n,g)=>n+g.tweaks.length,0),simulatedMutations:9,checks:['glass original','herramientas gratuitas','IPC','sandbox','simulación','confirmación previa','navegación','restauraciones accesibles']};
 })()`);
 const output=app.isPackaged?path.join(app.getPath('temp'),'ApexPCOptimizer-tests'):path.join(app.getAppPath(),'scratch');fs.mkdirSync(output,{recursive:true});
 const preferences=window.webContents.getLastWebPreferences();if(!preferences.sandbox||!preferences.contextIsolation||preferences.nodeIntegration)throw new Error('Aislamiento incorrecto.');
 for(const tab of ['dashboard','gaming','games','network','ram','advanced-tools','design','apex-pro','hardware','backup']){
  await window.webContents.executeJavaScript(`document.querySelector('[data-tab="${tab}"]').click()`);await new Promise(r=>setTimeout(r,600));
  fs.writeFileSync(path.join(output,`glass-${tab}.png`),(await window.webContents.capturePage()).toPNG());
 }
 await window.webContents.executeJavaScript(`document.querySelector('[data-tab="gaming"]').click(); void promptActionConfirmation({title:'Modo Juego de Windows',subtitle:'Activa la preferencia de Modo Juego para que Windows gestione los recursos durante una partida.',badgeText:'Herramienta gratuita',details:['Se guardará la configuración compatible antes de aplicar el ajuste.','Puedes deshacer el cambio usando el respaldo de Apex.'],confirmText:'Aplicar ajuste'});`);await new Promise(r=>setTimeout(r,450));
 const modalVisible=await window.webContents.executeJavaScript(`(()=>{const modal=document.getElementById('action-confirm-modal');const rect=modal.getBoundingClientRect();return modal.classList.contains('active')&&getComputedStyle(modal).display==='flex'&&rect.width>300&&rect.height>300})()`);
 if(!modalVisible)throw new Error('El diálogo debe estar visible, además de activo.');
 fs.writeFileSync(path.join(output,'glass-confirmation.png'),(await window.webContents.capturePage()).toPNG());
 await window.webContents.executeJavaScript("document.getElementById('btn-cancel-confirm-action').click()");
 window.setSize(1040,740);await new Promise(r=>setTimeout(r,400));fs.writeFileSync(path.join(output,'glass-compact.png'),(await window.webContents.capturePage()).toPNG());
 fs.writeFileSync(path.join(output,'glass-smoke-report.json'),JSON.stringify({...report,errors,sandbox:preferences.sandbox,mutationsIntercepted:simulation.operations.length},null,2));
 if(errors.length)throw new Error(errors.join('; '));console.log('SMOKE_OK '+JSON.stringify(report));
}
module.exports={runSmokeTest};
