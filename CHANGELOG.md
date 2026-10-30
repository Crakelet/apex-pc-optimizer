# Registro de cambios

## 1.0.3 — Primera publicación de fuentes y procedencia

- Publica las fuentes MIT, las pruebas y los límites de validación sin incluir perfiles, respaldos ni datos locales.
- Añade políticas de privacidad y firma al paquete y verifica que coincidan con las fuentes.
- Prepara compilaciones de Windows en GitHub Actions, hashes, estado Authenticode y atestaciones de procedencia; los ejecutables se conservan en borrador para revisión.
- Activa reportes privados de vulnerabilidades y propone actualizaciones mensuales de dependencias.
- Retira dos promesas de FPS sin medición del catálogo de juegos. No cambia los ajustes aplicados ni el diseño.
- Documenta la investigación pendiente de Bitdefender y los requisitos de una futura solicitud a SignPath Foundation; no implica aprobación de ninguno.

## 1.0.2 — Archivos y perfiles de juegos

- Corrige el mensaje genérico que ocultaba la causa del fallo al cambiar un ajuste individual del juego.
- Exige cerrar el juego para aplicar o restaurar archivos; no termina procesos ni altera anticheat.
- VALORANT permite elegir un perfil concreto cuando hay varias configuraciones, sin cambiar los otros perfiles.
- Identifica archivos de solo lectura y comprueba el acceso antes de preparar escrituras; conserva atributos y respaldos históricos.
- Las opciones ausentes se explican sin insertar claves supuestas. Los errores de acceso muestran pasos útiles sin rutas personales.
- Actualiza el estado y la propiedad del respaldo tras cada acción, y retira el aviso de progreso al terminar.

## 1.0.1 — Revisión de antivirus y asistente de rendimiento

- Sustituye el transporte PowerShell codificado por un arranque legible, sin saltar análisis de seguridad ni políticas.
- Game Bar usa preferencias de grabación, conservando la restauración exacta de respaldos anteriores.
- HOSTS protege destinos compartidos con actualizaciones, Defender y certificados.
- Añade un asistente gratuito de solo lectura en Gaming y Diseño: pantalla, memoria, GPU/controlador, espacio y guías oficiales de Photoshop, Premiere y Blender.
- Corrige expectativas de RAM, cachés y DNS. No promete mejoras de FPS sin medir.
- La alerta de Bitdefender sigue pendiente de identificar y verificar; consulta [la revisión](docs/ANTIVIRUS.md).

## 1.0.0 — Primera versión

- Restituidos el diseño original glassmorphism, sus paneles, su navegación lateral y las 14 secciones de la suite.
- Recuperadas todas las herramientas originales como gratuitas y disponibles; sin activación de pago ni una selección comercial decidida.
- Conservado el catálogo general de 50 ajustes, los cinco juegos con 29 ajustes específicos y las siete opciones Snappy UI.
- Confirmaciones con explicaciones del efecto y las consecuencias; los valores técnicos no dominan el recorrido principal.
- Estado visible de las operaciones manuales y actividad reciente con resultados e interrupciones; resumen de respaldos en Seguridad y Backup.
- Respaldos originales para los cambios generales, auditoría, Snappy, diseño, USB, juegos, DNS y preferencias GPU cubiertos por sus motores; sin reversión a valores de fábrica supuestos.
- Restauración propia de los ajustes Apex de energía, TCP y MSI, y de la preferencia GPU de cada aplicación.
- Restauración de perfiles de juego limitada a los respaldos propios y en el orden inverso real de aplicación, con detención ante conflictos externos.
- Cierre normal que detiene la limpieza automática de RAM, espera tareas pendientes y restaura prioridades de Ascensión sin sobrescribir cambios ajenos.
- Creación de puntos de restauración confirmada mediante un nuevo registro de Windows; no se anuncia éxito si el sistema no confirma el punto solicitado.
- Limpiezas conservadoras que excluyen autoguardados, recuperación, proyectos y medios originales, con conteos tras borrado confirmado.
- Reversión documentada según el alcance: las limpiezas y acciones avanzadas sin restauración propia no se anuncian como recuperables por «Revertir todo».
- Estado de hardware desconocido explícito; sin temperatura CPU calculada, memoria liberada inventada ni promesas universales de FPS o latencia.
- Correcciones en origen de programas de inicio, ejecución PowerShell, parámetros IPC y comunicación de fallos; mensajes legibles de permisos, espera y respuestas inválidas de Windows.
- Sandbox y aislamiento de Electron, recursos locales y confirmación previa de acciones reales.
- Arranque normal con herramientas reales desde Portable, Setup, `run.bat` y `npm start`; abrir la app no aplica ajustes automáticamente.
- Modo de pruebas separado en `run-tests.bat`, `run.bat --test-mode` y `npm run start:test`, con datos y acciones simuladas independientes.
- Comprobación manual de actualizaciones en GitHub Releases, sin descarga o ejecución automática.
- Portable e instalador x64 con verificación del contenido final, versión, hashes SHA-256 y estado Authenticode; workflow que prepara publicaciones en borrador.
- Licencia MIT estándar y explicación de sus permisos, contribuciones y componentes externos.

Esta entrada describe la v1.0.0 de la aplicación. La publicación en GitHub y la firma digital son pasos separados. Consulta las notas de release para conocer los escenarios realmente probados.
