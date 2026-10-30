const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const os = require('os');

function cleanClixml(str) {
  if (!str) return '';
  if (str.includes('#< CLIXML')) {
    const errorMatches = str.match(/<S S="Error">([\s\S]*?)<\/S>/gi);
    if (errorMatches && errorMatches.length > 0) {
      const extracted = errorMatches
        .map(m => m.replace(/<\/?S[^>]*>/gi, '')
                   .replace(/_x000D__x000A_/g, '\n')
                   .replace(/_x001B_\[\d+m/g, '')
                   .trim())
        .filter(Boolean)
        .join('\n');
      if (extracted) return extracted;
    }
  }
  return str.replace(/#< CLIXML[\s\S]*?<\/Objs>/gi, '').replace(/<[^>]+>/g, '').trim();
}

async function runPsScript(script, input = {}, options = {}) {
  const res = await require('./systemInfo').runPowerShell(require('./safeCleanup').CLEANUP_SCRIPT + '\n' + script, input && typeof input === 'object' ? input : {},options);
  if (!res.success) throw new Error(res.output || 'Windows no pudo completar la operación.');
  return res.output || '';
}

let cachedAudit = null;
let cachedAuditTime = 0;

/**
 * Realiza una auditoría completa del sistema estilo Paragon Tweaker
 * Puntuación normalizada exactamente sobre 1.000 puntos
 */
async function runSystemAudit(force = false) {
  if (!force && cachedAudit && (Date.now() - cachedAuditTime < 45000)) {
    return cachedAudit;
  }

  const auditScript = `
    $data = @{}

    # 1. GPU y Controlador
    try {
      $gpuProps = Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\000*' -ErrorAction SilentlyContinue | Where-Object { $_.DriverDesc } | Select-Object -First 1 DriverDesc, DriverVersion, DriverDate, ProviderName
      $data['gpu'] = $gpuProps
    } catch { $data['gpu'] = $null }

    # HAGS
    try {
      $data['hags'] = (Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'HwSchMode' -ErrorAction SilentlyContinue).HwSchMode
    } catch { $data['hags'] = 0 }

    # DirectX GPU Global Preference
    try {
      $data['dx_pref'] = (Get-ItemProperty 'HKCU:\\Software\\Microsoft\\DirectX\\UserGpuPreferences' -Name 'DirectXUserGlobalSettings' -ErrorAction SilentlyContinue).DirectXUserGlobalSettings
    } catch { $data['dx_pref'] = '' }

    # 2. Mantenimiento: CBS Log (SFC)
    try {
      $cbsPath = 'C:\\Windows\\Logs\\CBS\\CBS.log'
      if (Test-Path $cbsPath) {
        $lastWrite = (Get-Item $cbsPath).LastWriteTime
        $daysAgo = [math]::Round(((Get-Date) - $lastWrite).TotalDays)
        $data['cbs_days_ago'] = $daysAgo
        $data['cbs_date'] = $lastWrite.ToString('yyyy-MM-dd')
      } else {
        $data['cbs_days_ago'] = 999
        $data['cbs_date'] = 'Nunca'
      }
    } catch {
      $data['cbs_days_ago'] = 999
      $data['cbs_date'] = 'Nunca'
    }

    # Limpieza: Tamaño de archivos temporales ultra rápido con FSO nativo
    try {
      $t1 = $env:TEMP
      $t2 = (Join-Path $env:SystemRoot 'Temp')
      $fso = New-Object -ComObject Scripting.FileSystemObject
      $s1 = if (Test-Path $t1) { try { $fso.GetFolder($t1).Size } catch { 0 } } else { 0 }
      $s2 = if (Test-Path $t2) { try { $fso.GetFolder($t2).Size } catch { 0 } } else { 0 }
      $data['temp_mb'] = [math]::Round(($s1 + $s2) / 1MB, 1)
    } catch { $data['temp_mb'] = 0 }

    # 3. Debloat y Privacidad
    # Telemetría DiagTrack
    try {
      $svc = Get-Service -Name 'DiagTrack' -ErrorAction SilentlyContinue
      $data['diagtrack_running'] = ($svc.Status -eq 'Running')
      $data['diagtrack_start'] = $svc.StartType.ToString()
    } catch {
      $data['diagtrack_running'] = $false
      $data['diagtrack_start'] = 'Disabled'
    }

    # Bloatware apps instaladas (consultando repositorio real y activo del usuario en HKCU)
    try {
      $regUwp = 'HKCU:\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\Repository\\Packages'
      $apps = @(Get-ChildItem -Path $regUwp -ErrorAction SilentlyContinue | 
        Where-Object { $_.PSChildName -match 'BingNews|BingWeather|SolitaireCollection|FeedbackHub|GetHelp|ZuneVideo|ZuneMusic|MixedReality\\.Portal|PowerAutomateDesktop|Microsoft\\.Todos|Clipchamp|Microsoft\\.People|YourPhone|WindowsCopilot' } | 
        Select-Object -ExpandProperty PSChildName)
      $data['bloat_apps'] = $apps
    } catch { $data['bloat_apps'] = @() }

    # Copilot & Widgets
    try {
      $copilotPol = (Get-ItemProperty 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot' -Name 'TurnOffWindowsCopilot' -ErrorAction SilentlyContinue).TurnOffWindowsCopilot
      $widgetsPol = (Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'TaskbarDa' -ErrorAction SilentlyContinue).TaskbarDa
      $data['copilot_disabled'] = ($copilotPol -eq 1 -or $widgetsPol -eq 0)
    } catch { $data['copilot_disabled'] = $false }

    # Error Reporting (WerSvc)
    try {
      $wer = Get-Service -Name 'WerSvc' -ErrorAction SilentlyContinue
      $data['wersvc_running'] = ($wer.Status -eq 'Running')
    } catch { $data['wersvc_running'] = $false }

    # 4. Ajustes de Rendimiento
    # Plan de Energía
    try {
      $plan = powercfg /getactivescheme
      $data['is_high_power'] = ($plan -match 'e9a42b02|8c5e7fda|Rion|Apex|Ultimate|High performance|Alto rendimiento')
      $data['power_scheme_name'] = if ($plan -match '\\((.*)\\)') { $matches[1] } else { 'Predeterminado' }
    } catch { 
      $data['is_high_power'] = $false 
      $data['power_scheme_name'] = 'Desconocido'
    }

    # Game Mode
    try {
      $gm = (Get-ItemProperty 'HKCU:\\Software\\Microsoft\\GameBar' -Name 'AutoGameModeEnabled' -ErrorAction SilentlyContinue).AutoGameModeEnabled
      $data['game_mode_enabled'] = ($gm -eq 1)
    } catch { $data['game_mode_enabled'] = $false }

    # Game DVR
    try {
      $dvr = (Get-ItemProperty 'HKCU:\\System\\GameConfigStore' -Name 'GameDVR_Enabled' -ErrorAction SilentlyContinue).GameDVR_Enabled
      $data['game_dvr_disabled'] = ($dvr -eq 0)
    } catch { $data['game_dvr_disabled'] = $false }

    # CPU Priority Separation (24 = Design Studio / 38 y 40 = Gaming)
    try {
      $prio = (Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl' -Name 'Win32PrioritySeparation' -ErrorAction SilentlyContinue).Win32PrioritySeparation
      $data['cpu_prio_optimized'] = ($prio -eq 38 -or $prio -eq 40 -or $prio -eq 24)
    } catch { $data['cpu_prio_optimized'] = $false }

    # 5. Red y Latencia
    # Nagle
    try {
      $nagleOk = $false
      $netKeys = Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces' -ErrorAction SilentlyContinue
      foreach ($k in $netKeys) {
        $p = Get-ItemProperty -LiteralPath $k.PSPath -ErrorAction SilentlyContinue
        if ($p.TcpAckFrequency -eq 1 -and $p.TCPNoDelay -eq 1) {
          $nagleOk = $true; break
        }
      }
      $data['nagle_optimized'] = $nagleOk
    } catch { $data['nagle_optimized'] = $false }

    # DNS (Evaluación dual: Registro de Windows sin dependencia de CIM + respaldo)
    try {
      $allReg = Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\*' -ErrorAction SilentlyContinue
      $fastDnsFound = @()
      $activeDnsList = @()
      foreach ($iface in $allReg) {
        $ns = $iface.NameServer
        if (-not $ns) { $ns = $iface.DhcpNameServer }
        if ($ns) {
          $servers = $ns -split '[, ]+' | Where-Object { $_ -ne '' }
          $activeDnsList += $servers
          if ($servers -contains '1.1.1.1' -or $servers -contains '1.0.0.1' -or $servers -contains '8.8.8.8' -or $servers -contains '8.8.4.4' -or $servers -contains '9.9.9.9' -or $servers -contains '149.112.112.112') {
            $fastDnsFound += $servers
          }
        }
      }

      # Respaldo vía Get-DnsClientServerAddress si está disponible sin error CIM
      if ($fastDnsFound.Count -eq 0) {
        try {
          $dnsServers = (Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.ServerAddresses.Count -gt 0 } | Select-Object -First 1).ServerAddresses
          if ($dnsServers -contains '1.1.1.1' -or $dnsServers -contains '1.0.0.1' -or $dnsServers -contains '8.8.8.8' -or $dnsServers -contains '9.9.9.9') {
            $fastDnsFound += $dnsServers
          }
        } catch {}
      }

      $data['is_fast_dns'] = ($fastDnsFound.Count -gt 0)
      if ($data['is_fast_dns']) {
        $data['current_dns'] = (($fastDnsFound | Select-Object -Unique) -join ', ')
      } else {
        $data['current_dns'] = if ($activeDnsList.Count -gt 0) { (($activeDnsList | Select-Object -Unique) -join ', ') } else { 'Automático / ISP' }
      }
    } catch { 
      $data['is_fast_dns'] = $false 
      $data['current_dns'] = 'Automático / ISP'
    }

    $data | ConvertTo-Json -Depth 3
  `;

  let raw = {};
  try {
    const output = await runPsScript(auditScript);
    raw = JSON.parse(output);
  } catch (err) {
    console.error('[SystemAudit] Error obteniendo datos de auditoría:', err.message);
    throw new Error('No se pudo obtener la auditoría real de Windows: ' + err.message);
  }

  // --- Evaluación y Cálculo de Puntuaciones ---

  // 1. Mantenimiento (Máx 153 pts)
  // - Integridad de Windows (SFC): 51 pts
  let sfcScore = 0;
  let sfcStatus = 'warning';
  let sfcLabel = 'Nunca se ejecutó';
  if (raw.cbs_days_ago !== undefined && raw.cbs_days_ago <= 7) {
    sfcScore = 51;
    sfcStatus = 'ok';
    sfcLabel = `Al día (${raw.cbs_date})`;
  } else if (raw.cbs_days_ago <= 30) {
    sfcScore = 30;
    sfcStatus = 'warning';
    sfcLabel = `Hace ${raw.cbs_days_ago} días`;
  } else {
    sfcScore = 0;
    sfcStatus = 'critical';
    sfcLabel = 'Requiere análisis';
  }

  // - Limpieza de archivos temporales: 102 pts
  let cleanScore = 0;
  let cleanStatus = 'ok';
  let cleanLabel = 'Completo';
  const tempMb = raw.temp_mb || 0;
  if (tempMb < 250) {
    cleanScore = 102;
    cleanStatus = 'ok';
    cleanLabel = `Completo (${tempMb} MB)`;
  } else if (tempMb < 1500) {
    cleanScore = 60;
    cleanStatus = 'warning';
    cleanLabel = `Atención (${tempMb} MB temp)`;
  } else {
    cleanScore = 20;
    cleanStatus = 'critical';
    cleanLabel = `Crítico (${tempMb} MB acumulados)`;
  }

  const mantenimientoCategory = {
    id: 'mantenimiento',
    title: 'Mantenimiento',
    score: sfcScore + cleanScore,
    maxScore: 153,
    status: (sfcScore + cleanScore) >= 140 ? 'ok' : ((sfcScore + cleanScore) >= 70 ? 'warning' : 'critical'),
    statusLabel: (sfcScore + cleanScore) >= 140 ? 'Excelente' : 'Requiere atención',
    items: [
      {
        id: 'audit_sfc',
        title: 'Antigüedad del análisis de integridad de Windows',
        score: sfcScore,
        maxScore: 51,
        status: sfcStatus,
        statusLabel: sfcLabel,
        description: 'Comprueba y repara archivos corruptos del sistema operativo (SFC / DISM).',
        actionId: 'run_sfc',
        actionLabel: 'Analizar Integridad (SFC)',
        detailsTarget: 'C:\\Windows\\System32\\sfc.exe, DISM.exe',
        detailsChanges: 'Ejecuta el Comprobador de Archivos de Sistema de Windows (SFC). Verifica la firma criptográfica y repara archivos del kernel dañados sin alterar documentos ni programas.',
        detailsReason: 'Garantiza la estabilidad del sistema y previene pantallas azules (BSOD) o cierres inesperados de juegos.'
      },
      {
        id: 'audit_cleanup',
        title: 'Antigüedad de la limpieza',
        score: cleanScore,
        maxScore: 102,
        status: cleanStatus,
        statusLabel: cleanLabel,
        description: 'Elimina cachés de DirectX, archivos temporales del sistema y registros residuales.',
        actionId: 'clean_temp',
        actionLabel: 'Limpiar Archivos Temporales',
        detailsTarget: '%TEMP%, C:\\Windows\\Temp, Caché DirectX (D3DSCache)',
        detailsChanges: 'Elimina archivos temporales residuales (.tmp, .log, .dmp), cachés antiguas de DirectX y miniaturas acumuladas por instaladores.',
        detailsReason: 'Libera espacio en tu SSD y agiliza las operaciones de lectura/escritura del disco.'
      }
    ]
  };

  // 2. GPU y Controladores (Máx 204 pts)
  // - Driver de GPU: 100 pts
  let gpuDriverScore = 20;
  let gpuStatus = 'critical';
  let gpuLabel = 'Controlador básico de Windows';
  let gpuDesc = 'No se detectó GPU dedicada o usa el driver básico de Microsoft.';
  if (raw.gpu && raw.gpu.DriverDesc) {
    const isDedicated = /NVIDIA|GeForce|AMD|Radeon/i.test(raw.gpu.DriverDesc);
    const isIntel = /Intel/i.test(raw.gpu.DriverDesc);
    if (isDedicated || isIntel) {
      gpuDriverScore = 100;
      gpuStatus = 'ok';
      gpuLabel = `Óptimo (${raw.gpu.DriverDesc})`;
      gpuDesc = `Controlador: ${raw.gpu.DriverVersion || 'OK'} - Fecha: ${raw.gpu.DriverDate || 'Reciente'}`;
    }
  }

  // - HAGS (Hardware Accelerated GPU Scheduling): 50 pts
  const hagsEnabled = (raw.hags === 2);
  const hagsScore = hagsEnabled ? 50 : 0;
  const hagsStatus = hagsEnabled ? 'ok' : 'warning';
  const hagsLabel = hagsEnabled ? 'Activado' : 'Desactivado';

  // - DirectX Global High Performance: 54 pts
  const dxPref = raw.dx_pref || '';
  const dxOptimized = dxPref.includes('GpuPreference=2');
  const dxScore = dxOptimized ? 54 : 14;
  const dxStatus = dxOptimized ? 'ok' : 'warning';
  const dxLabel = dxOptimized ? 'Alto Rendimiento' : 'Sin asignar';

  const gpuCategory = {
    id: 'gpu',
    title: 'GPU y controladores',
    score: gpuDriverScore + hagsScore + dxScore,
    maxScore: 204,
    status: (gpuDriverScore + hagsScore + dxScore) >= 190 ? 'ok' : 'warning',
    statusLabel: (gpuDriverScore + hagsScore + dxScore) >= 190 ? 'Excelente' : 'Requiere atención',
    items: [
      {
        id: 'audit_gpu_driver',
        title: 'Estado del controlador gráfico dedicado',
        score: gpuDriverScore,
        maxScore: 100,
        status: gpuStatus,
        statusLabel: gpuLabel,
        description: gpuDesc,
        actionId: 'check_gpu_driver',
        actionLabel: 'Ver Detalles de GPU',
        detailsTarget: 'Administrador de Dispositivos -> Adaptadores de Pantalla',
        detailsChanges: 'Verifica que tu tarjeta gráfica cuente con los controladores oficiales del fabricante instalados y no los genéricos de Microsoft.',
        detailsReason: 'Garantiza soporte completo para DirectX 12, Vulkan, renderizado CUDA/NVENC y frecuencias máximas.'
      },
      {
        id: 'audit_hags',
        title: 'Aceleración por hardware GPU (HAGS)',
        score: hagsScore,
        maxScore: 50,
        status: hagsStatus,
        statusLabel: hagsLabel,
        description: 'Reduce la latencia de renderizado delegando la gestión de memoria VRAM directamente a la GPU.',
        actionId: 'enable_hags',
        actionLabel: 'Activar HAGS',
        detailsTarget: 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers -> HwSchMode = 2',
        detailsChanges: 'Establece HwSchMode en 2 en el registro. La GPU administra su propia memoria de video VRAM de forma directa.',
        detailsReason: 'Disminuye la latencia de entrada (input lag) y alivia el uso de la CPU en juegos de alta carga gráfica.'
      },
      {
        id: 'audit_dx_pref',
        title: 'Preferencia global de GPU para Alto Rendimiento',
        score: dxScore,
        maxScore: 54,
        status: dxStatus,
        statusLabel: dxLabel,
        description: 'Fuerza a DirectX a asignar la tarjeta gráfica de máximo rendimiento a todas las aplicaciones.',
        actionId: 'set_gpu_high_perf',
        actionLabel: 'Forzar Alto Rendimiento',
        detailsTarget: 'HKCU:\\Software\\Microsoft\\DirectX\\UserGpuPreferences -> DirectXUserGlobalSettings',
        detailsChanges: 'Agrega "GpuPreference=2;" a la configuración global de DirectX en el registro de Windows.',
        detailsReason: 'Evita que los juegos o programas de diseño se ejecuten por error en la GPU integrada de bajo consumo.'
      }
    ]
  };

  // 3. Debloat y Privacidad de Windows (Máx 233 pts)
  // - DiagTrack Telemetry: 60 pts
  const telemetryOff = (!raw.diagtrack_running || raw.diagtrack_start === 'Disabled');
  const telemetryScore = telemetryOff ? 60 : 0;
  const telemetryStatus = telemetryOff ? 'ok' : 'warning';
  const telemetryLabel = telemetryOff ? 'Desactivada' : 'Rastreo Activo';

  // - Bloatware apps: 83 pts
  const bloatList = raw.bloat_apps || [];
  const detectedBloat = bloatList.length;
  let bloatScore = 83;
  let bloatStatus = 'ok';
  let bloatLabel = 'Sin Bloatware';
  if (detectedBloat === 0) {
    bloatScore = 83;
    bloatStatus = 'ok';
    bloatLabel = 'Sin Bloatware (0 detectadas)';
  } else {
    // Escala proporcional dinámica: cada app eliminada otorga puntos de inmediato al sistema
    const totalCatalogApps = 14;
    const cleanedCount = Math.max(0, totalCatalogApps - detectedBloat);
    // Base 15 pts hasta 83 pts proporcional al progreso de limpieza (59 pts con 5 apps, 64 pts con 4 apps, etc.)
    bloatScore = Math.min(83, Math.max(15, Math.round(15 + (cleanedCount / totalCatalogApps) * (83 - 15))));
    bloatStatus = detectedBloat <= 2 ? 'ok' : 'warning';
    bloatLabel = `${detectedBloat} apps detectadas`;
  }

  // - Copilot & Widgets: 50 pts
  const copilotOff = !!raw.copilot_disabled;
  const copilotScore = copilotOff ? 50 : 10;
  const copilotStatus = copilotOff ? 'ok' : 'warning';
  const copilotLabel = copilotOff ? 'Desactivado' : 'Activo en barra';

  // - WerSvc (Error Reporting): 40 pts
  const werOff = !raw.wersvc_running;
  const werScore = werOff ? 40 : 10;
  const werStatus = werOff ? 'ok' : 'warning';
  const werLabel = werOff ? 'Desactivado' : 'En ejecución';

  const debloatCategory = {
    id: 'debloat',
    title: 'Debloat y Privacidad de Windows',
    score: telemetryScore + bloatScore + copilotScore + werScore,
    maxScore: 233,
    status: (telemetryScore + bloatScore + copilotScore + werScore) >= 200 ? 'ok' : 'warning',
    statusLabel: (telemetryScore + bloatScore + copilotScore + werScore) >= 200 ? 'Excelente' : 'Requiere atención',
    items: [
      {
        id: 'audit_telemetry',
        title: 'Telemetría y Rastreo de Diagnóstico (DiagTrack)',
        score: telemetryScore,
        maxScore: 60,
        status: telemetryStatus,
        statusLabel: telemetryLabel,
        description: 'Detiene el envío periódico de registros de uso y datos de telemetría a servidores de Microsoft.',
        actionId: 'disable_telemetry',
        actionLabel: 'Desactivar Telemetría',
        detailsTarget: 'Servicios: DiagTrack, dmwappushservice | Registro: Policies\\DataCollection -> AllowTelemetry = 0',
        detailsChanges: 'Detiene y deshabilita los servicios de diagnóstico y bloquea la telemetría periódica mediante políticas de Windows.',
        detailsReason: 'Ahorra ciclos continuos de CPU y ancho de banda en segundo plano, maximizando tu privacidad.'
      },
      {
        id: 'audit_bloatware',
        title: 'Aplicaciones Bloatware de Windows en Segundo Plano',
        score: bloatScore,
        maxScore: 83,
        status: bloatStatus,
        statusLabel: bloatLabel,
        description: 'Elimina apps preinstaladas innecesarias (Bing News, Bing Weather, Solitaire, Feedback Hub, etc.).',
        actionId: 'run_debloat',
        actionLabel: 'Debloat Rápido',
        detailsTarget: 'Paquetes UWP (%LOCALAPPDATA%\\Packages)',
        detailsChanges: 'Permite desinstalar de forma granular mediante botones individuales aplicaciones basura preinstaladas.',
        detailsReason: 'Libera entre 1 GB y 4 GB de disco y detiene procesos en segundo plano que consumen memoria RAM.'
      },
      {
        id: 'audit_copilot',
        title: 'Windows Copilot y Widgets de Noticias',
        score: copilotScore,
        maxScore: 50,
        status: copilotStatus,
        statusLabel: copilotLabel,
        description: 'Desactiva la integración web de Copilot y el feed de noticias MSN en la barra de tareas.',
        actionId: 'disable_copilot',
        actionLabel: 'Desactivar Widgets',
        detailsTarget: 'HKCU & HKLM Policies\\WindowsCopilot -> TurnOffWindowsCopilot = 1 | Explorer\\Advanced -> TaskbarDa = 0',
        detailsChanges: 'Deshabilita la IA Copilot en el sistema y oculta el icono de widgets con noticias MSN de la barra de tareas.',
        detailsReason: 'Elimina el proceso msedgewebview2.exe permanente que consume entre 200 MB y 500 MB de memoria RAM.'
      },
      {
        id: 'audit_wer',
        title: 'Servicio de Informe de Errores (WerSvc)',
        score: werScore,
        maxScore: 40,
        status: werStatus,
        statusLabel: werLabel,
        description: 'Evita bloqueos de ventanas congeladas al enviar reportes de cuelgues por Internet.',
        actionId: 'disable_wer',
        actionLabel: 'Desactivar WerSvc',
        detailsTarget: 'Servicio WerSvc (Informe de errores de Windows)',
        detailsChanges: 'Detiene y establece el servicio WerSvc en modo Deshabilitado.',
        detailsReason: 'Evita que Windows congele una ventana cuando una aplicación se bloquea mientras recopila y sube datos a Internet.'
      }
    ]
  };

  // 4. Ajustes de Rendimiento y Sistema (Máx 260 pts)
  // - Plan de energía: 80 pts
  const powerOk = !!raw.is_high_power;
  const powerScore = powerOk ? 80 : 25;
  const powerStatus = powerOk ? 'ok' : 'warning';
  const powerLabel = powerOk ? `Activo (${raw.power_scheme_name || 'Alto Rendimiento'})` : 'Equilibrado';

  // - Modo Juego: 60 pts
  const gameModeOk = !!raw.game_mode_enabled;
  const gameModeScore = gameModeOk ? 60 : 0;
  const gameModeStatus = gameModeOk ? 'ok' : 'warning';
  const gameModeLabel = gameModeOk ? 'Activado' : 'Desactivado';

  // - GameDVR: 60 pts
  const dvrDisabled = !!raw.game_dvr_disabled;
  const dvrScore = dvrDisabled ? 60 : 0;
  const dvrStatus = dvrDisabled ? 'ok' : 'warning';
  const dvrLabel = dvrDisabled ? 'Desactivado (Sin pérdida de FPS)' : 'Grabando en segundo plano';

  // - CPU Priority Separation: 60 pts
  const cpuPrioOk = !!raw.cpu_prio_optimized;
  const cpuPrioScore = cpuPrioOk ? 60 : 20;
  const cpuPrioStatus = cpuPrioOk ? 'ok' : 'warning';
  const cpuPrioLabel = cpuPrioOk ? 'Optimizado (0x26 Hex)' : 'Predeterminado';

  const rendimientoCategory = {
    id: 'rendimiento',
    title: 'Ajustes de Rendimiento',
    score: powerScore + gameModeScore + dvrScore + cpuPrioScore,
    maxScore: 260,
    status: (powerScore + gameModeScore + dvrScore + cpuPrioScore) >= 230 ? 'ok' : 'warning',
    statusLabel: (powerScore + gameModeScore + dvrScore + cpuPrioScore) >= 230 ? 'Excelente' : 'Requiere atención',
    items: [
      {
        id: 'audit_power_plan',
        title: 'Plan de Energía de Rendimiento Máximo',
        score: powerScore,
        maxScore: 80,
        status: powerStatus,
        statusLabel: powerLabel,
        description: 'Elimina estrangulamientos de energía y asegura frecuencias máximas constantes en CPU.',
        actionId: 'activate_power_plan',
        actionLabel: 'Activar Ultimate Plan',
        detailsTarget: 'powercfg.exe -> Plan Ultimate Performance (e9a42b02-d5df-448d-aa00-03f14749eb61)',
        detailsChanges: 'Inyecta y activa el plan de Rendimiento Máximo de Windows. Fija el estado mínimo y máximo del procesador al 100% y bloquea la suspensión USB.',
        detailsReason: 'Elimina el micro-stuttering derivado del Core Parking y los cambios de frecuencia bruscos de la CPU.'
      },
      {
        id: 'audit_game_mode',
        title: 'Modo de Juego de Windows',
        score: gameModeScore,
        maxScore: 60,
        status: gameModeStatus,
        statusLabel: gameModeLabel,
        description: 'Prioriza ciclos de GPU y CPU exclusivamente para juegos en ejecución.',
        actionId: 'enable_game_mode',
        actionLabel: 'Activar Modo Juego',
        detailsTarget: 'HKCU:\\Software\\Microsoft\\GameBar -> AutoGameModeEnabled = 1',
        detailsChanges: 'Habilita el Modo de Juego del kernel de Windows.',
        detailsReason: 'Windows asigna prioridad de reloj en tiempo real a los subprocesos del juego y restringe los procesos de fondo.'
      },
      {
        id: 'audit_gamedvr',
        title: 'Xbox GameDVR (Captura en segundo plano)',
        score: dvrScore,
        maxScore: 60,
        status: dvrStatus,
        statusLabel: dvrLabel,
        description: 'Desactiva la grabación y búfer de video permanente en segundo plano para recuperar FPS.',
        actionId: 'disable_gamedvr',
        actionLabel: 'Desactivar GameDVR',
        detailsTarget: 'HKCU:\\System\\GameConfigStore -> GameDVR_Enabled = 0 | Policies -> AppCaptureEnabled = 0',
        detailsChanges: 'Desactiva la grabación automática en bucle y capturas de fondo de la barra de juegos de Xbox.',
        detailsReason: 'Recupera entre un 5% y un 15% de FPS estables y reduce drásticamente el uso de VRAM y codificador de video.'
      },
      {
        id: 'audit_cpu_priority',
        title: 'Separación de Prioridades de CPU (Win32PrioritySeparation)',
        score: cpuPrioScore,
        maxScore: 60,
        status: cpuPrioStatus,
        statusLabel: cpuPrioLabel,
        description: 'Otorga cuotas mayores de procesamiento a las ventanas en primer plano y juegos.',
        actionId: 'optimize_cpu_prio',
        actionLabel: 'Optimizar Prioridad CPU',
        detailsTarget: 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl -> Win32PrioritySeparation = 38 (0x26 Hex)',
        detailsChanges: 'Configura quantum de tiempo de CPU optimizado: tiempos de procesamiento más largos y estables para la ventana en foco.',
        detailsReason: 'Mejora la suavidad de fotogramas (1% Low FPS) y evita tirones cuando otros programas intentan competir por la CPU.'
      }
    ]
  };

  // 5. Red y Latencia (Máx 150 pts)
  // - Nagle Algorithm: 75 pts
  const nagleOk = !!raw.nagle_optimized;
  const nagleScore = nagleOk ? 75 : 0;
  const nagleStatus = nagleOk ? 'ok' : 'warning';
  const nagleLabel = nagleOk ? 'Optimizado (Sin buffer delay)' : 'Estándar';

  // - DNS Rápido: 75 pts
  const dnsOk = !!raw.is_fast_dns;
  const dnsScore = dnsOk ? 75 : 25;
  const dnsStatus = dnsOk ? 'ok' : 'warning';
  const dnsLabel = dnsOk ? `Baja Latencia (${raw.current_dns || 'Cloudflare/Google'})` : 'DNS Predeterminado ISP';

  const redCategory = {
    id: 'red',
    title: 'Red y Latencia TCP/IP',
    score: nagleScore + dnsScore,
    maxScore: 150,
    status: (nagleScore + dnsScore) >= 140 ? 'ok' : 'warning',
    statusLabel: (nagleScore + dnsScore) >= 140 ? 'Excelente' : 'Requiere atención',
    items: [
      {
        id: 'audit_nagle',
        title: 'Algoritmo de Nagle (TcpAckFrequency & TCPNoDelay)',
        score: nagleScore,
        maxScore: 75,
        status: nagleStatus,
        statusLabel: nagleLabel,
        description: 'Envía paquetes de red de inmediato sin esperar a llenar el búfer, bajando el ping en juegos.',
        actionId: 'optimize_nagle',
        actionLabel: 'Desactivar Nagle',
        detailsTarget: 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces -> TcpAckFrequency=1, TCPNoDelay=1',
        detailsChanges: 'Desactiva el algoritmo de retraso de paquetes de Nagle en las interfaces de red activas.',
        detailsReason: 'Fuerza el envío instantáneo de paquetes de red sin esperar a llenar búferes, reduciendo el ping y la latencia en juegos online.'
      },
      {
        id: 'audit_dns',
        title: 'Servidor DNS de Alto Rendimiento',
        score: dnsScore,
        maxScore: 75,
        status: dnsStatus,
        statusLabel: dnsLabel,
        description: 'Resuelve dominios y servidores de emparejamiento con latencia mínima (Cloudflare 1.1.1.1).',
        actionId: 'set_cloudflare_dns',
        actionLabel: 'Configurar DNS 1.1.1.1',
        detailsTarget: 'Configuración de Adaptador de Red -> Servidores DNS IPv4 (1.1.1.1 y 1.0.0.1)',
        detailsChanges: 'Establece los servidores DNS de Cloudflare de ultra baja latencia en los adaptadores de red activos.',
        detailsReason: 'Mejora la velocidad de resolución de nombres, agiliza la conexión a partidas y previene el rastreo de tu proveedor de Internet.'
      }
    ]
  };

  const totalScore = mantenimientoCategory.score +
                     gpuCategory.score +
                     debloatCategory.score +
                     rendimientoCategory.score +
                     redCategory.score;

  const result = {
    totalScore: Math.min(1000, Math.max(0, totalScore)),
    maxPossibleScore: 1000,
    lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    categories: [
      mantenimientoCategory,
      gpuCategory,
      debloatCategory,
      rendimientoCategory,
      redCategory
    ]
  };
  cachedAudit = result;
  cachedAuditTime = Date.now();
  return result;
}

/**
 * Ejecuta una acción de reparación/optimización específica del sistema de auditoría
 */
const AUDIT_TWEAKS = Object.freeze({
  enable_hags: 'hags_gpu_scheduling', set_gpu_high_perf: 'design_gpu_creative_acceleration',
  disable_wer: 'svc_error_reporting', activate_power_plan: 'power_plan_ultimate',
  enable_game_mode: 'game_mode_windows', disable_gamedvr: 'game_dvr', optimize_nagle: 'tcp_nagle_disabled',
  clean_shader_cache: 'clean_shader_cache', clean_windows_update: 'clean_software_distribution'
});
const AUDIT_EXTRAS = {
  optimize_cpu_prio: { resource: 'audit_cpu_priority', script: "Set-ItemProperty -LiteralPath 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl' -Name Win32PrioritySeparation -Value 38 -Type DWord -Force", check: "if ((Get-ItemProperty -LiteralPath 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl').Win32PrioritySeparation -eq 38) { 'true' } else { 'false' }" },
  disable_telemetry: { resource: 'audit_telemetry', script: "foreach ($name in @('DiagTrack','dmwappushservice')) { if (Get-Service -Name $name -ErrorAction SilentlyContinue) { Stop-Service -Name $name -ErrorAction Stop; Set-Service -Name $name -StartupType Disabled -ErrorAction Stop } }; New-ApexRegistryKey -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' | Out-Null; Set-ItemProperty -LiteralPath 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' -Name AllowTelemetry -Value 0 -Type DWord -Force", check: "if (@(Get-Service -Name DiagTrack,dmwappushservice -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Running' -or $_.StartType -ne 'Disabled' }).Count -eq 0 -and (Get-ItemProperty -LiteralPath 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection').AllowTelemetry -eq 0) { 'true' } else { 'false' }" },
  disable_copilot: { resource: 'audit_copilot_widgets', script: "New-ApexRegistryKey -Path 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot' | Out-Null; New-ApexRegistryKey -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' | Out-Null; Set-ItemProperty -LiteralPath 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot' -Name TurnOffWindowsCopilot -Value 1 -Type DWord -Force; Set-ItemProperty -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name TaskbarDa -Value 0 -Type DWord -Force", check: "if ((Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot').TurnOffWindowsCopilot -eq 1 -and (Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced').TaskbarDa -eq 0) { 'true' } else { 'false' }" },
  optimize_ui_delay: { resource: 'audit_ui_delay', script: "Set-ItemProperty -LiteralPath 'HKCU:\\Control Panel\\Desktop' -Name MenuShowDelay -Value '0' -Force; Set-ItemProperty -LiteralPath 'HKCU:\\Control Panel\\Desktop' -Name ForegroundLockTimeout -Value 0 -Type DWord -Force; Set-ItemProperty -LiteralPath 'HKLM:\\SYSTEM\\CurrentControlSet\\Control' -Name WaitToKillServiceTimeout -Value '2000' -Force", check: "if ((Get-ItemProperty -LiteralPath 'HKCU:\\Control Panel\\Desktop').MenuShowDelay -eq '0' -and (Get-ItemProperty -LiteralPath 'HKCU:\\Control Panel\\Desktop').ForegroundLockTimeout -eq 0 -and (Get-ItemProperty -LiteralPath 'HKLM:\\SYSTEM\\CurrentControlSet\\Control').WaitToKillServiceTimeout -eq '2000') { 'true' } else { 'false' }" }
};
let auditEngine;
function getAuditEngine() { return auditEngine || (auditEngine = new (require('./optimizerEngine').OptimizerEngine)()); }
function configureAuditEngine(engine) { auditEngine = engine; }
async function applyAuditMutation(actionId, dependencies = {}) {
  const engine = dependencies.engine || getAuditEngine();
  let result;
  if (AUDIT_TWEAKS[actionId]) result = await engine.applyTweak(AUDIT_TWEAKS[actionId]);
  else if (AUDIT_EXTRAS[actionId]) {
    const item = AUDIT_EXTRAS[actionId];
    result = await engine.restoration.apply('audit:' + item.resource, require('./restorationResources').getResources(item.resource), item.script, item.check);
  } else if (actionId === 'set_cloudflare_dns') result = await (dependencies.network || require('./networkTools')).setDnsProvider('cloudflare');
  else if (actionId === 'clean_temp') {
    const results = [];
    for (const id of ['clean_temp_files','clean_windows_temp','clean_shader_cache']) results.push(await engine.applyTweak(id));
    result = { success: results.every(item => item.success), results, message: results.map(item => item.message).join('\n') };
  } else throw new Error('Acción de auditoría no reconocida.');
  if (!result || !result.success) throw new Error(result?.message || 'Windows no confirmó la operación.');
  return result;
}
async function executeAuditAction(actionId) {
  cachedAudit = null; cachedAuditTime = 0;
  if (actionId === 'optimize_all_audit') return optimizeAllAudits();
  if (actionId === 'run_debloat') {
    const result = await executeCustomDebloat(BLOAT_CATALOG.map(item => item.id));
    if (!result.success) throw new Error(result.message);
    return result.audit;
  }
  if (actionId === 'run_sfc') {
    await runPsScript("& sfc.exe /scannow; if ($LASTEXITCODE -ne 0) { throw 'SFC no confirmó una reparación completa. Revisa el resultado de Windows.' }",{},{timeout:1800000});
  } else if (actionId === 'check_gpu_driver') await runPsScript('Start-Process devmgmt.msc');
  else await applyAuditMutation(actionId);
  return runSystemAudit(true);
}

/**
 * Aplica todas las optimizaciones recomendadas de auditoría para maximizar la puntuación
 */
async function optimizeAllAudits() {
  cachedAudit = null;
  const actions = [
    'clean_temp',
    'enable_hags',
    'set_gpu_high_perf',
    'disable_telemetry',
    'disable_copilot',
    'disable_wer',
    'activate_power_plan',
    'enable_game_mode',
    'disable_gamedvr',
    'optimize_cpu_prio',
    'optimize_nagle',
    'set_cloudflare_dns'
  ];

  const results = [];
  for (const act of actions) {
    try { await executeAuditAction(act); results.push({ actionId: act, success: true }); }
    catch (err) { results.push({ actionId: act, success: false, message: err.message }); }
  }
  return { ...await runSystemAudit(true), results, success: results.every(item => item.success) };
}

const BLOAT_CATALOG = [
  {
    id: 'bing_news',
    pattern: 'BingNews',
    name: 'Noticias MSN (Bing News)',
    desc: 'Noticias y artículos web en segundo plano.',
    category: 'Noticias',
    icon: '📰'
  },
  {
    id: 'bing_weather',
    pattern: 'BingWeather',
    name: 'El Tiempo MSN (Bing Weather)',
    desc: 'Pronóstico del clima y telemetría de ubicación periódica.',
    category: 'Junk / Feed',
    icon: '🌤️'
  },
  {
    id: 'solitaire',
    pattern: 'SolitaireCollection',
    name: 'Colección de Solitario (Solitaire)',
    desc: 'Juego preinstalado con anuncios y conexiones en segundo plano.',
    category: 'Juegos',
    icon: '🃏'
  },
  {
    id: 'feedback_hub',
    pattern: 'FeedbackHub',
    name: 'Centro de Comentarios (Feedback Hub)',
    desc: 'Envío de comentarios y telemetría de diagnóstico a Microsoft.',
    category: 'Telemetría',
    icon: '💬'
  },
  {
    id: 'get_help',
    pattern: 'GetHelp',
    name: 'Obtener Ayuda (Get Help)',
    desc: 'Asistente web de soporte técnico de Windows.',
    category: 'Utilidad',
    icon: '❓'
  },
  {
    id: 'zune_video',
    pattern: 'ZuneVideo',
    name: 'Películas y TV (Zune Video)',
    desc: 'Reproductor UWP nativo. Innecesario si usas VLC, MPC o reproductores modernos.',
    category: 'Multimedia',
    icon: '🎬'
  },
  {
    id: 'zune_music',
    pattern: 'ZuneMusic',
    name: 'Reproductor Multimedia (Groove / Zune Music)',
    desc: 'Reproductor de música UWP preinstalado de Microsoft.',
    category: 'Multimedia',
    icon: '🎵'
  },
  {
    id: 'clipchamp',
    pattern: 'Clipchamp',
    name: 'Clipchamp Editor de Video',
    desc: 'Editor de video preinstalado basado en web (~600 MB).',
    category: 'Multimedia',
    icon: '✂️'
  },
  {
    id: 'mixed_reality',
    pattern: 'MixedReality.Portal',
    name: 'Portal de Realidad Mixta',
    desc: 'Servicios de visor y cascos VR/AR de Windows Mixed Reality.',
    category: 'VR / 3D',
    icon: '🥽'
  },
  {
    id: 'power_automate',
    pattern: 'PowerAutomateDesktop',
    name: 'Power Automate Desktop',
    desc: 'Automatizador empresarial en segundo plano.',
    category: 'Utilidad',
    icon: '⚡'
  },
  {
    id: 'todos',
    pattern: 'Microsoft.Todos',
    name: 'Microsoft To Do',
    desc: 'Gestor de listas y tareas pendientes en segundo plano.',
    category: 'Productividad',
    icon: '📝'
  },
  {
    id: 'people',
    pattern: 'Microsoft.People',
    name: 'Contactos de Windows (People)',
    desc: 'Libreta de contactos y sincronización en segundo plano.',
    category: 'Comunicaciones',
    icon: '👥'
  },
  {
    id: 'your_phone',
    pattern: 'YourPhone',
    name: 'Enlace Móvil (Phone Link)',
    desc: 'Sincronización de llamadas, SMS y notificaciones en segundo plano.',
    category: 'Comunicaciones',
    icon: '📱'
  },
  {
    id: 'copilot',
    pattern: 'WindowsCopilot',
    name: 'Windows Copilot UWP',
    desc: 'Envoltorio UWP de Copilot AI.',
    category: 'IA',
    icon: '🤖'
  }
];

/**
 * Escanea el estado real de instalación de aplicaciones de bloatware (consultando HKCU)
 */
async function getBloatStatus() {
  const out = await runPsScript('ConvertTo-Json -InputObject @(Get-AppxPackage | Select-Object Name,PackageFullName) -Compress');
  const data = JSON.parse(out || '[]');
  const packages = Array.isArray(data) ? data : [data];
  return BLOAT_CATALOG.map(item => {
    const match = packages.find(pkg => String(pkg.Name).toLowerCase().includes(item.pattern.toLowerCase()));
    return { ...item, installed: Boolean(match), package: match?.PackageFullName || '' };
  });
}

/**
 * Desinstala únicamente las aplicaciones seleccionadas por el usuario
 */
async function executeCustomDebloat(selectedIds) {
  if (!Array.isArray(selectedIds) || selectedIds.some(id => typeof id !== 'string' || !BLOAT_CATALOG.some(item => item.id === id))) {
    return { success: false, count: 0, message: 'La selección contiene aplicaciones no reconocidas.' };
  }
  const selected = [...new Set(selectedIds)];
  const before = await getBloatStatus();
  const patterns = BLOAT_CATALOG.filter(item => selected.includes(item.id)).map(item => item.pattern);
  try {
    await runPsScript(`
      foreach ($pattern in $data.patterns) {
        @(Get-AppxPackage -Name ('*' + $pattern + '*') -ErrorAction Stop) | Remove-AppxPackage -ErrorAction Stop
      }
      'OK'
    `, { patterns });
  } catch (error) {
    return { success: false, count: 0, message: error.message, catalog: await getBloatStatus(), audit: await runSystemAudit(true) };
  }
  cachedAudit = null; cachedAuditTime = 0;
  const catalog = await getBloatStatus(), audit = await runSystemAudit(true);
  const count = selected.filter(id => before.some(item => item.id === id && item.installed) && catalog.some(item => item.id === id && !item.installed)).length;
  const remaining = catalog.filter(item => selected.includes(item.id) && item.installed);
  return { success: remaining.length === 0, count, catalog, audit, message: remaining.length ? 'Algunas aplicaciones siguen instaladas. Revisa su estado antes de volver a intentarlo.' : count ? 'Desinstalación comprobada para ' + count + ' aplicación(es) del usuario actual.' : 'No había aplicaciones seleccionadas instaladas para este usuario.' };
}

module.exports = {
  runSystemAudit,
  applyAuditMutation,
  configureAuditEngine,
  AUDIT_TWEAKS, AUDIT_EXTRAS,
  executeAuditAction,
  optimizeAllAudits,
  getBloatStatus,
  executeCustomDebloat
};
