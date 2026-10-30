# Apex PC Optimizer

Versión 1.0.3 para evaluación: primera publicación de fuentes MIT, políticas de privacidad y firma incluidas en el paquete, compilación en GitHub con hashes y procedencia. Dos descripciones de juegos dejan de prometer cifras de FPS sin medición.

La suite recupera el diseño glassmorphism original, sus 14 secciones y todas las herramientas gratuitas. No hay checkout, activación Pro ni una selección de funciones comerciales decidida.

## Incluye

- Corrección de ajustes de juegos: selector de perfil de VALORANT, cierre previo para editar archivos y mensajes con el motivo real del fallo.
- Comprobación de solo lectura y acceso antes de escribir, sin quitar atributos; restauración compatible con respaldos históricos.

- Asistente gratuito de rendimiento en Gaming y Diseño: datos locales de pantalla, RAM, GPU/controlador y espacio, más pasos específicos para Photoshop, Premiere y Blender con fuentes oficiales.
- PowerShell legible y Game Bar sin redirección IFEO en acciones nuevas; restauración compatible con respaldos históricos.
- Lista HOSTS revisada para conservar servidores compartidos con actualizaciones, Defender y certificados.

- Catálogo general de 50 ajustes, cinco juegos con 29 ajustes específicos y siete opciones Snappy UI.
- Dashboard, diagnóstico de memoria y hardware, red/DNS, inicio, servicios, privacidad, diseño y limpieza.
- Confirmaciones claras antes de las acciones reales, con detalles técnicos secundarios.
- Estado de las acciones manuales, actividad reciente con resultados e interrupciones y resumen de respaldos en Seguridad y Backup.
- Respaldos originales para cambios generales, auditoría, Snappy, diseño, USB, juegos, DNS y preferencias GPU cubiertos por sus motores.
- Restauración propia de energía, TCP y MSI en el panel Apex y de la preferencia GPU de cada aplicación.
- Perfiles de juego restaurados desde sus respaldos propios en el orden inverso de aplicación; los conflictos externos detienen la restauración.
- Cierre normal que detiene la limpieza automática de RAM y recupera las prioridades guardadas de Ascensión, preservando los conflictos externos.
- Comprobación de un punto nuevo antes de confirmar su creación y mensajes legibles de errores de Windows/PowerShell.
- Arranque normal con herramientas reales en Portable, Setup, `run.bat` y `npm start`; confirmación previa de cada acción.
- Modo de pruebas independiente desde `run-tests.bat`, `run.bat --test-mode` o `npm run start:test`.
- Actualizaciones manuales mediante publicaciones oficiales de GitHub.

## Descargas

Elige Setup para instalar o Portable para ejecutar sin instalación. Ambos son x64 y arrancan en modo normal. Conserva los respaldos del perfil de usuario si necesitas deshacer cambios. Comprueba `SHA256SUMS.txt`, `signatures.json` y `release-manifest.json`.

## Límites de restauración y medición

Las limpiezas pueden ser irreversibles. Excluyen recuperación, autoguardados, proyectos y medios originales, pero los archivos eliminados no se recuperan con «Revertir todo». Las acciones avanzadas sin restauración propia tampoco se anuncian como reversibles automáticamente.

No se prometen porcentajes de FPS, latencia cero ni compatibilidad con todo hardware. Temperatura CPU no disponible cuando no hay una fuente compatible; los estados de hardware no confirmados se identifican. La puntuación del PC es un checklist, no un benchmark.

La lógica de confirmación de un punto de restauración nuevo se prueba con respuestas simuladas; esto no implica que se haya creado un punto real sobre el equipo de desarrollo. Consulta el alcance de las comprobaciones en la [validación de esta versión](https://github.com/Crakelet/apex-pc-optimizer/blob/v1.0.3/docs/VALIDATION.md).

La alerta de Bitdefender comunicada durante el desarrollo sigue pendiente de identificación y análisis del proveedor. No se anuncia un falso positivo confirmado ni un build aceptado por ese antivirus. Consulta [la revisión y sus límites](https://github.com/Crakelet/apex-pc-optimizer/blob/v1.0.3/docs/ANTIVIRUS.md). No desactives protecciones ni añadas exclusiones generales para probarlo.

## Antes de publicar este borrador

- Registrar las versiones de Windows, hardware y escenarios realmente probados.
- Confirmar el arranque y la ausencia de modificaciones en simulación.
- Verificar instalación/desinstalación, persistencia y alcance de los respaldos.
- Indicar expresamente si los ejecutables tienen una firma Authenticode válida; no anunciar como firmado un build sin certificado.
- Revisar los cambios y límites de CHANGELOG.md y README.md.

## Licencia

MIT permite uso comercial, modificaciones y redistribución conservando copyright y licencia. No exige créditos visibles en la interfaz de los forks. Software distribuido sin garantía; los componentes de terceros conservan sus licencias.
