# Validación de v1.0.3

Fecha: 30 de octubre de 2026, America/Santiago. Esta versión prepara la primera publicación de fuentes MIT y la compilación de distribución en GitHub. Conserva la lógica y las comprobaciones de perfiles de juegos de [v1.0.2](VALIDATION-1.0.2.md).

## Alcance del cambio

- Retira dos cifras de FPS sin medición de las descripciones del catálogo. No modifica los valores aplicados por esas herramientas.
- Incluye `PRIVACY.md` y `CODE_SIGNING_POLICY.md` en el paquete; el verificador exige que coincidan con las fuentes.
- Añade políticas, reportes privados de vulnerabilidades, actualizaciones de dependencias y workflows con acciones fijadas por revisión. La release genera hashes, estado Authenticode y procedencia de los ejecutables, y permanece en borrador para revisión manual.

## Evidencia de esta revisión

El resultado actual de cada revisión está disponible en [Validar Windows](https://github.com/Crakelet/apex-pc-optimizer/actions/workflows/ci.yml) y [Preparar release en borrador](https://github.com/Crakelet/apex-pc-optimizer/actions/workflows/release.yml). Solo una ejecución terminada correctamente acredita sus pasos; la configuración del workflow por sí sola no lo hace.

La suite comprueba sintaxis, políticas de seguridad, restauración sobre recursos sintéticos, selección de perfiles, conflictos y permisos, IPC y contenido empaquetado. Las pruebas nativas de Windows usan claves y archivos desechables; la simulación intercepta las acciones y el arranque normal de comprobación bloquea mutaciones. No se aplican optimizaciones al equipo de desarrollo.

En la revisión local v1.0.3 pasaron las 165 pruebas y la comprobación de sintaxis y políticas de los 73 archivos JavaScript. `npm audit` no informó vulnerabilidades conocidas en el árbol bloqueado de dependencias al consultar el 30 de octubre. Esto no certifica ausencia de fallos ni sustituye la revisión de antivirus.

El paquete local sin instalador también superó `verify-release --directory-only`: versión 1.0.3 y los 55 archivos coincidentes. Se comprobará por separado la distribución completa creada por GitHub.

La distribución debe registrar **55 archivos de código, recursos y políticas** coincidentes con el checkout usado para empaquetar, además de comprobar nombre, versión, entrada y licencia de `package.json`. Los hashes de un build local anterior no se atribuyen a un build de GitHub. La procedencia identifica el origen de los artefactos; no es una firma Authenticode ni un análisis de malware.

## Límites y pendientes

Los ejecutables siguen sin certificado de editor. La alerta de [Bitdefender](ANTIVIRUS.md) no tiene aún una identificación completa ni un veredicto documentado. Las pruebas funcionales no confirman un falso positivo.

No se repitió la instalación/desinstalación ni toda la matriz de herramientas en equipos representativos por este cambio de documentación y empaquetado. Los resultados anteriores se conservan en [v1.0.2](VALIDATION-1.0.2.md), [v1.0.1](VALIDATION-1.0.1.md) y [v1.0.0](VALIDATION-1.0.0.md). No se garantiza compatibilidad universal ni una ganancia de FPS. Los borradores no se describen como distribuciones públicas revisadas.

Los logs, respaldos e inventarios privados permanecen fuera del repositorio. No se han enviado muestras ni mensajes al proveedor de antivirus, ni una solicitud a SignPath Foundation.
