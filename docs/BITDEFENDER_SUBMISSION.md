# Paquete de revisión para Bitdefender

Preparado el 30 de octubre de 2026, America/Santiago. Estado: **borrador técnico; no enviado**. No hay número de caso ni veredicto del proveedor. Este documento puede publicarse porque no contiene perfiles, rutas personales, contactos privados ni capturas del sistema.

## Solicitud

Solicitamos identificar y analizar una posible detección de comportamiento relacionada con Apex PC Optimizer. No afirmamos que sea un falso positivo confirmado. Bitdefender puede valorar también si alguna capacidad corresponde a una clasificación de aplicación potencialmente no deseada y señalar la operación que debe corregirse.

El reporte original del usuario, recibido el 29 de octubre, mencionó `%APPDATA%\ApexPCOptimizer\` y los textos «Infected item detected» y «Malicious behavior blocked». Falta identificar el archivo, proceso, módulo y versión exactos de aquel evento. Las compilaciones locales v1.0.2 siguientes se prepararon después: sus hashes no se atribuyen al aviso original.

## Candidatos exactos para volver a comprobar

| Archivo | Tamaño en bytes | SHA-256 | Authenticode registrado |
| --- | ---: | --- | --- |
| `Apex-PC-Optimizer-v1.0.2-Portable-x64.exe` | 110990102 | `b42a5806846567a119d7cd39f751ee334d7d052f6824275f393a9a172acb76a0` | NotSigned |
| `Apex-PC-Optimizer-v1.0.2-Setup-x64.exe` | 121964420 | `e5d83354c63d85579d0a313b8adfaf459a37f92e1c296012b1c3806f8f600269` | NotSigned |

Las huellas y tamaños se recalcularon el 30 de octubre y coinciden con el manifiesto local. El verificador registró 53 archivos de código, recursos y licencias coincidentes entre fuentes y ASAR. Esto verifica contenido e integridad; no es un análisis de malware.

El destino configurado es `Crakelet/apex-pc-optimizer`. Antes de enviar, añade el enlace público comprobado, commit de fuentes, tag y URL del artefacto exacto. La compilación local procede de un árbol de trabajo de desarrollo; no debe atribuirse a un commit o a una compilación de GitHub sin comprobarlo. Los futuros artefactos de CI tendrán su propio manifiesto.

## Comportamiento que el proveedor puede revisar

- Aplicación Electron para Windows x64, con interfaz local, sandbox y aislamiento del renderer. El arranque normal no aplica un perfil de optimización.
- Consultas locales de hardware, memoria, procesos y preferencias mediante API de Node, CIM, Windows PowerShell y herramientas del sistema disponibles. Los scripts son internos; los datos de la interfaz viajan por JSON con validación de parámetros.
- Cambios de registro, servicios, energía, red, preferencias GPU, prioridades y archivos de juegos únicamente a través de herramientas conocidas y confirmadas en la interfaz. Algunas requieren permisos de administrador; la app no se eleva automáticamente al abrirse.
- Herramientas de memoria con llamadas a API nativas de Windows y limpiezas de caché. Son capacidades sensibles que deben evaluarse; no son prueba por sí solas de infección ni de legitimidad.
- Registro local de actividad y respaldos. Las nuevas escrituras de archivos de juegos exigen cerrar el juego y escoger el perfil cuando existen varios; se conservan atributos y conflictos externos.
- Actualización manual: consulta de metadatos de releases oficiales de GitHub cuando se solicita, sin descarga ni ejecución automática del nuevo binario. Las pruebas de red y las guías externas se abren por decisión del usuario.

La revisión del código actual no encontró órdenes para añadir exclusiones del antivirus, desactivarlo o saltar AMSI. Se retiraron el transporte PowerShell codificado y la redirección IFEO de Game Bar. Se corrigió la lista opcional HOSTS para no bloquear servidores compartidos con actualizaciones, Defender o certificados. Estos cambios no se presentan como una forma de eludir el análisis del antivirus.

## Prueba controlada propuesta

No es una reproducción confirmada de la alerta original. Sirve para identificar si el fallo aparece al descargar, analizar, extraer, abrir o consultar la aplicación.

1. Usa un Windows desechable con Bitdefender y su protección activos. Registra las versiones de Windows, producto, motor y firmas.
2. Comprueba el SHA-256 del archivo exacto. Analízalo manualmente con Bitdefender y conserva el resultado.
3. Si no se bloquea, el mantenedor o laboratorio puede ejecutar el Portable con `--verify-release-startup`. Este recorrido usa el backend normal pero bloquea las mutaciones, cancela la confirmación y se cierra al terminar. Consulta datos locales; no debe utilizarse para aplicar optimizaciones reales sobre el equipo de trabajo.
4. Si aparece un bloqueo, registra su hora, módulo, nombre de amenaza, proceso, acción y último paso visible. Detén la prueba. No restaures cuarentena ni añadas excepciones para continuar.
5. Conserva el informe generado en `%TEMP%\ApexPCOptimizer-release-check\release-startup-report.json`. Revisa sus datos y cualquier log antes de compartirlos; no adjuntes el perfil completo de la aplicación.

La prueba de simulación `--smoke-test` es distinta: intercepta las herramientas de modificación. Un resultado correcto de cualquiera de los recorridos no demuestra que Bitdefender apruebe todas las acciones reales. Una reproducción con herramientas sensibles debe acordarse con el laboratorio y hacerse solo en un entorno desechable.

## Datos aún necesarios del aviso

| Campo | Estado |
| --- | --- |
| Fecha/hora y zona del evento, no de la conversación | Pendiente |
| Producto, versión, motor y firmas de Bitdefender | Pendiente |
| Módulo que detectó el comportamiento | Pendiente |
| Nombre exacto de amenaza o identificador del evento | Pendiente |
| Archivo/proceso exacto y su SHA-256 | Pendiente |
| Versión de Apex que estaba abierta | Pendiente |
| Último paso ejecutado y acción tomada por Bitdefender | Pendiente |
| Captura o exportación del aviso | Pendiente; conservar original para soporte privado |
| Número de caso y respuesta del laboratorio | Todavía no existen |

## Texto listo para el contacto privado

Completa los datos pendientes en el formulario oficial, directamente con Bitdefender. No publiques la dirección de contacto o documentos privados en GitHub.

> Subject: Request for analysis of a possible behavioral detection related to Apex PC Optimizer
>
> I maintain Apex PC Optimizer, a Windows x64 Electron application for local diagnostics and explicitly confirmed Windows/game preferences. A user reported the messages “Infected item detected” and “Malicious behavior blocked” associated with the application data folder. We have not established the exact process, module, threat identifier or binary version behind that historical event and do not claim a confirmed false positive.
>
> We have prepared v1.0.2 candidates with the exact hashes listed in the attached artifact manifest. These binaries are unsigned. We reviewed the source, removed encoded PowerShell transport and the Game Bar executable redirection, retained Windows security scanning, and corrected HOSTS entries shared with update/security infrastructure. The application has sensitive but user-confirmed capabilities, including registry/service/network preferences and native memory operations; please identify the specific behavior and whether it represents malware, a potentially unwanted application, or an incorrect detection.
>
> We can provide the public source revision and a read-only startup procedure that blocks Windows mutations. The historical alert details are being collected separately. Both complete application packages exceed 100 MB; please advise the appropriate secure channel for a large sample or whether an exact official download URL is accepted. We have not disabled protection, restored quarantine or added exclusions to force reproduction. We will supply the precise notification and any requested logs privately after review.

## Envío y tamaño

El [formulario oficial para revisar detecciones](https://www.bitdefender.com/consumer/support/answer/29358/) y el [soporte al consumidor](https://www.bitdefender.com/consumer/support/help/) son los puntos de entrada. Durante esta preparación el primer artículo devolvió HTTP 403 al acceso automatizado; el canal de soporte sí fue accesible. No se comprobó el límite del formulario de consumo.

La [guía empresarial de muestras](https://www.bitdefender.com/business/support/en/77211-343057-submitting-sample-files-and-websites-for-analysis.html) menciona 25 MB y un contacto de soporte para muestras comprimidas mayores. Esa cifra no se atribuye al servicio de consumo. Pide instrucciones para el archivo completo; no dividas, cambies la extensión o alteres la protección para sortear un límite.

El paquete local `scratch/bitdefender-review/` contiene solo el mensaje, manifiesto, estado de investigación y documentos sanitizados. No incorpora ejecutables ni datos del usuario. Prepararlo no transmite información; enviar el formulario o adjuntar archivos sí la transmite al proveedor y requiere una decisión expresa del mantenedor.
