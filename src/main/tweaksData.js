/**
 * Base de datos completa de optimizaciones para Apex PC Optimizer.
 * Inspirada en las mejores utilidades del ecosistema (Paragon Tweaker, RionTool).
 * Cada ajuste es 100% transparente, verificable y reversible.
 */

const TWEAKS_DATA = [
  // ==========================================
  // --- 1. GAMING & LATENCIA (INPUT LAG / FPS) ---
  // ==========================================
  {
    id: 'game_dvr',
    category: 'gaming',
    title: 'Desactivar Xbox GameDVR y Grabación',
    description: 'Elimina la grabación continua de pantalla en segundo plano para evitar micro-tirones (stuttering) y reducir el retraso de entrada (input lag).',
    impact: 'Alto',
    risk: 'Seguro',
    applyScript: `
      New-Item -Path "HKCU:\\System\\GameConfigStore" -Force | Out-Null
      Set-ItemProperty -Path "HKCU:\\System\\GameConfigStore" -Name "GameDVR_Enabled" -Type DWord -Value 0
      New-Item -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR" -Force | Out-Null
      Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR" -Name "AllowGameDVR" -Type DWord -Value 0
      New-Item -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" -Force | Out-Null
      Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" -Name "AppCaptureEnabled" -Type DWord -Value 0
    `,
    revertScript: `
      Set-ItemProperty -Path "HKCU:\\System\\GameConfigStore" -Name "GameDVR_Enabled" -Type DWord -Value 1 -ErrorAction SilentlyContinue
      Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR" -Name "AllowGameDVR" -Type DWord -Value 1 -ErrorAction SilentlyContinue
      Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" -Name "AppCaptureEnabled" -Type DWord -Value 1 -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $val1 = (Get-ItemProperty -Path "HKCU:\\System\\GameConfigStore" -Name "GameDVR_Enabled" -ErrorAction SilentlyContinue).GameDVR_Enabled
      $val2 = (Get-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" -Name "AppCaptureEnabled" -ErrorAction SilentlyContinue).AppCaptureEnabled
      if ($val1 -eq 0 -and $val2 -eq 0) { "true" } else { "false" }
    `
  },
  {
    id: 'game_bar_presence',
    category: 'gaming',
    title: 'Limitar grabación de Xbox Game Bar',
    description: 'Desactiva la preferencia de grabación de juegos del usuario y la directiva AllowGameDVR. Afecta a las capturas de Xbox Game Bar; no garantiza más FPS.',
    impact: 'Medio',
    risk: 'Seguro',
    applyScript: `
      $pol = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR"
      New-ApexRegistryKey -Path $pol | Out-Null
      Set-ItemProperty -Path $pol -Name "AllowGameDVR" -Type DWord -Value 0 -Force
      $gcs = "HKCU:\\System\\GameConfigStore"
      New-ApexRegistryKey -Path $gcs | Out-Null
      Set-ItemProperty -Path $gcs -Name "GameDVR_Enabled" -Type DWord -Value 0 -Force
    `,
    revertScript: `
      throw 'La restauración requiere el estado original guardado por Apex; usa la acción Restaurar de este ajuste.'
    `,
    checkScript: `
      $pol = (Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR" -Name "AllowGameDVR" -ErrorAction SilentlyContinue).AllowGameDVR
      $gcs = (Get-ItemProperty -Path "HKCU:\\System\\GameConfigStore" -Name "GameDVR_Enabled" -ErrorAction SilentlyContinue).GameDVR_Enabled
      if ($null -ne $pol -and $null -ne $gcs -and $pol -eq 0 -and $gcs -eq 0) { "true" } else { "false" }
    `
  },
  {
    id: 'multimedia_priority',
    category: 'gaming',
    title: 'Prioridad Multimedia de Windows',
    description: 'Configura NetworkThrottlingIndex y SystemResponsiveness para que Windows no ralentice paquetes ni reserve recursos mientras juegas.',
    impact: 'Alto',
    risk: 'Seguro',
    applyScript: `
      $path = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile"
      if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
      Set-ItemProperty -Path $path -Name "NetworkThrottlingIndex" -Type DWord -Value 0xFFFFFFFF
      Set-ItemProperty -Path $path -Name "SystemResponsiveness" -Type DWord -Value 0
    `,
    revertScript: `
      $path = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile"
      Set-ItemProperty -Path $path -Name "NetworkThrottlingIndex" -Type DWord -Value 10 -ErrorAction SilentlyContinue
      Set-ItemProperty -Path $path -Name "SystemResponsiveness" -Type DWord -Value 20 -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $path = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile"
      $p = Get-ItemProperty -Path $path -ErrorAction SilentlyContinue
      if ($p.NetworkThrottlingIndex -eq -1 -and $p.SystemResponsiveness -eq 0) { "true" } else { "false" }
    `
  },
  {
    id: 'game_task_priority',
    category: 'gaming',
    title: 'Prioridad de GPU y Programación para Juegos',
    description: 'Fuerza a Windows a asignar prioridad de GPU 8 y categoría de planificación Alta a las tareas de juegos.',
    impact: 'Alto',
    risk: 'Seguro',
    applyScript: `
      $taskPath = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games"
      New-Item -Path $taskPath -Force | Out-Null
      Set-ItemProperty -Path $taskPath -Name "GPU Priority" -Type DWord -Value 8
      Set-ItemProperty -Path $taskPath -Name "Priority" -Type DWord -Value 6
      Set-ItemProperty -Path $taskPath -Name "Scheduling Category" -Type String -Value "High"
      Set-ItemProperty -Path $taskPath -Name "SFIO Priority" -Type String -Value "High"
    `,
    revertScript: `
      $taskPath = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games"
      Set-ItemProperty -Path $taskPath -Name "GPU Priority" -Type DWord -Value 8 -ErrorAction SilentlyContinue
      Set-ItemProperty -Path $taskPath -Name "Priority" -Type DWord -Value 2 -ErrorAction SilentlyContinue
      Set-ItemProperty -Path $taskPath -Name "Scheduling Category" -Type String -Value "Medium" -ErrorAction SilentlyContinue
      Set-ItemProperty -Path $taskPath -Name "SFIO Priority" -Type String -Value "Normal" -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $taskPath = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games"
      $p = Get-ItemProperty -Path $taskPath -ErrorAction SilentlyContinue
      if ($p.Priority -eq 6 -and $p.'Scheduling Category' -eq 'High') { "true" } else { "false" }
    `
  },
  {
    id: 'game_mode_windows',
    category: 'gaming',
    title: 'Modo Juego de Windows (Game Mode)',
    description: 'Activa el programador interno de Windows para concentrar los recursos de CPU/GPU en el juego en pantalla.',
    impact: 'Medio',
    risk: 'Seguro',
    applyScript: `
      New-Item -Path "HKCU:\\Software\\Microsoft\\GameBar" -Force | Out-Null
      Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\GameBar" -Name "AllowAutoGameMode" -Type DWord -Value 1
      Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\GameBar" -Name "AutoGameModeEnabled" -Type DWord -Value 1
    `,
    revertScript: `
      Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\GameBar" -Name "AllowAutoGameMode" -Type DWord -Value 0 -ErrorAction SilentlyContinue
      Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\GameBar" -Name "AutoGameModeEnabled" -Type DWord -Value 0 -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $val = (Get-ItemProperty -Path "HKCU:\\Software\\Microsoft\\GameBar" -Name "AllowAutoGameMode" -ErrorAction SilentlyContinue).AllowAutoGameMode
      if ($val -eq 1) { "true" } else { "false" }
    `
  },
  {
    id: 'hags_gpu_scheduling',
    category: 'gaming',
    title: 'Programación de GPU Acelerada por Hardware (HAGS)',
    description: 'Permite que la tarjeta gráfica gestione directamente su propia memoria VRAM, reduciendo la latencia de cuadros.',
    impact: 'Alto',
    risk: 'Seguro',
    applyScript: `
      $path = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers"
      if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
      Set-ItemProperty -Path $path -Name "HwSchMode" -Type DWord -Value 2
    `,
    revertScript: `
      Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" -Name "HwSchMode" -Type DWord -Value 1 -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $val = (Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" -Name "HwSchMode" -ErrorAction SilentlyContinue).HwSchMode
      if ($val -eq 2) { "true" } else { "false" }
    `
  },
  {
    id: 'power_plan_ultimate',
    category: 'gaming',
    title: 'Plan de Energía de Máximo Rendimiento',
    description: 'Inyecta y activa el esquema Ultimate Performance para mantener las frecuencias del procesador al 100% sin caídas.',
    impact: 'Medio',
    risk: 'Seguro',
    applyScript: `
      $guid = "e9a42b02-d5df-448d-aa00-03f14749eb61"
      $output = powercfg -duplicatescheme $guid 2>&1
      $newGuid = if ($output -match "([a-f0-9\\-]{36})") { $matches[1] } else { $guid }
      powercfg -setactive $newGuid
    `,
    revertScript: `
      powercfg -setactive 381b4222-f694-41f0-9685-ff5bb260df2e
    `,
    checkScript: `
      $active = powercfg -getactivescheme
      if ($active -match "Ultimate|Máximo|Alto") { "true" } else { "false" }
    `
  },

  // ==========================================
  // --- 2. RED Y LATENCIA (NETWORK & PING) ---
  // ==========================================
  {
    id: 'tcp_nagle_disabled',
    category: 'network',
    title: 'Desactivar Algoritmo de Nagle (TcpAck & TCPNoDelay)',
    description: 'Envía paquetes de red inmediatamente sin esperar a que el búfer se llene. Reduce el ping y la fluctuación (jitter) en juegos online.',
    impact: 'Alto',
    risk: 'Seguro',
    applyScript: `
      $interfaces = Get-ChildItem "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces"
      foreach ($iface in $interfaces) {
          Set-ItemProperty -Path $iface.PSPath -Name "TcpAckFrequency" -Type DWord -Value 1 -ErrorAction SilentlyContinue
          Set-ItemProperty -Path $iface.PSPath -Name "TCPNoDelay" -Type DWord -Value 1 -ErrorAction SilentlyContinue
      }
      netsh int tcp set heuristics disabled | Out-Null
    `,
    revertScript: `
      $interfaces = Get-ChildItem "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces"
      foreach ($iface in $interfaces) {
          Remove-ItemProperty -Path $iface.PSPath -Name "TcpAckFrequency" -ErrorAction SilentlyContinue
          Remove-ItemProperty -Path $iface.PSPath -Name "TCPNoDelay" -ErrorAction SilentlyContinue
      }
      netsh int tcp set heuristics default | Out-Null
    `,
    checkScript: `
      $interfaces = Get-ChildItem "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces"
      $found = $false
      foreach ($iface in $interfaces) {
          $val = (Get-ItemProperty -Path $iface.PSPath -Name "TCPNoDelay" -ErrorAction SilentlyContinue).TCPNoDelay
          if ($val -eq 1) { $found = $true; break }
      }
      if ($found) { "true" } else { "false" }
    `
  },
  {
    id: 'tcp_autotuning_optimal',
    category: 'network',
    title: 'Optimizar TCP Window Auto-Tuning',
    description: 'Establece el ajuste de ventana TCP en "Normal" y desactiva heurísticas arbitrarias de limitación de ancho de banda.',
    impact: 'Medio',
    risk: 'Seguro',
    applyScript: `
      netsh int tcp set global autotuninglevel=normal
      netsh int tcp set heuristics disabled
    `,
    revertScript: `
      netsh int tcp set global autotuninglevel=normal
      netsh int tcp set heuristics default
    `,
    checkScript: `
      $res = netsh int tcp show global
      if ($res -match "normal" -and $res -match "disabled") { "true" } else { "false" }
    `
  },
  {
    id: 'tcp_rss_enabled',
    category: 'network',
    title: 'Habilitar Receive Side Scaling (RSS)',
    description: 'Distribuye la carga de procesamiento de paquetes de red entre múltiples núcleos del procesador.',
    impact: 'Medio',
    risk: 'Seguro',
    applyScript: `
      netsh int tcp set global rss=enabled
      Get-NetAdapterRss -ErrorAction SilentlyContinue | ForEach-Object { Set-NetAdapterRss -Name $_.Name -Enabled $true -ErrorAction SilentlyContinue }
    `,
    revertScript: `
      netsh int tcp set global rss=default
    `,
    checkScript: `
      $res = netsh int tcp show global
      if ($res -match "rss.*enabled|Escalado del lado de recepci.*habilitado") { "true" } else { "false" }
    `
  },
  {
    id: 'qos_bandwidth_limit_off',
    category: 'network',
    title: 'Eliminar Reserva de Ancho de Banda QoS (20%)',
    description: 'Evita que el programador de paquetes de Windows reserve el 20% del ancho de banda total para tareas del sistema.',
    impact: 'Medio',
    risk: 'Seguro',
    applyScript: `
      New-Item -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Psched" -Force | Out-Null
      Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Psched" -Name "NonBestEffortLimit" -Type DWord -Value 0
    `,
    revertScript: `
      Remove-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Psched" -Name "NonBestEffortLimit" -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $val = (Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Psched" -Name "NonBestEffortLimit" -ErrorAction SilentlyContinue).NonBestEffortLimit
      if ($val -eq 0) { "true" } else { "false" }
    `
  },
  {
    id: 'tcp_ecn_disabled',
    category: 'network',
    title: 'Desactivar Notificación de Congestión Explícita (ECN)',
    description: 'Evita caídas de conexión y descarte erróneo de paquetes en routers que no soportan cabeceras ECN modernas.',
    impact: 'Bajo',
    risk: 'Seguro',
    applyScript: `
      netsh int tcp set global ecncapability=disabled
    `,
    revertScript: `
      netsh int tcp set global ecncapability=default
    `,
    checkScript: `
      $res = netsh int tcp show global
      if ($res -match "ecncapability.*disabled|notificaci.*deshabilitado") { "true" } else { "false" }
    `
  },

  // ==========================================
  // --- 3. DISEÑO & RENDER (ESTABILIDAD & CACHÉ) ---
  // ==========================================
  {
    id: 'large_system_cache',
    category: 'design',
    title: 'Caché de Sistema Ampliada (LargeSystemCache)',
    description: 'Asigna más memoria RAM para la caché de lectura/escritura del sistema de archivos, ideal para video en 4K/8K, texturas 3D y capas de Photoshop.',
    impact: 'Alto',
    risk: 'Seguro',
    applyScript: `
      $path = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management"
      if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
      Set-ItemProperty -Path $path -Name "LargeSystemCache" -Type DWord -Value 1
    `,
    revertScript: `
      Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management" -Name "LargeSystemCache" -Type DWord -Value 0
    `,
    checkScript: `
      $val = (Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management" -Name "LargeSystemCache" -ErrorAction SilentlyContinue).LargeSystemCache
      if ($val -eq 1) { "true" } else { "false" }
    `
  },
  {
    id: 'render_threads_balance',
    category: 'design',
    title: 'Prioridad Equilibrada para Renderizado en Segundo Plano',
    description: 'Configura Win32PrioritySeparation = 24 para que exportaciones en Premiere, Blender o DaVinci no se congelen al cambiar de ventana.',
    impact: 'Alto',
    risk: 'Seguro',
    applyScript: `
      $path = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl"
      if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
      Set-ItemProperty -Path $path -Name "Win32PrioritySeparation" -Type DWord -Value 24
    `,
    revertScript: `
      $path = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl"
      Set-ItemProperty -Path $path -Name "Win32PrioritySeparation" -Type DWord -Value 38 -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $val = (Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl" -Name "Win32PrioritySeparation" -ErrorAction SilentlyContinue).Win32PrioritySeparation
      if ($val -eq 24) { "true" } else { "false" }
    `
  },
  {
    id: 'long_paths_enabled',
    category: 'design',
    title: 'Habilitar Rutas Largas (>260 Caracteres)',
    description: 'Permite que programas de diseño y motores 3D trabajen con nombres y rutas de archivo profundas sin errores de guardado.',
    impact: 'Medio',
    risk: 'Seguro',
    applyScript: `
      $path = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem"
      if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
      Set-ItemProperty -Path $path -Name "LongPathsEnabled" -Type DWord -Value 1
    `,
    revertScript: `
      Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem" -Name "LongPathsEnabled" -Type DWord -Value 0
    `,
    checkScript: `
      $val = (Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem" -Name "LongPathsEnabled" -ErrorAction SilentlyContinue).LongPathsEnabled
      if ($val -eq 1) { "true" } else { "false" }
    `
  },
  {
    id: 'protect_creative_services',
    category: 'design',
    title: 'Garantizar Servicios de Color (ICC), Tableta Wacom e Impresión',
    description: 'Blinda y asegura el funcionamiento del Sistema de Color WCS, entrada táctil/lápiz (Windows Ink) y acceso a servidores NAS de edición.',
    impact: 'Alto',
    risk: 'Seguro',
    applyScript: `
      Set-Service -Name "TabletInputService" -StartupType Manual -ErrorAction SilentlyContinue
      Start-Service -Name "TabletInputService" -ErrorAction SilentlyContinue
      Set-Service -Name "Spooler" -StartupType Automatic -ErrorAction SilentlyContinue
      Start-Service -Name "Spooler" -ErrorAction SilentlyContinue
      Set-Service -Name "LanmanWorkstation" -StartupType Automatic -ErrorAction SilentlyContinue
      Start-Service -Name "LanmanWorkstation" -ErrorAction SilentlyContinue
    `,
    revertScript: `Write-Output "Servicios verificados en estado estándar."`,
    checkScript: `
      $spool = Get-Service "Spooler" -ErrorAction SilentlyContinue
      if ($spool.Status -eq 'Running') { "true" } else { "false" }
    `
  },
  {
    id: 'design_disable_paging_executive',
    category: 'design',
    title: 'Bloquear Drivers y Plugins Creativos en Memoria RAM Física',
    description: 'Establece DisablePagingExecutive = 1 para evitar que Windows envíe el núcleo y librerías de diseño al archivo de paginación en disco, eliminando congelamientos al cambiar de ventana.',
    impact: 'Alto',
    risk: 'Seguro',
    applyScript: `
      $path = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management"
      if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
      Set-ItemProperty -Path $path -Name "DisablePagingExecutive" -Type DWord -Value 1
    `,
    revertScript: `
      Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management" -Name "DisablePagingExecutive" -Type DWord -Value 0
    `,
    checkScript: `
      $val = (Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management" -Name "DisablePagingExecutive" -ErrorAction SilentlyContinue).DisablePagingExecutive
      if ($val -eq 1) { "true" } else { "false" }
    `
  },
  {
    id: 'design_tablet_stylus_latency_fix',
    category: 'design',
    title: 'Eliminar Retardo y Círculo de Clic Derecho en Tableta Gráfica',
    description: 'Desactiva el retardo de toque prolongado de Windows Ink (HoldMode = 3) y elimina el molesto círculo de espera al apoyar el lápiz en Photoshop, Illustrator y Clip Studio.',
    impact: 'Alto',
    risk: 'Seguro',
    applyScript: `
      $p = "HKCU:\\Software\\Microsoft\\Wisp\\Pen\\SysEventParameters"
      if (-not (Test-Path $p)) { New-Item -Path $p -Force | Out-Null }
      Set-ItemProperty -Path $p -Name "HoldMode" -Type DWord -Value 3 -Force
      Set-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -Name "PenBarrelFeedback" -Type DWord -Value 0 -Force
    `,
    revertScript: `
      $p = "HKCU:\\Software\\Microsoft\\Wisp\\Pen\\SysEventParameters"
      if (Test-Path $p) { Set-ItemProperty -Path $p -Name "HoldMode" -Type DWord -Value 1 -Force }
      Set-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -Name "PenBarrelFeedback" -Type DWord -Value 1 -Force
    `,
    checkScript: `
      $val = (Get-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Wisp\\Pen\\SysEventParameters" -Name "HoldMode" -ErrorAction SilentlyContinue).HoldMode
      if ($val -eq 3) { "true" } else { "false" }
    `
  },
  {
    id: 'design_cleartype_pro_smoothing',
    category: 'design',
    title: 'Suavizado de Fuentes Subpíxel ClearType Ultra-Nítido',
    description: 'Fuerza renderizado ClearType de alta fidelidad subpíxel para que tipografías, vectores y textos en software de diseño se vean con máxima nitidez en pantallas 1080p, 2K y 4K.',
    impact: 'Medio',
    risk: 'Seguro',
    applyScript: `
      Set-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -Name "FontSmoothing" -Value "2" -Force
      Set-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -Name "FontSmoothingType" -Type DWord -Value 2 -Force
    `,
    revertScript: `
      Set-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -Name "FontSmoothing" -Value "2" -Force
      Set-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -Name "FontSmoothingType" -Type DWord -Value 1 -Force
    `,
    checkScript: `
      $val = (Get-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -Name "FontSmoothingType" -ErrorAction SilentlyContinue).FontSmoothingType
      if ($val -eq 2) { "true" } else { "false" }
    `
  },
  {
    id: 'design_gpu_creative_acceleration',
    category: 'design',
    title: 'Asignación Obligatoria de GPU Dedicada a Suites de Diseño',
    description: 'Garantiza que Adobe Premiere, Photoshop, DaVinci Resolve, Blender y OBS siempre utilicen la GPU discreta de máximo rendimiento en lugar de gráficos integrados.',
    impact: 'Extremo',
    risk: 'Seguro',
    applyScript: `
      $p = "HKCU:\\Software\\Microsoft\\DirectX\\UserGpuPreferences"
      if (-not (Test-Path $p)) { New-Item -Path $p -Force | Out-Null }
      $cur = (Get-ItemProperty $p -Name "DirectXUserGlobalSettings" -ErrorAction SilentlyContinue).DirectXUserGlobalSettings
      if (-not $cur) { $cur = "" }
      if ($cur -notmatch "GpuPreference=2") {
        Set-ItemProperty -Path $p -Name "DirectXUserGlobalSettings" -Value (($cur + ";GpuPreference=2;").Trim(";") + ";") -Force
      }
    `,
    revertScript: `Write-Output "Preferencia restablecida."`,
    checkScript: `
      $cur = (Get-ItemProperty "HKCU:\\Software\\Microsoft\\DirectX\\UserGpuPreferences" -Name "DirectXUserGlobalSettings" -ErrorAction SilentlyContinue).DirectXUserGlobalSettings
      if ($cur -match "GpuPreference=2") { "true" } else { "false" }
    `
  },

  // ==========================================
  // --- 4. SERVICIOS DE WINDOWS (SERVICES TOGGLES) ---
  // ==========================================
  {
    id: 'svc_diagtrack',
    category: 'services',
    title: 'Servicio de Telemetría DiagTrack',
    description: 'Connected User Experiences and Telemetry. Envía datos de diagnóstico en segundo plano, consumiendo CPU y disco.',
    impact: 'Medio',
    risk: 'Seguro',
    applyScript: `
      Stop-Service "DiagTrack" -ErrorAction SilentlyContinue
      Set-Service "DiagTrack" -StartupType Disabled -ErrorAction SilentlyContinue
    `,
    revertScript: `
      Set-Service "DiagTrack" -StartupType Automatic -ErrorAction SilentlyContinue
      Start-Service "DiagTrack" -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $s = Get-Service "DiagTrack" -ErrorAction SilentlyContinue
      if ($s -and $s.StartType -eq 'Disabled') { "true" } else { "false" }
    `
  },
  {
    id: 'svc_sysmain',
    category: 'services',
    title: 'Servicio SysMain (Superfetch)',
    description: 'Precarga aplicaciones en RAM. Es innecesario en unidades SSD modernas y puede causar picos del 100% de uso de disco.',
    impact: 'Alto',
    risk: 'Moderado',
    applyScript: `
      Stop-Service "SysMain" -ErrorAction SilentlyContinue
      Set-Service "SysMain" -StartupType Disabled -ErrorAction SilentlyContinue
    `,
    revertScript: `
      Set-Service "SysMain" -StartupType Automatic -ErrorAction SilentlyContinue
      Start-Service "SysMain" -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $s = Get-Service "SysMain" -ErrorAction SilentlyContinue
      if ($s -and $s.StartType -eq 'Disabled') { "true" } else { "false" }
    `
  },
  {
    id: 'svc_wsearch',
    category: 'services',
    title: 'Indexador de Búsqueda de Windows (WSearch)',
    description: 'Indexa constantemente los archivos del disco duro. Desactivarlo reduce drásticamente las lecturas continuas en SSD.',
    impact: 'Medio',
    risk: 'Moderado',
    applyScript: `
      Stop-Service "WSearch" -ErrorAction SilentlyContinue
      Set-Service "WSearch" -StartupType Disabled -ErrorAction SilentlyContinue
    `,
    revertScript: `
      Set-Service "WSearch" -StartupType Automatic -ErrorAction SilentlyContinue
      Start-Service "WSearch" -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $s = Get-Service "WSearch" -ErrorAction SilentlyContinue
      if ($s -and $s.StartType -eq 'Disabled') { "true" } else { "false" }
    `
  },
  {
    id: 'svc_remotereg',
    category: 'services',
    title: 'Servicio de Registro Remoto',
    description: 'Permite que usuarios en red modifiquen el registro de Windows. Desactivarlo ahorra memoria y mejora la seguridad.',
    impact: 'Bajo',
    risk: 'Seguro',
    applyScript: `
      Stop-Service "RemoteRegistry" -ErrorAction SilentlyContinue
      Set-Service "RemoteRegistry" -StartupType Disabled -ErrorAction SilentlyContinue
    `,
    revertScript: `
      Set-Service "RemoteRegistry" -StartupType Disabled -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $s = Get-Service "RemoteRegistry" -ErrorAction SilentlyContinue
      if ($s -and $s.StartType -eq 'Disabled') { "true" } else { "false" }
    `
  },
  {
    id: 'svc_error_reporting',
    category: 'services',
    title: 'Informe de Errores de Windows (WerSvc)',
    description: 'Captura y envía volcados de memoria y registros cada vez que un programa se cierra de forma inesperada.',
    impact: 'Bajo',
    risk: 'Seguro',
    applyScript: `
      Stop-Service "WerSvc" -ErrorAction SilentlyContinue
      Set-Service "WerSvc" -StartupType Disabled -ErrorAction SilentlyContinue
    `,
    revertScript: `
      Set-Service "WerSvc" -StartupType Manual -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $s = Get-Service "WerSvc" -ErrorAction SilentlyContinue
      if ($s -and $s.StartType -eq 'Disabled') { "true" } else { "false" }
    `
  },

  // ==========================================
  // --- 5. PRIVACIDAD & DEBLOAT ---
  // ==========================================
  {
    id: 'privacy_telemetry_registry',
    category: 'privacy',
    title: 'Desactivar Telemetría de Windows en Registro',
    description: 'Establece AllowTelemetry = 0 para deshabilitar el envío constante de estadísticas y capturas de uso a Microsoft.',
    impact: 'Alto',
    risk: 'Seguro',
    applyScript: `
      New-Item -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" -Force | Out-Null
      Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" -Name "AllowTelemetry" -Type DWord -Value 0
    `,
    revertScript: `
      Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" -Name "AllowTelemetry" -Type DWord -Value 1 -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $val = (Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" -Name "AllowTelemetry" -ErrorAction SilentlyContinue).AllowTelemetry
      if ($val -eq 0) { "true" } else { "false" }
    `
  },
  {
    id: 'privacy_bing_search',
    category: 'privacy',
    title: 'Desactivar Búsquedas Web de Bing en el Menú Inicio',
    description: 'Evita que Windows consulte servidores de Bing cada vez que buscas un programa local en el menú Inicio, haciéndolo instantáneo.',
    impact: 'Medio',
    risk: 'Seguro',
    applyScript: `
      New-Item -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search" -Force | Out-Null
      Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search" -Name "BingSearchEnabled" -Type DWord -Value 0
      New-Item -Path "HKCU:\\Software\\Policies\\Microsoft\\Windows\\Explorer" -Force | Out-Null
      Set-ItemProperty -Path "HKCU:\\Software\\Policies\\Microsoft\\Windows\\Explorer" -Name "DisableSearchBoxSuggestions" -Type DWord -Value 1
    `,
    revertScript: `
      Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search" -Name "BingSearchEnabled" -Type DWord -Value 1 -ErrorAction SilentlyContinue
      Remove-ItemProperty -Path "HKCU:\\Software\\Policies\\Microsoft\\Windows\\Explorer" -Name "DisableSearchBoxSuggestions" -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $val = (Get-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search" -Name "BingSearchEnabled" -ErrorAction SilentlyContinue).BingSearchEnabled
      if ($val -eq 0) { "true" } else { "false" }
    `
  },
  {
    id: 'privacy_advertising_id',
    category: 'privacy',
    title: 'Desactivar ID de Publicidad de Windows',
    description: 'Impide que las aplicaciones utilicen tu identificador de publicidad para crear un perfil de tus hábitos de uso.',
    impact: 'Bajo',
    risk: 'Seguro',
    applyScript: `
      New-Item -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo" -Force | Out-Null
      Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo" -Name "Enabled" -Type DWord -Value 0
    `,
    revertScript: `
      Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo" -Name "Enabled" -Type DWord -Value 1 -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $val = (Get-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo" -Name "Enabled" -ErrorAction SilentlyContinue).Enabled
      if ($val -eq 0) { "true" } else { "false" }
    `
  },
  {
    id: 'privacy_copilot_recall',
    category: 'privacy',
    title: 'Desactivar Copilot / IA en Windows',
    description: 'Desactiva los botones y sugerencias automáticas de Copilot en la barra de tareas y el explorador de archivos.',
    impact: 'Medio',
    risk: 'Seguro',
    applyScript: `
      New-Item -Path "HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot" -Force | Out-Null
      Set-ItemProperty -Path "HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot" -Name "TurnOffWindowsCopilot" -Type DWord -Value 1
      New-Item -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot" -Force | Out-Null
      Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot" -Name "TurnOffWindowsCopilot" -Type DWord -Value 1
    `,
    revertScript: `
      Remove-ItemProperty -Path "HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot" -Name "TurnOffWindowsCopilot" -ErrorAction SilentlyContinue
      Remove-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot" -Name "TurnOffWindowsCopilot" -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $val = (Get-ItemProperty -Path "HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot" -Name "TurnOffWindowsCopilot" -ErrorAction SilentlyContinue).TurnOffWindowsCopilot
      if ($val -eq 1) { "true" } else { "false" }
    `
  },

  // ==========================================
  // --- 6. LIMPIEZA & REPARACIÓN (ONE-CLICK) ---
  // ==========================================
  {
    id: 'clean_shader_cache',
    category: 'clean',
    title: 'Caché de Sombreadores DirectX & GPU',
    description: 'Limpia los sombreadores corruptos o acumulados de NVIDIA (DXCache, GLCache), AMD y DirectX para eliminar tirones en juegos y 3D.',
    impact: 'Medio',
    risk: 'Seguro',
    applyScript: `
      $paths = @(
        "$env:LOCALAPPDATA\\D3DSCache",
        "$env:LOCALAPPDATA\\NVIDIA\\DXCache",
        "$env:LOCALAPPDATA\\NVIDIA\\GLCache",
        "$env:LOCALAPPDATA\\AMD\\DxCache"
      )
      foreach ($p in $paths) {
        if (Test-Path $p) {
          Get-ChildItem -Path $p -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
            try { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue } catch {}
          }
        }
      }
      $global:LASTEXITCODE = 0
      exit 0
    `,
    revertScript: `Write-Output "Regenerable automáticamente por el controlador GPU."`,
    checkScript: `"false"`
  },
  {
    id: 'clean_temp_files',
    category: 'clean',
    title: 'Archivos Temporales de Usuario (%TEMP%)',
    description: 'Elimina residuos de instaladores, descompresores y programas en segundo plano.',
    impact: 'Alto',
    risk: 'Seguro',
    applyScript: `
      Get-ChildItem -Path $env:TEMP -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
        try { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue } catch {}
      }
      Get-ChildItem -Path $env:TEMP -Directory -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
        try { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue } catch {}
      }
      $global:LASTEXITCODE = 0
      exit 0
    `,
    revertScript: `Write-Output "Temporales eliminados."`,
    checkScript: `"false"`
  },
  {
    id: 'clean_windows_temp',
    category: 'clean',
    title: 'Temporales del Sistema (C:\\Windows\\Temp)',
    description: 'Limpia registros de errores antiguos y volcados temporales de servicios de Windows.',
    impact: 'Medio',
    risk: 'Seguro',
    applyScript: `
      Get-ChildItem -Path "$env:SystemRoot\\Temp" -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
        try { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue } catch {}
      }
      Get-ChildItem -Path "$env:SystemRoot\\Temp" -Directory -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
        try { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue } catch {}
      }
      $global:LASTEXITCODE = 0
      exit 0
    `,
    revertScript: `Write-Output "Temporales de Windows eliminados."`,
    checkScript: `"false"`
  },
  {
    id: 'clean_software_distribution',
    category: 'clean',
    title: 'Caché de Descargas de Windows Update',
    description: 'Elimina paquetes e instaladores antiguos de actualizaciones de Windows ya instaladas para liberar gigabytes de espacio.',
    impact: 'Alto',
    risk: 'Seguro',
    applyScript: `
      Stop-Service "wuauserv" -ErrorAction SilentlyContinue
      Get-ChildItem -Path "$env:SystemRoot\\SoftwareDistribution\\Download" -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
        try { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue } catch {}
      }
      Start-Service "wuauserv" -ErrorAction SilentlyContinue
      $global:LASTEXITCODE = 0
      exit 0
    `,
    revertScript: `Write-Output "Caché de Windows Update limpiada."`,
    checkScript: `"false"`
  },
  {
    id: 'clean_thumbnail_cache',
    category: 'clean',
    title: 'Caché de Miniaturas del Explorador',
    description: 'Borra miniaturas corruptas de imágenes y videos para forzar su regeneración fluida.',
    impact: 'Bajo',
    risk: 'Seguro',
    applyScript: `
      Get-Process "explorer" -ErrorAction SilentlyContinue | Stop-Process -Force
      Get-ChildItem -Path "$env:LOCALAPPDATA\\Microsoft\\Windows\\Explorer" -Filter "thumbcache_*.db" -Force -ErrorAction SilentlyContinue | ForEach-Object {
        try { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue } catch {}
      }
      Start-Process "explorer.exe"
      $global:LASTEXITCODE = 0
      exit 0
    `,
    revertScript: `Write-Output "Miniaturas regeneradas."`,
    checkScript: `"false"`
  },

  // =========================================================================
  // --- 7. MEJORAS AVANZADAS INSPIRADAS EN OPTIMIZER & TBOK-WIN11OPTIMIZER ---
  // =========================================================================
  {
    id: 'hpet_timer',
    category: 'gaming',
    title: 'Desactivar HPET (High Precision Event Timer)',
    description: 'Desactiva el temporizador de alta precisión de la plataforma (HPET) en el BCD de Windows para que el sistema use el reloj de menor latencia de la CPU, reduciendo la latencia de entrada y los micro-tirones en juegos (Optimizer).',
    impact: 'Alto',
    risk: 'Seguro',
    applyScript: `
      cmd /c "bcdedit /set useplatformclock false >nul 2>&1"
      cmd /c "bcdedit /deletevalue useplatformclock >nul 2>&1"
      $global:LASTEXITCODE = 0
      exit 0
    `,
    revertScript: `
      cmd /c "bcdedit /set useplatformclock yes >nul 2>&1"
      $global:LASTEXITCODE = 0
      exit 0
    `,
    checkScript: `
      $out = cmd /c "bcdedit" 2>$null | Select-String "useplatformclock.*Yes"
      if ($out) { "false" } else { "true" }
    `
  },
  {
    id: 'dynamic_tick',
    category: 'gaming',
    title: 'Desactivar Dynamic Tick (Temporizador Uniforme)',
    description: 'Mantiene una frecuencia de reloj uniforme en procesadores modernos durante cargas pesadas, evitando saltos de temporización que provocan micro-stuttering en partidas (Optimizer & TBOK).',
    impact: 'Medio',
    risk: 'Seguro',
    applyScript: `
      cmd /c "bcdedit /set disabledynamictick yes >nul 2>&1"
      $global:LASTEXITCODE = 0
      exit 0
    `,
    revertScript: `
      cmd /c "bcdedit /set disabledynamictick no >nul 2>&1"
      $global:LASTEXITCODE = 0
      exit 0
    `,
    checkScript: `
      $out = cmd /c "bcdedit" 2>$null | Select-String "disabledynamictick.*Yes"
      if ($out) { "true" } else { "false" }
    `
  },
  {
    id: 'classic_context_menu',
    category: 'gaming',
    title: 'Restaurar Menú Contextual Clásico de Windows 11',
    description: 'Elimina el menú emergente moderno lento con la opción "Mostrar más opciones" y restaura el menú contextual directo de Windows 10 con un solo clic (Optimizer ClassicMenu).',
    impact: 'Medio',
    risk: 'Seguro',
    applyScript: `
      $p = "HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32"
      New-Item -Path $p -Force | Out-Null
      Set-ItemProperty -Path $p -Name "(Default)" -Value "" -Force
      Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
      Start-Process explorer.exe
    `,
    revertScript: `
      $p = "HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}"
      if (Test-Path $p) { Remove-Item -Path $p -Recurse -Force -ErrorAction SilentlyContinue }
      Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
      Start-Process explorer.exe
    `,
    checkScript: `
      if (Test-Path "HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}") { "true" } else { "false" }
    `
  },
  {
    id: 'disable_taskbar_chat',
    category: 'privacy',
    title: 'Desactivar Chat de Microsoft Teams en Barra de Tareas',
    description: 'Oculta la integración de Chat de Teams en Windows 11 y evita que procesos msedgewebview2.exe permanezcan cargados consumiendo RAM (Optimizer & TBOK).',
    impact: 'Medio',
    risk: 'Seguro',
    applyScript: `
      Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" -Name "TaskbarMn" -Value 0 -Type DWord -Force
    `,
    revertScript: `
      Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" -Name "TaskbarMn" -Value 1 -Type DWord -Force
    `,
    checkScript: `
      $val = (Get-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" -Name "TaskbarMn" -ErrorAction SilentlyContinue).TaskbarMn
      if ($val -eq 0) { "true" } else { "false" }
    `
  },
  {
    id: 'disable_delivery_optimization',
    category: 'network',
    title: 'Desactivar Entrega P2P de Windows Update (Delivery Optimization)',
    description: 'Evita que Windows Update utilice tu conexión para cargar y distribuir actualizaciones a otros equipos en Internet, ahorrando tu ancho de banda de subida (TBOK & Optimizer).',
    impact: 'Alto',
    risk: 'Seguro',
    applyScript: `
      $p = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization"
      if (-not (Test-Path $p)) { New-Item -Path $p -Force | Out-Null }
      Set-ItemProperty -Path $p -Name "DODownloadMode" -Value 0 -Type DWord -Force
      Stop-Service "DoSvc" -ErrorAction SilentlyContinue
      Set-Service "DoSvc" -StartupType Manual -ErrorAction SilentlyContinue
    `,
    revertScript: `
      $p = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization"
      if (Test-Path $p) { Remove-ItemProperty -Path $p -Name "DODownloadMode" -ErrorAction SilentlyContinue }
      Set-Service "DoSvc" -StartupType Automatic -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $val = (Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization" -Name "DODownloadMode" -ErrorAction SilentlyContinue).DODownloadMode
      if ($val -eq 0) { "true" } else { "false" }
    `
  },
  {
    id: 'disable_wpbt_bios',
    category: 'privacy',
    title: 'Bloquear Inyección BIOS WPBT de Fabricantes',
    description: 'Bloquea la tabla binaria WPBT en Windows para evitar que la placa madre inyecte utilidades pesadas o bloatware de fabricantes (Armoury Crate, Dragon Center) al iniciar (TBOK).',
    impact: 'Alto',
    risk: 'Seguro',
    applyScript: `
      $p = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager"
      if (-not (Test-Path $p)) { New-Item -Path $p -Force | Out-Null }
      Set-ItemProperty -Path $p -Name "DisableWPBTExecution" -Value 1 -Type DWord -Force
    `,
    revertScript: `
      $p = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager"
      Remove-ItemProperty -Path $p -Name "DisableWPBTExecution" -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $val = (Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager" -Name "DisableWPBTExecution" -ErrorAction SilentlyContinue).DisableWPBTExecution
      if ($val -eq 1) { "true" } else { "false" }
    `
  },
  {
    id: 'fast_shutdown_timeout',
    category: 'services',
    title: 'Acelerar Apagado Seguro de Servicios (WaitToKillServiceTimeout)',
    description: 'Reduce el tiempo de espera por procesos colgados de 5000ms a 2000ms para un apagado y reinicio veloz sin pérdida de datos (TBOK).',
    impact: 'Medio',
    risk: 'Seguro',
    applyScript: `
      $path = "HKLM:\\SYSTEM\\CurrentControlSet\\Control"
      if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
      Set-ItemProperty -Path $path -Name "WaitToKillServiceTimeout" -Value "2000" -Type String -Force
      Set-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -Name "WaitToKillAppTimeout" -Value "2000" -Type String -Force
    `,
    revertScript: `
      Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control" -Name "WaitToKillServiceTimeout" -Value "5000" -Type String -Force
      Set-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -Name "WaitToKillAppTimeout" -Value "5000" -Type String -Force
    `,
    checkScript: `
      $val = (Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control" -Name "WaitToKillServiceTimeout" -ErrorAction SilentlyContinue).WaitToKillServiceTimeout
      if ($val -eq '2000') { "true" } else { "false" }
    `
  },
  {
    id: 'verbose_status',
    category: 'services',
    title: 'Mensajes Detallados de Arranque y Apagado (Verbose Status)',
    description: 'Muestra en pantalla el controlador, servicio o directiva exacta que se está iniciando o deteniendo, permitiendo diagnosticar demoras en el arranque del sistema (Optimizer & TBOK).',
    impact: 'Bajo',
    risk: 'Seguro',
    applyScript: `
      $p = "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System"
      if (-not (Test-Path $p)) { New-Item -Path $p -Force | Out-Null }
      Set-ItemProperty -Path $p -Name "VerboseStatus" -Value 1 -Type DWord -Force
    `,
    revertScript: `
      $p = "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System"
      Remove-ItemProperty -Path $p -Name "VerboseStatus" -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $val = (Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" -Name "VerboseStatus" -ErrorAction SilentlyContinue).VerboseStatus
      if ($val -eq 1) { "true" } else { "false" }
    `
  },
  {
    id: 'optimize_irp_stack_size',
    category: 'network',
    title: 'Optimizar Búfer de Red IRPStackSize (LanmanServer)',
    description: 'Aumenta el búfer IRPStackSize a 32 (0x20) en el subsistema de red para mayor estabilidad y rendimiento en transferencia de archivos y juegos de red (TBOK).',
    impact: 'Medio',
    risk: 'Seguro',
    applyScript: `
      $p = "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters"
      if (-not (Test-Path $p)) { New-Item -Path $p -Force | Out-Null }
      Set-ItemProperty -Path $p -Name "IRPStackSize" -Value 32 -Type DWord -Force
    `,
    revertScript: `
      $p = "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters"
      Remove-ItemProperty -Path $p -Name "IRPStackSize" -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $val = (Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" -Name "IRPStackSize" -ErrorAction SilentlyContinue).IRPStackSize
      if ($val -eq 32) { "true" } else { "false" }
    `
  },

  // ==========================================
  // --- 7. OPTIMIZACIONES RION TOOL (LATENCIA, GPU & KERNEL) ---
  // ==========================================
  {
    id: 'gpu_mpo_fix',
    category: 'gaming',
    title: 'Desactivar Multi-Plane Overlay (MPO Fix)',
    description: 'Soluciona parpadeos negros, micro-stuttering y caídas de FPS causadas por MPO en tarjetas NVIDIA y AMD al jugar con Discord o navegador abierto (RionTool).',
    impact: 'Alto',
    risk: 'Seguro',
    applyScript: `
      $dwm = "HKLM:\\SOFTWARE\\Microsoft\\Windows\\Dwm"
      if (-not (Test-Path $dwm)) { New-Item -Path $dwm -Force | Out-Null }
      Set-ItemProperty -Path $dwm -Name "OverlayTestMode" -Type DWord -Value 5 -Force -ErrorAction SilentlyContinue

      $gfx = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers"
      if (-not (Test-Path $gfx)) { New-Item -Path $gfx -Force | Out-Null }
      Set-ItemProperty -Path $gfx -Name "DisableOverlays" -Type DWord -Value 1 -Force -ErrorAction SilentlyContinue
    `,
    revertScript: `
      Remove-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\Dwm" -Name "OverlayTestMode" -ErrorAction SilentlyContinue
      Remove-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" -Name "DisableOverlays" -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $v1 = (Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\Dwm" -Name "OverlayTestMode" -ErrorAction SilentlyContinue).OverlayTestMode
      $v2 = (Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" -Name "DisableOverlays" -ErrorAction SilentlyContinue).DisableOverlays
      if ($v1 -eq 5 -or $v2 -eq 1) { "true" } else { "false" }
    `
  },
  {
    id: 'net_disable_eee',
    category: 'network',
    title: 'Desactivar Energy-Efficient Ethernet (EEE / Green Ethernet)',
    description: 'Evita que el chip de red Ethernet entre en suspensión de bajo consumo, eliminando micro-cortes y picos de ping repentinos en partidas competitivas (RionTool).',
    impact: 'Alto',
    risk: 'Seguro',
    applyScript: `
      Get-NetAdapterAdvancedProperty -DisplayName '*Energy*' -ErrorAction SilentlyContinue | Set-NetAdapterAdvancedProperty -DisplayValue 'Disabled' -ErrorAction SilentlyContinue
      Get-NetAdapterAdvancedProperty -RegistryKeyword '*EEE' -ErrorAction SilentlyContinue | Set-NetAdapterAdvancedProperty -RegistryValue '0' -ErrorAction SilentlyContinue
      Get-NetAdapterAdvancedProperty -RegistryKeyword 'EEELinkAdvertisement' -ErrorAction SilentlyContinue | Set-NetAdapterAdvancedProperty -RegistryValue '0' -ErrorAction SilentlyContinue
    `,
    revertScript: `
      Get-NetAdapterAdvancedProperty -DisplayName '*Energy*' -ErrorAction SilentlyContinue | Set-NetAdapterAdvancedProperty -DisplayValue 'Enabled' -ErrorAction SilentlyContinue
      Get-NetAdapterAdvancedProperty -RegistryKeyword '*EEE' -ErrorAction SilentlyContinue | Set-NetAdapterAdvancedProperty -RegistryValue '1' -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $p = Get-NetAdapterAdvancedProperty -RegistryKeyword '*EEE' -ErrorAction SilentlyContinue
      if ($p -and $p.RegistryValue -eq '0') { "true" } else { "false" }
    `
  },
  {
    id: 'net_disable_intmod',
    category: 'network',
    title: 'Desactivar Moderación de Interrupciones de Red',
    description: 'Fuerza a la tarjeta de red a transferir cada paquete entrante a la CPU de inmediato sin agruparlos en búferes, reduciendo la latencia de red (RionTool).',
    impact: 'Alto',
    risk: 'Medio',
    applyScript: `
      Get-NetAdapterAdvancedProperty -RegistryKeyword '*InterruptModeration' -ErrorAction SilentlyContinue | Set-NetAdapterAdvancedProperty -RegistryValue '0' -ErrorAction SilentlyContinue
      Get-NetAdapterAdvancedProperty -DisplayName '*Interrupt Moderation*' -ErrorAction SilentlyContinue | Set-NetAdapterAdvancedProperty -DisplayValue 'Disabled' -ErrorAction SilentlyContinue
    `,
    revertScript: `
      Get-NetAdapterAdvancedProperty -RegistryKeyword '*InterruptModeration' -ErrorAction SilentlyContinue | Set-NetAdapterAdvancedProperty -RegistryValue '1' -ErrorAction SilentlyContinue
      Get-NetAdapterAdvancedProperty -DisplayName '*Interrupt Moderation*' -ErrorAction SilentlyContinue | Set-NetAdapterAdvancedProperty -DisplayValue 'Enabled' -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $p = Get-NetAdapterAdvancedProperty -RegistryKeyword '*InterruptModeration' -ErrorAction SilentlyContinue
      if ($p -and $p.RegistryValue -eq '0') { "true" } else { "false" }
    `
  },
  {
    id: 'power_usb_selective',
    category: 'gaming',
    title: 'Desactivar Suspensión Selectiva de USB',
    description: 'Impide que Windows ponga en reposo los puertos USB, evitando retardos de entrada (input dropouts) en ratones gamer, teclados mecánicos y DACs (RionTool).',
    impact: 'Medio',
    risk: 'Seguro',
    applyScript: `
      powercfg /setacvalueindex scheme_current 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0
      powercfg /setactive scheme_current
    `,
    revertScript: `
      powercfg /setacvalueindex scheme_current 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 1
      powercfg /setactive scheme_current
    `,
    checkScript: `
      $out = powercfg /q scheme_current 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226
      if ($out -match '0x00000000') { "true" } else { "false" }
    `
  },
  {
    id: 'input_queue_size_opt',
    category: 'gaming',
    title: 'Optimización de Colas de Ratón y Teclado',
    description: 'Reduce el tamaño del búfer de cola de eventos de periféricos (MouseDataQueueSize y KeyboardDataQueueSize) de 100 a 16 paquetes para mínima latencia de hardware (RionTool).',
    impact: 'Medio',
    risk: 'Seguro',
    applyScript: `
      Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\mouclass\\Parameters" -Name "MouseDataQueueSize" -Type DWord -Value 16 -Force -ErrorAction SilentlyContinue
      Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\kbdclass\\Parameters" -Name "KeyboardDataQueueSize" -Type DWord -Value 16 -Force -ErrorAction SilentlyContinue
    `,
    revertScript: `
      Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\mouclass\\Parameters" -Name "MouseDataQueueSize" -Type DWord -Value 100 -Force -ErrorAction SilentlyContinue
      Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\kbdclass\\Parameters" -Name "KeyboardDataQueueSize" -Type DWord -Value 100 -Force -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $m = (Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\mouclass\\Parameters" -Name "MouseDataQueueSize" -ErrorAction SilentlyContinue).MouseDataQueueSize
      $k = (Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\kbdclass\\Parameters" -Name "KeyboardDataQueueSize" -ErrorAction SilentlyContinue).KeyboardDataQueueSize
      if ($m -eq 16 -and $k -eq 16) { "true" } else { "false" }
    `
  },
  {
    id: 'bcd_clean_timers',
    category: 'gaming',
    title: 'Sincronización de Reloj TSC (TSC Invariant Clock)',
    description: 'Configura la política de sincronización TSC en Enhanced en el BCD de Windows para forzar temporización directa de hardware de procesador, eliminando latencia de reloj (RionTool & Calypto).',
    impact: 'Alto',
    risk: 'Seguro',
    applyScript: `
      cmd /c "bcdedit /set tscsyncpolicy Enhanced >nul 2>&1"
    `,
    revertScript: `
      cmd /c "bcdedit /deletevalue tscsyncpolicy >nul 2>&1"
    `,
    checkScript: `
      $out = cmd /c "bcdedit" 2>$null | Select-String "tscsyncpolicy.*Enhanced"
      if ($out) { "true" } else { "false" }
    `
  },
  {
    id: 'net_disable_llmnr',
    category: 'network',
    title: 'Desactivar LLMNR y Broadcasts Locales',
    description: 'Detiene la resolución de nombres por difusión multicast (LLMNR), ahorrando tráfico de red en segundo plano y cerrando vectores de envenenamiento DNS (RionTool).',
    impact: 'Bajo',
    risk: 'Seguro',
    applyScript: `
      $p = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\DNSClient"
      if (-not (Test-Path $p)) { New-Item -Path $p -Force | Out-Null }
      Set-ItemProperty -Path $p -Name "EnableMulticast" -Type DWord -Value 0 -Force
    `,
    revertScript: `
      Remove-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\DNSClient" -Name "EnableMulticast" -ErrorAction SilentlyContinue
    `,
    checkScript: `
      $v = (Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\DNSClient" -Name "EnableMulticast" -ErrorAction SilentlyContinue).EnableMulticast
      if ($v -eq 0) { "true" } else { "false" }
    `
  }
];

// All tools remain part of the free catalog. Restoration is based on recorded originals,
// never on the historical default-value scripts retained above as migration reference.
for (const tweak of TWEAKS_DATA) {
  tweak.free = true;
  tweak.reversible = tweak.category !== 'clean';
  if (tweak.category !== 'clean') {
    const { getResources } = require('./restorationResources');
    tweak.resources = getResources(tweak.id);
    tweak.applyScript = require('./systemInfo').normalizeRegistryCreation(tweak.applyScript);
    tweak.applyScript = tweak.applyScript.replace(/((?:Set-ItemProperty|Set-Service)[^\r\n]*?)\s+-ErrorAction SilentlyContinue/g, '$1');
  }
  tweak.description = tweak.description.replace(/100% seguro/gi, 'Revisa sus efectos antes de aplicar');
}

function replaceTweak(id, values) { Object.assign(TWEAKS_DATA.find(item => item.id === id), values); }
replaceTweak('hpet_timer', {
  description: 'Restaura la selección automática del reloj de plataforma. Es un ajuste avanzado de arranque, sin mejora de rendimiento garantizada; requiere reiniciar.',
  risk: 'Avanzado',
  applyScript: `
    $current = (& bcdedit.exe /enum '{current}' | Out-String)
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar el arranque.' }
    if ($current -match '(?im)^\\s*useplatformclock\\s+') { & bcdedit.exe /deletevalue '{current}' useplatformclock | Out-Null; if ($LASTEXITCODE -ne 0) { throw 'Windows rechazó el cambio de reloj.' } }
  `,
  checkScript: `$current = (& bcdedit.exe /enum '{current}' | Out-String); if ($LASTEXITCODE -ne 0) { throw 'No se pudo verificar el arranque.' }; if ($current -notmatch '(?im)^\\s*useplatformclock\\s+') { 'true' } else { 'false' }`
});
replaceTweak('dynamic_tick', { risk: 'Avanzado', description: 'Desactiva los ticks dinámicos de Windows. Es una opción de depuración avanzada; puede aumentar el consumo y no garantiza menor latencia. Requiere reiniciar.', applyScript: `& bcdedit.exe /set '{current}' disabledynamictick yes | Out-Null; if ($LASTEXITCODE -ne 0) { throw 'Windows rechazó el cambio de ticks.' }`, checkScript: `$text = (& bcdedit.exe /enum '{current}' | Out-String); if ($LASTEXITCODE -ne 0) { throw 'No se pudo verificar el arranque.' }; if ($text -match '(?im)^\\s*disabledynamictick\\s+(Yes|Sí|Si)\\s*$') { 'true' } else { 'false' }` });
replaceTweak('bcd_clean_timers', { risk: 'Avanzado', description: 'Configura la política de sincronización TSC en Enhanced. Opción avanzada de arranque; requiere reiniciar y una comprobación del resultado en tu equipo.', applyScript: `& bcdedit.exe /set '{current}' tscsyncpolicy Enhanced | Out-Null; if ($LASTEXITCODE -ne 0) { throw 'Windows rechazó la política TSC.' }`, checkScript: `$text = (& bcdedit.exe /enum '{current}' | Out-String); if ($LASTEXITCODE -ne 0) { throw 'No se pudo verificar el arranque.' }; if ($text -match '(?im)^\\s*tscsyncpolicy\\s+Enhanced\\s*$') { 'true' } else { 'false' }` });
replaceTweak('power_plan_ultimate', { applyScript: `
  $output = (& powercfg.exe /duplicatescheme 'e9a42b02-d5df-448d-aa00-03f14749eb61' | Out-String)
  if ($LASTEXITCODE -ne 0 -or $output -notmatch '[a-fA-F0-9-]{36}') { throw 'No se pudo crear el plan de energía solicitado.' }
  $newGuid = $Matches[0]
  & powercfg.exe /changename $newGuid 'Apex Performance' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo identificar el plan de Apex.' }
  & powercfg.exe /setactive $newGuid | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo activar el plan de energía.' }
  `, checkScript: `$active = (& powercfg.exe /getactivescheme | Out-String); if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar el plan activo.' }; if ($active -match 'Apex Performance') { 'true' } else { 'false' }` });
replaceTweak('tcp_autotuning_optimal', { checkScript: `$setting = Get-NetTCPSetting -SettingName Internet; if ($setting.AutoTuningLevelLocal.ToString() -eq 'Normal') { 'true' } else { 'false' }` });
replaceTweak('tcp_rss_enabled', { checkScript: `if ((Get-NetOffloadGlobalSetting).ReceiveSideScaling.ToString() -eq 'Enabled') { 'true' } else { 'false' }` });
replaceTweak('tcp_ecn_disabled', { checkScript: `if ((Get-NetTCPSetting -SettingName Internet).EcnCapability.ToString() -eq 'Disabled') { 'true' } else { 'false' }` });
replaceTweak('design_tablet_stylus_latency_fix', {
  description: 'Desactiva el toque prolongado, el círculo de respuesta y los gestos Flicks/Bouncing de Windows Ink para el usuario actual. Conserva sus valores originales.',
  applyScript: `
    $pen = 'HKCU:\\Software\\Microsoft\\Wisp\\Pen\\SysEventParameters'
    $touch = 'HKCU:\\Software\\Microsoft\\Wisp\\Touch'
    New-ApexRegistryKey -Path $pen | Out-Null
    New-ApexRegistryKey -Path $touch | Out-Null
    Set-ItemProperty -LiteralPath $pen -Name HoldMode -Type DWord -Value 3 -Force
    Set-ItemProperty -LiteralPath $touch -Name Bouncing -Type DWord -Value 0 -Force
    Set-ItemProperty -LiteralPath $touch -Name Flicks -Type DWord -Value 0 -Force
    Set-ItemProperty -LiteralPath 'HKCU:\\Control Panel\\Desktop' -Name PenBarrelFeedback -Type DWord -Value 0 -Force
  `,
  checkScript: `
    $pen = Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Microsoft\\Wisp\\Pen\\SysEventParameters'
    $touch = Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Microsoft\\Wisp\\Touch'
    $desktop = Get-ItemProperty -LiteralPath 'HKCU:\\Control Panel\\Desktop'
    if ($pen.HoldMode -eq 3 -and $touch.Bouncing -eq 0 -and $touch.Flicks -eq 0 -and $desktop.PenBarrelFeedback -eq 0) { 'true' } else { 'false' }
  `
});
module.exports = { TWEAKS_DATA };
