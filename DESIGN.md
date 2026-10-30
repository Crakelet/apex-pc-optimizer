---
name: Apex PC Optimizer
description: Aplicación de escritorio Windows con el diseño glass original y herramientas gratuitas.
colors:
  bg-deep: "#07080d"
  bg-sidebar: "rgba(13, 16, 28, 0.75)"
  glass-surface: "rgba(23, 30, 49, 0.63)"
  glass-surface-hover: "rgba(31, 42, 66, 0.76)"
  glass-border: "rgba(205, 225, 255, 0.13)"
  text-primary: "#ffffff"
  text-secondary: "#b3c1d6"
  text-muted: "#9aaac3"
  gaming: "#00f2fe"
  network: "#38bdf8"
  design: "#c084fc"
  clean: "#34d399"
  paragon-red: "#ff2a5f"
  focus: "#78eaf3"
typography:
  title:
    fontFamily: "'Plus Jakarta Sans', 'Segoe UI Variable', 'Segoe UI', sans-serif"
    fontSize: "21px"
    fontWeight: 800
    letterSpacing: "-0.3px"
  body:
    fontFamily: "'Plus Jakarta Sans', 'Segoe UI Variable', 'Segoe UI', sans-serif"
    fontSize: "13px"
  description:
    fontFamily: "'Plus Jakarta Sans', 'Segoe UI Variable', 'Segoe UI', sans-serif"
    fontSize: "12.5px"
    lineHeight: 1.65
  navigation:
    fontFamily: "'Plus Jakarta Sans', 'Segoe UI Variable', 'Segoe UI', sans-serif"
    fontSize: "13px"
    lineHeight: 1.4
rounded:
  sm: "8px"
  md: "12px"
  lg: "18px"
spacing:
  viewport: "27px 30px 36px"
  viewport-compact: "22px"
  header-bottom: "22px"
  sidebar: "16px 13px"
components:
  button-primary:
    textColor: "#000000"
    rounded: "{rounded.md}"
    padding: "9px 18px"
  button-secondary:
    backgroundColor: "rgba(255, 255, 255, 0.06)"
    textColor: "#f1f5f9"
    rounded: "{rounded.md}"
    padding: "9px 18px"
  panel:
    backgroundColor: "{colors.glass-surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
---

# Design System: Apex PC Optimizer

## Overview

La referencia visual es el diseño original de Apex, restaurado por petición del usuario: cristal oscuro, reflejos suaves, acentos cyan, rosa y violeta, tarjetas y medidores de escritorio. Los refinamientos conservan su navegación, jerarquía y personalidad. La interfaz plana reducida de cinco destinos queda descartada como referencia.

La aplicación conserva las herramientas gratuitas originales. Los cambios reales requieren una confirmación que explique su efecto; el modo de pruebas se identifica de forma persistente. Esta documentación describe lo implementado y no promete mejoras de rendimiento ni compatibilidad universal.

## Colors

El fondo profundo recibe reflejos radiales de baja opacidad. El cyan identifica juego y selección, azul la red, violeta el trabajo creativo, verde la limpieza y rosa las herramientas avanzadas. Conservar esta organización existente al añadir contenido.

Los textos secundarios y atenuados utilizan los valores de glass-refinements.css, que mejoran la legibilidad. El foco cyan es independiente del color de la herramienta. Disponibilidad, errores y modo de pruebas también se explican con texto.

## Typography

La familia preferida es Plus Jakarta Sans si está instalada, con fallback local a Segoe UI Variable y Segoe UI. No se descargan fuentes al abrir la aplicación. Títulos compactos y de peso alto mantienen la identidad; descripciones con interlineado amplio facilitan leer consecuencias y riesgos. Los datos ausentes se presentan como «No disponible» o «--» según el componente.

## Layout

El marco de escritorio combina barra superior propia, navegación lateral con scroll y área principal independiente. Se conservan las catorce secciones originales. No sustituirlas por una pantalla general de funciones futuras ni introducir planes de pago en esta versión.

La ventana parte de 1320 × 920 y admite un mínimo de 1040 × 720. En el ancho compacto se reduce el lateral de 250 a 228 px y el padding principal a 22 px. El texto de navegación no desplaza insignias; los elementos conservan al menos 44 px de altura. No se atribuye soporte móvil.

## Elevation & Depth

El glassmorphism es una preferencia explícita del usuario. Las superficies semitransparentes combinan blur, borde claro tenue, reflejo interior superior y sombra exterior oscura. Se mantiene el fondo radial visible a través del cristal. Las tarjetas comparten un relieve coherente; el diálogo añade profundidad para distinguir la revisión de la vista inferior.

Los refinamientos comparten --glass-surface, --glass-border y --glass-inner-shadow. Evitar más capas de brillo, sombras o gradientes sin una función visible. Las transiciones respetan prefers-reduced-motion.

## Shapes

La escala original usa radios de 8, 12 y 18 px. Controles, botones, tarjetas y diálogos conservan sus proporciones existentes. Las insignias de navegación permanecen en una línea y los textos largos no generan scroll horizontal en el lateral.

## Components

### Navigation and panels

La navegación activa combina superficie cyan tenue, reflejo interior y texto visible. Las herramientas mantienen su color por categoría. Las tarjetas reúnen título, descripción, estado y acción; su contenido explica lo que la operación hace realmente.

### Controls and focus

Botones, campos y checkboxes tienen foco de teclado visible. Durante una operación se bloquea el control pertinente y se restaura al terminar o cancelar. Los errores del backend se muestran como errores.

### Confirmation dialog

La revisión utiliza el diálogo glass original, con título, explicación, consecuencias y botones claros. Los mensajes normales describen el efecto sin exponer tablas crudas como «Actual / Solicitado / DWord». Cancelar conserva el estado previo. El foco entra al diálogo, permanece en él y vuelve al control de origen al cerrarlo.

### Readings and restoration

Los medidores usan datos disponibles y no inventan temperaturas, latencias o memoria liberada. Los respaldos corresponden a cambios propios de Apex; restaurar conserva cambios externos cuando hay un conflicto. Las limpiezas se describen como eliminación de caché y no como operaciones reversibles. Las preferencias GPU se restauran por aplicación desde su propio panel.

## Do's and Don'ts

- Conservar el diseño glass original y mejorar su legibilidad y comportamiento.
- Mantener todas las herramientas originales gratuitas; cualquier futura restricción requiere una decisión posterior del usuario.
- Distinguir el modo simulado y confirmar antes de cambios reales.
- Reutilizar tokens y componentes existentes.
- Mostrar errores, límites de lectura y resultados parciales con claridad.
- No prometer rendimiento, seguridad absoluta ni reversión de archivos eliminados.
- No recuperar la interfaz plana descartada ni su navegación reducida.
- No añadir «Próximamente», cuentas o pagos como sustituto de herramientas disponibles.
