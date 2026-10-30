# Publicar una versión

## Estado y alcance

El destino configurado es `Crakelet/apex-pc-optimizer`. Preparar el código y estos archivos no crea el repositorio, configura un remoto Git ni publica una release. La suite conserva las 14 secciones del diseño glassmorphism original y todas las herramientas gratuitas; no hay una selección de funciones de pago en esta entrega.

La v1 arranca en modo normal desde los ejecutables, `run.bat` y `npm start`; sus herramientas actúan después de la confirmación correspondiente. La simulación se abre por separado mediante `run-tests.bat`, `run.bat --test-mode` o `npm run start:test`. Las comprobaciones realizadas durante el desarrollo no deben aplicar optimizaciones al equipo de trabajo.

## Flujo preparado

1. Mantén `package.json` y `package-lock.json` con la misma versión estable `X.Y.Z`.
2. Actualiza CHANGELOG.md y `.github/release-notes.md` con funciones, compatibilidad probada, límites y estado de firma.
3. Ejecuta `npm ci`, `npm run check`, `npm test`, `npm run test:windows`, `npm run test:smoke`, `npm run test:release-startup` y `npm run build` en Windows. El recorrido de arranque normal bloquea mutaciones y cancela la confirmación; no sustituye la validación de ajustes reales. El build termina verificando el paquete, las dos salidas y sus huellas; también puedes ejecutar `npm run verify:release` sobre artefactos existentes.
4. En una VM limpia, revisa las 14 secciones, los diálogos de confirmación, el modo de pruebas, los fallos de permisos y la ausencia de acciones reales en simulación.
5. Prueba instalación y desinstalación en una cuenta estándar, el portable y la persistencia de respaldos. Verifica aplicación y restauración de los cambios compatibles en un entorno desechable, incluyendo valores existentes y ausentes, conflictos externos y reinicio.
6. Comprueba Windows 10 y 11 x64 antes de anunciar compatibilidad probada con ambos. Registra los modelos de hardware y límites de las mediciones.
7. Configura el remoto de GitHub y sube un tag `vX.Y.Z` que coincida con package.json. El workflow crea **un borrador**, nunca una publicación pública automática.
8. Revisa ejecutables, hashes, firma y notas en el borrador. Publica manualmente cuando termine la validación.

## Respaldos y operaciones irreversibles

La validación debe distinguir los respaldos del catálogo general y las restauraciones propias de juegos, DNS, GPU por aplicación y herramientas Apex. Comprueba también que auditoría, Snappy, diseño y USB comparten los respaldos del motor general. No basta con que una acción termine sin error: comprueba qué se guardó y qué recupera su reversión, incluyendo conflictos entre ajustes que modifican el mismo recurso.

Revisa que Seguridad y Backup muestre resultados manuales e interrupciones, junto con el resumen de ajustes generales, Snappy, Apex y juegos. El historial de actividad no autoriza una restauración ni sustituye los respaldos. En perfiles de juego, la recuperación debe usar solo registros propios y el orden inverso real de aplicación; conserva el respaldo cuando aparezca un conflicto externo.

Verifica el cierre normal con limpieza automática y Ascensión activas en un entorno desechable: debe detener la programación de RAM, esperar tareas pendientes e intentar recuperar las prioridades de los procesos originales sin sobrescribir cambios ajenos. Si la restauración falla, comprueba el aviso y la conservación del respaldo. Un cierre forzado no acredita este flujo.

La creación de un punto debe comprobar una secuencia nueva registrada por Windows con la descripción solicitada. La lógica se cubre con respuestas simuladas, sin crear puntos reales durante las pruebas automatizadas del equipo de trabajo. Valida por separado en la VM los permisos, la protección del sistema y el límite de frecuencia antes de anunciar ese escenario como probado.

La limpieza elimina archivos y no dispone de una recuperación universal. Confirma que quedan excluidos autoguardados, recuperación, proyectos, medios originales, enlaces de sistema y archivos recientes. Las acciones avanzadas sin API de reversión propia deben describirse como tales. No presentes «Revertir todo» como recuperación de todas las herramientas ni de archivos eliminados.

## Firma de ejecutables

Los builds locales sin certificado son **sin firma**. El responsable puede configurar los secrets `WIN_CSC_LINK` y `WIN_CSC_KEY_PASSWORD` compatibles con electron-builder. No incluyas certificados, contraseñas ni claves en el repositorio.

El workflow registra Authenticode. Sin certificado puede generar un borrador de pruebas con aviso; las notas deben indicar el estado real de firma. Una firma válida y los hashes no garantizan seguridad absoluta ni reputación de SmartScreen.

## Revisión de antivirus

Consulta [la alerta investigada de Bitdefender](ANTIVIRUS.md). Antes de publicar, registra el resultado del análisis del archivo exacto, su SHA-256, motor, versión de firmas y fecha. Una prueba de arranque o un `npm audit` correcto no equivalen a un veredicto del antivirus. Si persiste la detección, conserva el aviso y solicita revisión al proveedor sin desactivar protecciones ni añadir exclusiones generales. El envío de muestras requiere una decisión expresa del responsable.

## Actualizaciones

El botón de actualización consulta `/repos/Crakelet/apex-pc-optimizer/releases/latest` cuando lo pide el usuario. Acepta releases estables con tags de tres componentes y abre la página oficial de esa versión. No descarga ni ejecuta actualizaciones.

El usuario revisa las notas y elige Setup o Portable. Un 404 indica que no hay release estable; un error de red no significa que la app esté actualizada. Si cambias el repositorio, actualiza `updateService.js`, package.json, workflows y documentación.

## Integridad

`npm run build` genera `SHA256SUMS.txt`, `signatures.json` y `release-manifest.json`. El verificador exige los dos ejecutables completos de la versión actual, comprueba las huellas y que el ASAR contiene exactamente el código y los recursos locales finales. Un archivo ausente, un paquete antiguo o una firma inválida detienen el build. `NotSigned` se registra como tal y requiere indicarlo en las notas. Ejemplo:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath '.\Apex-PC-Optimizer-v1.0.2-Portable-x64.exe'
Get-AuthenticodeSignature -LiteralPath '.\Apex-PC-Optimizer-v1.0.2-Portable-x64.exe'
```

No reempaquetes los ejecutables después de generar sus hashes. No publiques `scratch`, `archive`, `reference`, `tweaks_state.json`, respaldos privados ni certificados.
