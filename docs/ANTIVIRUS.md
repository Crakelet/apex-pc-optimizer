# Revisión de la alerta de Bitdefender

Actualizado: 30 de octubre de 2026, America/Santiago. Estado: **investigación abierta, sin veredicto del proveedor ni falso positivo confirmado**.

El 29 de octubre el usuario informó de los avisos «Infected item detected» y «Malicious behavior blocked», asociados con `%APPDATA%\ApexPCOptimizer\`. Esa es una carpeta de datos de la aplicación; no identifica por sí sola el ejecutable, proceso u operación bloqueados. La versión exacta del archivo que provocó el aviso sigue sin confirmar.

Bitdefender explica que Advanced Threat Defense evalúa el comportamiento de procesos, además de las detecciones de archivos. La frase recibida orienta la investigación, pero no basta para atribuirla a un módulo concreto. [Descripción oficial](https://www.bitdefender.com/consumer/support/answer/2024/).

## Lo comprobado

- Bitdefender está registrado en Windows. La consulta de solo lectura a Defender no aportó alertas relacionadas con Apex.
- La consulta de solo lectura de metadatos de cuarentena del 30 de octubre no devolvió entradas relacionadas con Apex. Esto no descarta un bloqueo de comportamiento, un evento en otro registro ni una detección anterior. No se extrajo ni restauró la cuarentena.
- Los dos ejecutables v1.0.0 seguían presentes al revisar. `run.bat` faltaba en el árbol de trabajo; no se pudo atribuir su ausencia a Bitdefender con los datos disponibles.
- La revisión inicial de la carpeta indicada encontró nombres habituales de cachés y bases de datos de Electron/Chromium, sin ejecutables o scripts entre los archivos inventariados. No se leyó su contenido privado. Ese inventario histórico no acredita qué pudo retirar el antivirus ni el contenido actual de otros perfiles.
- La revisión del código activo no encontró órdenes para desactivar antivirus, añadir exclusiones o saltar AMSI. Las actualizaciones consultan metadatos de GitHub; no descargan ni ejecutan actualizaciones automáticamente.
- Las herramientas utilizan PowerShell y algunas funciones nativas para registro, memoria, servicios y red. Son capacidades sensibles que también pueden activar análisis de comportamiento. Su presencia no permite clasificar una alerta por sí sola.
- La distribución anterior carecía de firma Authenticode. La firma identifica al editor y protege integridad; no acredita por sí sola ausencia de malware.

## Cambios de v1.0.1

- PowerShell utiliza un comando de arranque legible y scripts UTF-8 por entrada estándar. Se eliminó `-EncodedCommand`; los datos siguen separados del código. El análisis de seguridad de Windows y las políticas se conservan.
- La herramienta Game Bar conserva su acceso gratuito y pasa a preferencias de grabación. Las nuevas aplicaciones no redirigen ejecutables mediante IFEO ni terminan GameBarPresenceWriter. La restauración admite únicamente los destinos exactos de los respaldos históricos.
- HOSTS excluye servidores compartidos con Windows Update, Defender o certificados. Una validación impide añadir esos servicios a la lista. Actualizar el bloque antiguo requiere pulsar Aplicar y confirmar; no se modificó el HOSTS real durante esta revisión.
- El iniciador BAT se escribió con arranque normal, sin elevación automática, cierre global de procesos ni desactivación del sandbox.
- El verificador de código rechaza comandos codificados, cambios de exclusiones de Defender y patrones conocidos de desactivación de AMSI.

En v1.0.2 también se exige cerrar el juego antes de modificar o restaurar archivos de configuración y se permite elegir un perfil concreto de VALORANT. Las opciones ausentes y los errores de acceso se explican; no se quitan atributos de solo lectura ni se altera el anticheat.

Estos cambios corrigen prácticas concretas. No se ha ejecutado un análisis de Bitdefender con veredicto documentado sobre los ejecutables v1.0.2. Las pruebas funcionales y las verificaciones de integridad no sustituyen ese análisis. El detalle técnico listo para revisión está en [BITDEFENDER_SUBMISSION.md](BITDEFENDER_SUBMISSION.md).

## Archivos de la compilación local v1.0.2

Huellas contrastadas de nuevo el 30 de octubre contra `dist/release-manifest.json` y `dist/SHA256SUMS.txt`. Ambos ejecutables tienen el estado Authenticode registrado **NotSigned**.

| Archivo | Bytes | SHA-256 |
| --- | ---: | --- |
| `Apex-PC-Optimizer-v1.0.2-Portable-x64.exe` | 110990102 | `b42a5806846567a119d7cd39f751ee334d7d052f6824275f393a9a172acb76a0` |
| `Apex-PC-Optimizer-v1.0.2-Setup-x64.exe` | 121964420 | `e5d83354c63d85579d0a313b8adfaf459a37f92e1c296012b1c3806f8f600269` |

Estos son candidatos para una comprobación nueva; no se afirma que esos hashes fueran los objetos de la alerta histórica. Una compilación posterior en GitHub debe publicar sus propios hashes y resultados, aunque conserve el número de versión.

## Cómo completar el diagnóstico

En Bitdefender, abre **Notificaciones** y conserva el aviso asociado: fecha, módulo, nombre exacto de amenaza, ruta y acción. Distingue un bloqueo de Advanced Threat Defense de una detección de archivo; los pasos de revisión dependen de esa diferencia. Comprueba qué versión y SHA-256 corresponden al archivo.

Se necesitan la fecha y hora del evento, producto y versión de Bitdefender, módulo, nombre exacto de amenaza, ruta del proceso o archivo, acción tomada y paso que provocó el aviso. Conserva las rutas completas y capturas sin editar para el soporte privado; en GitHub redacta nombres de usuario, identificadores de cuentas y otros datos personales.

Analiza el archivo exacto con la protección activa en un Windows desechable. Si se bloquea, conserva el aviso y detén esa comprobación; no fuerces su ejecución. El paquete local de revisión excluye perfiles del usuario, cachés, cuarentena, certificados y registros privados. Ninguna muestra se ha enviado al proveedor.

El formulario de revisión de detecciones de Bitdefender y su [canal de soporte al consumidor](https://www.bitdefender.com/consumer/support/help/) permiten iniciar la revisión. En esta investigación el acceso automatizado al artículo 29358 devolvió HTTP 403; eso no demuestra que el formulario esté cerrado para un navegador normal. Para un bloqueo de comportamiento, pide al soporte que identifique el módulo y el procedimiento apropiado antes de aportar registros del sistema.

Los ejecutables superan los 25 MB. La [documentación empresarial](https://www.bitdefender.com/business/support/en/77211-343057-submitting-sample-files-and-websites-for-analysis.html) indica contactar con su soporte si el archivo comprimido sigue superando ese tamaño; ese límite no se ha confirmado para el formulario de consumo. Solicita un canal de muestras grandes o utiliza una URL oficial del archivo exacto si el soporte la acepta. No dividas archivos ni cambies protecciones para eludir una restricción.

Antes de anunciar una versión final validada, siguen pendientes la firma y la comprobación de los ejecutables en un Windows desechable con protección activa. El repositorio puede documentar este estado y recibir revisiones; publicar código o acumular descargas no confirma que una detección sea incorrecta. No anuncies «sin virus», aceptación por Bitdefender ni aprobación de SignPath sin evidencia verificable.

Fuentes oficiales:

- [Bitdefender: Advanced Threat Defense y consulta de detecciones](https://www.bitdefender.com/consumer/support/answer/2024/).
- [Bitdefender: envío para revisión de un posible falso positivo](https://www.bitdefender.com/consumer/support/answer/29358/).
- [Microsoft: conectividad de Defender](https://learn.microsoft.com/en-us/defender-endpoint/configure-network-connections-microsoft-defender-antivirus).
- [Microsoft: diagnóstico de Windows Update y sus servidores](https://learn.microsoft.com/en-us/troubleshoot/windows-client/installing-updates-features-roles/windows-update-issues-troubleshooting).
