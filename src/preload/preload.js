const { contextBridge, ipcRenderer } = require('electron');

const invoke = async (channel, ...args) => {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (result && result.success === false) throw new Error(result.message || result.error || 'La operación no pudo completarse.');
  return result;
};

contextBridge.exposeInMainWorld('api', {
  getAppInfo: () => invoke('get-app-info'),
  getOperationState: () => invoke('get-operation-state'),
  getRecoverySummary: () => invoke('get-recovery-summary'),
  getPerformanceReport: () => invoke('get-performance-report'),
  openPerformanceSource: (id) => invoke('open-performance-source', id),
  openPerformanceSettings: (id) => invoke('open-performance-settings', id),
  onOperationState: (listener) => {
    if(typeof listener!=='function')throw new TypeError('Se requiere una función de actualización.');
    const receive=(_event,state)=>listener(state);
    ipcRenderer.on('operation-state',receive);
    return()=>ipcRenderer.removeListener('operation-state',receive);
  },
  getAdminStatus: () => invoke('get-admin-status'),
  restartAsAdmin: () => invoke('restart-as-admin'),
  getSpecs: () => invoke('get-specs'),
  getTweaks: () => invoke('get-tweaks'),
  getStatuses: () => invoke('get-statuses'),
  applyTweak: (id) => invoke('apply-tweak', id),
  revertTweak: (id) => invoke('revert-tweak', id),
  applyProfile: (category) => invoke('apply-profile', category),
  revertAll: () => invoke('revert-all'),
  createRestorePoint: (desc) => invoke('create-restore-point', desc),
  windowControl: (action) => invoke('window-control', action),
  
  // Herramientas de red
  runPingBenchmark: (host) => invoke('run-ping-benchmark', host),
  setDnsProvider: (provider) => invoke('set-dns-provider', provider),
  flushDns: () => invoke('flush-dns'),
  resetWinsock: () => invoke('reset-winsock'),
  restartAdapters: () => invoke('restart-adapters'),

  // Mejoras específicas por juego
  getGamesList: (profileId) => profileId==null?invoke('get-games-list'):invoke('get-games-list', profileId),
  applyGameTweak: (tweakId, profileId) => profileId==null?invoke('apply-game-tweak', tweakId):invoke('apply-game-tweak', tweakId, profileId),
  revertGameTweak: (tweakId) => invoke('revert-game-tweak', tweakId),
  revertGameProfile: (gameId) => invoke('revert-game-profile', gameId),

  // Auditoría y Puntuación del Sistema (1.000 pts)
  runSystemAudit: (force) => invoke('run-system-audit', force),
  executeAuditAction: (actionId) => invoke('execute-audit-action', actionId),
  optimizeAllAudit: () => invoke('optimize-all-audit'),
  getBloatStatus: () => invoke('get-bloat-status'),
  executeCustomDebloat: (selectedIds) => invoke('execute-custom-debloat', selectedIds),

  // Telemetría en Vivo & Nivel Apex Pro (Equivalente al plan más caro de Paragon)
  getRealtimeTelemetry: () => invoke('get-realtime-telemetry'),
  toggleWindowsAscension: (enable) => invoke('toggle-windows-ascension', enable),
  getAscensionStatus: () => invoke('get-ascension-status'),
  applyApexPowerPlan: () => invoke('apply-apex-power-plan'),
  applyMsiModeGpu: () => invoke('apply-msi-mode-gpu'),
  applyAdvancedNetworkStack: () => invoke('apply-advanced-network-stack'),
  revertApexTools: () => invoke('revert-apex-tools'),
  getBiosGuides: () => invoke('get-bios-guides'),

  // Herramientas Profesionales de Diseño y Productividad
  purgeStandbyRam: () => invoke('purge-standby-ram'),
  cleanCreativeMediaCache: () => invoke('clean-creative-media-cache'),
  optimizeGraphicsTablet: () => invoke('optimize-graphics-tablet'),
  assignGpuCreativeApps: () => invoke('assign-gpu-creative-apps'),
  assignGpuDesignApp: (exePath) => invoke('assign-gpu-design-app', exePath),
  restoreGpuDesignApp: (exePath) => invoke('restore-gpu-design-app', exePath),
  getDesignGpuBackupStatus: (exePath) => invoke('get-design-gpu-backup-status', exePath),
  detectDesignApps: () => invoke('detect-design-apps'),
  getDesignCacheSummary: () => invoke('get-design-cache-summary'),
  applyAllDesignStudio: () => invoke('apply-all-design-studio'),

  // Suite de Memoria RAM (Inspirada en WinMemoryCleaner de Igor Mundstein)
  getMemoryStats: () => invoke('get-memory-stats'),
  purgeStandbyList: () => invoke('purge-standby-list'),
  trimWorkingSets: () => invoke('trim-working-sets'),
  flushModifiedPageList: () => invoke('flush-modified-page-list'),
  cleanAllMemory: () => invoke('clean-all-memory'),
  optimizeSingleProcess: (pid) => invoke('optimize-single-process', pid),
  getAutoCleanConfig: () => invoke('get-auto-clean-config'),
  setAutoCleanConfig: (config) => invoke('set-auto-clean-config', config),

  // Suite de Herramientas Avanzadas (Inspiradas en Optimizer de hellzerg y TBOK)
  getStartupPrograms: () => invoke('get-startup-programs'),
  toggleStartupProgram: (name, location, enable) => invoke('toggle-startup-program', { name, location, enable }),
  getHostsShieldStatus: () => invoke('get-hosts-shield-status'),
  applyHostsShield: () => invoke('apply-hosts-shield'),
  revertHostsShield: () => invoke('revert-hosts-shield'),
  getCleanersStatus: () => invoke('get-cleaners-status'),
  getDiskCleanupStatus: () => invoke('get-disk-cleanup-status'),
  getGhostDevices: () => invoke('get-ghost-devices'),
  purgeGhostDevices: () => invoke('purge-ghost-devices'),
  cleanDiscordCache: () => invoke('clean-discord-cache'),
  cleanBrowserCaches: () => invoke('clean-browser-caches'),
  cleanCrashDumps: () => invoke('clean-crash-dumps'),
  cleanDeliveryOptimizationCache: () => invoke('clean-delivery-optimization-cache'),
  cleanNpmCache: () => invoke('clean-npm-cache'),
  cleanVscodeCache: () => invoke('clean-vscode-cache'),
  cleanPipCache: () => invoke('clean-pip-cache'),
  cleanGradleCache: () => invoke('clean-gradle-cache'),
  cleanMediaCache: () => invoke('clean-media-cache'),
  cleanLaunchersCache: () => invoke('clean-launchers-cache'),
  cleanAllAppCaches: () => invoke('clean-all-app-caches'),

  // Diagnóstico Gamer de Hardware y Memoria
  getHardwareReport: () => invoke('get-hardware-report'),
  getUsbLatencyStatus: () => invoke('get-usb-latency-status'),
  setUsbLowLatency: (enable) => invoke('set-usb-low-latency', enable),

  // Suite de Cero Retardo y Respuesta Instantánea de Windows (Snappy UI)
  getSnappyUiStatus: () => invoke('get-snappy-ui-status'),
  applySnappyUiTweak: (id) => invoke('apply-snappy-ui-tweak', id),
  revertSnappyUiTweak: (id) => invoke('revert-snappy-ui-tweak', id),
  applyAllSnappyUi: () => invoke('apply-all-snappy-ui'),

  // Actualizaciones automáticas y navegación externa
  checkForUpdates: () => invoke('check-for-updates'),
  openExternalUrl: (url) => invoke('open-external-url', url)
});
