# Contribuir a Apex

Gracias por ayudar a construir una herramienta transparente. Abre un issue antes de ampliar el alcance de un módulo o agregar cambios de Windows.

## Preparación

Usa Windows x64, Node.js 22.12 o superior y `npm ci`. **`npm start` y `run.bat` abren el modo normal con herramientas reales**; las acciones que modifican el equipo requieren confirmación. Para desarrollar sin aplicar cambios usa `npm run start:test`, `run-tests.bat` o `run.bat --test-mode`. Abrir la app no aplica un perfil automáticamente.

No pruebes modificaciones sensibles sobre tu equipo de trabajo; usa una VM desechable y respaldos. La simulación comprueba flujos, no acredita que una operación real funcione en todas las versiones de Windows.

## Criterios para un ajuste

- Explicar el efecto concreto, consecuencias, fuente y compatibilidad.
- Medir valores reales; no inventar resultados ni prometer beneficios generales.
- Guardar el valor original antes de escribir y verificar aplicación y reversión.
- Rechazar conflictos externos y entradas fuera del catálogo.
- No añadir scripts recibidos desde el renderer, comandos de shell interpolados o elevación silenciosa.
- Añadir pruebas de error, respaldo, interrupción y restauración. Los cambios de UI deben conservar teclado, foco y CSP.

Ejecuta `npm run check`, `npm test`, `npm run test:windows`, `npm run test:smoke` y `npm run test:release-startup` antes de proponer cambios. La integración nativa usa claves temporales exclusivas de prueba; la verificación de arranque normal bloquea modificaciones. Incluye los escenarios de Windows probados y los pendientes. No subas binarios generados al árbol de fuentes ni datos del usuario.

## Pull requests e informes

Describe el problema y el comportamiento final, explica las consecuencias del ajuste y aporta la validación pertinente. Los cambios externos se revisan antes de incorporarlos. El mantenedor debe revisar especialmente dependencias, workflows y código que escriba en Windows o en archivos del usuario.

Un informe público debe contener solo versión, entorno relevante, pasos y mensajes depurados. No adjuntes respaldos, una carpeta de AppData, volcados o registros completos con datos personales. Consulta [PRIVACY.md](PRIVACY.md). Las vulnerabilidades se comunican siguiendo [SECURITY.md](SECURITY.md), no mediante un issue público con un exploit operativo.

## Releases y firma

El flujo y los límites de distribución figuran en [RELEASING.md](docs/RELEASING.md) y la [Code signing policy](CODE_SIGNING_POLICY.md). Actualmente no hay firma Authenticode ni admisión confirmada en SignPath. No añadas certificados o claves al repositorio ni anuncies una detección resuelta sin evidencia del proveedor.

Los responsables que participen en un futuro proceso de firma deberán usar MFA, tener sus funciones documentadas y aprobar cada solicitud de firma manualmente. Esta guía no acredita que esas opciones estén ya habilitadas en las cuentas remotas.

Las contribuciones a la base se publican bajo MIT. Conserva los avisos de terceros y no copies código de herramientas comerciales sin autorización.
