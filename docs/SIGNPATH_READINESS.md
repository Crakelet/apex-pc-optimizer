# Preparación para SignPath Foundation

Revisión: 1 de noviembre de 2026. Esta lista prepara una futura solicitud para la edición MIT de Apex PC Optimizer. **No hay solicitud enviada, admisión ni certificado concedido.**

El repositorio para la solicitud es [Crakelet/apex-pc-optimizer](https://github.com/Crakelet/apex-pc-optimizer). Esta revisión acompaña la primera publicación de fuentes. El resultado efectivo de compilaciones y releases se consulta en [Actions](https://github.com/Crakelet/apex-pc-optimizer/actions) y [Releases](https://github.com/Crakelet/apex-pc-optimizer/releases).

## Requisitos y evidencia

Las [condiciones oficiales](https://signpath.org/terms), consultadas en la fecha anterior, exigen una edición abierta, mantenida, documentada y ya distribuida; reputación verificable; procedencia comprobable de los binarios; MFA, responsables definidos y aprobación manual de cada firma. También regulan los componentes ajenos, los avisos de cambios, la privacidad, la desinstalación y los metadatos. SignPath decide la admisión: no publica en esas condiciones un mínimo numérico de estrellas o una antigüedad obligatoria.

| Área | Estado de Apex y evidencia que falta |
| --- | --- |
| Fuentes y licencia | [LICENSE](../LICENSE) y el código MIT ya están públicos junto con las pruebas y scripts de compilación. La revisión de las licencias de todos los componentes distribuidos sigue siendo responsabilidad del mantenedor; [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) no sustituye ese inventario. |
| Distribución y documentación | README y guías describen herramientas, límites y restauración. Un borrador privado de release no acredita una distribución pública. Falta una entrega pública revisada, con ejecutables, huellas, versión y estado de firma explícitos. |
| Mantenimiento y reputación | Es la primera publicación del proyecto. Se debe aportar el historial real posterior: incidencias atendidas, revisiones, cambios explicados y releases comprobables. No se crearán fechas, usuarios, descargas o apoyos ficticios. |
| Procedencia | La [compilación v1.0.4](https://github.com/Crakelet/apex-pc-optimizer/actions/runs/41363159191) terminó desde el commit limpio `d490fb3e7c61986d5a527afb28b8d79a14e7f802`. Se comprobaron localmente hashes, tamaños, Authenticode y atestaciones con origen exigido. Consulta [el manifiesto](release-manifests/v1.0.4.json). No es una firma de editor; el build permanece en borrador. |
| Alertas abiertas | El informe de [Bitdefender](ANTIVIRUS.md) se remitió por su formulario, sin ejecutables ni datos personales del equipo. Falta respuesta y análisis del archivo exacto. No hay falso positivo confirmado. También se mantiene visible la [alerta de una dependencia de compilación](DEPENDENCY_REVIEW.md). |
| Responsables y MFA | [Code signing policy](../CODE_SIGNING_POLICY.md) propone a Crakelet como autor, revisor y aprobador. Falta confirmar esos accesos y la activación de MFA en GitHub y, cuando exista, SignPath. |
| Electron y otros binarios | Falta acordar con SignPath el alcance del ejecutable de Electron modificado por electron-builder y de los contenedores. No se solicitará firmar arbitrariamente binarios upstream con el certificado del proyecto. |
| Integración de firma | Aún no existe integración SignPath. Faltan configuración de artefactos y restricciones de nombre de producto/versión, aprobación manual, comprobación de la firma y huellas posteriores a la firma. |
| Experiencia del usuario | [Privacidad](../PRIVACY.md), confirmaciones y límites están documentados. Deben comprobarse en la distribución concreta, junto con la instalación y desinstalación. No se han validado todas las operaciones reales en todos los Windows compatibles. |

## Orden de trabajo

1. Publicar las fuentes y comprobar los resultados de CI; resolver fallos y conservar evidencia accesible.
2. Completar la investigación de Bitdefender y la validación de la distribución exacta. Registrar las limitaciones pendientes sin presentarlas como aprobadas.
3. Publicar una entrega revisada y mantenerla con actualizaciones reales. Confirmar MFA y las responsabilidades.
4. Revisar de nuevo las condiciones, resolver el alcance de Electron y preparar la [solicitud oficial](https://signpath.org/apply) con enlaces a esas evidencias.
5. Si se concede el servicio, integrar la firma y actualizar la política y los créditos. La política identifica el texto de atribución futuro; no se utiliza como insignia de un patrocinio actual.

La identidad del certificado de la Foundation sería **SignPath Foundation**. Una firma acredita origen e integridad según su proceso; no constituye una aceptación de Bitdefender ni una garantía de reputación de SmartScreen. La futura edición propietaria, si existiera, requeriría evaluar otra vía de firma y sus licencias por separado.
