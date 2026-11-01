# Informe de revisión para Bitdefender

Actualizado: 1 de noviembre de 2026. Borrador técnico, sin envío confirmado, caso ni veredicto. Este documento no contiene contactos privados, perfiles, respaldos ni capturas del sistema.

## Motivo

Solicitamos identificar y analizar una posible detección de comportamiento relacionada con Apex PC Optimizer. Durante el desarrollo se informaron los avisos «Infected item detected» y «Malicious behavior blocked», asociados con la carpeta de datos de la aplicación. No se ha establecido el archivo, proceso, módulo, versión o amenaza exactos del evento. No afirmamos que sea un falso positivo confirmado.

## Fuentes y muestra

Repositorio: [Crakelet/apex-pc-optimizer](https://github.com/Crakelet/apex-pc-optimizer). La versión actual de evaluación es v1.0.4. La [compilación de distribución](https://github.com/Crakelet/apex-pc-optimizer/actions/workflows/release.yml) debe terminar y aportar su commit, manifiesto, hashes y procedencia antes de identificar las muestras exactas. Los ejecutables permanecen en borrador, sin descarga pública para el proveedor.

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
