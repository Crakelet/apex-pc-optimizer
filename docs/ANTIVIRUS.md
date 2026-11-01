# Revisión de la alerta de Bitdefender

Actualizado: 1 de noviembre de 2026. Estado: investigación abierta, sin veredicto del proveedor ni falso positivo confirmado.

El reporte recibido durante el desarrollo mencionó los avisos «Infected item detected» y «Malicious behavior blocked», asociados con la carpeta de datos de Apex. No se ha confirmado el ejecutable, módulo, amenaza, versión ni momento exacto de aquel evento. Una carpeta de datos no identifica por sí sola el proceso bloqueado.

## Lo revisado y corregido

- El código activo no incluye órdenes para desactivar antivirus, añadir exclusiones o saltar AMSI. El arranque no aplica optimizaciones automáticamente.
- PowerShell utiliza un arranque legible y scripts por entrada estándar, con validación de datos y sin comandos codificados ni bypass de políticas en la aplicación distribuida.
- Game Bar utiliza preferencias de grabación; las acciones nuevas no redirigen ejecutables mediante IFEO. La restauración de respaldos históricos conserva un alcance limitado.
- La lista HOSTS opcional protege servicios compartidos con Windows Update, Defender y certificados.
- El programa conserva capacidades sensibles de registro, servicios, red, prioridades, memoria y cachés. Su presencia requiere analizar el comportamiento concreto; no demuestra por sí sola infección ni legitimidad.
- La consulta inicial de metadatos de cuarentena no encontró registros de Apex. No descarta bloqueos de comportamiento y no se extrajo ni restauró ninguna muestra.

Bitdefender describe su análisis de comportamiento en [Advanced Threat Defense](https://www.bitdefender.com/consumer/support/answer/2024/). El texto del aviso no basta para atribuirlo con certeza a ese módulo.

## Distribución actual

La v1.0.4 se prepara desde el historial público limpio. El resultado efectivo está en [Actions](https://github.com/Crakelet/apex-pc-optimizer/actions/workflows/release.yml). Cada build debe aportar su propio manifiesto, SHA-256 y estado Authenticode; no se reutilizan huellas de versiones anteriores ni se confunde procedencia de GitHub con una firma de editor.

Los ejecutables se conservan en borrador para revisión. No se atribuyen a la alerta histórica ni se presentan como aceptados por Bitdefender. Las compilaciones y evidencias previas se conservan localmente; sus referencias públicas se retiraron al limpiar capturas del historial.

## Revisión con el proveedor

El [informe técnico](BITDEFENDER_SUBMISSION.md) está preparado para solicitar análisis, sin afirmar un falso positivo. No hay un envío confirmado ni número de caso. No desactives protecciones, añadas exclusiones generales o restaures cuarentena para forzar una prueba.

El [soporte oficial](https://www.bitdefender.com/consumer/support/help/) debe indicar un canal apropiado para muestras de más de 100 MB. El contacto privado, las notificaciones originales y los logs del usuario no se incluyen en GitHub. Cualquier registro o binario adicional se revisará antes de compartirlo.
