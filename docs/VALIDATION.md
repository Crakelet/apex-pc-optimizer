# Validación de v1.0.4

Fecha: 1 de noviembre de 2026. Esta revisión conserva las herramientas gratuitas y el diseño, prepara un historial público sin capturas reales del equipo y una nueva distribución con procedencia verificable.

## Cambios

- Las siete capturas se generan desde el renderer con respuestas ficticias, sin cargar los motores de Windows ni consultar el hardware. La red queda bloqueada y el perfil de captura es desechable.
- La versión del encabezado proviene de los metadatos de la aplicación; no permanece fijada a una versión anterior.
- Las pruebas se ejecutan con concurrencia de archivos limitada a uno. En CI se observaron timeouts de arranque de PowerShell al ejecutarse varios procesos de prueba simultáneamente. Se conservan las mismas pruebas, validaciones y límites de las herramientas.
- Las revisiones y distribuciones anteriores se conservan en una copia local. Los enlaces públicos a ese historial se retiraron para no reintroducir las capturas originales.

## Comprobaciones

El resultado efectivo de esta revisión se consulta en [CI de Windows](https://github.com/Crakelet/apex-pc-optimizer/actions/workflows/ci.yml) y [Distribución](https://github.com/Crakelet/apex-pc-optimizer/actions/workflows/release.yml). Configurar un workflow no acredita que haya terminado correctamente.

La revisión local pasó las 165 pruebas y la comprobación de los 73 archivos JavaScript. La [CI del commit limpio](https://github.com/Crakelet/apex-pc-optimizer/actions/runs/41363158499) y la [compilación completa de v1.0.4](https://github.com/Crakelet/apex-pc-optimizer/actions/runs/41363159191) terminaron correctamente desde `d490fb3e7c61986d5a527afb28b8d79a14e7f802`.

Los ejecutables descargados coinciden con el [manifiesto de esa compilación](release-manifests/v1.0.4.json) en tamaño, SHA-256 y estado Authenticode `NotSigned`. También pasaron `gh attestation verify` con repositorio, workflow, commit y tag exigidos explícitamente. No se ejecutaron para realizar estas comprobaciones.

La suite comprueba restauración sobre recursos sintéticos, conflictos externos, selección de perfiles, permisos, validación IPC y paquete final. Las pruebas nativas usan claves y archivos desechables. El recorrido simulado intercepta mutaciones; el arranque normal de comprobación bloquea las acciones reales. No se aplican optimizaciones al equipo de desarrollo.

El paquete debe incluir 55 archivos de código, recursos, licencias y políticas coincidentes con el checkout usado para compilar, además de nombre, versión, entrada y licencia coherentes. Cada ejecutable debe tener su SHA-256 y estado Authenticode registrados. Los hashes locales anteriores no se atribuyen a builds nuevos.

## Límites

La revisión de [Bitdefender](ANTIVIRUS.md) sigue sin veredicto. Las pruebas y la procedencia no certifican ausencia de malware ni compatibilidad universal. No se repitió toda la matriz de instalación, desinstalación y herramientas reales en hardware representativo por este cambio. Tampoco se promete una ganancia de FPS.

Existe una [alerta moderada de una dependencia del compilador](DEPENDENCY_REVIEW.md), abierta y pendiente de actualización compatible; no se presenta como corregida ni se sustituye su análisis por los resultados funcionales.

Logs, inventarios, respaldos, contacto con soporte e historial local quedan fuera de GitHub. Las capturas públicas son ficticias. La retirada de referencias Git no garantiza por sí sola la eliminación de cachés o referencias de pull requests en los servidores de GitHub; su purga depende del servicio.
