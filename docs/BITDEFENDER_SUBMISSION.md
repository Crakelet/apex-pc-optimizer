# Informe de revisión para Bitdefender

Actualizado: 1 de noviembre de 2026. El formulario oficial confirmó el envío del informe y metadatos; no mostró número de caso y no hay veredicto del proveedor. No se enviaron ejecutables. Este documento no contiene contactos privados, perfiles, respaldos ni capturas del sistema.

## Motivo

Solicitamos identificar y analizar una posible detección de comportamiento relacionada con Apex PC Optimizer. Durante el desarrollo se informaron los avisos «Infected item detected» y «Malicious behavior blocked», asociados con la carpeta de datos de la aplicación. No se ha establecido el archivo, proceso, módulo, versión o amenaza exactos del evento. No afirmamos que sea un falso positivo confirmado.

## Fuentes y muestra

Repositorio: [Crakelet/apex-pc-optimizer](https://github.com/Crakelet/apex-pc-optimizer). La versión actual de evaluación es v1.0.4. La [compilación de distribución](https://github.com/Crakelet/apex-pc-optimizer/actions/runs/41363159191) terminó correctamente desde `d490fb3e7c61986d5a527afb28b8d79a14e7f802`, tag v1.0.4. Los ejecutables permanecen en borrador, sin descarga pública para el proveedor.

| Archivo | Bytes | SHA-256 | Authenticode |
| --- | ---: | --- | --- |
| Apex-PC-Optimizer-v1.0.4-Portable-x64.exe | 110995559 | `30a9df0b82b5857464aa7d5c8fd119cd1a6436826dbaffd2fc1e92d1076621f8` | NotSigned |
| Apex-PC-Optimizer-v1.0.4-Setup-x64.exe | 121968873 | `6de0ce0089cc8e1886d8a46470db1698fe398d1918615b2e15b4e1cff2711051` | NotSigned |

Ambos archivos descargados se contrastaron localmente con el [manifiesto de CI](release-manifests/v1.0.4.json) en tamaño, hash y firma. Las atestaciones también pasaron la verificación con repositorio, workflow, commit y tag exigidos. No se ejecutaron esos binarios y estos resultados no son un veredicto de antivirus. La CI comparó 55 archivos del paquete con el checkout.

Los candidatos anteriores no se atribuyen al evento histórico. Sus archivos y resultados locales se conservan separados; no se reutilizan sus huellas para una compilación nueva. El historial público se renovó para retirar capturas con datos reales de hardware, no para ocultar funciones del programa.

## Comportamiento a revisar

- Aplicación Electron Windows x64, renderer local con sandbox, aislamiento y validación de IPC. Abrirla no aplica un perfil de optimización.
- Consultas de hardware, memoria, procesos y preferencias mediante Node, CIM y Windows PowerShell.
- Herramientas gratuitas de registro, servicios, energía, red, preferencias GPU, prioridades y archivos de juegos con confirmación previa. Algunas necesitan permisos de administrador; no se solicita elevación automática al arrancar.
- Operaciones nativas de memoria y limpiezas de caché, con límites, exclusiones de recuperación y resultados observados. Son capacidades sensibles que el proveedor debe evaluar.
- Respaldos y registro de actividad locales. Los archivos de juegos requieren cerrar el juego y seleccionar perfil cuando corresponde; se conservan atributos y conflictos externos.
- Actualizaciones manuales: consulta de metadatos de GitHub y apertura de la release oficial, sin descarga ni ejecución automática de binarios.

Se retiraron el transporte PowerShell codificado y las nuevas redirecciones IFEO de Game Bar; HOSTS protege destinos compartidos con actualización, antivirus y certificados. No hay exclusiones de antivirus, desactivación de protección ni bypass de AMSI en el código distribuido.

## Solicitud al soporte

Pedimos identificar el comportamiento concreto y si corresponde a malware, aplicación potencialmente no deseada o detección incorrecta. Los paquetes superan 100 MB: solicitamos un canal seguro para suministrar la muestra exacta si se requiere. No se adjuntan ejecutables, perfiles, respaldos, contactos privados ni logs al repositorio público. Los datos que falten de la notificación original se facilitarán solo por el canal privado revisado.

Las pruebas funcionales, hashes y atestaciones no equivalen a un análisis de malware ni una firma Authenticode. No hay un veredicto nuevo de Bitdefender documentado.
