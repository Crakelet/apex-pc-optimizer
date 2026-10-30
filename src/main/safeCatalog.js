'use strict';
const SETTINGS = Object.freeze([
  { id: 'game-mode', title: 'Modo Juego de Windows', category: 'gaming', description: 'Activa la preferencia de Modo Juego del usuario actual.', consequence: 'Windows decide cómo usar este modo según el juego y el equipo. No garantiza más FPS.', path: 'HKCU:\\Software\\Microsoft\\GameBar', name: 'AutoGameModeEnabled', kind: 'DWord', value: 1 },
  { id: 'game-capture', title: 'Desactivar captura de juegos', category: 'gaming', description: 'Desactiva Game DVR para el usuario actual.', consequence: 'La captura de clips de Xbox puede dejar de estar disponible. No cierra OBS ni otras aplicaciones de grabación.', path: 'HKCU:\\System\\GameConfigStore', name: 'GameDVR_Enabled', kind: 'DWord', value: 0 },
  { id: 'background-capture', title: 'Desactivar captura de aplicaciones', category: 'gaming', description: 'Desactiva la preferencia AppCapture de Windows para este usuario.', consequence: 'Afecta a la grabación integrada de Windows. Úsalo si no dependes de esa función.', path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR', name: 'AppCaptureEnabled', kind: 'DWord', value: 0 },
  { id: 'transparency', title: 'Reducir transparencias', category: 'desktop', description: 'Desactiva las transparencias del escritorio de Windows.', consequence: 'Cambia la apariencia de Windows. Algunas superficies pueden requerir cerrar sesión.', path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', name: 'EnableTransparency', kind: 'DWord', value: 0 },
  { id: 'menu-delay', title: 'Acortar la espera de los menús', category: 'desktop', description: 'Establece en 200 ms la demora al desplegar submenús del escritorio.', consequence: 'Solo cambia la respuesta visual de los menús; no acelera el procesador ni los juegos. Puede requerir cerrar sesión.', path: 'HKCU:\\Control Panel\\Desktop', name: 'MenuShowDelay', kind: 'String', value: '200' }
]);
const COMING_SOON = Object.freeze([
  { id: 'game-lab', title: 'Laboratorio de rendimiento', description: 'Sesiones reproducibles, tiempos por fotograma y comparación antes/después.', reason: 'Requiere un colector de rendimiento y una metodología de comparación validados.' },
  { id: 'game-profiles', title: 'Perfiles por juego', description: 'Configuraciones temporales con respaldo de archivos y restauración al terminar.', reason: 'Los perfiles anteriores no ofrecían restauración completa. Se están rediseñando.' },
  { id: 'network-lab', title: 'Diagnóstico de red bajo carga', description: 'Análisis de jitter, pérdidas y latencia durante una sesión.', reason: 'La prueba ICMP básica ya está disponible. El análisis bajo carga aún no está implementado.' },
  { id: 'cleaner', title: 'Limpieza con recuperación', description: 'Vista previa de archivos regenerables y recuperación de cambios.', reason: 'La limpieza anterior podía incluir autoguardados. No está habilitada en esta versión.' },
  { id: 'memory', title: 'Análisis avanzado de memoria', description: 'Investigar presión de memoria y procesos durante una sesión.', reason: 'Se ha retirado la purga automática y cualquier cifra de liberación simulada.' },
  { id: 'creative', title: 'Estación creativa', description: 'Revisión de cachés, almacenamiento y preparación para renderizado.', reason: 'Se están definiendo reglas que protejan medios, proyectos y archivos de recuperación.' },
  { id: 'hardware', title: 'Diagnóstico avanzado de hardware', description: 'Información de memoria y almacenamiento con fuentes verificables.', reason: 'No se inferirá XMP, canales de RAM ni tasa de sondeo USB como si fueran mediciones.' }
]);
function getSetting(id) {
  const setting = SETTINGS.find(item => item.id === id);
  if (!setting) throw new Error('Este ajuste no está disponible en la versión actual.');
  return setting;
}
module.exports = { SETTINGS, COMING_SOON, getSetting };
