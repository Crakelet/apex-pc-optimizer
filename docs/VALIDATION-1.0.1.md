# Validación local de v1.0.1

Fecha: 29 de octubre de 2026, America/Santiago. Windows x64 compilación 26300; Node.js 24.15.0, Electron 45.0.0 y electron-builder 26.18.0.

La aplicación conserva sus 14 secciones y herramientas gratuitas. Portable, Setup, `run.bat` y `npm start` arrancan en modo normal. Las acciones reales requieren confirmación; la simulación se abre por separado.

## Resultados de esta revisión

| Comprobación | Resultado |
| --- | --- |
| Sintaxis y política de código | 70 archivos JavaScript comprobados. Rechazo de comandos codificados, exclusiones de Defender y patrones conocidos de desactivación de AMSI. |
| Pruebas automatizadas | 146 correctas, sin fallos ni omisiones. |
| Integración nativa de Windows | Dos escenarios correctos sobre claves HKCU temporales exclusivas de la prueba; retiradas al terminar. |
| Dependencias | npm audit del 29 de octubre: cero vulnerabilidades conocidas reportadas. No acredita todo riesgo de la cadena de suministro. |
| Arranque normal empaquetado | Correcto con backend real y mutaciones bloqueadas durante la verificación: 14 secciones, 50 ajustes gratuitos, cinco juegos y 29 ajustes. |
| Asistente de rendimiento | Tres recomendaciones gaming y cuatro creativas en este equipo, datos locales visibles, pasos accesibles y controles recuperados al terminar. No se midieron FPS. |
| Confirmación y recuperación | Confirmación cancelada, historial intacto y cero mutaciones invocadas. |
| Portable v1.0.1 | Recorrido en simulación correcto, nueve acciones interceptadas, ningún error de renderer registrado. |
| Aislamiento | Sandbox y contextIsolation activos; Node deshabilitado en el renderer. |
| Contenido del paquete | 52 archivos de fuentes, interfaz, recursos y licencias coinciden con el ASAR final. |
| Integridad | Los dos ejecutables completos coinciden con SHA256SUMS.txt y release-manifest.json. |
| Firma digital | Ambos ejecutables: NotSigned. |
| Bitdefender | Alerta de comportamiento investigada; sin veredicto documentado sobre los binarios nuevos ni falso positivo confirmado. |

Las pruebas nuevas comprueban transporte PowerShell legible y datos separados, Unicode, scripts mayores de 32 KiB, errores, timeouts, restauración de Game Bar actual e histórica, destinos de enlaces fijos y resultados parciales del asistente. La prueba HOSTS utiliza archivos sintéticos en scratch y sustituye ipconfig por una función local; no cambia HOSTS ni DNS reales.

La integración nativa verifica el motor activo con valores ausentes, DWord, QWord, String, ExpandString, MultiString y Binary, persistencia entre instancias, propiedades vecinas, conflictos externos y un error nativo. Solo modifica su clave temporal GUID. No aplica preferencias reales, servicios, dispositivos, BCD, energía, limpiezas ni perfiles de juegos al equipo.

El recorrido se realizó también con carga y ventanas en segundo plano. El inventario de cachés de herramientas avanzadas agotó su timeout en ese entorno; ese aviso figura en stderr y no representa una limpieza ejecutada. No debe interpretarse un inventario no disponible como espacio ocupado igual a cero. Las capturas pueden quedar atrasadas cuando Windows suspende el renderizado de ventanas cubiertas; el recorrido visual adicional mantiene activo el renderizado solo durante la prueba.

## Evidencia

- `dist/release-manifest.json`, `dist/SHA256SUMS.txt`, `dist/signatures.json`.
- `scratch/v1.0.1-packaged-startup-report.json`: arranque normal y asistente, sin mutaciones.
- `scratch/v1.0.1-portable-smoke-report.json`: portable en simulación.
- `scratch/v1.0.1-visual-startup-report.json`: recorrido adicional con renderizado activo en segundo plano; capturas verificadas en `docs/images/performance-gaming.png` y `docs/images/performance-design.png`.
- `scratch/v1.0.1-startup.stderr.log`: aviso del inventario de cachés durante carga.
- [Revisión de antivirus](ANTIVIRUS.md) y [fuentes de rendimiento](PERFORMANCE.md).

Scratch permanece excluido del repositorio. No publiques inventarios privados, perfiles del usuario ni datos de cuarentena.

## Alcance y pendientes

La instalación y desinstalación local por usuario se validaron para **v1.0.0**; el informe histórico se conserva en [VALIDATION-1.0.0.md](VALIDATION-1.0.0.md). No se anuncia un nuevo ciclo de instalación de v1.0.1 por haber generado su Setup.

Siguen pendientes la firma del editor, el veredicto de Bitdefender sobre el archivo exacto y una matriz en Windows desechable con protección activa, reinicio y hardware representativo. Las pruebas locales no certifican todas las herramientas reales ni Windows 10/11 en todos los equipos. No se publicaron archivos en GitHub ni se enviaron muestras al antivirus.
