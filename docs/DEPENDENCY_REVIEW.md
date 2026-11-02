# Revisión de dependencias de compilación

Revisión: 1 de noviembre de 2026. Hay una alerta moderada abierta de minimatch: [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). No se ha descartado ni se anuncia como corregida.

El aviso describe consumo excesivo de CPU y memoria ante patrones controlados por un atacante y procesamiento con `optimizationLevel >= 2`; señala como corregida la versión 11.0.1. El árbol bloqueado de electron-builder 26.18.0 incluye minimatch 10.2.6 y ramas antiguas 3, 5 y 9. El compilador sigue siendo la versión publicada más reciente al consultar el registro en esta fecha.

El alcance identificado es el entorno de desarrollo y empaquetado. Los patrones de distribución de Apex son constantes del repositorio; la aplicación no recibe patrones de compilación de sus usuarios. El uso revisado de app-builder-lib pasa opciones de coincidencia con `dot: true`, sin solicitar el nivel de optimización descrito en el aviso. Esto reduce la exposición del flujo actual, pero no constituye un parche de la dependencia.

minimatch no es una herramienta de Apex ni una dependencia de producción declarada. Se extrajo e inspeccionó el ASAR del Portable v1.0.4 descargado y verificado, sin ejecutar el programa: 60 entradas, sin directorio node_modules ni archivos minimatch. Esta comprobación limita el hallazgo al árbol de compilación revisado; no corrige la dependencia. Electron y otros binarios upstream requieren sus propias revisiones; un resultado de npm audit no certifica todo el runtime.

No se sustituyen todas las ramas por minimatch 11 con un override general: componentes antiguos como ASAR esperan la API de función de minimatch 3, y un salto mayor puede romper el empaquetado. Queda pendiente una actualización compatible o un parche de alcance comprobado, seguido de compilación y comparación del paquete. Los builds permanecen en evaluación y la alerta continúa visible.
