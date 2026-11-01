# Componentes y licencias de terceros

El código propio de Apex PC Optimizer usa MIT. Los permisos de MIT no sustituyen las licencias de las dependencias.

- **Electron**: MIT. Integra Chromium, Node.js y otros componentes con sus propias licencias. Sus avisos se distribuyen en los archivos de licencia del runtime, incluidos `LICENSE.electron.txt` y `LICENSES.chromium.html` en el paquete de aplicación.
- **electron-builder y sus herramientas de empaquetado**: consultar sus licencias y las dependencias fijadas en `package-lock.json`. Se usan para construir los ejecutables; no se incorpora a la UI su código como una función de optimización.
- **Windows PowerShell, CIM y NVIDIA SMI**: herramientas del sistema o del fabricante, no redistribuidas por Apex.

No se incluyen Paragon Tweaking Utility, sus DLL, helpers ni otros ejecutables comerciales de referencia. La interfaz no descarga fuentes, iconos ni scripts externos. Los controles utilizan SVG locales y símbolos del sistema.

Antes de agregar o distribuir componentes nuevos, conserva sus textos de licencia completos y verifica sus condiciones. Los avisos de runtime no deben eliminarse del paquete.
