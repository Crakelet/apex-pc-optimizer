const { runPowerShell } = require('./systemInfo');

/**
 * Suite de Ajustes de Cero Retardo y Respuesta Instantánea de Windows 11/10 (Snappy UI)
 */
const SNAPPY_UI_TWEAKS = [
  {
    id: 'ui_menu_show_delay',
    title: 'Cero Retardo en Menús (MenuShowDelay = 0 ms)',
    tag: 'Instantáneo',
    badgeClass: 'badge-gaming',
    description: 'Elimina los 400ms de retraso artificial de Windows al desplegar menús contextuales, barras de menú y submenús.',
    riskLevel: 'low',
    risks: 'Ninguno. 100% seguro y reversible.',
    safety: '100% Seguro • Mejora perceptible de velocidad inmediata',
    applyScript: `
      Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'MenuShowDelay' -Value '0' -Force
      "OK"
    `,
    revertScript: `
      Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'MenuShowDelay' -Value '400' -Force
      "OK"
    `,
    checkScript: `
      $v = (Get-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -ErrorAction SilentlyContinue).MenuShowDelay
      if ($v -eq '0') { "true" } else { "false" }
    `
  },
  {
    id: 'ui_classic_context_menu',
    title: 'Menú Contextual Clásico de Windows 11 (Sin Lag)',
    tag: 'Windows 11',
    badgeClass: 'badge-gaming',
    description: 'Restaura el menú contextual directo de Windows 10 con 1 solo clic. Elimina el menú moderno lento y el botón "Mostrar más opciones".',
    riskLevel: 'low',
    risks: 'Reinicia brevemente el Explorador de Windows para aplicar el cambio.',
    safety: '100% Seguro • Acelera el uso diario del Explorador',
    applyScript: `
      $p = "HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32"
      New-Item -Path $p -Force | Out-Null
      Set-ItemProperty -Path $p -Name "(Default)" -Value "" -Force
      Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
      Start-Process explorer.exe
      "OK"
    `,
    revertScript: `
      $p = "HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}"
      if (Test-Path $p) { Remove-Item -Path $p -Recurse -Force -ErrorAction SilentlyContinue }
      Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
      Start-Process explorer.exe
      "OK"
    `,
    checkScript: `
      if (Test-Path "HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}") { "true" } else { "false" }
    `
  },
  {
    id: 'ui_responsive_animations',
    title: 'Animaciones de Ventanas Instantáneas (MinAnimate = 0)',
    tag: 'Rendimiento GPU',
    badgeClass: 'badge-gaming',
    description: 'Desactiva los efectos de desvanecimiento lento (fade-in / slide) al minimizar o maximizar ventanas, manteniendo intacta la nitidez de fuentes ClearType.',
    riskLevel: 'low',
    risks: 'Ninguno. Reduce el consumo de GPU y hace que las ventanas aparezcan de inmediato.',
    safety: '100% Seguro • Máxima sensación de fluidez',
    applyScript: `
      $wm = 'HKCU:\\Control Panel\\Desktop\\WindowMetrics'
      New-Item -Path $wm -Force | Out-Null
      Set-ItemProperty -Path $wm -Name 'MinAnimate' -Value '0' -Force
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'TaskbarAnimations' -Value 0 -Type DWord -Force
      "OK"
    `,
    revertScript: `
      Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop\\WindowMetrics' -Name 'MinAnimate' -Value '1' -Force
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'TaskbarAnimations' -Value 1 -Type DWord -Force
      "OK"
    `,
    checkScript: `
      $v = (Get-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop\\WindowMetrics' -ErrorAction SilentlyContinue).MinAnimate
      if ($v -eq '0') { "true" } else { "false" }
    `
  },
  {
    id: 'ui_disable_ads_tips',
    title: 'Desactivar Anuncios, Sugerencias y Tips de Windows',
    tag: 'Privacidad & Limpieza',
    badgeClass: 'badge-design',
    description: 'Bloquea apps patrocinadas en el Menú Inicio, consejos de configuración y notificaciones comerciales de OneDrive en el Explorador.',
    riskLevel: 'low',
    risks: 'Ninguno. Evita distracciones y ahorra peticiones de red en segundo plano.',
    safety: '100% Seguro • Interfaz limpia sin publicidad',
    applyScript: `
      $cdm = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager'
      New-Item -Path $cdm -Force | Out-Null
      'SystemPaneSuggestionsEnabled','SoftLandingEnabled','SubscribedContent-338388Enabled','SubscribedContent-338389Enabled','SubscribedContent-353694Enabled','SubscribedContent-353696Enabled' | ForEach-Object {
        Set-ItemProperty -Path $cdm -Name $_ -Value 0 -Type DWord -Force
      }
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'ShowSyncProviderNotifications' -Value 0 -Type DWord -Force
      "OK"
    `,
    revertScript: `
      $cdm = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager'
      'SystemPaneSuggestionsEnabled','SoftLandingEnabled' | ForEach-Object {
        Set-ItemProperty -Path $cdm -Name $_ -Value 1 -Type DWord -Force
      }
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'ShowSyncProviderNotifications' -Value 1 -Type DWord -Force
      "OK"
    `,
    checkScript: `
      $v = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager' -ErrorAction SilentlyContinue).SystemPaneSuggestionsEnabled
      if ($v -eq 0) { "true" } else { "false" }
    `
  },
  {
    id: 'ui_disable_aero_shake',
    title: 'Desactivar Aero Shake (Sacudir para Minimizar)',
    tag: 'Productividad',
    badgeClass: 'badge-design',
    description: 'Evita que al mover una ventana rápidamente se minimicen por accidente todas las demás aplicaciones que tengas en pantalla.',
    riskLevel: 'low',
    risks: 'Ninguno. Elimina un comportamiento molesto al arrastrar ventanas en monitores múltiples.',
    safety: '100% Seguro',
    applyScript: `
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'DisallowShaking' -Value 1 -Type DWord -Force
      "OK"
    `,
    revertScript: `
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'DisallowShaking' -Value 0 -Type DWord -Force
      "OK"
    `,
    checkScript: `
      $v = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -ErrorAction SilentlyContinue).DisallowShaking
      if ($v -eq 1) { "true" } else { "false" }
    `
  },
  {
    id: 'ui_hung_app_timeout',
    title: 'Cierre Rápido de Procesos Bloqueados (HungAppTimeout = 1s)',
    tag: 'Sistema',
    badgeClass: 'badge-gaming',
    description: 'Reduce el tiempo en que Windows espera a programas congelados antes de ofrecer cerrarlos (de 5s a 1s), y acelera el apagado seguro.',
    riskLevel: 'low',
    risks: 'Si un juego muy pesado tarda en cargar al inicio, Windows podría detectarlo más rápido si deja de responder.',
    safety: 'Seguro • Evita esperas infinitas cuando una app se cuelga',
    applyScript: `
      Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'HungAppTimeout' -Value '1000' -Force
      Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'WaitToKillAppTimeout' -Value '2000' -Force
      Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control' -Name 'WaitToKillServiceTimeout' -Value '2000' -Force
      "OK"
    `,
    revertScript: `
      Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'HungAppTimeout' -Value '5000' -Force
      Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'WaitToKillAppTimeout' -Value '20000' -Force
      Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control' -Name 'WaitToKillServiceTimeout' -Value '5000' -Force
      "OK"
    `,
    checkScript: `
      $v = (Get-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -ErrorAction SilentlyContinue).HungAppTimeout
      if ($v -eq '1000') { "true" } else { "false" }
    `
  },
  {
    id: 'ui_explorer_separate_process',
    title: 'Explorador en Proceso Independiente (Estabilidad)',
    tag: 'Estabilidad',
    badgeClass: 'badge-design',
    description: 'Ejecuta ventanas de carpetas en un proceso separado para que si una carpeta se bloquea no arrastre ni congele la barra de tareas.',
    riskLevel: 'low',
    risks: 'Consume aproximadamente ~15 MB adicionales de memoria RAM.',
    safety: 'Seguro • Aísla fallos de carpetas pesadas',
    applyScript: `
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'SeparateProcess' -Value 1 -Type DWord -Force
      "OK"
    `,
    revertScript: `
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'SeparateProcess' -Value 0 -Type DWord -Force
      "OK"
    `,
    checkScript: `
      $v = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -ErrorAction SilentlyContinue).SeparateProcess
      if ($v -eq 1) { "true" } else { "false" }
    `
  }
];

const { RestorationManager } = require('./restorationStore');
const { getResources } = require('./restorationResources');
let restoration;
function manager() { return restoration || (restoration = new RestorationManager()); }
for (const tweak of SNAPPY_UI_TWEAKS) {
  tweak.free = true;
  tweak.safety = 'Revisa el efecto antes de aplicar. Se conserva el estado original.';
  tweak.risks = tweak.risks.replace(/100% seguro y reversible\.?/gi, 'Se guardará el valor original para restaurarlo.').replace(/^Ninguno\.\s*/i, '');
  tweak.applyScript = require('./systemInfo').normalizeRegistryCreation(tweak.applyScript);
}
async function getSnappyUiStatus() {
  const script = '$statuses = @{}\n' + SNAPPY_UI_TWEAKS.map(tweak => `try { $value = & { ${tweak.checkScript} }; $statuses['${tweak.id}'] = (($value | Out-String).Trim().ToLowerInvariant() -eq 'true') } catch { $statuses['${tweak.id}'] = $false }\n$global:LASTEXITCODE = 0`).join('\n') + '\n$statuses | ConvertTo-Json -Compress';
  const result = await runPowerShell(script);
  let statuses = {};
  if (result.success) try { statuses = JSON.parse(result.output); } catch {}
  return SNAPPY_UI_TWEAKS.map(({ applyScript, revertScript, checkScript, ...tweak }) => ({ ...tweak, isApplied: statuses[tweak.id] === true }));
}
async function applySnappyUiTweak(id) {
  const tweak = SNAPPY_UI_TWEAKS.find(item => item.id === id);
  if (!tweak) return { success: false, message: 'Ajuste no encontrado.' };
  try { return await manager().apply(`snappy:${id}`, getResources(id), tweak.applyScript, tweak.checkScript); }
  catch (error) { return { success: false, message: error.message }; }
}
async function revertSnappyUiTweak(id) {
  const tweak = SNAPPY_UI_TWEAKS.find(item => item.id === id);
  if (!tweak) return { success: false, message: 'Ajuste no encontrado.' };
  try { return await manager().revert(`snappy:${id}`, getResources(id)); }
  catch (error) { return { success: false, message: error.message }; }
}
async function applyAllSnappyUi() {
  const results = [];
  for (const tweak of SNAPPY_UI_TWEAKS) results.push({ id: tweak.id, ...await applySnappyUiTweak(tweak.id) });
  const failed = results.filter(result => !result.success).length;
  return { success: failed === 0, partial: failed > 0 && failed < results.length, results, message: failed ? `${results.length - failed} ajustes aplicados y ${failed} con incidencias.` : 'Ajustes visuales aplicados y verificados; se conservan los valores originales.' };
}
module.exports = { SNAPPY_UI_TWEAKS, getSnappyUiStatus, applySnappyUiTweak, revertSnappyUiTweak, applyAllSnappyUi };
