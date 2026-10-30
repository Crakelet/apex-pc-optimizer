'use strict';

const os = require('node:os');

// Only these identifiers may be resolved to external destinations by the main process.
const SETTINGS_TARGETS = Object.freeze({
  graphics: 'ms-settings:display-advancedgraphics',
  display: 'ms-settings:display-advanced',
  gameMode: 'ms-settings:gaming-gamemode',
  startup: 'ms-settings:startupapps',
  power: 'ms-settings:powersleep'
});
const SOURCES = Object.freeze(Object.fromEntries(Object.entries({
  windowedGames: { title: 'Microsoft · Juegos en ventana y GPU por aplicación', url: 'https://support.microsoft.com/en-us/windows/hardware/display-graphics/optimizations-for-windowed-games-in-windows-11' },
  refreshRate: { title: 'Microsoft · Frecuencia de actualización, VRR y DRR', url: 'https://support.microsoft.com/en-us/windows/hardware/display-graphics/change-the-refresh-rate-on-your-monitor-in-windows' },
  photoshopPerformance: { title: 'Adobe · Preferencias de rendimiento de Photoshop', url: 'https://helpx.adobe.com/photoshop/desktop/get-started/settings-and-preferences/configure-photoshop-performance-preferences.html' },
  photoshopScratch: { title: 'Adobe · Discos de memoria virtual de Photoshop', url: 'https://helpx.adobe.com/photoshop/desktop/troubleshoot/troubleshoot-tools-resources/set-up-and-manage-scratch-disks.html' },
  premiereProxies: { title: 'Adobe · Crear proxies en Premiere', url: 'https://helpx.adobe.com/premiere/desktop/organize-media/ingest-proxy-workflow/create-proxies.html' },
  premiereDecoding: { title: 'Adobe · Decodificación por hardware en Premiere', url: 'https://helpx.adobe.com/premiere/desktop/get-started/technical-requirements/enable-hardware-accelerated-decoding-support.html' },
  blenderGpu: { title: 'Blender · Renderizado con GPU en Cycles', url: 'https://docs.blender.org/manual/en/latest/render/cycles/gpu_rendering.html' },
  nvidiaStudio: { title: 'NVIDIA · Studio Drivers para aplicaciones creativas', url: 'https://developer.nvidia.com/nvidia-studio-stack' },
  windowsSettings: { title: 'Microsoft · Páginas oficiales de Configuración', url: 'https://learn.microsoft.com/en-us/windows/apps/develop/launch/launch-settings' }
}).map(([key, value]) => [key, Object.freeze(value)])));

// Single bounded query of hardware metadata and existing preferences. No app files,
// project directories, processes, benchmark workloads or Windows settings are changed.
const PERFORMANCE_SCRIPT = String.raw`
$warnings = @()
$gpus = @(); $disks = @()
$gameMode = $null; $gameModeAllowed = $null; $hags = $null
try {
  $gpus = @(Get-CimInstance Win32_VideoController -OperationTimeoutSec 4 -ErrorAction Stop | Select-Object -First 16 Name, DriverVersion)
} catch { $warnings += 'gpu-unavailable' }
try {
  $disks = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' -OperationTimeoutSec 4 -ErrorAction Stop | Select-Object -First 26 DeviceID, DriveType, Size, FreeSpace)
} catch { $warnings += 'disks-unavailable' }
try {
  $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\Microsoft\GameBar')
  if ($key) {
    try { $gameMode = $key.GetValue('AutoGameModeEnabled', $null); $gameModeAllowed = $key.GetValue('AllowAutoGameMode', $null) }
    finally { $key.Close() }
  }
} catch { $warnings += 'game-mode-unavailable' }
try {
  $key = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SYSTEM\CurrentControlSet\Control\GraphicsDrivers')
  if ($key) { try { $hags = $key.GetValue('HwSchMode', $null) } finally { $key.Close() } }
} catch { $warnings += 'hags-unavailable' }
@{ gpus=$gpus; disks=$disks; preferences=@{ gameMode=$gameMode; gameModeAllowed=$gameModeAllowed; hags=$hags }; warnings=$warnings } | ConvertTo-Json -Depth 5 -Compress
`;

const WARNING_MESSAGES = Object.freeze({
  'gpu-unavailable': 'Windows no pudo informar las GPU y sus controladores.',
  'disks-unavailable': 'Windows no pudo informar el espacio de las unidades locales.',
  'game-mode-unavailable': 'No se pudo consultar la preferencia registrada de Modo Juego.',
  'hags-unavailable': 'No se pudo consultar la preferencia registrada de programación de GPU.',
  'windows-unavailable': 'La consulta de Windows no está disponible. Las guías siguen disponibles.',
  'memory-unavailable': 'No se pudo obtener una lectura válida de memoria.',
  'displays-unavailable': 'No se recibió una frecuencia válida de las pantallas. Revísala en Pantalla avanzada.',
  'invalid-data': 'Parte de los datos recibidos no pudo validarse y se omitió.'
});

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const list = value => Array.isArray(value) ? value : object(value) ? [value] : [];
const finite = (value, min, max = Number.MAX_SAFE_INTEGER) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
const text = (value, max = 160) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '';
const enumValue = (value, choices) => choices.includes(value) ? value : null;
const knownWarning = value => typeof value === 'string' && Object.hasOwn(WARNING_MESSAGES, value);

function buildReport({ memory, windows, displays = [], warnings = [], observedAt } = {}) {
  const warningCodes = new Set(Array.isArray(warnings) ? warnings.filter(knownWarning) : []);
  const memoryTotal = finite(memory?.totalBytes, 1), memoryAvailable = finite(memory?.availableBytes, 0);
  const memoryValid = memoryTotal !== null && memoryAvailable !== null && memoryAvailable <= memoryTotal;
  if (!memoryValid) warningCodes.add('memory-unavailable');
  const memoryFact = { totalBytes: memoryValid ? memoryTotal : null, availableBytes: memoryValid ? memoryAvailable : null, usedPercent: memoryValid ? Math.round((1 - memoryAvailable / memoryTotal) * 100) : null, observation: memoryValid ? 'measured' : 'unavailable' };

  const native = object(windows) ? windows : {};
  if (!object(windows)) warningCodes.add('windows-unavailable');
  if (Array.isArray(native.warnings)) for (const code of native.warnings) if (knownWarning(code)) warningCodes.add(code);
  const rawGpus = list(native.gpus), gpus = [];
  for (const gpu of rawGpus.slice(0, 16)) {
    const name = text(gpu?.Name), driverVersion = text(gpu?.DriverVersion, 80);
    if (!name) { warningCodes.add('invalid-data'); continue; }
    gpus.push({ name, driverVersion: driverVersion || null, observation: 'measured' });
  }
  const disks = [], seenDrives = new Set();
  for (const disk of list(native.disks).slice(0, 26)) {
    const drive = text(disk?.DeviceID, 3).toUpperCase(), totalBytes = finite(disk?.Size, 1), freeBytes = finite(disk?.FreeSpace, 0);
    if (disk?.DriveType !== 3 || !/^[A-Z]:$/.test(drive) || totalBytes === null || freeBytes === null || freeBytes > totalBytes || seenDrives.has(drive)) { warningCodes.add('invalid-data'); continue; }
    seenDrives.add(drive);
    disks.push({ drive, totalBytes, freeBytes, freePercent: Math.round(freeBytes / totalBytes * 100), observation: 'measured' });
  }
  disks.sort((a, b) => a.drive.localeCompare(b.drive));
  const displayFacts = [];
  for (const display of list(displays).slice(0, 16)) {
    const refreshRateHz = finite(display?.displayFrequency ?? display?.refreshRateHz, 10, 1000);
    const width = finite(display?.size?.width ?? display?.width, 1, 32768), height = finite(display?.size?.height ?? display?.height, 1, 32768);
    if (refreshRateHz === null && width === null && height === null) continue;
    displayFacts.push({ label: text(display?.label, 100) || 'Pantalla ' + (displayFacts.length + 1), refreshRateHz, width, height, observation: 'measured' });
  }
  if (!displayFacts.some(display => display.refreshRateHz !== null)) warningCodes.add('displays-unavailable');
  const rawPreferences = object(native.preferences) ? native.preferences : {};
  const gameMode = enumValue(rawPreferences.gameMode, [0, 1]), allowed = enumValue(rawPreferences.gameModeAllowed, [0, 1]);
  const hags = enumValue(rawPreferences.hags, [0, 1, 2]);
  const preferences = {
    gameMode: { value: gameMode, allowed, state: allowed === 0 || gameMode === 0 ? 'disabled' : gameMode === 1 ? 'enabled' : 'not-configured', observation: 'registered', effectiveStateKnown: false },
    hags: { value: hags, state: hags === 2 ? 'enabled' : hags === 1 ? 'disabled' : 'system-default', observation: 'registered', effectiveStateKnown: false }
  };
  const lowSpace = disks.filter(disk => disk.freeBytes / disk.totalBytes < 0.1), memoryPressure = memoryFact.usedPercent !== null && memoryFact.usedPercent >= 85;
  const refreshEvidence = displayFacts.filter(display => display.refreshRateHz !== null).map(display => `${display.label}: ${display.refreshRateHz} Hz`).join(' · ');
  const recommendations = [
    {
      id: 'gaming-display', category: 'gaming', priority: 'review', title: 'Revisa los Hz y la sincronización de tu pantalla',
      summary: 'Comprueba la frecuencia y las opciones VRR que admite tu equipo. Una lectura de 60 Hz no prueba que la pantalla soporte más.',
      observation: refreshEvidence ? 'measured' : 'manual', evidence: refreshEvidence || 'La frecuencia actual no está disponible en esta consulta.',
      steps: ['Abre Pantalla avanzada y selecciona el monitor que usas para jugar.', 'Elige una frecuencia compatible con su resolución. Comprueba VRR en Windows y en el panel de la GPU.', 'Si DRR limita los Hz de un juego, compara con DRR desactivado. Una frecuencia mayor puede consumir más batería.'],
      sourceId: 'refreshRate', settingsId: 'display'
    },
    {
      id: 'gaming-windowed', category: 'gaming', priority: 'review', title: 'Optimiza juegos en ventana y la elección de GPU',
      summary: 'En Windows 11, las optimizaciones para juegos en ventana están dirigidas a DX10/DX11 compatibles. La GPU de alto rendimiento es útil si hay varias GPU.',
      observation: 'manual', evidence: 'No se ha comprobado la API gráfica del juego, la compatibilidad de VRR ni qué GPU utiliza realmente.',
      steps: ['Abre Gráficos y añade el ejecutable del juego si falta.', 'Revisa su GPU y las optimizaciones de ventana. Reinicia el juego después del cambio.', 'Compara la misma escena. Si aparecen problemas, restaura la opción desde Windows para ese juego. HAGS también depende del hardware y el controlador; no garantiza más FPS.'],
      sourceId: 'windowedGames', settingsId: 'graphics'
    },
    {
      id: 'gaming-background', category: 'gaming', priority: memoryPressure ? 'attention' : 'review', title: 'Deja recursos disponibles para la sesión',
      summary: 'Revisa las aplicaciones de inicio y cierra lo que no necesites antes de comparar rendimiento. Conserva antivirus, controladores y servicios de trabajo.',
      observation: memoryValid ? 'measured' : 'manual', evidence: memoryValid ? `Memoria física utilizada en esta lectura: ${memoryFact.usedPercent}%. Es una instantánea; no identifica por sí sola la causa de los tirones.` : 'No hay una lectura válida de memoria en este momento.',
      steps: ['Revisa qué aplicaciones arrancan con Windows y sus funciones antes de deshabilitarlas.', 'Cierra manualmente aplicaciones que no necesites; guarda primero su trabajo.', 'Usa la misma escena, resolución y duración al comparar. Cambia una opción a la vez; la app no mide FPS en este informe.'],
      sourceId: 'windowsSettings', settingsId: 'startup'
    },
    {
      id: 'design-photoshop', category: 'design', priority: lowSpace.length ? 'attention' : 'review', title: 'Photoshop: memoria, GPU y disco de trabajo',
      summary: 'Ajusta Photoshop según tus documentos. Revisa Efficiency durante trabajo real y usa una unidad rápida con espacio para el scratch.',
      observation: lowSpace.length ? 'measured' : 'manual', evidence: lowSpace.length ? `Unidades con menos del 10% libre: ${lowSpace.map(disk => disk.drive).join(', ')}. Este umbral orientativo no confirma cuál usa Photoshop como scratch.` : 'No se leen las preferencias de Photoshop ni el contenido de tus proyectos.',
      steps: ['En Preferencias > Rendimiento, comprueba la GPU detectada y el indicador Efficiency mientras editas.', 'Ajusta la memoria dejando recursos para Windows y otras apps; compara con el mismo documento.', 'En Preferencias > Discos de memoria virtual, revisa espacio y orden de las unidades. No borres scratch activo, autoguardados ni recuperación.'],
      sourceId: 'photoshopPerformance', sourceIds: ['photoshopPerformance', 'photoshopScratch'], settingsId: 'graphics'
    },
    {
      id: 'design-premiere', category: 'design', priority: 'review', title: 'Premiere: proxies y decodificación de vídeo',
      summary: 'Los proxies reducen el trabajo al editar medios pesados. La decodificación H.264/HEVC por hardware depende de la GPU y del formato del archivo.',
      observation: 'manual', evidence: 'Este informe no inspecciona códecs, proyectos ni ajustes de Premiere.',
      steps: ['En el panel Proyecto, selecciona los clips y usa Proxy > Crear proxies; prueba un tamaño reducido.', 'En Preferencias > Medios, revisa la decodificación H.264/HEVC por hardware y reinicia Premiere si la cambias.', 'Compara reproducción y exportación por separado con el mismo material. Comprueba el uso de originales en la exportación final.'],
      sourceId: 'premiereProxies', sourceIds: ['premiereProxies', 'premiereDecoding']
    },
    {
      id: 'design-blender', category: 'design', priority: 'review', title: 'Blender: comprueba el dispositivo real de Cycles',
      summary: 'La preferencia GPU de Windows no activa por sí sola el renderizado GPU de Cycles. Debes elegir un backend compatible y el dispositivo de la escena.',
      observation: 'manual', evidence: 'No se lee la configuración de Blender ni se ejecuta un render de prueba.',
      steps: ['En Preferencias > Sistema, elige el backend disponible para tu GPU y activa sus dispositivos.', 'En la escena de Cycles, selecciona GPU Compute.', 'Compara una escena idéntica con el mismo muestreo. Las texturas, la VRAM y el uso de esa GPU para pantalla pueden limitar el resultado.'],
      sourceId: 'blenderGpu'
    }
  ];
  if (gpus.some(gpu => /nvidia/i.test(gpu.name))) recommendations.push({
    id: 'design-studio-driver', category: 'design', priority: 'review', title: 'NVIDIA: evalúa Studio para tu flujo creativo',
    summary: 'Studio Drivers se prueban con flujos de varias aplicaciones creativas. Elige el controlador compatible con tu GPU y tus aplicaciones.',
    observation: 'measured', evidence: 'Se detectó una GPU NVIDIA. La versión informada no permite identificar de forma fiable el canal Studio o Game Ready.',
    steps: ['Comprueba los requisitos de tus aplicaciones y las notas del controlador oficial.', 'Guarda tu trabajo antes de actualizar y compara el mismo proyecto después.', 'Esta herramienta no descarga ni instala controladores.'], sourceId: 'nvidiaStudio'
  });
  const date = typeof observedAt === 'string' && Number.isFinite(Date.parse(observedAt)) ? new Date(observedAt).toISOString() : null;
  return {
    success: true, partial: warningCodes.size > 0, observedAt: date,
    facts: { memory: memoryFact, gpus, disks, displays: displayFacts, preferences },
    recommendations, warnings: [...warningCodes].map(code => WARNING_MESSAGES[code])
  };
}

async function getPerformanceReport({ displays = [] } = {}, dependencies = {}) {
  const platform = dependencies.platform ?? process.platform;
  const runner = dependencies.runner || require('./powerShell').runPowerShell;
  const now = dependencies.now || (() => new Date().toISOString());
  const readMemory = dependencies.memory || (() => ({ totalBytes: os.totalmem(), availableBytes: os.freemem() }));
  const warnings = [];
  let memory = null, windows = null;
  try { memory = readMemory(); } catch { warnings.push('memory-unavailable'); }
  if (platform === 'win32') {
    try { windows = await runner(PERFORMANCE_SCRIPT, {}, { timeout: 12000 }); }
    catch { warnings.push('windows-unavailable'); }
  } else warnings.push('windows-unavailable');
  let observedAt = null;
  try { observedAt = now(); } catch { /* Missing timestamp does not fabricate an observation. */ }
  return buildReport({ memory, windows, displays, warnings, observedAt });
}

module.exports = { getPerformanceReport, buildReport, SETTINGS_TARGETS, SOURCES, PERFORMANCE_SCRIPT };
