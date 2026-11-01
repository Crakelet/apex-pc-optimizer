# Rendimiento para gaming y creación

Revisión de fuentes: 29 de octubre de 2026, America/Santiago.

El asistente de rendimiento es gratuito y de solo lectura. Combina lecturas locales con pasos para revisar Windows y las aplicaciones. No aplica perfiles, instala controladores, limpia memoria ni inspecciona proyectos. Una recomendación no acredita que un ajuste mejore el rendimiento de un equipo concreto.

## Qué se mide

- Memoria física total y disponible con las API de Node. El porcentaje es una instantánea; no es la memoria comprometida ni identifica un cuello de botella.
- Nombre de GPU y versión de controlador informados por Windows. No se presenta `AdapterRAM` como VRAM exacta ni se deduce el canal Studio/Game Ready a partir de una versión.
- Tamaño y espacio libre de unidades locales fijas informadas por Windows. No se recorre su contenido ni se confirma dónde una aplicación guarda su scratch. El aviso por menos del 10% libre es una orientación del asistente, no un umbral oficial universal.
- Resolución y Hz que Electron proporciona para las pantallas. Si los Hz no están disponibles se indica; no se infiere la frecuencia máxima compatible ni VRR.
- Preferencias de Modo Juego y HAGS existentes en el registro. Son valores registrados, no una prueba de soporte del controlador, reinicio completado o activación efectiva. La ausencia de un valor no significa que la función esté desactivada.

La consulta nativa tiene un tiempo máximo de 12 segundos y conserva resultados parciales. Si Windows bloquea una lectura, el panel mantiene las guías y las lecturas disponibles. No se envían estos datos a servicios externos.

## Gaming

### Pantalla, VRR y juegos en ventana

Revisa Pantalla avanzada para elegir una frecuencia compatible con la resolución de tu monitor. Los Hz actuales no permiten asegurar que admite más. Una frecuencia mayor también puede aumentar consumo. DRR requiere hardware compatible y puede limitar algunos juegos; compáralo con DRR desactivado si aparece ese problema. [Microsoft: frecuencia de actualización, VRR y DRR](https://support.microsoft.com/en-us/windows/hardware/display-graphics/change-the-refresh-rate-on-your-monitor-in-windows).

Las optimizaciones para juegos en ventana de Windows 11 se dirigen a juegos DirectX 10 y 11 compatibles en ventana o sin bordes. Revisa cada juego desde Gráficos; Windows permite elegir GPU y desactivar opciones por aplicación. Reinicia el juego y compara. La selección de GPU tiene más sentido cuando hay varias GPU disponibles. [Microsoft: optimizaciones para juegos en ventana](https://support.microsoft.com/en-us/windows/hardware/display-graphics/optimizations-for-windowed-games-in-windows-11).

HAGS requiere GPU y controlador compatibles. No debe ofrecerse como una cantidad garantizada de FPS. [Microsoft: programación de GPU por hardware](https://devblogs.microsoft.com/directx/hardware-accelerated-gpu-scheduling/).

### Medición útil

Usa el mismo juego, escena, resolución, calidad, límite de FPS y duración. Mantén comparables las aplicaciones de fondo y cambia una opción a la vez. Este informe no incluye captura de FPS, tiempos de fotograma, 1% low ni temperatura. La carga total del procesador por sí sola no determina si un juego está limitado por CPU o GPU; depende también de escena y ajustes. [Microsoft: limitación por CPU y GPU](https://devblogs.microsoft.com/directx/cpu-and-gpu-boundedness/).

## Diseño, vídeo y 3D

### Photoshop

Revisa Efficiency mientras trabajas con el documento habitual, la GPU detectada y la asignación de memoria en Preferencias > Rendimiento. Ajusta memoria, historial y caché según el documento, dejando recursos para el sistema y las otras aplicaciones. [Adobe: preferencias de rendimiento](https://helpx.adobe.com/photoshop/desktop/get-started/settings-and-preferences/configure-photoshop-performance-preferences.html).

Configura las unidades de memoria virtual desde Photoshop, con espacio y orden de prioridad adecuados. Un SSD rápido puede ayudar cuando la tarea usa scratch; no implica una mejora universal cuando cabe en RAM. Conserva proyectos, recuperación, autoguardados y scratch activo. [Adobe: configurar discos de memoria virtual](https://helpx.adobe.com/photoshop/desktop/troubleshoot/troubleshoot-tools-resources/set-up-and-manage-scratch-disks.html).

### Premiere

Los proxies son copias de menor resolución para editar medios pesados. Créales un destino claro y conserva los originales para el trabajo final. [Adobe: crear proxies](https://helpx.adobe.com/premiere/desktop/organize-media/ingest-proxy-workflow/create-proxies.html).

La decodificación H.264/HEVC por hardware puede mejorar la reproducción con formatos y hardware compatibles; se revisa en Preferencias > Medios y requiere reiniciar. Compara reproducción y exportación por separado. [Adobe: decodificación por hardware](https://helpx.adobe.com/premiere/desktop/get-started/technical-requirements/enable-hardware-accelerated-decoding-support.html).

### Blender

En Cycles debes seleccionar un backend compatible, activar los dispositivos en Preferencias > Sistema y elegir GPU Compute en la escena. La preferencia GPU de Windows no configura Cycles. Compara el mismo render y muestreo; la memoria de la escena, las texturas y compartir GPU con la pantalla condicionan el resultado. [Blender: renderizado con GPU](https://docs.blender.org/manual/en/latest/render/cycles/gpu_rendering.html).

### Controladores

NVIDIA describe pruebas de Studio Drivers con flujos de varias aplicaciones creativas. Comprueba compatibilidad y notas oficiales para tu GPU y tus versiones de aplicaciones. El asistente no identifica el canal instalado de forma fiable ni instala controladores. [NVIDIA: Studio Stack](https://developer.nvidia.com/nvidia-studio-stack).

## Destinos controlados

Los botones usan identificadores fijos resueltos en el proceso principal. Los destinos de Configuración son `display-advancedgraphics`, `display-advanced`, `gaming-gamemode`, `startupapps` y `powersleep`; su disponibilidad depende de Windows y del equipo. No se acepta una URI o un comando libre desde el panel. [Microsoft: abrir Configuración de Windows](https://learn.microsoft.com/en-us/windows/apps/develop/launch/launch-settings).

Las fuentes externas requieren una acción del usuario y pueden abrirse en su navegador. Abrir una fuente sí conecta con ese sitio; generar el informe permanece local.
