# Code signing policy

Última revisión: 1 de noviembre de 2026.

## Estado actual

Apex PC Optimizer no tiene un certificado Authenticode configurado; los builds de evaluación se registran como **sin firma** hasta que un manifiesto y una comprobación de Windows acrediten lo contrario. El proyecto no dispone de un certificado de SignPath Foundation, no afirma haber sido admitido y no presenta una solicitud como enviada. Preparar esta política no concede una firma ni acredita que un antivirus haya aceptado los archivos.

El estado de cada distribución debe constar en sus notas, `signatures.json` y `release-manifest.json`. La investigación comunicada de Bitdefender sigue documentada en [ANTIVIRUS.md](docs/ANTIVIRUS.md). No se describirá una alerta como falso positivo confirmado sin un resultado verificable del proveedor.

## Alcance propuesto

La futura firma cubrirá únicamente archivos propios de Apex construidos desde el código de este repositorio y una revisión concreta: el ejecutable de la aplicación y los componentes propios de sus paquetes Portable, Setup y desinstalación, según la configuración que apruebe el servicio elegido. Nombre de producto y versión deben coincidir con las fuentes y ser comprobados durante la release.

Electron, Chromium y otros componentes de terceros conservan sus licencias y firmas propias. La integración deberá distinguir los archivos propios de los binarios upstream; no solicitará volver a firmar código ajeno con un certificado de SignPath Foundation. Que electron-builder modifique los recursos del ejecutable de Electron no resuelve por sí solo esa clasificación: el alcance de ese ejecutable y de los contenedores deberá acordarse con el proveedor antes de activar la firma. Consulta [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

La eventual solicitud se limita a la edición abierta de Apex bajo MIT y a sus componentes elegibles. Una futura edición con componentes propietarios tendrá un proceso de firma independiente. Cobrar por una distribución abierta no determina por sí solo su elegibilidad: cualquier cambio de licencia o modelo debe contrastarse con las condiciones del servicio antes de usarlo.

## Responsabilidades

El mantenedor identificado del proyecto es [Crakelet](https://github.com/Crakelet). Para el proceso de firma se propone la siguiente asignación inicial, que deberá confirmarse antes de habilitarlo:

| Función | Responsable propuesto | Responsabilidad |
| --- | --- | --- |
| Autor con permiso de escritura | Crakelet | Mantener fuentes, dependencias y scripts de compilación. |
| Revisor | Crakelet | Revisar contribuciones externas, incluidos workflows y cambios que afecten al sistema. |
| Aprobador de firma y publicación | Crakelet | Revisar la evidencia y aprobar manualmente cada solicitud de firma y release. |

No se presenta esta tabla como una comprobación de los permisos remotos de GitHub o SignPath. Todo nuevo integrante con esas responsabilidades debe figurar en la política y tener los accesos correspondientes revisados.

La autenticación multifactor es un requisito para los mantenedores y aprobadores tanto en GitHub como en el futuro servicio de firma. **Su activación no se ha verificado**; debe comprobarla el responsable de la cuenta antes de solicitar la admisión o habilitar la firma.

## Procedencia y aprobación

1. Cada release identificará una revisión del repositorio y un tag que coincida con la versión de `package.json` y `package-lock.json`.
2. La compilación debe ejecutarse desde ese código con las dependencias fijadas, pruebas y comprobaciones de seguridad. La evidencia distinguirá lo probado en simulación, fixtures y sistemas desechables de lo pendiente.
3. La integración de firma debe permitir comprobar la procedencia del build. No se solicitará firmar un ejecutable arbitrario o procedente de otro proyecto.
4. El aprobador revisará cambios, resultados, dependencias, metadatos y alertas abiertas, y aprobará manualmente cada petición de firma. Una futura conexión con SignPath no eliminará este paso.
5. Después de firmar se comprobarán la cadena, identidad y sello de tiempo, y se generarán las huellas finales. Los archivos publicados deben ser exactamente los verificados.

Las credenciales y claves de firma se guardarán en el servicio o almacén seguro admitido y en los secretos necesarios del entorno de compilación; nunca en el código, documentación, issues o artefactos públicos. Las contribuciones externas no tendrán acceso a esos secretos por ejecutar una pull request.

La publicación del código o una release sin firma no equivale a una aprobación de Microsoft, SignPath o un fabricante de antivirus. La reputación debe apoyarse en un historial real de mantenimiento, builds verificables y atención a los problemas comunicados.

## Privacidad y cambios del sistema

Consulta [PRIVACY.md](PRIVACY.md). Apex mantiene los diagnósticos y respaldos localmente; las conexiones propias de actualización, pruebas de red y enlaces se realizan por acciones del usuario. Las herramientas que modifican Windows anuncian su efecto y solicitan confirmación. El Setup incluye desinstalación; desinstalar no equivale a revertir todos los ajustes.

## Preparación para SignPath

Antes de solicitar la admisión deben existir una distribución publicada y documentada, control verificable del repositorio y una revisión de sus alertas abiertas. SignPath evalúa la elegibilidad y la reputación; utilizar MIT no garantiza la aprobación ni fija un plazo.

Las [condiciones oficiales](https://signpath.org/terms) y la [solicitud oficial](https://signpath.org/apply) son la referencia. Si el proyecto fuese admitido, esta página se actualizaría con el alcance acordado, los responsables confirmados y el crédito exigido: “Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/)”. Ese texto describe una obligación futura y **no un servicio actualmente concedido a Apex**.
