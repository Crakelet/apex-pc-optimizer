/**
 * Módulo de Internacionalización (i18n) - Español & English
 * Proyecto Original por Crakelet (https://github.com/Crakelet/apex-pc-optimizer)
 */

const TRANSLATIONS = {
  es: {
    // Top Bar
    'app_title': 'Apex PC Optimizer',
    'app_author_badge': 'Oficial • por Crakelet',
    'btn_check_updates': '🔄 Actualizaciones',
    'search_placeholder': 'Buscar optimizaciones (ej: DNS, RAM, Shaders, Valorant)...',

    // Nav Items
    'nav_dashboard': 'Panel Principal',
    'nav_audit': 'Puntuación del PC',
    'nav_ram': 'Memoria RAM',
    'nav_hardware': 'Hardware Gamer',
    'nav_advanced_tools': 'Herramientas avanzadas',
    'nav_apex_pro': 'Nivel Apex & BIOS',
    'nav_games': 'Ajustes por Juego',
    'nav_gaming': 'Gaming & FPS',
    'nav_network': 'Red & Ping',
    'nav_design': 'Modo Diseño',
    'nav_services': 'Servicios Windows',
    'nav_privacy': 'Privacidad & IA',
    'nav_cleanup': 'Limpiador Disco',
    'nav_backup': 'Seguridad & Backup',

    // Nav Pills
    'pill_live': 'EN VIVO',
    'pill_win_cleaner': 'WinCleaner',
    'pill_xmp_disks': 'XMP & Discos',
    'pill_optimizer': 'Optimizer',
    'pill_pro': 'GRATIS',
    'pill_fps_pro': 'Por juego',
    'pill_latency': 'Latencia',
    'pill_dns_ping': 'DNS/Ping',
    'pill_render': 'Render',

    // Dashboard
    'dash_welcome': 'Bienvenido a Apex PC Optimizer',
    'dash_subtitle': 'Rendimiento, Optimización y Solución de Problemas Todo en Uno • Creado por Crakelet',
    'dash_pro_badge': 'Todas las herramientas incluidas',
    'dash_btn_sys_info': 'ℹ️ Info del Sistema',
    'dash_btn_changelog': '📋 Registro de cambios',
    'dash_score_label': 'Puntuación de optimización',
    'dash_last_clean': 'Última limpieza',
    'dash_gpu_status': 'Estado del controlador',
    'dash_areas_label': 'Áreas por revisar',
    'dash_btn_re_audit': '⚙️ Re-analizar',

    // Telemetry Gauges
    'gauge_cpu_cores': 'Núcleos Lógicos',
    'gauge_gpu_temp': 'Temp & Driver',
    'gauge_ram_free': 'Disponible',

    // Snappy UI
    'snappy_title': '⚡ Suite de Cero Retardo & Snappy UI (Windows 11 / 10)',
    'snappy_sub': 'Ajustes directos del registro para eliminar la pesadez visual de Windows, menús con lag, animaciones lentas y publicidad integrada.',
    'snappy_btn_all': '⚡ Aplicar Todo Cero Retardo',

    // Sidebar footer
    'btn_relaunch_admin': '⚡ Iniciar como Administrador',
    'btn_quick_restore': '🛡️ Crear Punto Restauración',
    'author_footer': 'Apex PC Optimizer • Proyecto original por Crakelet',

    // Update banner
    'update_badge': 'NUEVA ACTUALIZACIÓN',
    'update_btn_download': '⬇️ Descargar Actualización',
    'update_up_to_date': '✓ Ya tienes la última versión instalada'
  },
  en: {
    // Top Bar
    'app_title': 'Apex PC Optimizer',
    'app_author_badge': 'Official • by Crakelet',
    'btn_check_updates': '🔄 Updates',
    'search_placeholder': 'Search tweaks (e.g. DNS, RAM, Shaders, Valorant)...',

    // Nav Items
    'nav_dashboard': 'Dashboard',
    'nav_audit': 'PC Score',
    'nav_ram': 'RAM Memory',
    'nav_hardware': 'Gamer Hardware',
    'nav_advanced_tools': 'Advanced tools',
    'nav_apex_pro': 'Apex Level & BIOS',
    'nav_games': 'Per-Game Tweaks',
    'nav_gaming': 'Gaming & FPS',
    'nav_network': 'Network & Ping',
    'nav_design': 'Design Mode',
    'nav_services': 'Windows Services',
    'nav_privacy': 'Privacy & AI',
    'nav_cleanup': 'Disk Cleaner',
    'nav_backup': 'Security & Backup',

    // Nav Pills
    'pill_live': 'LIVE',
    'pill_win_cleaner': 'WinCleaner',
    'pill_xmp_disks': 'XMP & Drives',
    'pill_optimizer': 'Optimizer',
    'pill_pro': 'GRATIS',
    'pill_fps_pro': 'Por juego',
    'pill_latency': 'Latency',
    'pill_dns_ping': 'DNS/Ping',
    'pill_render': 'Render',

    // Dashboard
    'dash_welcome': 'Welcome to Apex PC Optimizer',
    'dash_subtitle': 'Performance, Optimization and System Diagnostics All-in-One • Created by Crakelet',
    'dash_pro_badge': 'All tools included',
    'dash_btn_sys_info': 'ℹ️ System Info',
    'dash_btn_changelog': '📋 Changelog',
    'dash_score_label': 'Optimization Score',
    'dash_last_clean': 'Last cleanup',
    'dash_gpu_status': 'Driver Status',
    'dash_areas_label': 'Areas to review',
    'dash_btn_re_audit': '⚙️ Re-Scan',

    // Telemetry Gauges
    'gauge_cpu_cores': 'Logical Cores',
    'gauge_gpu_temp': 'Temp & Driver',
    'gauge_ram_free': 'Available',

    // Snappy UI
    'snappy_title': '⚡ Zero Delay & Snappy UI Suite (Windows 11 / 10)',
    'snappy_sub': 'Direct registry tweaks to eliminate Windows UI lag, context menu delays, sluggish animations and embedded ads.',
    'snappy_btn_all': '⚡ Apply All Zero Delay',

    // Sidebar footer
    'btn_relaunch_admin': '⚡ Run as Administrator',
    'btn_quick_restore': '🛡️ Create Restore Point',
    'author_footer': 'Apex PC Optimizer • Original project by Crakelet',

    // Update banner
    'update_badge': 'NEW UPDATE',
    'update_btn_download': '⬇️ Download Update',
    'update_up_to_date': '✓ You are running the latest version'
  }
};

let currentLang = localStorage.getItem('apex_lang') || 'es';

function getLanguage() {
  return currentLang;
}

function t(key) {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.es;
  return dict[key] || TRANSLATIONS.es[key] || key;
}

function setLanguage(lang) {
  if (lang !== 'es' && lang !== 'en') lang = 'es';
  currentLang = lang;
  localStorage.setItem('apex_lang', lang);
  applyTranslations();
  updateLanguageToggleUI();
}

function toggleLanguage() {
  setLanguage(currentLang === 'es' ? 'en' : 'es');
}

function updateLanguageToggleUI() {
  const btn = document.getElementById('btn-lang-toggle');
  if (btn) {
    btn.innerHTML = currentLang === 'es' 
      ? '<span style="font-size: 13px;">🇪🇸 ES</span>' 
      : '<span style="font-size: 13px;">🇬🇧 EN</span>';
    btn.title = currentLang === 'es' ? 'Cambiar a Inglés' : 'Switch to Spanish';
  }
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const text = t(key);
    if (text) el.textContent = text;
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const text = t(key);
    if (text) el.placeholder = text;
  });

  updateLanguageToggleUI();
}

// Exportar globalmente para renderer.js
if (typeof window !== 'undefined') {
  window.i18n = {
    t,
    getLanguage,
    setLanguage,
    toggleLanguage,
    applyTranslations
  };
}
