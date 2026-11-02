# Revisión de privacidad de la publicación

Revisión: 1 de noviembre de 2026.

La publicación inicial contenía capturas de la interfaz con información general del equipo: hardware, recursos y fechas de perfiles. No eran credenciales, pero se retiraron a petición del mantenedor. El historial anterior se conserva solo en una copia local; la rama pública y el tag de evaluación v1.0.4 parten de una raíz nueva.

Una copia nueva del repositorio público confirmó 117 archivos, 108 de texto y un único commit de origen. Ninguno de los siete blobs de capturas originales está alcanzable en esa historia. Las capturas nuevas provienen de respuestas ficticias; no se cargan los motores de Windows ni se consulta el hardware para generarlas.

La revisión de texto no encontró rutas personales del equipo, el correo privado de contacto, tokens con los patrones comprobados, claves privadas, certificados, logs, respaldos, bases de datos ni archivos de entorno. Las constantes públicas de Windows/DNS y los datos sintéticos de pruebas son código, no un inventario del equipo. Se verificó que las ramas locales de archivo no estuvieran publicadas.

Esta es una revisión con alcance concreto, no una garantía de detección de cualquier secreto posible. Las fuentes propias son MIT; publicar el código no publica los datos que la aplicación lee cuando se ejecuta.

## Referencias antiguas y cachés

Se retiraron las ramas de actualización basadas en el historial anterior, su tag y el borrador de distribución previo. Los pull requests asociados quedaron cerrados. GitHub puede conservar vistas en caché o referencias internas de esos pull requests; una reescritura no garantiza su purga.

Al comprobar el portal el 2 de noviembre de 2026, GitHub Support confirmó el envío de la solicitud privada de revisión de cachés y referencias. Se proporcionaron únicamente el repositorio, las revisiones anteriores, rutas de capturas y números de PR, sin adjuntar imágenes, logs ni archivos del equipo. No se solicitó borrar el repositorio actual. La confirmación del mensaje no acredita que GitHub haya realizado o aprobado la purga; su respuesta sigue pendiente.

Consulta el [procedimiento oficial de GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository). Las copias descargadas por terceros tampoco pueden retirarse mediante Git.

El contacto privado con Bitdefender y cualquier notificación del usuario quedan fuera del repositorio. La revisión del antivirus sigue documentada por separado en [ANTIVIRUS.md](ANTIVIRUS.md).
