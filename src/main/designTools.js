const { exec } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

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

async function runPsScript(script, input = {}) {
  const res = await require('./systemInfo').runPowerShell(require('./safeCleanup').CLEANUP_SCRIPT + '\n' + script, input && typeof input === 'object' ? input : {});
  if (!res.success) throw new Error(res.output || 'Windows no pudo completar la operación.');
  return res.output || '';
}

/**
 * Purga de Memoria Standby y Working Sets para liberar RAM antes de renders pesados
 */
async function purgeStandbyRam() {
  return await require('./memoryCleanerService').purgeStandbyList();
}

/**
 * Detecta suites de diseño y software creativo instalado en el equipo (Photoshop, Illustrator, InDesign, etc.)
 */
const DESIGN_APP_DEFINITIONS = [
  ['Photoshop.exe','Adobe Photoshop (PSD)','PSD','Ps','#31a8ff'],
  ['Illustrator.exe','Adobe Illustrator (AI)','AI','Ai','#ff9a00'],
  ['InDesign.exe','Adobe InDesign','ID','Id','#ff3366'],
  ['Adobe Premiere Pro.exe','Adobe Premiere Pro','PR','Pr','#ea77ff'],
  ['AfterFX.exe','Adobe After Effects','AE','Ae','#9999ff'],
  ['Lightroom.exe','Adobe Lightroom','LR','Lr','#31a8ff'],
  ['Resolve.exe','DaVinci Resolve','DVR','DaVinci','#ff5533'],
  ['blender.exe','Blender 3D','3D','Blender','#f5792a'],
  ['CLIPStudioPaint.exe','Clip Studio Paint','CSP','CSP','#00c8b3'],
  ['Figma.exe','Figma Desktop','FIG','Figma','#a259ff'],
  ['CorelDRW.exe','CorelDRAW','CDR','Corel','#2ecc71'],
  ['Cinema 4D.exe','Maxon Cinema 4D','C4D','C4D','#0055ff']
].map(([Key,Name,Tag,Badge,Color])=>({Key,Name,Tag,Badge,Color}));

// Registry metadata only. Filesystem discovery happens once with explicit budgets below.
const DESIGN_DISCOVERY_SCRIPT = String.raw`
$watch = [Diagnostics.Stopwatch]::StartNew()
$partial = $false; $visitedKeys = 0
$appPaths = @{}; $roots = @(); $gpu = @{}
$localDrives = @([IO.DriveInfo]::GetDrives() | Where-Object { $_.DriveType -eq [IO.DriveType]::Fixed } | ForEach-Object { $_.Name.Substring(0,1).ToLowerInvariant() })
function Test-LocalAppPath([string]$value) {
  return ($value -match '^[a-zA-Z]:\\' -and $localDrives -contains $value.Substring(0,1).ToLowerInvariant())
}
$matchCreative = '(?i)photoshop|illustrator|indesign|premiere|after effects|lightroom|davinci|blender|clip studio|figma|coreldraw|cinema 4d'
foreach ($hive in @([Microsoft.Win32.RegistryHive]::CurrentUser,[Microsoft.Win32.RegistryHive]::LocalMachine)) {
 foreach ($view in @([Microsoft.Win32.RegistryView]::Registry64,[Microsoft.Win32.RegistryView]::Registry32)) {
  $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive,$view)
  try {
   foreach ($definition in $data.definitions) {
    $key = $base.OpenSubKey('Software\Microsoft\Windows\CurrentVersion\App Paths\' + $definition.Key)
    if ($key) { try { $value = ([string]$key.GetValue('')).Trim().Trim('"'); if (Test-LocalAppPath $value) { $appPaths[$definition.Key.ToLowerInvariant()] = $value } } finally { $key.Close() } }
   }
   $uninstall = $base.OpenSubKey('Software\Microsoft\Windows\CurrentVersion\Uninstall')
   if ($uninstall) {
    try {
     foreach ($name in $uninstall.GetSubKeyNames()) {
      if ($watch.ElapsedMilliseconds -gt 3500 -or $visitedKeys -ge 2500) { $partial = $true; break }
      $visitedKeys++
      $key = $uninstall.OpenSubKey($name)
      if (-not $key) { continue }
      try {
       if ([string]$key.GetValue('DisplayName') -notmatch $matchCreative) { continue }
       $location = [string]$key.GetValue('InstallLocation')
       if (Test-LocalAppPath $location) { $roots += $location }
       $icon = ([string]$key.GetValue('DisplayIcon') -replace ',\s*-?\d+\s*$','').Trim().Trim('"')
       if ((Test-LocalAppPath $icon) -and [IO.Path]::GetExtension($icon) -eq '.exe') { $roots += [IO.Path]::GetDirectoryName($icon) }
      } finally { $key.Close() }
     }
    } finally { $uninstall.Close() }
   }
  } catch { $partial = $true } finally { $base.Close() }
 }
}
$preferences = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\Microsoft\DirectX\UserGpuPreferences')
if ($preferences) {
 try {
  $count = 0
  foreach ($name in $preferences.GetValueNames()) {
   if ($count++ -ge 2000) { $partial = $true; break }
   if (Test-LocalAppPath $name) { $gpu[$name.ToLowerInvariant()] = [string]$preferences.GetValue($name) }
  }
 } finally { $preferences.Close() }
}
@{ appPaths=$appPaths; roots=@($roots | Select-Object -Unique); localDrives=$localDrives; gpu=$gpu; running=@([Diagnostics.Process]::GetProcesses() | ForEach-Object { $_.ProcessName }); partial=$partial } | ConvertTo-Json -Depth 5 -Compress
`;

async function scanDesignExecutables(roots, initialPaths = {}, options = {}) {
  const io=options.fs||fs.promises, clock=options.clock||Date.now;
  const deadline=clock()+(options.maxMilliseconds??4500), maxDirectories=options.maxDirectories??180, maxEntries=options.maxEntries??7000, maxDepth=options.maxDepth??4;
  const names=new Set(DESIGN_APP_DEFINITIONS.map(item=>item.Key.toLowerCase())), found={};
  const queue=[], seen=new Set(), safeAncestors=new Set(); let partial=false, directories=0, entries=0;
  const timed=async action=>{
    const remaining=deadline-clock(); if(remaining<=0){partial=true;return null;}
    let timer;const expired=Symbol('deadline');
    try{const result=await Promise.race([action(),new Promise(resolve=>{timer=setTimeout(()=>resolve(expired),remaining);})]);if(result===expired){partial=true;return null;}return result;}
    finally{clearTimeout(timer);}
  };
  const local=value=>typeof value==='string'&&/^[a-z]:\\/i.test(value)&&!/[\0\r\n]/.test(value);
  const safeRoot=async value=>{
    if(!local(value))return false;
    let current=path.win32.normalize(value);const checked=[];
    while(current!==path.win32.dirname(current)){
      const key=current.toLowerCase();if(safeAncestors.has(key))break;
      try{const stat=await timed(()=>io.lstat(current));if(!stat||stat.isSymbolicLink()){partial=true;return false;}checked.push(key);}catch{return false;}
      current=path.win32.dirname(current);
    }
    for(const key of checked)safeAncestors.add(key);return true;
  };
  for(const [name,file] of Object.entries(initialPaths)){
    if(!names.has(name.toLowerCase())||!local(file)||!await safeRoot(path.win32.dirname(file)))continue;
    try{const stat=await timed(()=>io.lstat(file));if(stat?.isFile()&&!stat.isSymbolicLink())found[name.toLowerCase()]=file;}catch{}
  }
  for(const root of roots){
    if(!local(root))continue;
    const normalized=path.win32.normalize(root),key=normalized.toLowerCase();
    if(seen.has(key)||!await safeRoot(normalized))continue;
    seen.add(key);queue.push({directory:normalized,depth:0});
  }
  while(queue.length){
    if(directories>=maxDirectories||entries>=maxEntries||clock()>=deadline){partial=true;break;}
    const {directory,depth}=queue.shift();directories++;
    let children;try{children=await timed(()=>io.readdir(directory,{withFileTypes:true}));}catch{partial=true;continue;}
    if(!children)break;
    for(const item of children){
      if(entries++>=maxEntries||clock()>=deadline){partial=true;break;}
      if(item.isSymbolicLink()){partial=true;continue;}
      const file=path.win32.join(directory,item.name),key=file.toLowerCase();
      if(item.isFile()&&names.has(item.name.toLowerCase())&&!found[item.name.toLowerCase()])found[item.name.toLowerCase()]=file;
      if(item.isDirectory()&&depth<maxDepth&&!seen.has(key)){
        if(queue.length+directories>=maxDirectories){partial=true;continue;}
        seen.add(key);queue.push({directory:file,depth:depth+1});
      }
      else if(item.isDirectory()&&depth>=maxDepth)partial=true;
    }
  }
  return{paths:found,partial,directories,entries};
}

async function detectInstalledDesignApps() {
  try {
    const result=await require('./systemInfo').runPowerShell(DESIGN_DISCOVERY_SCRIPT,{definitions:DESIGN_APP_DEFINITIONS});
    if(!result.success)throw new Error(result.output||'No se pudo consultar el software creativo instalado.');
    const metadata=JSON.parse(result.output);
    if(!metadata||!Array.isArray(metadata.roots)||!metadata.appPaths||!Array.isArray(metadata.localDrives))throw new Error('Windows devolvió información de aplicaciones no válida.');
    const roots=[...metadata.roots];
    const bases=[process.env.ProgramFiles,process.env['ProgramFiles(x86)'],'D:\\Program Files','D:\\Program Files (x86)'];
    for(const base of bases.filter(Boolean))for(const vendor of ['Adobe','Blackmagic Design','Blender Foundation','CELSYS','Corel','Maxon'])roots.push(path.win32.join(base,vendor));
    if(process.env.LOCALAPPDATA){roots.push(path.win32.join(process.env.LOCALAPPDATA,'Figma'));roots.push(path.win32.join(process.env.LOCALAPPDATA,'Programs','Figma'));}
    const drives=new Set(metadata.localDrives.map(value=>String(value).toLowerCase()));
    const local=value=>typeof value==='string'&&/^[a-z]:\\/i.test(value)&&drives.has(value[0].toLowerCase());
    const scan=await scanDesignExecutables(roots.filter(local),Object.fromEntries(Object.entries(metadata.appPaths).filter(([,value])=>local(value))));
    const running=new Set((metadata.running||[]).map(value=>String(value).toLowerCase()));
    const apps=[];
    for(const definition of DESIGN_APP_DEFINITIONS){
      const file=scan.paths[definition.Key.toLowerCase()];if(!file)continue;
      const backup=getDesignGpuBackupStatus(file);
      apps.push({...definition,Path:file,Version:'Detectado',GpuOptimized:/GpuPreference=2(?:;|$)/i.test(metadata.gpu?.[file.toLowerCase()]||''),IsRunning:running.has(path.win32.parse(file).name.toLowerCase()),HasGpuBackup:backup.success&&backup.hasBackup,BackupStatus:backup.status||null,BackupError:backup.success?null:backup.message});
    }
    const partial=metadata.partial===true||scan.partial;
    return{success:true,apps,partial,warning:partial?'La búsqueda fue parcial para mantener la aplicación ágil. Se muestran las aplicaciones confirmadas; una ruta no detectada no significa que la aplicación no esté instalada.':null};
  }catch(error){return{success:false,apps:[],error:error.message};}
}


/**
 * Obtiene el resumen del espacio ocupado por caché de diseño y scratch disks
 */
async function getDesignCacheSummary() {
  const script = `
    $targets = @(
      @{ App = 'MediaCache'; Category = 'Adobe Premiere (Media Cache)'; Path = (Join-Path $env:APPDATA 'Adobe\\Common\\Media Cache Files'); Filter = '*' },
      @{ App = 'MediaCache'; Category = 'Adobe Premiere (Media Cache)'; Path = (Join-Path $env:APPDATA 'Adobe\\Common\\Media Cache'); Filter = '*' },
      @{ App = 'MediaCache'; Category = 'Adobe Premiere (Picos de Audio)'; Path = (Join-Path $env:APPDATA 'Adobe\\Common\\Peak Files'); Filter = '*' },
      @{ App = 'DaVinci'; Category = 'DaVinci Resolve (Render Cache)'; Path = (Join-Path $env:LOCALAPPDATA 'Blackmagic Design\\DaVinci Resolve\\Support\\CacheClip'); Filter = '*' },
      @{ App = 'DaVinci'; Category = 'DaVinci Resolve (Temp)'; Path = (Join-Path $env:LOCALAPPDATA 'Temp\\DaVinciResolve'); Filter = '*' }
    )

    $adobeRoaming = Join-Path $env:APPDATA 'Adobe'
    if (Test-Path $adobeRoaming) {
      Get-ChildItem -Path $adobeRoaming -Filter 'Adobe Illustrator*' -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $caches = Get-ChildItem -Path $_.FullName -Filter 'Caches' -Recurse -Depth 2 -Directory -ErrorAction SilentlyContinue
        foreach ($c in $caches) {
          $targets += @{ App = 'Illustrator'; Category = 'Adobe Illustrator (Caches)'; Path = $c.FullName; Filter = '*' }
        }
      }
    }

    $totalBytes = 0
    $totalCount = 0
    $breakdown = @{}

    foreach ($t in $targets) {
      $dir = $t.Path
      if ($dir -and (Test-Path $dir -ErrorAction SilentlyContinue)) {
        $files = @(Get-ApexCacheFiles -Root $dir -Filter $t.Filter)
        foreach ($f in $files) {
          $totalBytes += $f.Length
          $totalCount++
          $cat = $t.Category
          if (-not $breakdown.ContainsKey($cat)) { $breakdown[$cat] = 0 }
          $breakdown[$cat] += $f.Length
        }
      }
    }

    $items = @()
    foreach ($k in $breakdown.Keys) {
      $items += [PSCustomObject]@{
        Category = $k
        SizeMB = [math]::Round($breakdown[$k] / 1MB, 1)
      }
    }

    [PSCustomObject]@{
      TotalCount = $totalCount
      TotalMB = [math]::Round($totalBytes / 1MB, 1)
      TotalGB = [math]::Round($totalBytes / 1GB, 2)
      Breakdown = $items
    } | ConvertTo-Json
  `;

  try {
    const out = await runPsScript(script);
    const data = JSON.parse(out || '{}');
    return {
      success: true,
      totalCount: data.TotalCount || 0,
      totalMB: data.TotalMB || 0,
      totalGB: data.TotalGB || 0,
      breakdown: data.Breakdown || []
    };
  } catch (err) {
    return { success: false, totalCount: 0, totalMB: 0, totalGB: 0, breakdown: [] };
  }
}

/**
 * Limpieza profunda de Scratch Disks y Caché de Medios de Adobe Photoshop, Illustrator, Premiere, DaVinci y Blender
 */
async function cleanCreativeMediaCache() {
  const script = `
    if (@(Get-Process -Name Photoshop,Illustrator,AfterFX,'Adobe Premiere Pro',Resolve,blender -ErrorAction SilentlyContinue).Count -gt 0) { throw 'Cierra las aplicaciones creativas antes de limpiar sus cachés.' }
    $targets = @(
      # Solo cachés regenerables; se preservan scratch y recuperación.
      
      # Illustrator (AI) Temp Scratch

      # Adobe Premiere & After Effects Media Cache
      @{ Path = (Join-Path $env:APPDATA 'Adobe\\Common\\Media Cache Files'); Filter = '*' },
      @{ Path = (Join-Path $env:APPDATA 'Adobe\\Common\\Media Cache'); Filter = '*' },
      @{ Path = (Join-Path $env:APPDATA 'Adobe\\Common\\Peak Files'); Filter = '*' },

      # DaVinci Resolve & Blender
      @{ Path = (Join-Path $env:LOCALAPPDATA 'Blackmagic Design\\DaVinci Resolve\\Support\\CacheClip'); Filter = '*' },
      @{ Path = (Join-Path $env:LOCALAPPDATA 'Temp\\DaVinciResolve'); Filter = '*' }
    )

    # Añadir cachés de Photoshop e Illustrator en AppData
    $adobeRoaming = Join-Path $env:APPDATA 'Adobe'
    if (Test-Path $adobeRoaming) {
      Get-ChildItem -Path $adobeRoaming -Filter 'Adobe Illustrator*' -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $caches = Get-ChildItem -Path $_.FullName -Filter 'Caches' -Recurse -Depth 2 -Directory -ErrorAction SilentlyContinue
        foreach ($c in $caches) { $targets += @{ Path = $c.FullName; Filter = '*' } }
      }
    }

    $deletedCount = 0
    $deletedBytes = 0

    foreach ($t in $targets) {
      $dir = $t.Path
      if ($dir -and (Test-Path $dir -ErrorAction SilentlyContinue)) {
        $files = @(Get-ApexCacheFiles -Root $dir -Filter $t.Filter)
        foreach ($f in $files) {
          try {
            $length = $f.Length
            Remove-Item -LiteralPath $f.FullName -Force -ErrorAction Stop
            if (-not (Test-Path -LiteralPath $f.FullName)) { $deletedBytes += $length; $deletedCount++ }
          } catch {}
        }
      }
    }

    $deletedMB = [math]::Round($deletedBytes / 1MB, 1)
    [PSCustomObject]@{
      Count = $deletedCount
      SizeMB = $deletedMB
    } | ConvertTo-Json
  `;

  try {
    const out = await runPsScript(script);
    const data = JSON.parse(out || '{}');
    const size = data.SizeMB || 0;
    const count = data.Count || 0;
    const msg = count > 0
      ? `Limpieza completada: ${count} archivos de caché regenerable eliminados (${size} MB).`
      : 'No se eliminaron archivos de caché elegibles. Los archivos recientes, medios y datos de recuperación se conservaron.';

    return {
      success: true,
      sizeMB: size,
      count: count,
      message: msg
    };
  } catch (err) {
    return { success: false, sizeMB: 0, count: 0, message: err.message };
  }
}

/**
 * Elimina la latencia y retardo del lápiz/tableta gráfica (Wacom, Huion, XP-Pen) en Photoshop y Windows Ink
 */
async function optimizeGraphicsTablet(engine) {
  if (!engine || typeof engine.applyTweak !== 'function') return { success: false, message: 'El motor de respaldos no está disponible. No se modificó Windows.' };
  return await engine.applyTweak('design_tablet_stylus_latency_fix');
}

/**
 * Asigna GPU dedicada de alto rendimiento a una app específica de diseño
 */
async function assignGpuToDesignApp(exePath) {
  return await require('./designGpuBackup').assign(exePath);
}

async function restoreGpuForDesignApp(exePath) {
  return await require('./designGpuBackup').restore(exePath);
}

function getDesignGpuBackupStatus(exePath) {
  return require('./designGpuBackup').status(exePath);
}

/**
 * Asigna la GPU dedicada de máximo rendimiento a todas las suites de diseño detectadas
 */
async function assignGpuToCreativeApps() {
  const detected = await detectInstalledDesignApps();
  if (!detected.success) return { success: false, count: 0, message: detected.message || 'No se pudieron consultar las aplicaciones creativas.' };
  const results = [];
  for (const app of detected.apps || []) {
    const result = await assignGpuToDesignApp(app.Path);
    results.push({ name: app.Name, path: app.Path, ...result });
  }
  const count = results.filter(item => item.success && !item.skipped).length;
  const failed = results.filter(item => !item.success);
  return { success: failed.length === 0, count, results, message: failed.length ? 'Algunas preferencias GPU no se aplicaron. Revisa los resultados; los respaldos existentes se conservaron.' : count ? 'Preferencia GPU aplicada con respaldo a ' + count + ' aplicación(es).' : 'No se necesitó modificar ninguna preferencia GPU.' };
}

/**
 * Aplica todas las optimizaciones de diseño en 1 solo clic
 */
async function applyAllDesignStudioProfile(engine) {
  if (!engine || typeof engine.applyTweak !== 'function') return { success: false, message: 'El motor de respaldos no está disponible. No se modificó Windows.' };
  const results = [];
  for (const id of ['large_system_cache', 'design_disable_paging_executive', 'render_threads_balance', 'long_paths_enabled', 'design_cleartype_pro_smoothing', 'protect_creative_services', 'design_tablet_stylus_latency_fix']) {
    const result = await engine.applyTweak(id);
    results.push({ id, ...result });
    if (!result.success) return { success: false, partial: results.some(item => item.success), results, message: 'El perfil se detuvo en un ajuste que Windows no pudo confirmar. Los ajustes anteriores conservan su respaldo y pueden restaurarse desde Copia de seguridad.' };
  }
  const gpu = await assignGpuToCreativeApps();
  results.push({ id: 'creative_gpu_preferences', ...gpu });
  return { success: gpu.success, partial: !gpu.success, results, message: gpu.success ? 'Perfil Estudio aplicado con respaldo y verificación. Los ajustes se restauran desde Copia de seguridad y cada preferencia GPU desde su aplicación.' : 'Los ajustes del perfil se respaldaron y verificaron; hubo incidencias al asignar la GPU. Revisa los resultados y los respaldos por aplicación.' };
}

module.exports = {
  purgeStandbyRam,
  cleanCreativeMediaCache,
  optimizeGraphicsTablet,
  assignGpuToCreativeApps,
  assignGpuToDesignApp,
  restoreGpuForDesignApp,
  getDesignGpuBackupStatus,
  detectInstalledDesignApps,
  scanDesignExecutables,
  DESIGN_APP_DEFINITIONS,
  DESIGN_DISCOVERY_SCRIPT,
  getDesignCacheSummary,
  applyAllDesignStudioProfile
};
