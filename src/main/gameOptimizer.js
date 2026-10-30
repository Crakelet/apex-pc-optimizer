'use strict';
const GAMES_DATA = [
  {
    "id": "valorant",
    "name": "VALORANT",
    "tag": "Riot Games",
    "icon": "🎯",
    "description": "Preferencias de VALORANT con respaldo del archivo o valor original. El resultado depende de tu equipo y de la versión del juego.",
    "tweaks": [
      {
        "id": "val_fullscreen",
        "group": "Pantalla y Tasa de Cuadros",
        "title": "Habilitar Pantalla Completa Exclusiva",
        "description": "Selecciona pantalla completa en la configuración del juego. El modo de presentación final depende del motor y de Windows."
      },
      {
        "id": "val_disable_vsync",
        "group": "Pantalla y Tasa de Cuadros",
        "title": "Desactivar V-Sync (Sincronización Vertical)",
        "description": "Desactiva V-Sync en el archivo del juego. Puede reducir la espera de sincronización y provocar tearing."
      },
      {
        "id": "val_disable_dynamic_res",
        "group": "Pantalla y Tasa de Cuadros",
        "title": "Desactivar Resolución Dinámica",
        "description": "Evita que el juego altere la nitidez y el escalado de resolución durante combates pesados."
      },
      {
        "id": "val_disable_hdr",
        "group": "Pantalla y Tasa de Cuadros",
        "title": "Desactivar Salida HDR",
        "description": "Apaga el mapeo de tonos de alto rango dinámico para ahorrar tiempo de cómputo en la GPU."
      },
      {
        "id": "val_multithreaded_rendering",
        "group": "Rendimiento de Motor",
        "title": "Renderizado Multihilo (Multithreaded Rendering)",
        "description": "Activa la preferencia de renderizado multihilo cuando la configuración del juego la contiene. Su soporte depende de la versión y del hardware."
      },
      {
        "id": "val_unlock_fps",
        "group": "Pantalla y Tasa de Cuadros",
        "title": "Desactivar Límites de FPS (Unlock Framerate)",
        "description": "Desactiva los límites de FPS indicados en el archivo. Puede aumentar consumo, temperatura y carga de GPU, incluso en menús."
      },
      {
        "id": "val_show_fps",
        "group": "Pantalla y Tasa de Cuadros",
        "title": "Mostrar Contador de FPS en Juego",
        "description": "Activa el medidor de FPS nativo en pantalla de VALORANT (Texto en esquina superior izquierda)."
      },
      {
        "id": "val_low_shadows",
        "group": "Calidad Gráfica Competitiva",
        "title": "Calidad de Sombras Mínima (Low Shadows)",
        "description": "Desactiva sombras complejas y suavizado dinámico en mapas para ganar hasta 25 FPS en zonas con humo."
      },
      {
        "id": "val_low_textures",
        "group": "Calidad Gráfica Competitiva",
        "title": "Calidad de Texturas Competitiva (Low Textures)",
        "description": "Reduce el consumo de VRAM y acelera la carga entre rondas sin afectar la visibilidad de los agentes."
      },
      {
        "id": "val_low_effects",
        "group": "Calidad Gráfica Competitiva",
        "title": "Calidad de Efectos Mínima (Low Effects)",
        "description": "Simplifica los efectos de partículas de habilidades y explosiones para evitar caídas bruscas de FPS en tiroteos."
      },
      {
        "id": "val_low_postprocessing",
        "group": "Calidad Gráfica Competitiva",
        "title": "Desactivar Post-Procesado Pesado (Low Post-Processing)",
        "description": "Elimina filtros de coloración y correcciones visuales pesadas de la GPU."
      },
      {
        "id": "val_low_shading",
        "group": "Calidad Gráfica Competitiva",
        "title": "Calidad de Sombreadores Baja (Low Shading Quality)",
        "description": "Reduce la complejidad de los píxel shaders sobre paredes y suelos para aliviar la carga de la GPU."
      },
      {
        "id": "val_low_foliage",
        "group": "Calidad Gráfica Competitiva",
        "title": "Calidad de Follaje y Vegetación Mínima (Low Foliage)",
        "description": "Disminuye la densidad de hojas y plantas en mapas como Breeze o Lotus."
      },
      {
        "id": "val_low_antialiasing",
        "group": "Calidad Gráfica Competitiva",
        "title": "Desactivar Anti-Aliasing (Low AA Quality)",
        "description": "Elimina el suavizado de bordes borroso, dejando siluetas más nítidas de los oponentes a largas distancias."
      },
      {
        "id": "val_disable_vignette",
        "group": "Claridad Visual",
        "title": "Desactivar Viñeteado y Distorsión (Vignette & Bloom)",
        "description": "Elimina sombras oscuras en los bordes de la pantalla y reflejos cegadores de las fuentes de luz."
      },
      {
        "id": "val_cpu_priority",
        "group": "Ajustes del Sistema Windows",
        "title": "Prioridad de CPU y GPU Alta en Windows",
        "description": "Solicita prioridad alta para el ejecutable del juego mediante una preferencia de Windows. Puede afectar a otras aplicaciones."
      }
    ]
  },
  {
    "id": "fortnite",
    "name": "Fortnite",
    "tag": "Epic Games",
    "icon": "⚡",
    "description": "Preferencias de Fortnite con respaldo del archivo o valor original. El resultado depende de tu equipo y de la versión del juego.",
    "tweaks": [
      {
        "id": "fn_disable_vsync",
        "group": "Pantalla y Tasa de Cuadros",
        "title": "Desactivar V-Sync (Sincronización Vertical)",
        "description": "Elimina el retraso de sincronización en construcciones rápidas y edición de paredes."
      },
      {
        "id": "fn_disable_grass",
        "group": "Calidad Gráfica Competitiva",
        "title": "Desactivar Hierba y Vegetación (bShowGrass = False)",
        "description": "Apaga el renderizado de hierba en todo el mapa de Fortnite. Maximiza la visibilidad de jugadores y sube FPS."
      },
      {
        "id": "fn_disable_raytracing",
        "group": "Rendimiento de Motor",
        "title": "Desactivar Ray Tracing, Lumen y Nanite",
        "description": "Asegura que las funciones de trazado de rayos no se activen en modo DirectX 11 o Rendimiento."
      },
      {
        "id": "fn_low_shadows_effects",
        "group": "Calidad Gráfica Competitiva",
        "title": "Sombras, Efectos y Post-Procesado al Mínimo",
        "description": "Fuerza sg.ShadowQuality=0, sg.EffectsQuality=0 y sg.PostProcessQuality=0 en la configuración de usuario."
      },
      {
        "id": "fn_cpu_priority",
        "group": "Ajustes del Sistema Windows",
        "title": "Prioridad de CPU Alta en Windows",
        "description": "Solicita prioridad alta para el ejecutable de Fortnite. No garantiza una mejora y puede afectar a otras aplicaciones."
      }
    ]
  },
  {
    "id": "cs2",
    "name": "Counter-Strike 2 (CS2)",
    "tag": "Valve / Steam",
    "icon": "💣",
    "description": "Preferencias de Counter-Strike 2 (CS2) con respaldo del archivo o valor original. El resultado depende de tu equipo y de la versión del juego.",
    "tweaks": [
      {
        "id": "cs2_cpu_priority",
        "group": "Ajustes del Sistema Windows",
        "title": "Prioridad de CPU y GPU Alta en Windows",
        "description": "Solicita prioridad alta para el ejecutable de CS2. No garantiza una mejora y puede afectar a otras aplicaciones."
      },
      {
        "id": "cs2_disable_fse",
        "group": "Pantalla y Tasa de Cuadros",
        "title": "Desactivar Optimizaciones de Pantalla Completa DWM",
        "description": "Configura la preferencia de compatibilidad de pantalla completa para la ruta real de CS2. Abre el juego para localizar su ejecutable."
      },
      {
        "id": "cs2_game_dvr_off",
        "group": "Rendimiento de Motor",
        "title": "Desactivar Intercepción de Grabación para CS2",
        "description": "Bloquea la intercepción de buffers de Game Bar para evitar micro-stutters con monitores de 144Hz/240Hz."
      }
    ]
  },
  {
    "id": "apex_legends",
    "name": "Apex Legends",
    "tag": "EA / Respawn",
    "icon": "🏆",
    "description": "Preferencias de Apex Legends con respaldo del archivo o valor original. El resultado depende de tu equipo y de la versión del juego.",
    "tweaks": [
      {
        "id": "apex_csm_shadows_off",
        "group": "Calidad Gráfica Competitiva",
        "title": "Desactivar Sombras Dinámicas en Cascada (CSM Off)",
        "description": "Configura setting.csm_enabled = 0 en videoconfig.txt. La mejora más potente de Apex Legends (hasta 40 FPS más)."
      },
      {
        "id": "apex_ragdolls_zero",
        "group": "Calidad Gráfica Competitiva",
        "title": "Eliminar Físicas de Muñecos (Ragdoll Count = 0)",
        "description": "Configura setting.ragdoll_maxcount = 0 para eliminar cálculos de físicas de cadáveres en tiroteos múltiples."
      },
      {
        "id": "apex_cpu_priority",
        "group": "Ajustes del Sistema Windows",
        "title": "Prioridad de CPU Alta en Windows (r5apex.exe)",
        "description": "Solicita prioridad alta para el ejecutable de Apex Legends. No garantiza una mejora y puede afectar a otras aplicaciones."
      }
    ]
  },
  {
    "id": "call_of_duty",
    "name": "Call of Duty (Warzone / MW)",
    "tag": "Activision",
    "icon": "🎖️",
    "description": "Preferencias de Call of Duty (Warzone / MW) con respaldo del archivo o valor original. El resultado depende de tu equipo y de la versión del juego.",
    "tweaks": [
      {
        "id": "cod_cpu_priority",
        "group": "Ajustes del Sistema Windows",
        "title": "Prioridad de CPU Alta en Windows (cod.exe)",
        "description": "Solicita prioridad alta para el ejecutable de Call of Duty. No garantiza una mejora y puede afectar a otras aplicaciones."
      },
      {
        "id": "cod_disable_fse",
        "group": "Pantalla y Tasa de Cuadros",
        "title": "Desactivar Optimizaciones de Pantalla Completa DWM",
        "description": "Configura la preferencia de compatibilidad de pantalla completa para la ruta real de Call of Duty. Abre el juego para localizar su ejecutable."
      }
    ]
  }
];

// The original catalog remains free; mutations use exact backups, not default scripts.
const gameBackups = require('./gameBackupStore');
for (const game of GAMES_DATA) for (const tweak of game.tweaks) {
  delete tweak.applyScript;
  delete tweak.revertScript;
  delete tweak.checkScript;
}
async function getGamesList(profileId = null) {
  const ids=GAMES_DATA.flatMap(game => game.tweaks.map(tweak => tweak.id));
  const configProfiles=gameBackups.getConfigProfiles();
  const profileAvailable=profileId!==null&&configProfiles.some(profile=>profile.id===profileId);
  const selectedConfigProfileId=profileAvailable?profileId:(configProfiles.length===1?configProfiles[0].id:null);
  const states = await gameBackups.statuses(ids,selectedConfigProfileId);
  const owned=gameBackups.ownership(ids,selectedConfigProfileId),allOwned=gameBackups.ownership(ids);
  return GAMES_DATA.map(game => ({
    id: game.id, name: game.name, tag: game.tag, icon: game.icon, description: game.description,
    hasGameBackups:game.tweaks.some(tweak=>allOwned[tweak.id]?.hasBackup),
    ...(game.id==='valorant'?{configProfiles,selectedConfigProfileId,configProfileWarning:profileId&&!profileAvailable?'El perfil anterior ya no está disponible. Se actualizó la lista; revisa la selección antes de aplicar.':null}:{}),
    tweaks: game.tweaks.map(tweak => ({ id: tweak.id, group: tweak.group || 'Ajustes generales', title: tweak.title, description: tweak.description, configFile:Boolean(gameBackups.FILE_SETTINGS[tweak.id]), isApplied: states[tweak.id] === true,hasBackup:false,...owned[tweak.id] }))
  }));
}
function findTweakById(id) { return GAMES_DATA.flatMap(game => game.tweaks).find(tweak => tweak.id === id); }
async function applySpecificGameTweak(id,profileId=null) {
  if (!findTweakById(id)) return { success: false, message: 'Mejora no encontrada.' };
  return gameBackups.apply(id,profileId);
}
async function revertSpecificGameTweak(id) {
  if (!findTweakById(id)) return { success: false, message: 'Mejora no encontrada.' };
  return gameBackups.revert(id);
}
async function revertGameProfile(id){
 const game=GAMES_DATA.find(item=>item.id===id);
 if(!game)return{success:false,message:'Juego no reconocido.'};
 return gameBackups.revertProfile(game.tweaks.map(tweak=>tweak.id));
}
module.exports = { GAMES_DATA, getGamesList, applySpecificGameTweak, revertSpecificGameTweak,revertGameProfile };
