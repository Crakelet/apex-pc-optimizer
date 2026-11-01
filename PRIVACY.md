# Política de privacidad

Última revisión: 30 de octubre de 2026. Aplicación: Apex PC Optimizer, línea 1.0.x. Responsable del proyecto: [Crakelet](https://github.com/Crakelet).

Apex funciona localmente. No requiere una cuenta. La aplicación no incluye publicidad ni envía analítica de uso; los inventarios y respaldos permanecen en el equipo. La telemetría que muestra el Dashboard son lecturas locales de hardware y procesos.

## Datos locales

Según la herramienta que utilices, Apex consulta información de Windows como CPU, memoria, GPU y controlador, pantallas, unidades y espacio libre, programas de inicio, servicios, adaptadores de red, procesos y preferencias de registro. La detección de aplicaciones creativas comprueba ubicaciones locales conocidas. El asistente de rendimiento no lee el contenido de tus proyectos.

Cuando confirmas un cambio compatible, la app guarda los valores originales y los datos necesarios para restaurarlos. Un respaldo puede contener rutas con nombres de usuario o identificadores de perfil, valores del registro, configuración DNS y copias completas de archivos de configuración de juegos. Los respaldos son archivos locales, no están cifrados por Apex y no deben publicarse.

El historial de actividad conserva hasta 30 acciones recientes con su nombre, fecha y resultado. No almacena los argumentos de la acción, aunque un mensaje de error de Windows o de una versión anterior puede incluir una ruta local. Electron también mantiene cachés y preferencias de funcionamiento.

En modo normal, estos datos se encuentran principalmente en `%APPDATA%\ApexPCOptimizer`, también al usar el Portable. Algunas herramientas conservan su respaldo junto al recurso correspondiente, por ejemplo el respaldo local de HOSTS o registros de programas de inicio. La simulación y las pruebas usan ubicaciones separadas en `scratch` o en el directorio temporal.

## Cuándo se utiliza la red

Apex no consulta actualizaciones ni envía diagnósticos automáticamente. Estas conexiones requieren una acción del usuario:

| Acción | Conexión y datos implicados |
| --- | --- |
| Comprobar actualizaciones | Consulta HTTPS a `api.github.com` para la última release estable de `Crakelet/apex-pc-optimizer`. GitHub recibe la información habitual de conexión y un agente de usuario con la versión de Apex. No se envía el inventario del equipo. La descarga e instalación son manuales. |
| Prueba de ping | Envía paquetes ICMP a la IP o dominio indicado, o a los destinos predefinidos que muestra la herramienta. Si se usa un dominio, Windows puede solicitar su resolución al proveedor DNS configurado. El destino y la infraestructura de red pueden observar la conexión y su IP de origen. |
| Abrir una guía o publicación | Abre en tu navegador una dirección fija de GitHub, Microsoft, Adobe, Blender o NVIDIA. El sitio y tu navegador aplican sus propias políticas, incluidas las sesiones o cookies que ya existan en él. |
| Elegir un proveedor DNS | Cambia, tras confirmación, la configuración IPv4 de los adaptadores cubiertos. Las consultas posteriores de Windows y de otras aplicaciones pueden utilizar ese proveedor. Esto afecta a la resolución del equipo y no equivale a un servicio de privacidad total. |

La generación del informe de rendimiento y la selección de un perfil de VALORANT permanecen locales. Abrir Configuración de Windows no envía un informe a Apex. Las comunicaciones que Windows, el navegador, el antivirus o una aplicación externa hagan por su cuenta dependen de esos productos.

Consulta las políticas de los servicios que elijas utilizar:

- [GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).
- [Microsoft](https://privacy.microsoft.com/es-es/privacystatement), [Adobe](https://www.adobe.com/privacy/policy.html), [Blender](https://www.blender.org/privacy-policy/) y [NVIDIA](https://www.nvidia.com/en-us/about-nvidia/privacy-policy/).
- DNS: [Cloudflare 1.1.1.1](https://developers.cloudflare.com/1.1.1.1/privacy/public-dns-resolver/), [Google Public DNS](https://developers.google.com/speed/public-dns/privacy) y [Quad9](https://quad9.net/privacy/policy/).
- Destinos predefinidos de ping de terceros: [Riot Games](https://www.riotgames.com/en/privacy-notice) y [Steam/Valve](https://store.steampowered.com/privacy_agreement/). Una dirección accesible por ICMP no acredita un servidor de partida.

## Control y conservación

Puedes usar las funciones locales sin comprobar actualizaciones, ejecutar pings o abrir enlaces. La app no dispone de una cuenta remota del usuario ni de un panel de datos en la nube.

Desinstalar Apex conserva los datos de su perfil y no revierte automáticamente los cambios de Windows. Los respaldos compatibles se restauran desde sus paneles; no eliminan archivos de trabajo ni recuperan todas las limpiezas. Antes de borrar un respaldo, comprueba que ya no lo necesitas. La app no puede reconstruirlo una vez eliminado. Consulta el [alcance de la restauración](README.md#respaldos-y-límites-de-la-restauración).

## Informes de problemas

No se envían errores o muestras al antivirus automáticamente. Si decides publicar un issue o remitir un archivo a un proveedor, esa acción transmite los datos que adjuntes. Revisa y oculta nombres de usuario, rutas, direcciones de red, identificadores de cuentas y otros datos personales. No adjuntes una carpeta completa de AppData ni los archivos de respaldo.

Para preguntas generales puedes usar los [issues del proyecto](https://github.com/Crakelet/apex-pc-optimizer/issues), cuando el repositorio esté disponible. Si se trata de una vulnerabilidad o información sensible, sigue [SECURITY.md](SECURITY.md). Esta política deberá actualizarse antes de añadir nuevas comunicaciones o recogida de datos.
