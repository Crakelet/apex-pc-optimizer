'use strict';
const reg = (path, ...names) => names.map(name => ({ path, name }));
const resources = registry => ({ registry });
const memory = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management';
const desktop = 'HKCU:\\Control Panel\\Desktop';
const advanced = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced';
const cdm = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager';
const context = 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32';
// Historical backups may contain this former target. Only an exact, owned legacy
// record can authorize restoring it; new changes never capture or modify it.
const legacyGameBarDebugger = reg('HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\GameBarPresenceWriter.exe','Debugger')[0];
const MAP = {
  game_dvr: resources([...reg('HKCU:\\System\\GameConfigStore','GameDVR_Enabled'), ...reg('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR','AllowGameDVR'), ...reg('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR','AppCaptureEnabled')]),
  game_bar_presence: resources([...reg('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR','AllowGameDVR'), ...reg('HKCU:\\System\\GameConfigStore','GameDVR_Enabled')]),
  multimedia_priority: resources(reg('HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile','NetworkThrottlingIndex','SystemResponsiveness')),
  game_task_priority: resources(reg('HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games','GPU Priority','Priority','Scheduling Category','SFIO Priority')),
  game_mode_windows: resources(reg('HKCU:\\Software\\Microsoft\\GameBar','AllowAutoGameMode','AutoGameModeEnabled')),
  hags_gpu_scheduling: resources(reg('HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers','HwSchMode')),
  power_plan_ultimate: { power: 'active' },
  tcp_nagle_disabled: { registryInterfaces: ['TcpAckFrequency','TCPNoDelay'], tcp: ['heuristics'] },
  tcp_autotuning_optimal: { tcp: ['autotuning','heuristics'] },
  tcp_rss_enabled: { tcp: ['rss'], adapterRss: true },
  qos_bandwidth_limit_off: resources(reg('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Psched','NonBestEffortLimit')),
  tcp_ecn_disabled: { tcp: ['ecn'] },
  large_system_cache: resources(reg(memory,'LargeSystemCache')),
  render_threads_balance: resources(reg('HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl','Win32PrioritySeparation')),
  long_paths_enabled: resources(reg('HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem','LongPathsEnabled')),
  protect_creative_services: { services: ['TabletInputService','Spooler','LanmanWorkstation'] },
  design_disable_paging_executive: resources(reg(memory,'DisablePagingExecutive')),
  design_tablet_stylus_latency_fix: resources([...reg('HKCU:\\Software\\Microsoft\\Wisp\\Pen\\SysEventParameters','HoldMode'), ...reg('HKCU:\\Software\\Microsoft\\Wisp\\Touch','Bouncing','Flicks'), ...reg(desktop,'PenBarrelFeedback')]),
  design_cleartype_pro_smoothing: resources(reg(desktop,'FontSmoothing','FontSmoothingType')),
  design_gpu_creative_acceleration: resources(reg('HKCU:\\Software\\Microsoft\\DirectX\\UserGpuPreferences','DirectXUserGlobalSettings')),
  svc_diagtrack: { services: ['DiagTrack'] }, svc_sysmain: { services: ['SysMain'] }, svc_wsearch: { services: ['WSearch'] }, svc_remotereg: { services: ['RemoteRegistry'] }, svc_error_reporting: { services: ['WerSvc'] },
  privacy_telemetry_registry: resources(reg('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection','AllowTelemetry')),
  privacy_bing_search: resources([...reg('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search','BingSearchEnabled'), ...reg('HKCU:\\Software\\Policies\\Microsoft\\Windows\\Explorer','DisableSearchBoxSuggestions')]),
  privacy_advertising_id: resources(reg('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo','Enabled')),
  privacy_copilot_recall: resources([...reg('HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot','TurnOffWindowsCopilot'), ...reg('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot','TurnOffWindowsCopilot')]),
  hpet_timer: { bcd: ['useplatformclock'] }, dynamic_tick: { bcd: ['disabledynamictick'] },
  classic_context_menu: resources(reg(context,'')),
  disable_taskbar_chat: resources(reg(advanced,'TaskbarMn')),
  disable_delivery_optimization: { registry: reg('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization','DODownloadMode'), services: ['DoSvc'] },
  disable_wpbt_bios: resources(reg('HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager','DisableWPBTExecution')),
  fast_shutdown_timeout: resources([...reg('HKLM:\\SYSTEM\\CurrentControlSet\\Control','WaitToKillServiceTimeout'), ...reg(desktop,'WaitToKillAppTimeout')]),
  verbose_status: resources(reg('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System','VerboseStatus')),
  optimize_irp_stack_size: resources(reg('HKLM:\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters','IRPStackSize')),
  gpu_mpo_fix: resources([...reg('HKLM:\\SOFTWARE\\Microsoft\\Windows\\Dwm','OverlayTestMode'), ...reg('HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers','DisableOverlays')]),
  net_disable_eee: { adapterPatterns: ['*Energy*','*EEE','EEELinkAdvertisement'] },
  net_disable_intmod: { adapterPatterns: ['*InterruptModeration','*Interrupt Moderation*'] },
  power_usb_selective: { power: 'usb' },
  input_queue_size_opt: resources([...reg('HKLM:\\SYSTEM\\CurrentControlSet\\Services\\mouclass\\Parameters','MouseDataQueueSize'), ...reg('HKLM:\\SYSTEM\\CurrentControlSet\\Services\\kbdclass\\Parameters','KeyboardDataQueueSize')]),
  bcd_clean_timers: { bcd: ['tscsyncpolicy'] },
  net_disable_llmnr: resources(reg('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\DNSClient','EnableMulticast')),
  ui_menu_show_delay: resources(reg(desktop,'MenuShowDelay')),
  ui_classic_context_menu: resources(reg(context,'')),
  ui_responsive_animations: resources([...reg(`${desktop}\\WindowMetrics`,'MinAnimate'), ...reg(advanced,'TaskbarAnimations')]),
  ui_disable_ads_tips: resources([...reg(cdm,'SystemPaneSuggestionsEnabled','SoftLandingEnabled','SubscribedContent-338388Enabled','SubscribedContent-338389Enabled','SubscribedContent-353694Enabled','SubscribedContent-353696Enabled'), ...reg(advanced,'ShowSyncProviderNotifications')]),
  ui_disable_aero_shake: resources(reg(advanced,'DisallowShaking')),
  ui_hung_app_timeout: resources([...reg(desktop,'HungAppTimeout','WaitToKillAppTimeout'), ...reg('HKLM:\\SYSTEM\\CurrentControlSet\\Control','WaitToKillServiceTimeout')]),
  ui_explorer_separate_process: resources(reg(advanced,'SeparateProcess')),
  audit_cpu_priority: resources(reg('HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl','Win32PrioritySeparation')),
  audit_telemetry: { registry: reg('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection','AllowTelemetry'), services: ['DiagTrack','dmwappushservice'] },
  audit_copilot_widgets: resources([...reg('HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot','TurnOffWindowsCopilot'), ...reg(advanced,'TaskbarDa')]),
  audit_ui_delay: resources([...reg(desktop,'MenuShowDelay','ForegroundLockTimeout'), ...reg('HKLM:\\SYSTEM\\CurrentControlSet\\Control','WaitToKillServiceTimeout')]),
  apex_power: { power: 'active' },
  apex_network: { tcp: ['rss','ecn','autotuning'] },
  apex_msi: resources([])
};
function getResources(id, { legacyGameBar = false } = {}) {
  if (legacyGameBar && id !== 'game_bar_presence') throw new Error('La compatibilidad de respaldo no corresponde a este ajuste.');
  const item = MAP[id];
  if (!item) throw new Error('No se encontró la definición de respaldo del ajuste. No se aplicarán cambios.');
  const result = { registry: [], services: [], bcd: [], tcp: [], adapterRss: false, adapterPatterns: [], power: null, registryInterfaces: [], ...structuredClone(item) };
  if (legacyGameBar === true) result.registry.unshift(structuredClone(legacyGameBarDebugger));
  for (const service of result.services) result.registry.push(...reg(`HKLM:\\SYSTEM\\CurrentControlSet\\Services\\${service}`, 'Start', 'DelayedAutoStart'));
  return result;
}
function getResourcesForRestore(id, record) {
  const current = getResources(id);
  if (id !== 'game_bar_presence' || record?.id !== 'tweak:game_bar_presence' || !['prepared','applied','failed'].includes(record.status)) return current;
  const legacy = getResources(id, { legacyGameBar: true });
  const identity = value => typeof value?.path === 'string' && typeof value?.name === 'string' ? `${value.path.replace(/\\+/g,'\\').toLowerCase()}|${value.name.toLowerCase()}` : null;
  const expected = new Set(legacy.registry.map(identity));
  const exactTargets = snapshot => {
    if (!Array.isArray(snapshot?.registry) || snapshot.registry.length !== expected.size) return false;
    const actual = new Set(snapshot.registry.map(identity));
    return actual.size === expected.size && [...actual].every(target => expected.has(target));
  };
  // Snapshot contents/types are still validated by RestorationManager before any
  // capture or write. This compatibility branch only recognizes the closed old set.
  return exactTargets(record.before) && (!record.after || exactTargets(record.after)) ? legacy : current;
}
module.exports = { getResources, getResourcesForRestore, MAP };
