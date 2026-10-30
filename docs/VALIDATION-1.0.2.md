# Validación local de v1.0.2

Fecha: 30 de octubre de 2026, America/Santiago. Windows x64 compilación 26300; Node.js 24.15.0, Electron 45.0.0 y electron-builder 26.18.0.

Esta revisión corrige el fallo al modificar ajustes de juego y el alcance de los perfiles de VALORANT. Conserva las 14 secciones, las herramientas gratuitas, el modo normal y la confirmación previa. No aplica optimizaciones automáticamente al iniciar.

## Causas comprobadas

El historial de la aplicación conservaba motivos que la interfaz ocultaba: preferencias ausentes en algunos archivos y un error de acceso al reemplazar otro. La búsqueda anterior incluía varias configuraciones de VALORANT a la vez, entre ellas archivos antiguos y de solo lectura. No se atribuye el fallo original únicamente a que el juego estuviera abierto: antes no existía esa comprobación.

La nueva versión exige cerrar el juego antes de editar o restaurar archivos, permite escoger un perfil concreto de VALORANT y comunica la causa del fallo. No añade claves desconocidas, termina procesos, cambia anticheat ni retira atributos de solo lectura. Los ajustes de registro conservan sus requisitos propios, incluida la detección de ejecutables cuando corresponde.

## Resultados

| Comprobación | Resultado |
| --- | --- |
| Sintaxis y política de código | 73 archivos JavaScript comprobados. |
| Pruebas automatizadas | 165 correctas, sin fallos ni omisiones. |
| Selección de perfiles | Identificadores opacos estables, selección obligatoria con varios archivos, rechazo de identificadores desconocidos y escritura limitada al perfil elegido. |
| Juego abierto o consulta fallida | Aplicación y restauración de archivos bloqueadas antes de guardar historial o cambios; pruebas con procesos simulados. |
| Consulta nativa de procesos | Consulta de nombres de VALORANT correcta, de solo lectura. No se terminaron procesos ni se abrió el juego. |
| Archivos protegidos | Pruebas con archivos sintéticos de solo lectura y errores de acceso; atributos e historial conservados. |
| Respaldos históricos | Restauración de registros de varios archivos y comprobación previa de los destinos antes de la primera escritura; no se anuncia como una transacción indivisible. |
| Mensajes y controles | El fallo específico llega a la interfaz, se retira el progreso, se recupera el control y se actualiza la propiedad del respaldo para restaurar desde el mismo ajuste. |
| Arranque desde fuentes | Correcto con backend normal y mutaciones bloqueadas: selector, elección y consulta por perfil, 14 secciones, 50 ajustes y cinco juegos con 29 ajustes. |
| Arranque empaquetado | Correcto en v1.0.2: selección explícita de perfil y consulta por identificador comprobadas, historial intacto y cero mutaciones invocadas. |
| Portable v1.0.2 | Recorrido correcto en simulación, nueve acciones interceptadas, ningún error de renderer registrado y sandbox activo. |
| Revisión visual | Capturas de escritorio y ventana compacta; ajuste del encabezado y barra de desplazamiento del selector de juegos. |
| Distribución | 53 archivos coinciden con las fuentes finales; ambos ejecutables completos coinciden con sus SHA-256 registrados. |
| Antivirus y firma | Ambos ejecutables: NotSigned. No hay un veredicto nuevo de Bitdefender; las comprobaciones funcionales no confirman un falso positivo. |

Las pruebas de escritura de juegos solo utilizan configuraciones sintéticas dentro de scratch. La revisión del perfil real del usuario fue de solo lectura; no se aplicaron ni restauraron ajustes a VALORANT. Los respaldos y atributos reales se conservaron.

La comprobación previa de acceso no acredita todos los permisos específicos de reemplazo ni evita cambios externos posteriores. Si Windows rechaza guardar, el respaldo se conserva y el error se comunica. La selección dura esta sesión, no identifica una cuenta de Riot y no cambia archivos por sí misma.

## Evidencia

- `dist/release-manifest.json`, `dist/SHA256SUMS.txt` y `dist/signatures.json`: fuentes, versión e integridad de la distribución.
- `scratch/release-startup-report.json`: comprobación desde fuentes de v1.0.2.
- `scratch/v1.0.2-packaged-startup-report.json`: comprobación empaquetada correcta.
- `scratch/v1.0.2-portable-smoke-report.json`: recorrido correcto del Portable en simulación.
- `scratch/v1.0.2-release-games.png` y `scratch/v1.0.2-release-games-compact.png`: capturas empaquetadas.
- `docs/images/game-profiles.png` y `docs/images/game-profiles-compact.png`: capturas revisadas del selector en el diseño glass.

Scratch está excluido del repositorio. No publiques inventarios privados, perfiles reales ni respaldos del usuario.

## Comprobaciones anteriores y pendientes

Los dos escenarios nativos completos de restauración del motor se verificaron en v1.0.1; no se repitió esa matriz de registro para este cambio de perfiles. La instalación y desinstalación local por usuario se validaron en v1.0.0. Los informes históricos se conservan en [v1.0.1](VALIDATION-1.0.1.md) y [v1.0.0](VALIDATION-1.0.0.md).

Siguen pendientes la firma del editor, el veredicto de Bitdefender sobre cada archivo exacto y la matriz en Windows desechable con protección activa y hardware representativo. La validación local no certifica todas las herramientas ni garantiza una mejora de FPS. No se publicaron archivos en GitHub ni se enviaron muestras al antivirus.
