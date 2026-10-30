# Validación local de v1.0.0

Fecha: 29 de octubre de 2026 (America/Santiago). Entorno: Windows x64, compilación 26300; Node.js 24.15.0, Electron 45.0.0 y electron-builder 26.18.0.

La distribución inicia en **modo normal**, con herramientas reales y confirmación previa. `run.bat` y `npm start` usan este modo. `run-tests.bat`, `run.bat --test-mode` y `npm run start:test` abren la simulación por separado.

## Resultados

| Comprobación | Resultado |
| --- | --- |
| Sintaxis y política de seguridad | 62 archivos JavaScript comprobados. |
| Pruebas automatizadas | 119 correctas, sin fallos ni pruebas omitidas. |
| Integración nativa de Windows | Dos escenarios correctos del motor activo sobre claves HKCU temporales exclusivas de la prueba; se retiraron al terminar. |
| Dependencias | La consulta npm audit del 28 de octubre no reportó vulnerabilidades conocidas. No cambiaron las dependencias después de esa consulta. |
| Arranque normal empaquetado | Catálogo gratuito de 50 ajustes, cinco juegos con 29 ajustes, navegación de las 14 secciones, permisos reales, actividad y respaldos. Confirmación cancelada sin modificar el historial. |
| Portable final | Recorrido correcto en simulación, con nueve mutaciones interceptadas y ningún error de consola registrado. |
| Aislamiento | Sandbox y contextIsolation activos; Node deshabilitado en el renderer. |
| Contenido del paquete | 48 archivos de código, interfaz, recursos y licencias coinciden con las fuentes finales. |
| Instalación local por usuario | Setup instalado en una carpeta exclusiva de validación dentro de scratch; registros, accesos directos y ASAR comprobados. |
| Aplicación instalada | Arranque normal de verificación correcto, con modificaciones bloqueadas durante el recorrido. |
| Desinstalación | Completada; destino, claves y accesos directos retirados. Los datos previos se conservaron y la caché creada por la prueba se retiró tras comprobar su hash. |
| Integridad | SHA-256 y tamaños de ambos ejecutables registrados en release-manifest.json y contrastados con SHA256SUMS.txt. |
| Firma | Portable e instalador: NotSigned, comprobado con Authenticode. |

La prueba nativa conserva tipos y valores existentes o ausentes: DWord, QWord, String, ExpandString, MultiString y Binary, además de texto con caracteres especiales. Comprueba persistencia entre instancias del motor, propiedades vecinas, conflictos externos y fallos de PowerShell. No modifica preferencias reales del usuario, servicios, dispositivos, arranque ni energía.

Las pruebas con adaptadores simulados cubren los respaldos previos a la escritura, fallos de guardado, destinos alterados, orden de restauración de ajustes solapados y juegos, recuperación de controles tras errores, cierre de tareas de memoria y preparación del reinicio como administrador. La creación de puntos exige una secuencia nueva confirmada por Windows; esa lógica se probó con respuestas simuladas, sin crear puntos en el equipo de trabajo.

La detección de aplicaciones creativas recorre carpetas pertinentes con límites de tiempo, profundidad y entradas. Una medición local de solo lectura terminó en 723 ms, con tres aplicaciones confirmadas y aviso de cobertura parcial. Ese dato no es una garantía de tiempo para todos los equipos. Los procesos hijos de Windows PowerShell usan sus módulos compatibles, sin cambiar las variables del sistema.

## Evidencia

- `dist/release-manifest.json`: versión, archivos comprobados, tamaños, hashes y estado de firma.
- `scratch/packaged-release-startup-report.json`: arranque empaquetado con backend normal y verificación de solo lectura.
- `scratch/portable-smoke-report.json`: recorrido del portable final en simulación.
- `scratch/installer-validation-confirm1/before-installation-proof.json`: estado y hashes previos a la prueba del Setup.
- `scratch/installer-validation-confirm1/installer-validation-report.json`: ciclo completo correcto, datos conservados y ausencia de restos.

Scratch está excluido del repositorio. No publiques los inventarios privados de la prueba. Las capturas actuales de la interfaz están en docs/images.

## Límites de la validación

La instalación se comprobó por usuario en este equipo, con un destino aislado dentro del proyecto. No acredita una VM limpia, una cuenta estándar nueva, instalación para todos los usuarios ni todos los flujos UAC.

La aplicación y restauración de perfiles completos, limpiezas, red, servicios, dispositivos y ajustes de arranque requieren una matriz adicional en Windows desechable, incluyendo reinicio y hardware representativo. No se aplicaron esas optimizaciones sobre el equipo de trabajo durante esta validación final.

La firma digital, la publicación de GitHub y la matriz de compatibilidad Windows 10/11 siguen siendo tareas del lanzamiento público. La v1 puede utilizarse en modo normal; estos resultados no certifican todos los equipos ni garantizan mejoras de rendimiento. Sigue [RELEASING.md](RELEASING.md) para publicar.
