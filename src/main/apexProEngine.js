'use strict';
const path = require('node:path');
const { runPowerShell } = require('./systemInfo');
const { RestorationManager, userDataPath } = require('./restorationStore');
const { getResources } = require('./restorationResources');

const POWER_SCRIPT = `
  $output = (& powercfg.exe /duplicatescheme 'e9a42b02-d5df-448d-aa00-03f14749eb61' | Out-String)
  if ($LASTEXITCODE -ne 0 -or $output -notmatch '[a-fA-F0-9-]{36}') { throw 'No se pudo crear un plan independiente. El plan original no se modificó.' }
  $guid = $Matches[0]
  & powercfg.exe /changename $guid 'Apex Session'
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo identificar el plan independiente.' }
  foreach ($setting in @('CPMINCORES','PROCTHROTTLEMIN','PROCTHROTTLEMAX')) {
    & powercfg.exe /setacvalueindex $guid SUB_PROCESSOR $setting 100
    if ($LASTEXITCODE -ne 0) { throw 'Windows no confirmó una preferencia del nuevo plan.' }
  }
  & powercfg.exe /setacvalueindex $guid '2a737441-1930-4402-8d77-b2bebba308a3' '48e6b7a6-50f5-4782-a5d4-53bb8f07e226' 0
  if ($LASTEXITCODE -ne 0) { throw 'Windows no confirmó la preferencia USB del nuevo plan.' }
  & powercfg.exe /setactive $guid
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo activar el nuevo plan.' }
`;
const POWER_CHECK = `
  $active = (& powercfg.exe /getactivescheme | Out-String)
  if ($LASTEXITCODE -ne 0 -or $active -notmatch 'Apex Session') { 'false'; return }
  foreach ($setting in @('CPMINCORES','PROCTHROTTLEMIN','PROCTHROTTLEMAX')) {
    $query = (& powercfg.exe /query SCHEME_CURRENT SUB_PROCESSOR $setting | Out-String)
    $values = [regex]::Matches($query, '0x[0-9a-fA-F]+')
    if ($LASTEXITCODE -ne 0 -or $values.Count -lt 2 -or [Convert]::ToInt32($values[$values.Count - 2].Value.Substring(2),16) -ne 100) { 'false'; return }
  }
  $query = (& powercfg.exe /query SCHEME_CURRENT '2a737441-1930-4402-8d77-b2bebba308a3' '48e6b7a6-50f5-4782-a5d4-53bb8f07e226' | Out-String)
  $values = [regex]::Matches($query, '0x[0-9a-fA-F]+')
  if ($LASTEXITCODE -eq 0 -and $values.Count -ge 2 -and [Convert]::ToInt32($values[$values.Count - 2].Value.Substring(2),16) -eq 0) { 'true' } else { 'false' }
`;
const NETWORK_SCRIPT = `
  & netsh.exe interface tcp set global rss=enabled
  if ($LASTEXITCODE -ne 0) { throw 'Windows rechazó RSS.' }
  & netsh.exe interface tcp set global ecncapability=disabled
  if ($LASTEXITCODE -ne 0) { throw 'Windows rechazó ECN.' }
  & netsh.exe interface tcp set global autotuninglevel=normal
  if ($LASTEXITCODE -ne 0) { throw 'Windows rechazó el autoajuste TCP.' }
`;
const NETWORK_CHECK = `
  $setting = Get-NetTCPSetting -SettingName Internet
  $rss = (Get-NetOffloadGlobalSetting).ReceiveSideScaling.ToString()
  if ($rss -eq 'Enabled' -and $setting.EcnCapability.ToString() -eq 'Disabled' -and $setting.AutoTuningLevelLocal.ToString() -eq 'Normal') { 'true' } else { 'false' }
`;
const DETECT_MSI_SCRIPT = `
  $paths = @()
  foreach ($gpu in @(Get-CimInstance Win32_VideoController -ErrorAction Stop | Where-Object PNPDeviceID -like 'PCI*')) {
    $key = 'HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\' + $gpu.PNPDeviceID + '\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties'
    if (Test-Path -LiteralPath $key) { $paths += $key }
  }
  ConvertTo-Json -InputObject @($paths | Sort-Object -Unique) -Compress
`;
class ApexTools {
  constructor({ runner = runPowerShell, restoration, directory = userDataPath() } = {}) {
    this.runner = runner;
    this.restoration = restoration || new RestorationManager({ file: path.join(directory, 'restoration-v1.json'), runner });
  }
  async msiResources() {
    const result = await this.runner(DETECT_MSI_SCRIPT);
    if (!result.success) throw new Error(result.output || 'No se pudieron detectar las preferencias MSI.');
    const paths = JSON.parse(result.output);
    if (!Array.isArray(paths) || paths.length > 32 || paths.some(value => typeof value !== 'string' || !/^HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\PCI\\[a-z0-9_&.-]+\\[a-z0-9_&.-]+\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties$/i.test(value))) throw new Error('Windows devolvió una ruta MSI no reconocida.');
    return { ...getResources('apex_msi'), registry: paths.map(value => ({ path: value, name: 'MSISupported' })) };
  }
  async apply(kind) {
    try {
      let resources = getResources('apex_' + kind), script, check;
      if (kind === 'power') { script = POWER_SCRIPT; check = POWER_CHECK; }
      else if (kind === 'network') { script = NETWORK_SCRIPT; check = NETWORK_CHECK; }
      else if (kind === 'msi') {
        resources = await this.msiResources();
        if (!resources.registry.length) return { success: false, message: 'No se detectaron dispositivos con una configuración MSI compatible.' };
        // Only freshly detected, strictly validated device paths become script literals.
        const paths = '@(' + resources.registry.map(item => "'" + item.path + "'").join(',') + ')';
        script = 'foreach ($key in ' + paths + ') { Set-ItemProperty -LiteralPath $key -Name MSISupported -Value 1 -Type DWord -Force -ErrorAction Stop }';
        check = '$ok = $true; foreach ($key in ' + paths + ") { if ((Get-ItemProperty -LiteralPath $key -Name MSISupported).MSISupported -ne 1) { $ok = $false } }; if ($ok) { 'true' } else { 'false' }";
      } else throw new Error('Herramienta Apex no reconocida.');
      const result = await this.restoration.apply('apex:' + kind, resources, script, check);
      return { ...result, message: result.success ? 'Cambio comprobado; se guardó el estado original. Puedes restaurarlo desde este panel. No garantiza mayor rendimiento.' : result.message };
    } catch (error) { return { success: false, message: error.message }; }
  }
  async revertAll() {
    const results = [];
    try {
      const records = this.restoration.read().entries.filter(item => ['apex:power','apex:msi','apex:network'].includes(item.id) && ['prepared','applied','failed'].includes(item.status));
      for (const item of [...records].reverse()) {
        try {
          const kind = item.id.slice(5);
          const resources = kind === 'msi' ? await this.msiResources() : getResources('apex_' + kind);
          results.push({ id: item.id, ...await this.restoration.revert(item.id, resources) });
        } catch (error) { results.push({ id: item.id, success: false, message: error.message }); }
      }
      const failures = results.filter(item => !item.success);
      return { success: failures.length === 0, results, message: failures.length ? 'No se pudo restaurar todo: ' + failures.map(item => item.message).join(' ') : results.length ? 'Se restauraron y verificaron los cambios de energía, MSI y TCP respaldados en este panel. El plan independiente permanece disponible en Windows.' : 'No hay cambios Apex propios que restaurar.' };
    } catch (error) { return { success: false, results, message: error.message }; }
  }
}
let instance;
function tools() { return instance || (instance = new ApexTools()); }
async function applyApexPowerPlan() { return tools().apply('power'); }
async function applyMsiModeGpu() { return tools().apply('msi'); }
async function applyAdvancedNetworkStack() { return tools().apply('network'); }
async function revertApexTools() { return tools().revertAll(); }

function getBiosGuides() {
  return [
    {
      id: 'rebar',
      title: 'Resizable BAR (ReBAR / Smart Access Memory)',
      impact: 'Resultado dependiente del hardware; sin mejora garantizada',
      badge: 'Recomendado',
      description: 'Permite a la CPU acceder a todo el búfer de memoria de la tarjeta gráfica (VRAM) en una sola transferencia en vez de bloques pequeños de 256MB.',
      steps: [
        'Reinicia tu PC y pulsa Supr o F2 para entrar al BIOS.',
        'Activa "Above 4G Decoding" (normalmente en Configuración PCI / Avanzado).',
        'Activa "Re-Size BAR Support" (Auto o Enabled).',
        'Asegúrate de que CSM (Compatibility Support Module) esté "Disabled" (Modo UEFI puro).',
        'Guarda cambios con F10 y reinicia.'
      ]
    },
    {
      id: 'xmp',
      title: 'Perfiles de Memoria RAM (XMP / DOCP / EXPO)',
      impact: 'Resultado dependiente del hardware; sin mejora garantizada',
      badge: 'Guía gratuita',
      description: 'Los perfiles XMP/DOCP/EXPO aplican una configuración de memoria del fabricante. Su compatibilidad depende de la CPU, placa y módulos; requieren comprobar estabilidad.',
      steps: [
        'En el menú principal o Ai Tweaker / OC Tweaker de tu BIOS.',
        'Busca la opción "Memory Profile", "XMP" (Intel/ASUS), "D.O.C.P." (AMD ASUS) o "EXPO" (AMD AM5).',
        'Sigue el perfil compatible recomendado por el fabricante; la frecuencia más alta no garantiza estabilidad.',
        'Guarda con F10 y reinicia. Verifica en el Administrador de Tareas la velocidad.'
      ]
    },
    {
      id: 'pbo',
      title: 'AMD Precision Boost Overdrive (PBO) & Curve Optimizer',
      impact: 'Resultado dependiente del hardware; sin mejora garantizada',
      badge: 'Guía gratuita',
      description: 'Permite a procesadores Ryzen mantener frecuencias Turbo más altas y constantes mediante un undervolt adaptativo por curva.',
      steps: [
        'En BIOS busca "AMD Overclocking" -> "Precision Boost Overdrive".',
        'Configura PBO en "Advanced" o "Enabled".',
        'Consulta un procedimiento de validación específico para tu modelo. No copies valores negativos de otros equipos.',
        'Esto reduce el calor del procesador permitiéndole sostener frecuencias boost sostenidas.'
      ]
    },
    {
      id: 'cstates',
      title: 'Estados de Energía de CPU (C-States / C1E)',
      impact: 'Resultado dependiente del hardware; sin mejora garantizada',
      badge: 'Competitivo',
      description: 'Los estados C (C3, C6, C7) ponen núcleos de CPU a dormir cuando hay pausas de microsegundos, introduciendo retraso al reactivarse.',
      steps: [
        'En "CPU Configuration" o "Avanzado".',
        'Busca "CPU C-States" o "Global C-State Control".',
        'Para juego competitivo extremo, puedes ponerlo en "Disabled" para que la CPU nunca entre en estados de suspensión.',
        'Nota: En laptops, déjalo habilitado para preservar la batería.'
      ]
    },
    {
      id: 'hpet',
      title: 'High Precision Event Timer (HPET) en BIOS',
      impact: 'Resultado dependiente del hardware; sin mejora garantizada',
      badge: 'Avanzado',
      description: 'HPET es un temporizador antiguo que añade sobrecarga de interrupciones si está activo junto a los timers TSC modernos de la CPU.',
      steps: [
        'En Configuración Avanzada de Chipset / ACPI.',
        'Busca "High Precision Timer" o "HPET".',
        'Conserva el valor predeterminado salvo que el fabricante indique un cambio para un diagnóstico reproducible.',
        'Windows selecciona sus temporizadores según el hardware; alterar HPET no garantiza una mejora de latencia.'
      ]
    }
  ];
}


module.exports = { ApexTools, applyApexPowerPlan, applyMsiModeGpu, applyAdvancedNetworkStack, revertApexTools, getBiosGuides, POWER_SCRIPT, POWER_CHECK, NETWORK_SCRIPT, NETWORK_CHECK, DETECT_MSI_SCRIPT };
