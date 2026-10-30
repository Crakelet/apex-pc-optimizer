'use strict';
const {app,BrowserWindow,ipcMain,shell,session,dialog,screen}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {trustedSender}=require('./ipcPolicy');
const {createRouter}=require('./runtimeRouter');
const {REPOSITORY,RELEASES_URL,allowedExternal,checkForUpdates}=require('./updateService');
const {OperationJournal}=require('./operationJournal');
const {operationLabel,recoverySummary}=require('./releaseSummary');
const {READ_ONLY}=require('./legacyPolicy');
const {prepareAdminRestart}=require('./sessionLifecycle');
const performance=require('./performanceAdvisor');
const simulated=process.argv.includes('--test-mode')||process.argv.includes('--smoke-test');
const smoke=process.argv.includes('--smoke-test');
const verifyRelease=process.argv.includes('--verify-release-startup');
app.name='ApexPCOptimizer';
app.setPath('userData',verifyRelease?path.join(app.getPath('temp'),'ApexPCOptimizer-release-check','user-data'):simulated?(app.isPackaged?path.join(app.getPath('temp'),'ApexPCOptimizer-tests'):path.join(app.getAppPath(),'scratch',smoke?'glass-smoke-user-data':'test-user-data')):path.join(app.getPath('appData'),'ApexPCOptimizer'));
app.enableSandbox();
const gotLock=app.requestSingleInstanceLock();
if(!gotLock){app.quit();process.exit(0);}
const system=require('./systemInfo');
const {TWEAKS_DATA}=require('./tweaksData');
const {OptimizerEngine}=require('./optimizerEngine');
const network=require('./networkTools'),games=require('./gameOptimizer'),audit=require('./systemAudit'),telemetry=require('./telemetryService');
const apex=require('./apexProEngine'),design=require('./designTools'),memory=require('./memoryCleanerService'),advanced=require('./advancedToolsService'),hardware=require('./hardwareDiagnosticsService'),snappy=require('./snappyUiService');
let mainWindow=null,engine=null;
let allowQuit=false,shutdownPromise=null;
const journal=new OperationJournal({file:path.join(app.getPath('userData'),'activity-v1.json'),notify:state=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('operation-state',state);}});
const router=createRouter({simulated,catalog:TWEAKS_DATA,onOperation:event=>journal.record(event,operationLabel(event.channel,event.args))});
const entryUrl=pathToFileURL(path.join(__dirname,'../renderer/index.html')).href;
// Explicit routes: complete free tools, no arbitrary scripts or module access.
const routes={
 'get-app-info':()=>({version:app.getVersion(),simulated,verificationReadOnly:verifyRelease,packaged:app.isPackaged,allToolsFree:true,releasesUrl:RELEASES_URL,repository:'https://github.com/'+REPOSITORY,simulationOperations:router.simulation.operations.length}),
 'get-operation-state':()=>journal.snapshot(),'get-recovery-summary':()=>recoverySummary(engine),
 'get-performance-report':()=>performance.getPerformanceReport({displays:screen.getAllDisplays()}),
 'open-performance-source':async id=>{await shell.openExternal(performance.SOURCES[id].url);return{success:true};},
 'open-performance-settings':async id=>{await shell.openExternal(performance.SETTINGS_TARGETS[id]);return{success:true};},
 'get-admin-status':()=>({isAdmin:system.checkIsAdmin()}),'restart-as-admin':async()=>{const result=await prepareAdminRestart({memory,telemetry,system});if(result.handoffStarted)allowQuit=true;return result;},'get-specs':()=>system.getSystemSpecs(),
 'get-tweaks':()=>TWEAKS_DATA,'get-statuses':()=>engine.checkAllStatuses(),'apply-tweak':id=>engine.applyTweak(id),'revert-tweak':id=>engine.revertTweak(id),'apply-profile':category=>engine.applyProfile(category),'revert-all':()=>engine.revertAll(),'create-restore-point':description=>engine.createRestorePoint(description),
 'run-ping-benchmark':host=>network.runPingBenchmark(host),'set-dns-provider':provider=>network.setDnsProvider(provider),'flush-dns':()=>network.flushDnsCache(),'reset-winsock':()=>network.resetWinsockCatalog(),'restart-adapters':()=>network.restartAdapters(),
 'get-games-list':profileId=>games.getGamesList(profileId),'apply-game-tweak':(id,profileId)=>games.applySpecificGameTweak(id,profileId),'revert-game-tweak':id=>games.revertSpecificGameTweak(id),'revert-game-profile':id=>games.revertGameProfile(id),
 'run-system-audit':force=>audit.runSystemAudit(force),'execute-audit-action':id=>audit.executeAuditAction(id),'optimize-all-audit':()=>audit.optimizeAllAudits(),'get-bloat-status':()=>audit.getBloatStatus(),'execute-custom-debloat':ids=>audit.executeCustomDebloat(ids),
 'get-realtime-telemetry':()=>telemetry.getRealtimeTelemetry(),'toggle-windows-ascension':enable=>telemetry.toggleWindowsAscension(enable),'get-ascension-status':()=>telemetry.getAscensionStatus(),
 'apply-apex-power-plan':()=>apex.applyApexPowerPlan(),'apply-msi-mode-gpu':()=>apex.applyMsiModeGpu(),'apply-advanced-network-stack':()=>apex.applyAdvancedNetworkStack(),'revert-apex-tools':()=>apex.revertApexTools(),'get-bios-guides':()=>apex.getBiosGuides(),
 'purge-standby-ram':()=>design.purgeStandbyRam(),'clean-creative-media-cache':()=>design.cleanCreativeMediaCache(),'optimize-graphics-tablet':()=>design.optimizeGraphicsTablet(engine),'assign-gpu-creative-apps':()=>design.assignGpuToCreativeApps(),'assign-gpu-design-app':file=>design.assignGpuToDesignApp(file),'detect-design-apps':()=>design.detectInstalledDesignApps(),'get-design-cache-summary':()=>design.getDesignCacheSummary(),'apply-all-design-studio':()=>design.applyAllDesignStudioProfile(engine),
 'restore-gpu-design-app':file=>design.restoreGpuForDesignApp(file),'get-design-gpu-backup-status':file=>design.getDesignGpuBackupStatus(file),
 'get-memory-stats':()=>memory.getMemoryStats(),'purge-standby-list':()=>memory.purgeStandbyList(),'trim-working-sets':()=>memory.trimWorkingSets(),'flush-modified-page-list':()=>memory.flushModifiedPageList(),'clean-all-memory':()=>memory.cleanAllMemory(),'optimize-single-process':pid=>memory.optimizeSingleProcess(pid),'get-auto-clean-config':()=>memory.getAutoCleanConfig(),'set-auto-clean-config':config=>memory.setAutoCleanConfig(config),
 'get-startup-programs':()=>advanced.getStartupPrograms(),'toggle-startup-program':({name,location,enable})=>advanced.toggleStartupProgram(name,location,enable),'get-hosts-shield-status':()=>advanced.getHostsShieldStatus(),'apply-hosts-shield':()=>advanced.applyHostsShield(),'revert-hosts-shield':()=>advanced.revertHostsShield(),'get-cleaners-status':()=>advanced.getCleanersStatus(),'get-disk-cleanup-status':()=>advanced.getDiskCleanupStatus(),'get-ghost-devices':()=>advanced.getGhostDevices(),'purge-ghost-devices':()=>advanced.purgeGhostDevices(),
 'clean-discord-cache':()=>advanced.cleanDiscordCache(),'clean-browser-caches':()=>advanced.cleanBrowserCaches(),'clean-crash-dumps':()=>advanced.cleanCrashDumps(),'clean-delivery-optimization-cache':()=>advanced.cleanDeliveryOptimizationCache(),'clean-npm-cache':()=>advanced.cleanNpmCache(),'clean-vscode-cache':()=>advanced.cleanVscodeCache(),'clean-pip-cache':()=>advanced.cleanPipCache(),'clean-gradle-cache':()=>advanced.cleanGradleCache(),'clean-media-cache':()=>advanced.cleanMediaCache(),'clean-launchers-cache':()=>advanced.cleanLaunchersCache(),'clean-all-app-caches':()=>advanced.cleanAllAppCaches(),
 'get-hardware-report':()=>hardware.getHardwareReport(),'get-usb-latency-status':()=>hardware.getUsbLatencyStatus(),'set-usb-low-latency':enable=>hardware.setUsbLowLatency(enable,engine),
 'get-snappy-ui-status':()=>snappy.getSnappyUiStatus(),'apply-snappy-ui-tweak':id=>snappy.applySnappyUiTweak(id),'revert-snappy-ui-tweak':id=>snappy.revertSnappyUiTweak(id),'apply-all-snappy-ui':()=>snappy.applyAllSnappyUi(),
 'check-for-updates':async()=>({...await checkForUpdates(),success:true}),
 'open-external-url':async url=>{if(!allowedExternal(url))throw new Error('Enlace no autorizado.');await shell.openExternal(url);return true;},
 'window-control':action=>{if(action==='close')mainWindow.close();if(action==='minimize')mainWindow.minimize();if(action==='maximize')mainWindow.isMaximized()?mainWindow.unmaximize():mainWindow.maximize();}
};
for(const[channel,handler]of Object.entries(routes)){
 ipcMain.handle(channel,async(event,...args)=>{
  try{if(!trustedSender(event,mainWindow,entryUrl))throw new Error('Origen de solicitud no autorizado.');if((shutdownPromise||allowQuit)&&!READ_ONLY.has(channel)&&channel!=='window-control')throw new Error('Apex está completando el cierre o reinicio de la sesión. Espera a que termine.');if(verifyRelease&&!READ_ONLY.has(channel)&&!['window-control'].includes(channel))throw new Error('La verificación de arranque solo permite lecturas.');return await router.invoke(channel,args,handler);}
  catch(error){return{success:false,message:String(error.message).slice(0,1500),error:String(error.message).slice(0,1500)};}
 });
}
app.whenReady().then(async()=>{
 engine=new OptimizerEngine({userDataPath:app.getPath('userData')});
 audit.configureAuditEngine(engine);
 session.defaultSession.setPermissionRequestHandler((_w,_p,callback)=>callback(false));session.defaultSession.setPermissionCheckHandler(()=>false);
 session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('file://')&&!details.url.startsWith('devtools://')}));
 mainWindow=new BrowserWindow({width:1320,height:920,minWidth:1040,minHeight:720,frame:false,show:false,title:'Apex PC Optimizer',backgroundColor:'#07080d',icon:path.join(__dirname,'../../appicon.ico'),webPreferences:{preload:path.join(__dirname,'../preload/preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 if(smoke||verifyRelease)mainWindow.webContents.setBackgroundThrottling(false);
 mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));mainWindow.webContents.on('will-navigate',event=>event.preventDefault());mainWindow.webContents.on('will-attach-webview',event=>event.preventDefault());
 mainWindow.on('close',event=>{
  if(router.busy){event.preventDefault();void dialog.showMessageBox(mainWindow,{type:'info',message:'Espera a que termine la operación antes de cerrar Apex.'});}
  else if(!allowQuit&&!simulated&&!verifyRelease){event.preventDefault();app.quit();}
 });
 mainWindow.once('ready-to-show',()=>{if(!smoke&&!verifyRelease)mainWindow.show();});
 await mainWindow.loadURL(entryUrl);
 if(smoke){try{await require('./glassSmokeTest').runSmokeTest(mainWindow,{simulated,simulation:router.simulation});app.exit(0);}catch(error){console.error(error);app.exit(1);}}
 if(verifyRelease){try{await require('./releaseStartupTest').runReleaseStartupTest(mainWindow);app.exit(0);}catch(error){console.error(error);app.exit(1);}}
}).catch(error=>{console.error(error);app.exit(1);});
app.on('before-quit',event=>{
 if(allowQuit||simulated||verifyRelease)return;
 event.preventDefault();
 if(router.busy){if(mainWindow&&!mainWindow.isDestroyed())void dialog.showMessageBox(mainWindow,{type:'info',message:'Espera a que termine la operación actual antes de cerrar Apex.'});return;}
 if(shutdownPromise)return;
 if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('operation-state',{...journal.snapshot(),current:{label:'Cerrando Apex',status:'running',message:'Terminando las tareas de memoria y restaurando las prioridades de sesión guardadas.'}});
 shutdownPromise=(async()=>{
  try{
   await memory.shutdownSession();
   const result=await telemetry.shutdownSession();
   if(!result.success){
    const answer=await dialog.showMessageBox(mainWindow,{type:'warning',message:'No se pudieron restaurar todas las prioridades de la sesión.',detail:result.message+' Los respaldos se conservaron. Puedes reintentar desde Seguridad y Backup.',buttons:['Volver a Apex','Cerrar conservando el respaldo'],defaultId:0,cancelId:0});
    if(answer.response!==1)return;
   }
   allowQuit=true;app.quit();
  }catch(error){if(mainWindow&&!mainWindow.isDestroyed())void dialog.showMessageBox(mainWindow,{type:'error',message:'No se pudo completar el cierre de la sesión.',detail:String(error.message)});}
 })().finally(()=>{shutdownPromise=null;if(!allowQuit&&mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('operation-state',journal.snapshot());});
});
app.on('second-instance',()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();}});app.on('window-all-closed',()=>app.quit());
