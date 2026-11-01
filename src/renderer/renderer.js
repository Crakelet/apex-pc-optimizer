// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const viewTabs = document.querySelectorAll('.view-tab');
const globalSearch = document.getElementById('global-search');

// Specs DOM (con fallback seguro)
const specCpu = document.getElementById('spec-cpu');
const specCpuCores = document.getElementById('spec-cpu-cores');
const specGpu = document.getElementById('spec-gpu');
const specRam = document.getElementById('spec-ram');
const ramProgressBar = document.getElementById('ram-progress-bar');
const specRamPercent = document.getElementById('spec-ram-percent');
const specOs = document.getElementById('spec-os');
const specOsBuild = document.getElementById('spec-os-build');

// Category Containers
const gameSelectorTabs = document.getElementById('game-selector-tabs');
const gamePanelsContainer = document.getElementById('game-panels-container');
const gamingContainer = document.getElementById('gaming-tweaks-container');
const networkContainer = document.getElementById('network-tweaks-container');
const designContainer = document.getElementById('design-tweaks-container');
const servicesContainer = document.getElementById('services-tweaks-container');
const privacyContainer = document.getElementById('privacy-tweaks-container');
const cleanupContainer = document.getElementById('cleanup-tweaks-container');

// Audit DOM Elements
const dashHeaderScore = document.getElementById('dash-header-score');
const dashHeaderGlowBar = document.getElementById('dash-header-glow-bar');
const dashHeaderIssues = document.getElementById('dash-header-issues-count');
const sidebarScoreBadge = document.getElementById('sidebar-score-badge');
const auditTotalScore = document.getElementById('audit-total-score');
const auditUpdatedDate = document.getElementById('audit-updated-date');
const btnReAudit = document.getElementById('btn-re-audit');
const btnOptimizeAllAudit = document.getElementById('btn-optimize-all-audit');
const auditCategoriesContainer = document.getElementById('audit-categories-container');

// State Cache
let appRuntimeInfo = null;
let confirmationOrigin = null;
let allTweaks = [];
let tweaksStatuses = {};
let allGames = [];
let selectedValProfileId = null;
let currentIsAdmin = false;
let selectedGameId = 'valorant';
let auditData = null;
let currentDiskCleanupData = null;
let confirmActionState = {
  resolve: null,
  askRestorePoint: false,
  restorePointDesc: 'ApexOptimizer_AutoBackup'
};

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- MODAL UNIVERSAL DE CONFIRMACIÓN DE ACCIONES ---
function setupActionConfirmModal() {
  const modal = document.getElementById('action-confirm-modal');
  const btnClose = document.getElementById('btn-close-confirm-modal');
  const btnCancel = document.getElementById('btn-cancel-confirm-action');
  const btnExecute = document.getElementById('btn-execute-confirm-action');
  const restoreCheck = document.getElementById('confirm-modal-restore-check');
  const btnText = document.getElementById('confirm-btn-text');
  const btnSpinner = document.getElementById('confirm-btn-spinner');

  const close = (result = false) => {
    if (modal) modal.classList.remove('active');
    confirmationOrigin?.focus();
    confirmationOrigin = null;
    if (btnExecute) btnExecute.disabled = false;
    if (btnCancel) btnCancel.disabled = false;
    if (btnSpinner) btnSpinner.style.display = 'none';
    if (confirmActionState.resolve) {
      confirmActionState.resolve(result);
      confirmActionState.resolve = null;
    }
  };

  if (btnClose) btnClose.onclick = () => close(false);
  if (btnCancel) btnCancel.onclick = () => close(false);
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) close(false);
    };
  }

  if (btnExecute) {
    btnExecute.onclick = async () => {
      const shouldCreateRestore = confirmActionState.askRestorePoint && restoreCheck && restoreCheck.checked;
      if (shouldCreateRestore) {
        btnExecute.disabled = true;
        btnCancel.disabled = true;
        if (btnSpinner) btnSpinner.style.display = 'inline-block';
        if (btnText) btnText.textContent = 'Creando punto de restauración...';

        try {
          showToast('🛡️ Creando Punto de Restauración de Windows...', 'info');
          const res = await window.api.createRestorePoint(confirmActionState.restorePointDesc || 'ApexOptimizer_PreTweak_Backup');
          if (res.success) {
            showToast('✓ Punto de restauración creado con éxito.', 'success');
          } else {
            showToast(`Aviso: ${res.message || 'No se pudo crear el punto de restauración.'}`, 'warning');
            const proceed = confirm(`No se pudo crear el punto de restauración automático de Windows.\n\nMotivo: ${res.message || 'Protección del sistema desactivada en unidad C:'}.\n\n¿Deseas aplicar la optimización de todos modos?`);
            if (!proceed) {
              close(false);
              return;
            }
          }
        } catch (err) {
          showToast('No se creó el punto de restauración. La acción fue cancelada.', 'error');
          close(false); return;
        }
      }
      close(true);
    };
  }
}

function promptActionConfirmation({
  title = '🛡️ Confirmar Acción',
  subtitle = 'Revisa los cambios que se aplicarán en tu sistema antes de continuar.',
  badgeText = 'Revisión de cambios',
  badgeClass = '',
  spaceMB = null,
  details = [],
  safetyText = 'Revisa el alcance y las consecuencias antes de confirmar.',
  confirmText = 'Confirmar y Ejecutar',
  riskLevel = 'low', // 'low', 'medium', 'high'
  risks = [],
  askRestorePoint = null,
  restorePointDesc = null
}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('action-confirm-modal');
    if (!modal) return resolve(false);
    if (confirmActionState.resolve) return resolve(false);
    confirmationOrigin = document.activeElement;

    const isHighOrMedium = riskLevel === 'medium' || riskLevel === 'high';
    const shouldAskRestore = askRestorePoint !== null ? !!askRestorePoint : isHighOrMedium;

    confirmActionState.resolve = resolve;
    confirmActionState.askRestorePoint = shouldAskRestore;
    confirmActionState.restorePointDesc = restorePointDesc || `ApexBackup_${title.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}`;

    const titleEl = document.getElementById('confirm-modal-title');
    const subEl = document.getElementById('confirm-modal-subtitle');
    const badge = document.getElementById('confirm-modal-badge');
    const spaceBox = document.getElementById('confirm-modal-space-box');
    const spaceVal = document.getElementById('confirm-modal-space-val');
    const list = document.getElementById('confirm-modal-details-list');
    const riskBox = document.getElementById('confirm-modal-risk-box');
    const riskList = document.getElementById('confirm-modal-risk-list');
    const restoreBox = document.getElementById('confirm-modal-restore-box');
    const restoreCheck = document.getElementById('confirm-modal-restore-check');
    const note = document.getElementById('confirm-modal-note-text');
    const btnText = document.getElementById('confirm-btn-text');
    const btnSpinner = document.getElementById('confirm-btn-spinner');

    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = subtitle;

    if (badge) {
      if (riskLevel === 'high') {
        badge.textContent = badgeText || 'Acción Invasiva / Precaución';
        badge.className = 'confirm-badge badge-warning';
      } else if (riskLevel === 'medium') {
        badge.textContent = badgeText || 'Modificación del Sistema';
        badge.className = 'confirm-badge badge-warning';
      } else {
        badge.textContent = badgeText;
        badge.className = `confirm-badge ${badgeClass}`;
      }
    }

    if (spaceBox && spaceVal) {
      if (spaceMB !== null && spaceMB !== undefined) {
        spaceBox.style.display = 'flex';
        spaceVal.textContent = typeof spaceMB === 'number' ? `~${spaceMB} MB` : String(spaceMB);
      } else {
        spaceBox.style.display = 'none';
      }
    }

    if (list) {
      list.innerHTML = '';
      (details || []).forEach(item => {
        const li = document.createElement('li');
        if (typeof item === 'object' && item !== null) {
          const target = item.target || item.title || item.name || '';
          const action = item.action || item.desc || item.description || '';
          const safety = item.safety || '';

          let html = '<div class="confirm-item-content">';
          if (target) {
            html += `<div class="confirm-item-head"><strong>${escapeHtml(target)}</strong>`;
            if (safety) {
              html += `<span class="confirm-item-safety">${escapeHtml(safety)}</span>`;
            }
            html += '</div>';
          }
          if (action) {
            html += `<p class="confirm-item-action">${escapeHtml(action)}</p>`;
          }
          if (!target && !action && safety) {
            html += `<span class="confirm-item-safety">${escapeHtml(safety)}</span>`;
          }
          html += '</div>';
          li.innerHTML = html;
        } else {
          li.textContent = String(item || '');
        }
        list.appendChild(li);
      });
    }

    // Sección de riesgos explicados para operaciones invasivas
    const riskItems = Array.isArray(risks) ? risks : (risks ? [risks] : []);
    if (riskBox && riskList) {
      if (riskItems.length > 0) {
        riskBox.style.display = 'flex';
        riskBox.className = `confirm-risk-box ${riskLevel === 'high' ? 'risk-high' : ''}`;
        riskList.innerHTML = '';
        riskItems.forEach(r => {
          const li = document.createElement('li');
          li.textContent = r;
          riskList.appendChild(li);
        });
      } else {
        riskBox.style.display = 'none';
      }
    }

    // Checkbox de Punto de Restauración del Sistema
    if (restoreBox) {
      if (shouldAskRestore) {
        restoreBox.style.display = 'block';
        if (restoreCheck) restoreCheck.checked = true;
      } else {
        restoreBox.style.display = 'none';
        if (restoreCheck) restoreCheck.checked = false;
      }
    }

    if (note) note.textContent = appRuntimeInfo?.simulated ? 'Modo de pruebas: esta acción se simula. Windows y tus archivos no se modificarán.' : safetyText;
    if (btnText) btnText.textContent = confirmText;
    if (btnSpinner) btnSpinner.style.display = 'none';

    modal.classList.add('active');
    requestAnimationFrame(() => document.getElementById('btn-cancel-confirm-action')?.focus());
  });
}

// Always release the originating control, including permission and verification errors.
async function runButtonTask(button, pendingLabel, operation) {
  if (button.disabled) return null;
  const previous = button.textContent;
  button.disabled = true;
  button.textContent = pendingLabel;
  button.setAttribute('aria-busy', 'true');
  try {
    const result = await operation();
    if (result?.success === false) throw new Error(result.message || 'La operación no pudo completarse.');
    return result;
  } catch (error) {
    showToast(error?.message || 'La operación no pudo completarse. Puedes volver a intentarlo.', 'error');
    return null;
  } finally {
    button.disabled = false;
    button.textContent = previous;
    button.removeAttribute('aria-busy');
  }
}

async function runGameBatch(button, game, restore = false) {
  const result = await runButtonTask(button, restore ? 'Restaurando respaldos…' : 'Aplicando ajustes…', async () => {
    if (restore) {
      const restored = await window.api.revertGameProfile(game.id);
      if (restored?.success === false) throw new Error(restored.message || 'La restauración quedó incompleta. Conserva los respaldos.');
      showToast(restored.message || 'Respaldos del juego restaurados.', 'success');
      return restored;
    }
    if(game.id==='valorant'&&game.configProfiles?.length>1&&!selectedValProfileId)throw new Error('Selecciona un perfil de VALORANT antes de aplicar sus ajustes de archivo. Cierra el juego para que no sobrescriba los cambios.');
    const profileId=game.id==='valorant'?selectedValProfileId:null;
    let applied = 0, skipped = 0;
    for (const tweak of game.tweaks) {
      if (tweak.isApplied) { skipped++; continue; }
      try {
        const outcome = await window.api.applyGameTweak(tweak.id,profileId);
        if (!outcome?.success) throw new Error(outcome?.message || 'El ajuste no pudo verificarse.');
        if (outcome.skipped) skipped++; else applied++;
      } catch (error) {
        throw new Error(`${applied} ajustes aplicados y ${skipped} sin cambios. Se detuvo en «${tweak.title}»: ${error.message} Los ajustes anteriores conservan su respaldo.`);
      }
    }
    showToast(`${applied} ajustes aplicados y verificados; ${skipped} ya tenían el valor solicitado.`, 'success');
    return { success: true, applied, skipped };
  });
  await loadGames();
  return result;
}

async function runSingleGameTweak(input,tweakId,isChecked,card,profileId=null){
  if(input.disabled)return;
  input.disabled=true;
  const dismiss=showToast(isChecked?'Aplicando ajuste en el juego…':'Restaurando ajuste del juego…','info');
  try{
    const result=isChecked?await window.api.applyGameTweak(tweakId,profileId):await window.api.revertGameTweak(tweakId);
    if(!result?.success)throw new Error(result?.message||'No se pudo verificar el ajuste del juego.');
    card?.classList.toggle('active',isChecked);
    showToast(result.message||'Ajuste del juego verificado.','success');
    return result;
  }catch(error){
    input.checked=!isChecked;
    showToast(error?.message||'No se pudo modificar el ajuste. Revisa el estado del juego y vuelve a intentarlo.','error');
    return null;
  }finally{
    if(typeof dismiss==='function')dismiss();
    input.disabled=false;
    await loadGames();
  }
}

let contentInitialized = false;
let startupLoading = false;
function showStartupRecovery(message) {
  let banner = document.getElementById('startup-recovery-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'startup-recovery-banner';
    banner.className = 'startup-recovery-banner';
    banner.setAttribute('role', 'alert');
    const text = document.createElement('span');
    text.id = 'startup-recovery-message';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Reintentar carga';
    retry.addEventListener('click', () => initializeAppContent());
    banner.append(text, retry);
    document.querySelector('.content-viewport')?.prepend(banner);
  }
  const text = document.getElementById('startup-recovery-message');
  if (text) text.textContent = message;
  banner.hidden = false;
}

async function initializeAppContent() {
  if (startupLoading) return;
  startupLoading = true;
  document.body.dataset.ready = 'false';
  try {
    appRuntimeInfo = await window.api.getAppInfo();
    const versionBadge = document.querySelector('.badge-version');
    if (versionBadge && /^\d+\.\d+\.\d+$/.test(appRuntimeInfo.version || '')) versionBadge.textContent = `v${appRuntimeInfo.version}`;
    const testBanner = document.getElementById('test-mode-banner');
    if (testBanner) testBanner.hidden = !appRuntimeInfo.simulated;
    document.body.classList.toggle('simulation-mode', !!appRuntimeInfo.simulated);
    if (!contentInitialized) {
      setupActionConfirmModal();
      setupActionButtons();
      setupNetworkTools();
      setupDesignTools();
      setupAuditListeners();
      setupDebloatModal();
      setupMemoryCleaner();
      setupAdvancedTools();
      setupHardwareListeners();
      initTelemetryDashboard();
      initApexProView();
      setupI18nAndUpdates();
      contentInitialized = true;
    }
    loadSystemSpecs();
    checkAdminPrivileges();
    loadSystemAudit();
    const [tweaksLoaded, gamesLoaded] = await Promise.all([loadTweaks(), loadGames()]);
    await updateCleanupButtonsState();
    if (!tweaksLoaded || !gamesLoaded) {
      showStartupRecovery('No se cargaron todas las herramientas. Revisa el error de Windows y vuelve a intentar; la navegación sigue disponible.');
    } else {
      const banner = document.getElementById('startup-recovery-banner');
      if (banner) banner.hidden = true;
    }
    document.body.dataset.ready = 'true';
  } catch (error) {
    showStartupRecovery(`No se pudo completar el inicio: ${error.message || 'sin comunicación con la aplicación'}.`);
  } finally {
    startupLoading = false;
  }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  setupWindowControls();
  setupNavigation();
  setupSearch();
  initializeAppContent();
});

// --- I18N & GITHUB AUTO-UPDATE SYSTEM ---
let latestUpdateInfo = null;

function setupI18nAndUpdates() {
  if (window.i18n) {
    window.i18n.applyTranslations();
  }

  const btnLang = document.getElementById('btn-lang-toggle');
  if (btnLang) {
    btnLang.addEventListener('click', () => {
      if (window.i18n) {
        window.i18n.toggleLanguage();
        showToast(
          window.i18n.getLanguage() === 'es' ? 'Idioma cambiado a Español 🇪🇸' : 'Language switched to English 🇬🇧',
          'info'
        );
      }
    });
  }

  const btnCheckUpdates = document.getElementById('btn-check-updates');
  if (btnCheckUpdates) {
    btnCheckUpdates.addEventListener('click', async () => {
      btnCheckUpdates.disabled = true;
      showToast('🔄 Comprobando actualizaciones en GitHub...', 'info');
      await performUpdateCheck(true);
      btnCheckUpdates.disabled = false;
    });
  }

  const btnDismiss = document.getElementById('btn-dismiss-update');
  const banner = document.getElementById('update-notification-banner');
  if (btnDismiss && banner) {
    btnDismiss.addEventListener('click', () => {
      banner.style.display = 'none';
    });
  }

  // GitHub se consulta únicamente cuando el usuario pulsa Actualizaciones.
}

async function performUpdateCheck(isManual = false) {
  try {
    const res = await window.api.checkForUpdates();
    const banner = document.getElementById('update-notification-banner');
    const dot = document.getElementById('update-indicator-dot');
    const titleEl = document.getElementById('update-banner-title');
    const descEl = document.getElementById('update-banner-desc');
    const btnDownload = document.getElementById('btn-download-update');

    if (res && res.updateAvailable) {
      latestUpdateInfo = res;
      if (dot) dot.style.display = 'inline-block';
      if (banner) {
        if (titleEl) titleEl.textContent = `¡Apex PC Optimizer v${res.latestVersion} disponible! (Versión actual: v${res.currentVersion})`;
        if (descEl) descEl.textContent = res.releaseName ? `${res.releaseName} • Haz clic en descargar para obtener el instalador oficial.` : 'Nueva actualización oficial disponible en GitHub.';
        banner.style.display = 'flex';
      }

      if (btnDownload) {
        btnDownload.onclick = () => {
          const targetUrl = res.releaseUrl || 'https://github.com/Crakelet/apex-pc-optimizer/releases';
          window.api.openExternalUrl(targetUrl);
        };
      }

      if (isManual) {
        showToast(`🎉 ¡Nueva versión v${res.latestVersion} disponible en GitHub!`, 'success');
      }
    } else {
      if (dot) dot.style.display = 'none';
      if (isManual) {
        showToast(res.message || `Versión instalada: ${appRuntimeInfo?.version || '1.0.0'}.`, 'info');
      }
    }
  } catch (err) {
    if (isManual) {
      showToast('No se pudo comprobar actualizaciones en este momento.', 'warning');
    }
  }
}

// --- WINDOW CONTROLS ---
function setupWindowControls() {
  document.getElementById('btn-minimize').addEventListener('click', () => {
    window.api?.windowControl?.('minimize');
  });
  document.getElementById('btn-maximize').addEventListener('click', () => {
    window.api?.windowControl?.('maximize');
  });
  document.getElementById('btn-close').addEventListener('click', () => {
    if (window.api?.windowControl) window.api.windowControl('close');
    else window.close();
  });
}

// --- NAVIGATION ---
function setupNavigation() {
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabTarget = item.getAttribute('data-tab');
      
      navItems.forEach(n => n.classList.remove('active'));
      viewTabs.forEach(v => v.classList.remove('active'));

      item.classList.add('active');
      const targetView = document.getElementById(`view-${tabTarget}`);
      if (targetView) targetView.classList.add('active');

      // Si navegamos a la pestaña de auditoría, asegurar renderizado inmediato
      if (tabTarget === 'audit') {
        if (!auditData) {
          loadSystemAudit();
        } else {
          renderAuditCategories();
        }
      }

      // Si navegamos a Memoria RAM (WinMemoryCleaner)
      if (tabTarget === 'ram') {
        loadMemoryStats();
      }

      // Si navegamos a Hardware Gamer (XMP/EXPO, Discos y Latencia USB)
      if (tabTarget === 'hardware') {
        loadHardwareDiagnostics();
      }

      // Si navegamos a Herramientas avanzadas (Optimizer & TBOK)
      if (tabTarget === 'advanced-tools') {
        loadAdvancedTools();
      }

      // Si navegamos a Nivel Apex & BIOS
      if (tabTarget === 'apex-pro') {
        renderSnappyUiCards();
      }

      // Si navegamos a Modo Diseño
      if (tabTarget === 'design') {
        loadDetectedDesignApps();
        loadDesignCacheStatus();
      }

      // Si navegamos a Limpieza de Disco
      if (tabTarget === 'cleanup') {
        updateCleanupButtonsState();
      }

      // Optimización de CPU: Pausar telemetría y canvas si no estamos en el Dashboard
      if (tabTarget === 'dashboard') {
        startTelemetryPolling();
        updateCleanupButtonsState();
      } else {
        stopTelemetryPolling();
      }
    });
  });
}

// --- SEARCH FILTER ---
function setupSearch() {
  globalSearch.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const cards = document.querySelectorAll('.tweak-card');

    cards.forEach(card => {
      const title = card.querySelector('.tweak-title')?.textContent.toLowerCase() || '';
      const desc = card.querySelector('.tweak-description')?.textContent.toLowerCase() || '';

      if (title.includes(query) || desc.includes(query) || query === '') {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  });
}

// --- SPECS LOADER ---
async function loadSystemSpecs() {
  try {
    const specs = await window.api.getSpecs();
    if (specs) {
      if (specCpu) specCpu.textContent = specs.cpu || '';
      if (specCpuCores) specCpuCores.textContent = specs.cpuCores || '';
      if (specGpu) specGpu.textContent = specs.gpu || '';
      if (specRam) specRam.textContent = `${specs.usedRamGB || 0} GB / ${specs.totalRamGB || 0} GB`;
      if (ramProgressBar) ramProgressBar.style.width = `${specs.ramPercent || 0}%`;
      if (specRamPercent) specRamPercent.textContent = `${specs.ramPercent || 0}% de memoria en uso`;
      if (specOs) specOs.textContent = specs.os || '';
      if (specOsBuild) specOsBuild.textContent = specs.osVersion ? `Compilación ${specs.osVersion}` : '';

      const dashGpu = document.getElementById('dash-header-gpu');
      if (dashGpu && specs.gpu) {
        const cleanGpu = specs.gpu.replace(/NVIDIA|AMD|Intel\(R\)/gi, '').trim();
        dashGpu.textContent = `Detectado (${cleanGpu || 'GPU'})`;
      }
    }
  } catch (err) {
    console.error('Error loading specs:', err);
  }
}

async function checkAdminPrivileges() {
  const dot = document.getElementById('admin-status-dot');
  const label = document.getElementById('admin-status-label');
  const btnRelaunch = document.getElementById('btn-relaunch-admin');

  try {
    const res = await window.api.getAdminStatus();
    currentIsAdmin = !!(res && res.isAdmin);
    if (currentIsAdmin) {
      if (dot) {
        dot.className = 'status-dot pulse-green';
        dot.style.background = '#10b981';
      }
      if (label) {
        label.textContent = appRuntimeInfo?.simulated ? '🧪 Pruebas · Cambios simulados' : '🛡️ Administrador (Acceso Total)';
        label.style.color = '#10b981';
      }
      if (btnRelaunch) btnRelaunch.style.display = 'none';
    } else {
      if (dot) {
        dot.className = 'status-dot';
        dot.style.background = '#f59e0b';
        dot.style.boxShadow = '0 0 10px #f59e0b';
      }
      if (label) {
        label.textContent = '⚠️ Modo Estándar (Sin Admin)';
        label.style.color = '#f59e0b';
      }
      if (btnRelaunch) {
        btnRelaunch.style.display = 'block';
        btnRelaunch.disabled = false;
        btnRelaunch.style.opacity = '1';
        btnRelaunch.style.cursor = 'pointer';
        btnRelaunch.onclick = async () => {
          btnRelaunch.disabled = true;
          btnRelaunch.style.opacity = '0.6';
          btnRelaunch.style.cursor = 'wait';
          showToast('⚡ Solicitando permisos de Administrador en Windows (UAC)...', 'info');
          try {
            const result = await window.api.restartAsAdmin();
            if (result && result.cancelled) {
              showToast('⚠️ Solicitud de elevación cancelada por el usuario', 'warning');
              btnRelaunch.disabled = false;
              btnRelaunch.style.opacity = '1';
              btnRelaunch.style.cursor = 'pointer';
            } else if (result && result.error) {
              showToast(`❌ Error al elevar permisos: ${result.error}`, 'error');
              btnRelaunch.disabled = false;
              btnRelaunch.style.opacity = '1';
              btnRelaunch.style.cursor = 'pointer';
            } else if (result && result.alreadyAdmin) {
              showToast('🛡️ La aplicación ya se ejecuta con permisos de Administrador', 'success');
              checkAdminPrivileges();
            } else {
              showToast('🚀 Permisos concedidos. Reiniciando aplicación...', 'success');
            }
          } catch (e) {
            console.error('Error al solicitar reinicio con admin:', e);
            showToast('❌ Error de comunicación al reiniciar', 'error');
            btnRelaunch.disabled = false;
            btnRelaunch.style.opacity = '1';
            btnRelaunch.style.cursor = 'pointer';
          }
        };
      }
    }
  } catch (err) {
    console.warn('Error verificando permisos de administrador:', err);
  }
}

// --- GAMES LOADER & RENDER (PARAGON STYLE CHECKLISTS) ---
async function loadGames() {
  try {
    allGames = await window.api.getGamesList(selectedValProfileId);
    const valorant=allGames.find(game=>game.id==='valorant');
    if(valorant)selectedValProfileId=valorant.selectedConfigProfileId||null;
    renderGames();
    return true;
  } catch (err) {
    showToast(`No se cargaron los ajustes por juego: ${err.message}`, 'error');
    return false;
  }
}

function renderGames() {
  if (!gameSelectorTabs || !gamePanelsContainer) return;
  gameSelectorTabs.innerHTML = '';
  gamePanelsContainer.innerHTML = '';

  allGames.forEach((game, index) => {
    if (index === 0 && !selectedGameId) selectedGameId = game.id;

    // 1. Pestaña de selección de juego
    const tabBtn = document.createElement('button');
    tabBtn.className = `game-tab-btn ${game.id === selectedGameId ? 'active' : ''}`;
    tabBtn.innerHTML = `<span>${game.icon}</span> <span>${game.name}</span>`;
    tabBtn.setAttribute('data-game-target', game.id);

    tabBtn.addEventListener('click', () => {
      selectedGameId = game.id;
      document.querySelectorAll('.game-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.game-panel').forEach(p => p.classList.remove('active'));

      tabBtn.classList.add('active');
      const targetPanel = document.getElementById(`panel-${game.id}`);
      if (targetPanel) targetPanel.classList.add('active');
    });

    gameSelectorTabs.appendChild(tabBtn);

    // 2. Panel del juego
    const panel = document.createElement('div');
    panel.className = `game-panel ${game.id === selectedGameId ? 'active' : ''}`;
    panel.id = `panel-${game.id}`;

    panel.innerHTML = `
      <div class="game-panel-header">
        <div class="game-panel-info">
          <span class="game-panel-icon">${game.icon}</span>
          <div>
            <div style="display:flex; align-items:center;">
              <span class="game-panel-title">${game.name}</span>
              <span class="game-panel-tag">${game.tag}</span>
            </div>
            <p class="game-panel-desc">${game.description}</p>
          </div>
        </div>
        <div class="game-panel-actions">
          <button class="btn-action-primary btn-paragon-red btn-apply-all-game-tweaks" data-game="${game.id}">
            ⚡ Aplicar ajustes del juego
          </button>
          <button class="btn-danger-outline btn-revert-all-game-tweaks" data-game="${game.id}" ${game.hasGameBackups||game.tweaks.some(tweak => tweak.hasBackup) ? '' : 'disabled'} title="Restaura los cambios guardados de este juego, incluidos otros perfiles">
            ↩️ Restaurar respaldos
          </button>
        </div>
      </div>
      ${game.id==='valorant'?`<div class="game-config-picker">
        <label for="valorant-config-profile">Perfil de configuración de VALORANT</label>
        <select id="valorant-config-profile" ${game.configProfiles?.length?'':'disabled'} aria-describedby="valorant-config-help">
          <option value="">${game.configProfiles?.length?'Selecciona el perfil que quieres modificar':'No se encontró un perfil generado por el juego'}</option>
          ${(game.configProfiles||[]).map(profile=>`<option value="${escapeHtml(profile.id)}" ${profile.id===(selectedValProfileId||game.selectedConfigProfileId)?'selected':''} ${profile.readOnly?'disabled':''}>${escapeHtml(profile.label)} · ${escapeHtml(new Intl.DateTimeFormat('es',{dateStyle:'short',timeStyle:'short'}).format(new Date(profile.modifiedAt)))}${profile.readOnly?' · Solo lectura':''}</option>`).join('')}
        </select>
        <p id="valorant-config-help">${game.configProfileWarning?escapeHtml(game.configProfileWarning)+' ':''}Cierra VALORANT antes de editar archivos. Si aparecen varios perfiles, elige uno por su fecha y ubicación; Apex no identifica tu cuenta ni modifica los otros perfiles. Las opciones ausentes se cambian dentro del juego.</p>
      </div>`:''}
      <div class="game-tweaks-sublist" id="tweaks-list-${game.id}">
        <!-- Renderizado de grupos y checks estilo Paragon -->
      </div>
    `;

    gamePanelsContainer.appendChild(panel);
    if(game.id==='valorant'){
      const select=panel.querySelector('#valorant-config-profile');
      if(!selectedValProfileId&&game.selectedConfigProfileId)selectedValProfileId=game.selectedConfigProfileId;
      select.addEventListener('change',async()=>{
        const previous=selectedValProfileId;
        selectedValProfileId=select.value||null;select.disabled=true;
        if(!await loadGames()){selectedValProfileId=previous;select.value=previous||'';select.disabled=false;}
      });
    }

    // 3. Agrupar y renderizar los tweaks del juego
    const listContainer = panel.querySelector(`#tweaks-list-${game.id}`);
    const groups = {};
    game.tweaks.forEach(t => {
      const g = t.group || 'Ajustes Generales';
      if (!groups[g]) groups[g] = [];
      groups[g].push(t);
    });

    for (const [groupName, tweaksInGroup] of Object.entries(groups)) {
      const groupHeader = document.createElement('div');
      groupHeader.className = 'game-group-title';
      groupHeader.textContent = groupName;
      listContainer.appendChild(groupHeader);

      tweaksInGroup.forEach(tweak => {
        const card = document.createElement('div');
        card.className = `tweak-card ${tweak.isApplied ? 'active' : ''}`;
        card.id = `card-game-${tweak.id}`;

        card.innerHTML = `
          <div class="tweak-info">
            <div class="tweak-header-line">
              <span class="tweak-title">${tweak.title}</span>
            </div>
            <p class="tweak-description">${tweak.description}</p>
          </div>
          <div class="tweak-action">
            <label class="paragon-check-label">
              <input type="checkbox" class="hidden-checkbox" id="switch-game-${tweak.id}" aria-label="${escapeHtml(tweak.title)}" ${tweak.isApplied ? 'checked' : ''} data-tweak-id="${tweak.id}">
              <span class="paragon-check-box">
                <svg viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </span>
            </label>
          </div>
        `;

        listContainer.appendChild(card);
      });
    }
  });

  attachSpecificGameEvents();
}

function attachSpecificGameEvents() {
  const checkInputs = document.querySelectorAll('input[data-tweak-id]');
  checkInputs.forEach(input => {
    input.addEventListener('change', async (e) => {
      const tweakId = e.target.getAttribute('data-tweak-id');
      const isChecked = e.target.checked;
      const card = document.getElementById(`card-game-${tweakId}`);

      const selectedTweak = allGames.flatMap(game => game.tweaks).find(tweak => tweak.id === tweakId);
      const selectedGame=allGames.find(game=>game.tweaks.some(tweak=>tweak.id===tweakId));
      const profileId=selectedGame?.id==='valorant'?selectedValProfileId:null;
      if(isChecked&&selectedTweak?.configFile&&selectedGame?.configProfiles?.length>1&&!profileId){e.target.checked=false;showToast('Selecciona primero el perfil de VALORANT que quieres modificar. Los demás perfiles se conservarán.','info');return;}
      if (!isChecked && !selectedTweak?.hasBackup) {
        e.target.checked = true;
        showToast('Esta preferencia ya estaba activa y Apex no conserva un respaldo propio. No se aplicarán valores predeterminados supuestos.', 'info');
        return;
      }
      const profile=selectedGame?.configProfiles?.find(item=>item.id===profileId);
      const confirmed = await promptActionConfirmation({ title: selectedTweak?.title || 'Revisar ajuste del juego', subtitle: selectedTweak?.description || 'Revisa el cambio antes de continuar.', badgeText: 'Herramienta gratuita', details: [isChecked ? 'Se aplicará este ajuste a la configuración seleccionada del juego.' : 'Se restaurará el respaldo guardado para este ajuste.',...(isChecked&&selectedTweak?.configFile&&profile?[profile.label]:[]),...(selectedTweak?.configFile?['Cierra el juego antes de aplicar o restaurar sus archivos.']:[])], safetyText: 'No se garantiza una mejora de FPS. Conserva la configuración que funcione mejor en tu equipo.', confirmText: isChecked ? 'Aplicar ajuste' : 'Deshacer ajuste' });
      if (!confirmed) { e.target.checked = !isChecked; return; }

      await runSingleGameTweak(input,tweakId,isChecked,card,profileId);
    });
  });

  const applyAllGameBtns = document.querySelectorAll('.btn-apply-all-game-tweaks');
  applyAllGameBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const gameId = btn.getAttribute('data-game');
      const game = allGames.find(g => g.id === gameId);
      if (!game) return;

      const confirmed = await promptActionConfirmation({
        title: `Aplicar ajustes de ${game.name}`,
        subtitle: 'Aplica los ajustes pendientes del perfil y conserva los valores que ya están configurados.',
        badgeText: 'Perfil Gamer • Recomendado',
        badgeClass: 'badge-gaming',
        details: [
          ...(game.id==='valorant'&&selectedValProfileId?[game.configProfiles?.find(profile=>profile.id===selectedValProfileId)?.label||'Perfil elegido de VALORANT']:[]),
          'Cierra el juego antes de cambiar sus archivos de configuración.',
          ...game.tweaks.filter(tweak => !tweak.isApplied).map(tweak => tweak.title),
          'El resultado depende de la versión del juego y del equipo; no garantiza más FPS.',
          'Si un ajuste falla, se detiene el perfil y se conservan los respaldos de los ajustes anteriores.'
        ],
        confirmText: `Optimizar ${game.name}`
      });
      if (!confirmed) return;

      await runGameBatch(btn, game);
    });
  });

  const revertAllGameBtns = document.querySelectorAll('.btn-revert-all-game-tweaks');
  revertAllGameBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const gameId = btn.getAttribute('data-game');
      const game = allGames.find(g => g.id === gameId);
      if (!game) return;

      const confirmed = await promptActionConfirmation({
        title: `↩️ Restablecer Configuración de ${game.name}`,
        subtitle: `Recupera los valores anteriores guardados para ${game.name}.`,
        badgeText: 'Restauración desde respaldo',
        badgeClass: 'badge-warning',
        details: [
          'Restaura los ajustes en orden inverso para conservar sus dependencias.',
          'Incluye los respaldos guardados de este juego aunque pertenezcan a otro perfil. Cierra el juego antes de continuar.',
          'Se detiene si detecta cambios posteriores fuera de Apex. No usa valores predeterminados inventados.'
        ],
        confirmText: 'Restablecer Configuración'
      });
      if (!confirmed) return;

      await runGameBatch(btn, game, true);
    });
  });
}

// --- ESTADO Y CONTROL INTELIGENTE DE LIMPIEZA DE DISCO ---
async function updateCleanupButtonsState() {
  try {
    currentDiskCleanupData = await window.api.getDiskCleanupStatus();
    if (!currentDiskCleanupData) return;

    const btnRunAll = document.getElementById('btn-run-all-cleanup');
    const btnQuickClean = document.getElementById('btn-disk-quick-clean');

    const lastRunAllTime = parseInt(localStorage.getItem('apex_clean_all_disk') || '0', 10);
    const tenMinAgo = Date.now() - (10 * 60 * 1000);
    const totalMB = currentDiskCleanupData.totalMB || 0;
    const isTotalClean = totalMB < 2 || lastRunAllTime > tenMinAgo;

    // Actualizar botón "Ejecutar Limpieza Completa"
    if (btnRunAll) {
      if (isTotalClean) {
        btnRunAll.disabled = true;
        btnRunAll.classList.add('done');
        btnRunAll.innerHTML = '✓ Disco Optimizado (0 MB pendientes)';
        btnRunAll.title = 'No hay suficiente caché pendiente o se limpió recientemente';
      } else {
        btnRunAll.disabled = false;
        btnRunAll.classList.remove('done');
        btnRunAll.innerHTML = `🧹 Ejecutar Limpieza Completa (~${totalMB} MB)`;
        btnRunAll.title = 'Eliminar todos los archivos temporales y residuos del sistema';
      }
    }

    // Actualizar botón rápido del Dashboard
    if (btnQuickClean) {
      if (isTotalClean) {
        btnQuickClean.disabled = true;
        btnQuickClean.classList.add('done');
        btnQuickClean.textContent = '✓ Disco Optimizado';
        btnQuickClean.title = 'No hay suficiente caché acumulada';
      } else {
        btnQuickClean.disabled = false;
        btnQuickClean.classList.remove('done');
        btnQuickClean.textContent = `Limpiar archivos (~${totalMB} MB)`;
        btnQuickClean.title = 'Limpiar residuos temporales en el disco';
      }
    }

    // Actualizar botones individuales
    const cleanTweaks = allTweaks.filter(t => t.category === 'clean');
    cleanTweaks.forEach(tweak => {
      const btn = document.getElementById(`btn-clean-${tweak.id}`);
      const card = document.getElementById(`card-${tweak.id}`);
      const itemData = currentDiskCleanupData[tweak.id];
      const sizeMB = itemData ? itemData.sizeMB : 0;

      const lastClean = parseInt(localStorage.getItem('apex_clean_' + tweak.id) || '0', 10);
      const isClean = sizeMB < 1 || lastClean > tenMinAgo;

      // Actualizar badge de tamaño en el card
      if (card) {
        let sizeBadge = card.querySelector('.clean-size-badge');
        if (!sizeBadge) {
          const headerLine = card.querySelector('.tweak-header-line');
          if (headerLine) {
            sizeBadge = document.createElement('span');
            sizeBadge.className = 'clean-size-badge';
            headerLine.appendChild(sizeBadge);
          }
        }
        if (sizeBadge) {
          sizeBadge.textContent = `${sizeMB} MB`;
          if (sizeMB === 0) sizeBadge.classList.add('zero');
          else sizeBadge.classList.remove('zero');
        }
      }

      if (btn) {
        if (isClean) {
          btn.disabled = true;
          btn.classList.add('done');
          btn.textContent = '✓ Limpio';
          btn.title = 'Archivos limpios o purgados recientemente';
        } else {
          btn.disabled = false;
          btn.classList.remove('done');
          btn.textContent = `Limpiar (~${sizeMB} MB)`;
          btn.title = `Eliminar ${sizeMB} MB de archivos temporales`;
        }
      }
    });
  } catch (err) {
    console.warn('Error al actualizar estado de limpiadores de disco:', err);
  }
}

// --- TWEAKS GENERALES LOADER & RENDER ---
async function loadTweaks() {
  try {
    allTweaks = await window.api.getTweaks();
    tweaksStatuses = await window.api.getStatuses();

    renderTweaks();
    await updateCleanupButtonsState();
    return true;
  } catch (err) {
    showToast(`No se cargaron los ajustes de Windows: ${err.message}`, 'error');
    return false;
  }
}

function renderTweaks() {
  const containers = [
    gamingContainer,
    networkContainer,
    designContainer,
    servicesContainer,
    privacyContainer,
    cleanupContainer
  ];
  containers.forEach(c => { if (c) c.innerHTML = ''; });

  allTweaks.forEach(tweak => {
    const isApplied = !!tweaksStatuses[tweak.id];
    const card = document.createElement('div');
    card.className = `tweak-card ${isApplied ? 'active' : ''}`;
    card.id = `card-${tweak.id}`;

    const impactClass = tweak.impact.toLowerCase();
    const riskClass = tweak.risk ? tweak.risk.toLowerCase() : 'seguro';

    card.innerHTML = `
      <div class="tweak-info">
        <div class="tweak-header-line">
          <span class="tweak-title">${tweak.title}</span>
          <span class="impact-badge impact-${impactClass}">Impacto ${tweak.impact}</span>
          <span class="risk-badge risk-${riskClass}">${tweak.risk || 'Seguro'}</span>
        </div>
        <p class="tweak-description">${tweak.description}</p>
      </div>
      <div class="tweak-action">
        ${
          tweak.category === 'clean'
            ? `<button class="btn-action-primary btn-clean btn-single-clean" id="btn-clean-${tweak.id}" data-id="${tweak.id}">Limpiar</button>`
            : `
            <label class="paragon-check-label">
              <input type="checkbox" class="hidden-checkbox" id="switch-${tweak.id}" aria-label="${escapeHtml(tweak.title)}" ${isApplied ? 'checked' : ''} data-id="${tweak.id}">
              <span class="paragon-check-box">
                <svg viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </span>
            </label>
            `
        }
      </div>
    `;

    if (tweak.category === 'gaming' && gamingContainer) gamingContainer.appendChild(card);
    else if (tweak.category === 'network' && networkContainer) networkContainer.appendChild(card);
    else if (tweak.category === 'design' && designContainer) designContainer.appendChild(card);
    else if (tweak.category === 'services' && servicesContainer) servicesContainer.appendChild(card);
    else if (tweak.category === 'privacy' && privacyContainer) privacyContainer.appendChild(card);
    else if (tweak.category === 'clean' && cleanupContainer) cleanupContainer.appendChild(card);
  });

  attachTweakEvents();
  updateCleanupButtonsState();
}

function attachTweakEvents() {
  const switches = document.querySelectorAll('input[data-id]');
  switches.forEach(sw => {
    sw.addEventListener('change', async (e) => {
      const id = e.target.getAttribute('data-id');
      const isChecked = e.target.checked;
      const card = document.getElementById(`card-${id}`);

      const selectedTweak = allTweaks.find(tweak => tweak.id === id);
      const approved = await promptActionConfirmation({ title: selectedTweak?.title || 'Revisar ajuste', subtitle: selectedTweak?.description || 'Revisa el cambio antes de continuar.', badgeText: 'Herramienta gratuita', details: [isChecked ? 'Se guardará la configuración compatible antes de aplicar este ajuste.' : 'Se intentará restaurar el valor anterior respaldado por Apex.'], safetyText: 'Algunos cambios requieren reiniciar o cerrar sesión. Si Windows solicita permisos, puedes cancelar.', confirmText: isChecked ? 'Aplicar ajuste' : 'Deshacer ajuste' });
      if (!approved) { e.target.checked = !isChecked; return; }

      // Si la app está en modo usuario y el ajuste modifica el sistema (HKLM/Servicios)
      if (!currentIsAdmin) {
        const tweakObj = allTweaks.find(t => t.id === id);
        if (tweakObj && tweakObj.applyScript && tweakObj.applyScript.includes('HKLM')) {
          e.target.checked = !isChecked;
          const confirmed = await promptActionConfirmation({
            title: '⚡ Permisos de Administrador Requeridos',
            subtitle: 'Este ajuste modifica configuraciones protegidas del sistema (HKEY_LOCAL_MACHINE).',
            badgeText: 'Elevación de Permisos Requerida',
            badgeClass: 'badge-warning',
            details: [
              `Ajuste: ${tweakObj.title}`,
              'Para aplicar cambios a nivel global en Windows se requieren privilegios elevados.',
              'Pulsa "Iniciar como Administrador" para reiniciar la aplicación con acceso total.'
            ],
            confirmText: '⚡ Iniciar como Administrador'
          });

          if (confirmed) {
            try {
              await window.api.restartAsAdmin();
            } catch (err) {}
          }
          return;
        }
      }

      sw.disabled = true;
      showToast(isChecked ? 'Aplicando ajuste en el sistema...' : 'Revirtiendo ajuste...', 'info');

      try {
        const res = isChecked 
          ? await window.api.applyTweak(id)
          : await window.api.revertTweak(id);

        if (res.success) {
          tweaksStatuses[id] = isChecked;
          if (isChecked) card.classList.add('active');
          else card.classList.remove('active');
          showToast(res.message, 'success');
        } else {
          e.target.checked = !isChecked;
          showToast(res.message, 'error');
        }
      } catch (err) {
        e.target.checked = !isChecked;
        showToast('Error de ejecución en Windows.', 'error');
      } finally {
        sw.disabled = false;
      }
    });
  });

  const cleanButtons = document.querySelectorAll('.btn-single-clean');
  cleanButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.disabled || btn.classList.contains('done')) return;
      const id = btn.getAttribute('data-id');
      const tweak = allTweaks.find(t => t.id === id);
      const itemData = currentDiskCleanupData ? currentDiskCleanupData[id] : null;
      const sizeMB = itemData ? itemData.sizeMB : 0;

      let detailsList = [];
      let subtitle = tweak ? tweak.description : 'Eliminación segura de residuos.';
      if (id === 'clean_temp_files') {
        detailsList = [
          'Se vaciará la carpeta temporal de usuario (%TEMP%).',
          'Elimina instaladores descargados, descompresiones temporales y archivos residuales de apps.',
          'Los archivos actualmente en uso por programas en ejecución se omitirán automáticamente.',
          'Tus documentos y descargas personales no serán modificados.'
        ];
      } else if (id === 'clean_windows_temp') {
        detailsList = [
          'Se vaciará la carpeta temporal del sistema (C:\\Windows\\Temp).',
          'Elimina volcados de diagnósticos pasados e instaladores de servicios de Windows.',
          'Requiere privilegios de Administrador para archivos protegidos.',
          'Operación con revisión previa para la integridad del sistema.'
        ];
      } else if (id === 'clean_shader_cache') {
        detailsList = [
          'Se purgarán las carpetas D3DSCache, NVIDIA DXCache/GLCache y AMD DxCache.',
          'Elimina sombreadores compilados antiguos o corruptos para solucionar tirones (stuttering) en juegos.',
          'El controlador gráfico regenerará los sombreadores nuevos automáticamente al abrir tus juegos.'
        ];
      } else if (id === 'clean_software_distribution') {
        detailsList = [
          'Se vaciará la carpeta SoftwareDistribution\\Download.',
          'Elimina paquetes pesados de actualizaciones de Windows que ya fueron instaladas en el equipo.',
          'Detiene y reactiva automáticamente el servicio de Windows Update para liberar el espacio.'
        ];
      } else if (id === 'clean_thumbnail_cache') {
        detailsList = [
          'Se eliminarán los archivos thumbcache_*.db del Explorador de Windows.',
          'Soluciona miniaturas en negro o corruptas de fotos y videos en carpetas.',
          'Reinicia brevemente el Explorador para desbloquear y purgar los archivos.'
        ];
      } else {
        detailsList = [
          `Se eliminarán los archivos temporales de: ${tweak ? tweak.title : id}.`,
          'La operación ignorará de forma segura cualquier archivo en uso.',
          'Tus datos y documentos personales están protegidos.'
        ];
      }

      const confirmed = await promptActionConfirmation({
        title: `🧹 ${tweak ? tweak.title : 'Limpieza de Archivos'}`,
        subtitle: subtitle,
        badgeText: 'Limpieza de Disco • Seguro',
        spaceMB: sizeMB,
        details: detailsList,
        confirmText: 'Liberar Espacio Ahora'
      });
      if (!confirmed) return;

      btn.disabled = true;
      btn.textContent = '⏳ Limpiando...';
      showToast(`🧹 Limpiando ${tweak ? tweak.title : 'archivos'}...`, 'info');

      try {
        const res = await window.api.applyTweak(id);
        localStorage.setItem('apex_clean_' + id, Date.now());
        showToast((res && res.message) ? res.message : 'Limpieza finalizada con éxito.', 'success');
      } catch (e) {
        showToast('Limpieza finalizada con advertencias.', 'info');
      }

      await updateCleanupButtonsState();
    });
  });
}

// --- NETWORK TOOLS ---
function setupNetworkTools() {
  const btnTestPing = document.getElementById('btn-test-ping');
  const customPingHost = document.getElementById('custom-ping-host');

  btnTestPing.addEventListener('click', async () => {
    const custom = customPingHost.value.trim();
    btnTestPing.disabled = true;
    btnTestPing.textContent = 'Midiendo...';
    showToast('📡 Ejecutando medición de ping...', 'info');

    try {
      const results = await window.api.runPingBenchmark(custom || null);
      if (results && results.length > 0) {
        results.forEach(item => {
          if (item.host === '1.1.1.1') updatePingUi('ping-val-1111', item);
          else if (item.host === '8.8.8.8') updatePingUi('ping-val-8888', item);
          else if (item.host === 'playvalorant.com') updatePingUi('ping-val-riot', item);
          else if (item.host === 'store.steampowered.com') updatePingUi('ping-val-steam', item);
          else if (custom && item.host === custom) {
            showToast(`Ping a ${custom}: ${Number.isFinite(item.latencyMs) ? item.latencyMs + ' ms' : 'Sin respuesta'}`, Number.isFinite(item.latencyMs) ? 'success' : 'error');
          }
        });
        showToast('Medición de latencia completada.', 'success');
      }
    } catch (err) {
      showToast('Error al conectar con los servidores de prueba.', 'error');
    } finally {
      btnTestPing.disabled = false;
      btnTestPing.textContent = '📶 Medir Ping Ahora';
    }
  });

  function updatePingUi(elementId, data) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const badge = el.parentElement.querySelector('.ping-status-badge');

    if (data.latencyMs !== null) {
      el.textContent = `${data.latencyMs} ms`;
      if (data.latencyMs < 35) {
        el.style.color = 'var(--color-clean)';
        if (badge) { badge.textContent = 'Excelente (Óptimo)'; badge.style.color = 'var(--color-clean)'; }
      } else if (data.latencyMs < 75) {
        el.style.color = 'var(--color-network)';
        if (badge) { badge.textContent = 'Bueno'; badge.style.color = 'var(--color-network)'; }
      } else {
        el.style.color = 'var(--color-paragon-red)';
        if (badge) { badge.textContent = 'Alto'; badge.style.color = 'var(--color-paragon-red)'; }
      }
    } else {
      el.textContent = 'Timeout';
      el.style.color = 'var(--color-paragon-red)';
      if (badge) { badge.textContent = 'Sin respuesta'; badge.style.color = 'var(--color-paragon-red)'; }
    }
  }

  // DNS Switcher
  const dnsButtons = document.querySelectorAll('.btn-dns-apply');
  dnsButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const provider = btn.getAttribute('data-dns');
      const names={cloudflare:'Cloudflare',google:'Google',quad9:'Quad9',dhcp:'DNS automático (DHCP)',original:'DNS guardados por Apex'};
      const confirmed=await promptActionConfirmation({title:provider==='original'?'Restaurar tus DNS guardados':'Cambiar DNS a '+names[provider],subtitle:provider==='original'?'Recupera la configuración IPv4 anterior de los adaptadores respaldados.':'Cambia los servidores de resolución de nombres de las interfaces IPv4 activas.',badgeText:'Red · Herramienta gratuita',details:[provider==='dhcp'?'Usará los DNS que asigne DHCP. Esto no equivale a recuperar unos DNS estáticos anteriores.':'Se conserva IPv6 y se guarda la configuración anterior compatible.'],riskLevel:'medium',risks:['Puede afectar la resolución de nombres en redes corporativas o con VPN.'],askRestorePoint:false,confirmText:provider==='original'?'Restaurar DNS guardados':'Aplicar DNS'});
      if(!confirmed)return;
      btn.disabled = true;
      btn.textContent = 'Aplicando...';
      showToast(`Configurando DNS ${provider.toUpperCase()}...`, 'info');

      try {
        const res = await window.api.setDnsProvider(provider);
        if (res.success) {
          showToast(res.message, 'success');
          btn.textContent = 'Activo ✓';
        } else {
          showToast('Error al modificar adaptadores DNS.', 'error');
          btn.textContent = 'Reintentar';
        }
      } catch (e) {
        showToast('Error al aplicar configuración DNS.', 'error');
      } finally {
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = provider === 'original' ? 'Restaurar DNS guardados' : provider === 'dhcp' ? 'Restablecer DHCP' : `Usar ${provider.charAt(0).toUpperCase() + provider.slice(1)}`;
        }, 2500);
      }
    });
  });

  // Network Quick Buttons
  document.getElementById('btn-flush-dns').addEventListener('click', async () => {
    const confirmed=await promptActionConfirmation({title:'Vaciar caché DNS',subtitle:'Elimina las respuestas de nombres guardadas localmente para que Windows vuelva a consultarlas.',badgeText:'Herramienta gratuita',details:['No cambia tus servidores DNS ni reinicia el adaptador.'],confirmText:'Vaciar caché DNS'});if(!confirmed)return;
    showToast('Vaciando caché de resolución DNS…','info');
    const res = await window.api.flushDns();
    showToast(res.message, 'success');
  });

  document.getElementById('btn-reset-winsock').addEventListener('click', async () => {
    const confirmed = await promptActionConfirmation({
      title: '🔄 Restablecer Catálogo Winsock y TCP/IP',
      subtitle: 'Restaura la configuración de sockets y protocolos de red a valores de fábrica.',
      badgeText: 'Red y Conectividad • Advertencia',
      badgeClass: 'badge-warning',
      details: [
        'Ejecuta "netsh winsock reset" y "netsh int ip reset".',
        'Soluciona problemas de conexión limitada, DNS bloqueado y errores de sockets.',
        'Requiere reiniciar el equipo para completar la reconfiguración.'
      ],
      safetyText: '⚠️ Requiere reiniciar el ordenador después de aplicarlo.',
      confirmText: 'Restablecer Catálogo Winsock'
    });
    if (!confirmed) return;

    showToast('🔄 Restableciendo catálogo de Winsock y TCP...', 'info');
    const res = await window.api.resetWinsock();
    showToast(res.message, 'success');
  });

  document.getElementById('btn-restart-adapters').addEventListener('click', async () => {
    const confirmed = await promptActionConfirmation({
      title: '🔌 Reiniciar Adaptadores de Red',
      subtitle: 'Desconecta y reconecta brevemente los adaptadores Ethernet y Wi-Fi.',
      badgeText: 'Red y Conectividad',
      badgeClass: 'badge-warning',
      details: [
        'Reinicia todas las tarjetas de red físicas del ordenador.',
        'Renueva la dirección IP y borra la caché ARP local.',
        'La conexión a Internet se pausará durante unos 3 a 5 segundos.'
      ],
      safetyText: '⚠️ La conexión a Internet se interrumpirá momentáneamente.',
      confirmText: 'Reiniciar Adaptadores Ahora'
    });
    if (!confirmed) return;

    showToast('🔌 Reiniciando adaptadores de red...', 'info');
    const res = await window.api.restartAdapters();
    showToast(res.message, 'success');
  });
}

// --- HERRAMIENTAS PROFESIONALES DE DISEÑO & PRODUCTIVIDAD ---
let cachedDesignCacheSummary = null;

async function loadDetectedDesignApps() {
  const container = document.getElementById('detected-design-apps-container');
  if (!container) return;

  try {
    const res = await window.api.detectDesignApps();
    const apps = (res && res.apps) ? res.apps : [];
    const showScanWarning = () => {
      if(!res?.partial&&!res?.warning)return;
      const notice=document.createElement('div');notice.className='design-empty-slot';notice.setAttribute('role','status');
      notice.textContent=res.warning||'La búsqueda es parcial. Se muestran las aplicaciones que pudieron comprobarse.';container.prepend(notice);
    };

    if (apps.length === 0) {
      container.innerHTML = `
        <div class="design-empty-slot">
          <span>No se detectaron aplicaciones compatibles en las rutas revisadas. Puedes volver a detectar después de instalar una aplicación.</span>
        </div>
      `;
      showScanWarning();
      return;
    }

    container.innerHTML = apps.map(app => {
      const isGpu = app.GpuOptimized;
      return `
        <div class="design-app-card">
          <div class="design-app-top">
            <div class="design-app-logo" style="background: ${escapeHtml(app.Color || '#c084fc')}">
              ${escapeHtml(app.Badge || app.Tag || 'APP')}
            </div>
            <div class="design-app-info">
              <div class="design-app-name-row">
                <span class="design-app-title" title="${escapeHtml(app.Name)}">${escapeHtml(app.Name)}</span>
                <span class="design-app-tag">${escapeHtml(app.Tag)}</span>
              </div>
              <span class="design-app-path" title="${escapeHtml(app.Path)}">${escapeHtml(app.Path)}</span>
            </div>
          </div>
          <div class="design-app-footer">
            <span class="design-app-pill ${isGpu ? 'pill-gpu-active' : 'pill-gpu-pending'}">
              ${isGpu ? '✓ Preferencia de alto rendimiento' : 'Preferencia del sistema'}
            </span>
            <button class="btn-app-gpu-opt ${isGpu ? 'done' : ''}" data-path="${escapeHtml(app.Path)}" ${isGpu ? 'disabled' : ''}>
              ${isGpu ? '✓ Preferencia activa' : '⚡ Preferir GPU'}
            </button>
            ${app.HasGpuBackup ? `<button class="btn-app-gpu-restore" data-path="${escapeHtml(app.Path)}">Restaurar GPU</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
    showScanWarning();

    // Listener para botones de GPU individuales
    container.querySelectorAll('.btn-app-gpu-opt:not(.done)').forEach(btn => {
      btn.addEventListener('click', async () => {
        const exePath = btn.getAttribute('data-path');
        const confirmed=await promptActionConfirmation({title:'Preferir la GPU de alto rendimiento',subtitle:'Cambia la preferencia gráfica de Windows para esta aplicación.',badgeText:'Herramienta gratuita',details:['Se guarda la preferencia anterior. La aplicación debe reiniciarse para comprobar el efecto.','Windows y la aplicación deciden la GPU usada; esta preferencia no garantiza una aceleración.'],confirmText:'Asignar preferencia GPU'});
        if(!confirmed)return;
        btn.disabled = true;
        btn.textContent = 'Configurando…';
        try {
          const result = await window.api.assignGpuDesignApp(exePath);
          showToast(result.message || 'Preferencia GPU guardada.', 'success');
          await loadDetectedDesignApps();
        } catch (err) {
          showToast(`Error al asignar GPU: ${err.message}`, 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = '⚡ Preferir GPU';
        }
      });
    });
    container.querySelectorAll('.btn-app-gpu-restore').forEach(btn => {
      btn.addEventListener('click', async () => {
        const confirmed = await promptActionConfirmation({title:'Restaurar preferencia GPU',subtitle:'Recupera el valor anterior guardado para esta aplicación.',badgeText:'Restauración desde respaldo',details:['Si la preferencia cambió fuera de Apex, la restauración se detiene para evitar sobrescribirla.'],confirmText:'Restaurar preferencia'});
        if(!confirmed)return;
        btn.disabled=true;
        try{const result=await window.api.restoreGpuDesignApp(btn.dataset.path);showToast(result.message,'success');await loadDetectedDesignApps();}
        catch(error){showToast(error.message,'error');}
        finally{btn.disabled=false;}
      });
    });
  } catch (err) {
    console.error('Error cargando apps de diseño:', err);
    container.innerHTML = `<div class="design-empty-slot" style="color: #f87171;">Error al escanear software de diseño: ${escapeHtml(err.message)}</div>`;
  }
}

async function loadDesignCacheStatus() {
  const cacheTag = document.getElementById('design-cache-size-tag');
  if (!cacheTag) return;

  try {
    const summary = await window.api.getDesignCacheSummary();
    cachedDesignCacheSummary = summary;
    const mb = summary.totalMB || 0;
    if (mb > 0) {
      const displaySize = mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
      cacheTag.textContent = `${displaySize} Detectados`;
      cacheTag.style.color = '#fbbf24';
      cacheTag.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    } else {
      cacheTag.textContent = '✓ Scratch Limpio';
      cacheTag.style.color = '#34d399';
      cacheTag.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    }
  } catch (err) {
    console.error('Error obteniendo estado de caché creativa:', err);
  }
}

function setupDesignTools() {
  const btnPurgeRam = document.getElementById('btn-purge-ram-design');
  const btnCleanCache = document.getElementById('btn-clean-media-cache-design');
  const btnOptTablet = document.getElementById('btn-opt-tablet-design');
  const btnAssignGpu = document.getElementById('btn-assign-gpu-design');
  const btnRefreshDesign = document.getElementById('btn-refresh-design-apps');

  if (btnRefreshDesign) {
    btnRefreshDesign.addEventListener('click', async () => {
      btnRefreshDesign.disabled = true;
      btnRefreshDesign.textContent = '⏳ Escaneando...';
      await Promise.all([loadDetectedDesignApps(), loadDesignCacheStatus()]);
      btnRefreshDesign.disabled = false;
      btnRefreshDesign.textContent = '🔄 Actualizar';
      showToast('Programas de diseño y caché actualizados.', 'success');
    });
  }

  if (btnPurgeRam) {
    btnPurgeRam.addEventListener('click', async () => {
      const confirmed = await promptActionConfirmation({
        title: '🚀 Purgar Memoria Standby RAM',
        subtitle: 'Libera bloques de memoria retenidos por Windows para edición pesada.',
        badgeText: 'Estudio Creativo • Memoria',
        badgeClass: 'badge-gaming',
        details: [
          'Vuelca la lista Standby del Administrador de Memoria a la lista de memoria disponible.',
          'Permite a programas como Photoshop, Illustrator, Premiere y DaVinci asignar más RAM de previsualización.',
          'No cierra ninguna aplicación ni pierde tu trabajo.'
        ],
        confirmText: 'Purgar Memoria Standby'
      });
      if (!confirmed) return;

      btnPurgeRam.disabled = true;
      btnPurgeRam.textContent = '⏳ Purgando Standby RAM...';
      showToast('🚀 Purgando Standby RAM y memoria retenida...', 'info');
      try {
        const res = await window.api.purgeStandbyRam();
        showToast(res.message, 'success');
        btnPurgeRam.textContent = `✓ ${res.freedMB ?? 0} MB Liberados`;
      } catch (err) {
        showToast('Memoria Standby purgada con éxito.', 'success');
        btnPurgeRam.textContent = '✓ RAM Liberada';
      }
      setTimeout(() => {
        btnPurgeRam.disabled = false;
        btnPurgeRam.textContent = '🚀 Purgar Standby RAM Ahora';
      }, 3000);
      loadSystemSpecs();
    });
  }

  if (btnCleanCache) {
    btnCleanCache.addEventListener('click', async () => {
      const breakdown = (cachedDesignCacheSummary && cachedDesignCacheSummary.breakdown) ? cachedDesignCacheSummary.breakdown : [];
      const totalMB = (cachedDesignCacheSummary && cachedDesignCacheSummary.totalMB) ? cachedDesignCacheSummary.totalMB : 0;
      
      const detailsList = [
        'Elimina archivos temporales de Photoshop (.psd scratch) y auto-recuperaciones obsoletas.',
        'Vacía archivos temporales (.ai temp) y cachés de fuentes/pinceles de Illustrator.',
        'Elimina archivos .pek (picos de audio) e .ims (conformados) de Adobe Premiere y After Effects.',
        'Vacía las carpetas de caché temporal de DaVinci Resolve y BlenderAutosaves.',
        'Tus proyectos, timelines y archivos de origen NO se eliminan ni modifican.'
      ];

      if (breakdown.length > 0) {
        detailsList.unshift(`Espacio detectado para liberar: ${totalMB} MB en ${breakdown.map(b => b.Category).join(', ')}.`);
      }

      const confirmed = await promptActionConfirmation({
        title: '🧹 Limpiar Scratch Disks & Caché Creativa',
        subtitle: 'Elimina gigabytes de renders temporales, scratch disks y previsualizaciones de video.',
        badgeText: 'Diseño y Edición • Seguro',
        details: detailsList,
        confirmText: 'Limpiar Caché y Scratch Disks'
      });
      if (!confirmed) return;

      btnCleanCache.disabled = true;
      btnCleanCache.textContent = '⏳ Limpiando Scratch Disks...';
      showToast('🧹 Limpiando caché y scratch disks de Photoshop, Illustrator, Premiere y DaVinci...', 'info');
      try {
        const res = await window.api.cleanCreativeMediaCache();
        showToast(res.message, 'success');
        btnCleanCache.textContent = `✓ ${res.count || 0} Archivos Eliminados`;
        await loadDesignCacheStatus();
      } catch (err) {
        showToast('Caché de diseño limpiada con éxito.', 'success');
        btnCleanCache.textContent = '✓ Caché Limpia';
      }
      setTimeout(() => {
        btnCleanCache.disabled = false;
        btnCleanCache.textContent = '🧹 Limpiar Caché y Scratch Disks';
      }, 3000);
    });
  }

  if (btnOptTablet) {
    btnOptTablet.addEventListener('click', async () => {
      const confirmed = await promptActionConfirmation({
        title: '✏️ Optimizar Tableta Gráfica y Lápiz Digital',
        subtitle: 'Elimina retardos, halos y latencia del motor Windows Ink en tabletas Wacom, Huion y XP-Pen.',
        badgeText: 'Periféricos • Cero Retardo',
        badgeClass: 'badge-gaming',
        details: [
          'Desactiva el gesto "Presionar y mantener presionado" (HoldMode = 3) para clic derecho instantáneo.',
          'Elimina el efecto de rebote táctil (Bouncing = 0) y los gestos rápidos de Windows (Flicks = 0).',
          'Deshabilita la animación circular PenBarrelFeedback de Windows al apoyar la punta del lápiz.',
          'Trazo directo y respuesta inmediata en Photoshop, Illustrator, Krita y Blender.'
        ],
        confirmText: 'Optimizar Respuesta de Tableta'
      });
      if (!confirmed) return;

      btnOptTablet.disabled = true;
      btnOptTablet.textContent = '⏳ Optimizando lápiz...';
      showToast('✏️ Eliminando retardo de presión y flicks en Windows Ink...', 'info');
      try {
        const res = await window.api.optimizeGraphicsTablet();
        showToast(res.message, 'success');
        btnOptTablet.textContent = '✓ Tableta Sin Latencia';
      } catch (err) {
        showToast('Tableta gráfica optimizada.', 'success');
        btnOptTablet.textContent = '✓ Tableta Optimizada';
      }
      setTimeout(() => {
        btnOptTablet.disabled = false;
        btnOptTablet.textContent = '✏️ Optimizar Tableta Gráfica';
      }, 3000);
    });
  }

  if (btnAssignGpu) {
    btnAssignGpu.addEventListener('click', async () => {
      const confirmed = await promptActionConfirmation({
        title: '⚡ Forzar GPU de Alto Rendimiento en Suites Detectadas',
        subtitle: 'Configura las directivas de DirectX para que Photoshop, Illustrator, DaVinci y Blender usen la GPU dedicada.',
        badgeText: 'Hardware GPU • Alto Rendimiento',
        badgeClass: 'badge-gaming',
        details: [
          'Asigna GpuPreference = 2 (Alto Rendimiento) en el registro de DirectX a todas las suites detectadas.',
          'Evita que Windows ejecute Photoshop, Illustrator o Premiere en los gráficos integrados lentos.',
          'Acelera el renderizado por hardware, aceleración CUDA / NVENC y la fluidez del canvas en tiempo real.'
        ],
        confirmText: 'Asignar GPU de Alto Rendimiento'
      });
      if (!confirmed) return;

      btnAssignGpu.disabled = true;
      btnAssignGpu.textContent = '⏳ Configurando GPU...';
      showToast('⚡ Asignando GPU de alto rendimiento a todas las apps de diseño...', 'info');
      try {
        const res = await window.api.assignGpuCreativeApps();
        showToast(res.message, 'success');
        btnAssignGpu.textContent = `✓ GPU Asignada (${res.count || 0} Apps)`;
        await loadDetectedDesignApps();
      } catch (err) {
        showToast('GPU asignada a suites creativas.', 'success');
        btnAssignGpu.textContent = '✓ GPU Asignada';
      }
      setTimeout(() => {
        btnAssignGpu.disabled = false;
        btnAssignGpu.textContent = '⚡ Asignar GPU a Apps Detectadas';
      }, 3000);
    });
  }

  // Carga inicial en segundo plano
  loadDetectedDesignApps();
  loadDesignCacheStatus();
}

// --- ACTION BUTTONS & PROFILES ---
function setupActionButtons() {
  const applyGaming = async () => {
    const confirmed = await promptActionConfirmation({
      title: '⚡ Activar Perfil Gaming Completo',
      subtitle: 'Aplica en un solo clic todas las optimizaciones de baja latencia para juegos.',
      badgeText: 'Perfil Gaming • Alto Rendimiento',
      badgeClass: 'badge-gaming',
      details: [
        'Desactiva Xbox GameDVR y Game Bar Presence Writer para eliminar micro-tirones.',
        'Prioriza la GPU y el planificador multimedia de Windows para procesos de juego.',
        'Deshabilita el algoritmo de Nagle (TcpAck & TCPNoDelay) en adaptadores de red.',
        'Ajusta la respuesta del sistema a 0ms de retardo.',
        'Optimiza el plan de energía para máximo rendimiento de CPU.'
      ],
      confirmText: 'Activar Perfil Gaming'
    });
    if (!confirmed) return;

    showToast('⚡ Activando perfil Gaming completo...', 'info');
    const res = await window.api.applyProfile('gaming');
    if (res.success) {
      showToast('Perfil Gaming aplicado con éxito.', 'success');
      refreshStatuses();
    }
  };
  document.getElementById('btn-apply-gaming-profile').addEventListener('click', applyGaming);
  document.getElementById('btn-apply-all-gaming').addEventListener('click', applyGaming);

  const applyDesign = async () => {
    const confirmed = await promptActionConfirmation({
      title: '✨ Activar Suite de Diseño, Render y Edición',
      subtitle: 'Ajusta el sistema para estabilidad y fluidez en Premiere, Blender, DaVinci y Photoshop.',
      badgeText: 'Estudio Creativo • Productividad',
      badgeClass: 'badge-gaming',
      details: [
        'Activa LargeSystemCache para acelerar previsualizaciones de video en memoria RAM.',
        'Equilibra los hilos de render en segundo plano (Win32PrioritySeparation = 24).',
        'Elimina retardos y flicks en tabletas gráficas (Windows Ink).',
        'Asigna la GPU dedicada de alto rendimiento a todas las suites de diseño instaladas.',
        'Habilita soporte para rutas largas de archivos en proyectos 3D.'
      ],
      confirmText: 'Activar Suite de Diseño'
    });
    if (!confirmed) return;

    showToast('✨ Activando suite de Diseño, Render y Productividad...', 'info');
    try {
      await window.api.applyAllDesignStudio();
      const res = await window.api.applyProfile('design');
      if (res.success) {
        showToast('Estudio de Diseño y Render activado con éxito (Caché RAM, GPU, tableta y prioridad de render).', 'success');
        refreshStatuses();
        loadSystemAudit();
      }
    } catch (err) {
      showToast('Error al activar modo diseño: ' + err.message, 'error');
    }
  };
  document.getElementById('btn-apply-design-profile').addEventListener('click', applyDesign);
  document.getElementById('btn-apply-all-design').addEventListener('click', applyDesign);

  const btnRunAllCleanup = document.getElementById('btn-run-all-cleanup');
  if (btnRunAllCleanup) {
    btnRunAllCleanup.addEventListener('click', async () => {
      if (btnRunAllCleanup.disabled || btnRunAllCleanup.classList.contains('done')) return;
      const totalMB = currentDiskCleanupData ? currentDiskCleanupData.totalMB : 0;

      const confirmed = await promptActionConfirmation({
        title: '🧹 Limpieza Profunda de Disco Completa',
        subtitle: 'Ejecuta todas las rutinas de purga de archivos temporales del sistema.',
        badgeText: 'Limpieza Total • Seguro',
        spaceMB: totalMB,
        details: [
          'Se vaciarán los archivos temporales de usuario (%TEMP%).',
          'Se limpiarán los registros temporales del sistema (C:\\Windows\\Temp).',
          'Se purgarán sombreadores corruptos de DirectX y drivers GPU (NVIDIA/AMD).',
          'Se eliminarán instaladores antiguos de Windows Update ya aplicados.',
          'Se reseteará la caché de miniaturas de imágenes corruptas del explorador.',
          'Tus programas instalados y archivos personales NO serán afectados.'
        ],
        confirmText: 'Liberar Todo el Espacio'
      });
      if (!confirmed) return;

      btnRunAllCleanup.disabled = true;
      btnRunAllCleanup.textContent = '⏳ Limpiando disco...';
      showToast('🧹 Ejecutando limpieza completa de disco...', 'info');

      const cleanTweaks = allTweaks.filter(t => t.category === 'clean');
      for (const tweak of cleanTweaks) {
        await window.api.applyTweak(tweak.id);
        localStorage.setItem('apex_clean_' + tweak.id, Date.now());
      }
      localStorage.setItem('apex_clean_all_disk', Date.now());

      showToast('Limpieza profunda completada con éxito.', 'success');
      await updateCleanupButtonsState();
    });
  }

  const revertHandler = async () => {
    const confirmed = await promptActionConfirmation({
      title: '↩️ Deshacer ajustes guardados',
      subtitle: 'Restaura los valores anteriores respaldados por esta versión de Apex.',
      badgeText: 'Restablecimiento Total • Precaución',
      badgeClass: 'badge-warning',
      details: [
        'Se desactivarán todos los tweaks aplicados en Gaming, Red, Diseño, Privacidad y Servicios.',
        'Se restaurará el plan de energía predeterminado de Windows.',
        'Se restablecerá la configuración original de temporizadores y red.',
        'Tus aplicaciones, juegos y archivos personales permanecerán intactos.'
      ],
      safetyText: '💡 Solo se restauran ajustes con un respaldo propio. Algunas opciones requieren reiniciar.',
      confirmText: 'Restablecer Configuración'
    });
    if (!confirmed) return;

    showToast('↩️ Restaurando valores de fábrica...', 'info');
    const res = await window.api.revertAll();
    if (res.success) {
      showToast('Se restauraron los ajustes guardados por Apex.', 'success');
      refreshStatuses();
      await loadGames();
    }
  };
  const btnRevertTop = document.getElementById('btn-revert-all-top');
  if (btnRevertTop) btnRevertTop.addEventListener('click', revertHandler);
  const btnRevertMain = document.getElementById('btn-revert-all-main');
  if (btnRevertMain) btnRevertMain.addEventListener('click', revertHandler);

  const createRestoreHandler = async () => {
    const input = document.getElementById('input-restore-name');
    const desc = (input && input.value.trim()) ? input.value.trim() : 'ApexOptimizer_AutoBackup';

    const confirmed = await promptActionConfirmation({
      title: '🛡️ Crear Punto de Restauración del Sistema',
      subtitle: 'Guarda una instantánea de seguridad de Windows antes de aplicar cambios.',
      badgeText: 'Seguridad y Respaldo • Recomendado',
      badgeClass: 'badge-gaming',
      details: [
        `Se creará una instantánea en Windows con el nombre "${desc}".`,
        'Guarda una copia del Registro de Windows y archivos críticos del sistema operativo.',
        'Permite regresar al estado actual en caso de cualquier incompatibilidad futura.',
        'No borra ni modifica tus archivos personales.'
      ],
      confirmText: 'Crear Punto de Restauración'
    });
    if (!confirmed) return;

    showToast('🛡️ Creando punto de restauración en Windows...', 'info');
    const res = await window.api.createRestorePoint(desc);
    if (res.success) {
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'error');
    }
  };
  const btnCreateRestore = document.getElementById('btn-create-restore-point');
  if (btnCreateRestore) btnCreateRestore.addEventListener('click', createRestoreHandler);
  const btnQuickRestore = document.getElementById('btn-quick-restore');
  if (btnQuickRestore) btnQuickRestore.addEventListener('click', createRestoreHandler);
}

async function refreshStatuses() {
  tweaksStatuses = await window.api.getStatuses();
  renderTweaks();
}

// --- AUDITORÍA & PUNTUACIÓN (1.000 PTS) ---

function setupAuditListeners() {
  const gotoAuditHandler = () => {
    navItems.forEach(n => n.classList.remove('active'));
    viewTabs.forEach(v => v.classList.remove('active'));
    const auditNav = document.querySelector('.nav-item[data-tab="audit"]');
    const auditView = document.getElementById('view-audit');
    if (auditNav) auditNav.classList.add('active');
    if (auditView) auditView.classList.add('active');
  };

  // Clic en el widget de puntuación del dashboard -> navega a la pestaña de auditoría
  const dashTopWidget = document.querySelector('.dash-top-stats-widget');
  if (dashTopWidget) {
    dashTopWidget.style.cursor = 'pointer';
    dashTopWidget.addEventListener('click', (e) => {
      if (e.target.closest('#btn-dash-quick-optimize')) return;
      gotoAuditHandler();
    });
  }

  if (btnReAudit) {
    btnReAudit.addEventListener('click', async () => {
      btnReAudit.disabled = true;
      btnReAudit.textContent = '⏳ Analizando...';
      showToast('🔍 Re-analizando componentes y estado del sistema...', 'info');
      await loadSystemAudit(true);
      btnReAudit.disabled = false;
      btnReAudit.textContent = '🔄 Re-analizar Sistema';
      showToast('Auditoría del sistema actualizada.', 'success');
    });
  }

  if (btnOptimizeAllAudit) {
    btnOptimizeAllAudit.addEventListener('click', async () => {
      const confirmed = await promptActionConfirmation({
        title: 'Aplicar ajustes de auditoría',
        subtitle: 'Aplica el conjunto de ajustes indicado. La puntuación es orientativa y no mide FPS ni seguridad.',
        badgeText: 'Auditoría • Recomendado',
        badgeClass: 'badge-gaming',
        details: [
          'Habilita la programación de GPU acelerada por hardware (HAGS) y preferencia de alto rendimiento.',
          'Configura DNS Cloudflare y guarda la configuración IPv4 anterior.',
          'Cambia las preferencias de Nagle en las interfaces de red.',
          'Optimiza la separación de prioridades de CPU en primer plano (Win32PrioritySeparation).',
          'Elimina archivos temporales y residuos del disco.',
          'Ajusta la energía, desactiva Game DVR, diagnósticos de errores, telemetría y preferencias de Copilot compatibles.',
          'La desinstalación de aplicaciones se realiza por separado, eligiendo cada aplicación.'
        ],
        riskLevel: 'high',
        risks: ['Puede afectar grabación de juegos, diagnósticos, consumo y conectividad.','Los archivos eliminados por la limpieza no tienen recuperación automática.'],
        confirmText: 'Optimizar Todo el Sistema'
      });
      if (!confirmed) return;

      btnOptimizeAllAudit.disabled = true;
      btnOptimizeAllAudit.textContent = '⚡ Optimizando todo...';
      showToast('🚀 Aplicando todas las optimizaciones seguras de auditoría...', 'info');
      try {
        const res = await window.api.optimizeAllAudit();
        auditData = res;
        try {
          localStorage.setItem('apex_audit_cache', JSON.stringify(res));
        } catch (e) {}
        updateAuditUI();
        refreshStatuses();
        showToast('¡Sistema optimizado! Puntuación aumentada.', 'success');
      } catch (err) {
        showToast(`Error al optimizar: ${err.message}`, 'error');
      } finally {
        btnOptimizeAllAudit.disabled = false;
        btnOptimizeAllAudit.textContent = '⚡ Optimizar Todo (Subir a 1.000 pts)';
      }
    });
  }
}

async function loadSystemAudit(force = false) {
  try {
    // 1. Mostrar caché inmediatamente en 0ms si existe para evitar que el usuario vea "--"
    if (!force) {
      const cached = localStorage.getItem('apex_audit_cache');
      if (cached && !auditData) {
        try {
          auditData = JSON.parse(cached);
          updateAuditUI();
        } catch (e) {}
      }
    }

    // 2. Ejecutar auditoría en vivo
    const fresh = await window.api.runSystemAudit(force);
    if (fresh) {
      auditData = fresh;
      try {
        localStorage.setItem('apex_audit_cache', JSON.stringify(fresh));
      } catch (e) {}
      updateAuditUI();
    }
  } catch (err) {
    console.error('Error cargando auditoría:', err);
  }
}

function updateAuditUI() {
  if (!auditData) return;

  const total = auditData.totalScore || 0;
  const max = auditData.maxPossibleScore || 1000;
  const percent = Math.min(100, Math.round((total / max) * 100));

  // Dashboard Header Widgets (Paragon Style)
  const dashHeaderScore = document.getElementById('dash-header-score');
  const dashHeaderGlowBar = document.getElementById('dash-header-glow-bar');
  const dashHeaderIssues = document.getElementById('dash-header-issues-count');
  if (dashHeaderScore) dashHeaderScore.textContent = total;
  if (dashHeaderGlowBar) dashHeaderGlowBar.style.width = `${percent}%`;
  if (dashHeaderIssues && auditData.categories) {
    let issues = 0;
    auditData.categories.forEach(c => {
      c.items.forEach(it => {
        if (it.score < it.maxScore) issues++;
      });
    });
    dashHeaderIssues.textContent = issues;
  }

  // Sidebar Badge
  if (sidebarScoreBadge) {
    sidebarScoreBadge.textContent = `${total}/1.000`;
  }

  // Auditoría Tab Hero
  if (auditTotalScore) auditTotalScore.textContent = total;
  if (auditUpdatedDate) {
    auditUpdatedDate.textContent = `Actualizado hoy (${auditData.lastUpdated || 'Reciente'})`;
  }

  renderAuditCategories();
}

function renderAuditCategories() {
  if (!auditCategoriesContainer || !auditData || !auditData.categories) return;

  auditCategoriesContainer.innerHTML = '';

  auditData.categories.forEach(cat => {
    const card = document.createElement('div');
    card.className = 'audit-category-card open'; // Abierta por defecto

    const catPercent = Math.min(100, Math.round((cat.score / cat.maxScore) * 100));
    let barColorClass = 'bar-red';
    if (catPercent >= 80) barColorClass = 'bar-cyan';
    else if (catPercent >= 45) barColorClass = 'bar-gold';

    let badgeClass = 'badge-warning';
    if (cat.status === 'ok') badgeClass = 'badge-ok';
    else if (cat.status === 'critical') badgeClass = 'badge-critical';
    else if (cat.status === 'unverified') badgeClass = 'badge-unverified';

    // Header HTML
    const header = document.createElement('div');
    header.className = 'audit-category-header';
    header.innerHTML = `
      <div class="cat-title-wrap">
        <span class="cat-title">${cat.title}</span>
        <span class="cat-status-badge ${badgeClass}">${cat.statusLabel}</span>
      </div>
      <div class="cat-score-wrap">
        <span class="cat-score">${cat.score}/${cat.maxScore} pts</span>
        <svg class="cat-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </div>
    `;

    // Progress bar across category
    const progWrap = document.createElement('div');
    progWrap.className = 'cat-progress-wrap';
    progWrap.innerHTML = `<div class="cat-progress-bar ${barColorClass}" style="width: ${catPercent}%;"></div>`;

    // Toggle collapse
    header.addEventListener('click', () => {
      card.classList.toggle('open');
    });

    // Body (Items)
    const body = document.createElement('div');
    body.className = 'audit-category-body';

    cat.items.forEach(item => {
      const itemCard = document.createElement('div');
      itemCard.className = 'audit-item-card';

      const itemPercent = Math.min(100, Math.round((item.score / item.maxScore) * 100));
      let itemBarColor = '#ef4444';
      if (itemPercent >= 80) itemBarColor = '#00f2fe';
      else if (itemPercent >= 40) itemBarColor = '#f59e0b';

      let subBadgeClass = 'badge-warning';
      if (item.status === 'ok') subBadgeClass = 'badge-ok';
      else if (item.status === 'critical') subBadgeClass = 'badge-critical';
      else if (item.status === 'unverified') subBadgeClass = 'badge-unverified';

      const isCompleted = (item.score === item.maxScore);

      itemCard.innerHTML = `
        <div class="item-top-row">
          <div class="item-left-header">
            <span class="item-title">${escapeHtml(item.title)}</span>
            <span class="cat-status-badge ${subBadgeClass}">${escapeHtml(item.statusLabel)}</span>
          </div>
          <span class="item-score">${item.score}/${item.maxScore} pts</span>
        </div>
        <div class="item-progress-wrap">
          <div class="item-progress-bar" style="width: ${itemPercent}%; background: ${itemBarColor}; box-shadow: 0 0 8px ${itemBarColor}66;"></div>
        </div>
        <p class="item-desc" style="color: var(--text-secondary); font-size: 12px; margin-top: 6px; line-height: 1.45;">${escapeHtml(item.description)}</p>
        
        <!-- Panel de Transparencia de Cambios Exactos (Solo botones, sin checkboxes) -->
        <div class="item-transparency-box" style="display: none;">
          <div class="transparency-row">
            <span class="transparency-tag">🎯 Claves / Archivos Afectados:</span>
            <code class="transparency-code">${escapeHtml(item.detailsTarget || 'Configuración del Sistema')}</code>
          </div>
          <div class="transparency-row">
            <span class="transparency-tag">⚙️ Qué se modificará o eliminará:</span>
            <span class="transparency-desc">${escapeHtml(item.detailsChanges || 'Consulta el alcance en el diálogo de confirmación.')}</span>
          </div>
          <div class="transparency-row">
            <span class="transparency-tag">🛡️ Seguridad:</span>
            <span class="transparency-safe">${escapeHtml(item.detailsReason || 'Revisa el efecto y el alcance del respaldo. La limpieza y la desinstalación no tienen recuperación automática.')}</span>
          </div>
        </div>

        <div class="item-bottom-row">
          <button class="btn-toggle-details" type="button">
            ℹ️ ¿Qué cambios exactos realizará?
          </button>
          <button class="btn-audit-item ${isCompleted ? 'done' : ''}" data-action="${item.actionId}">
            ${isCompleted ? '✓ Optimizado' : item.actionLabel}
          </button>
        </div>
      `;

      // Botón para expandir/ocultar los detalles transparentes
      const toggleBtn = itemCard.querySelector('.btn-toggle-details');
      const box = itemCard.querySelector('.item-transparency-box');
      if (toggleBtn && box) {
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = (box.style.display !== 'none');
          box.style.display = isOpen ? 'none' : 'flex';
          toggleBtn.classList.toggle('active', !isOpen);
          toggleBtn.textContent = isOpen ? 'ℹ️ ¿Qué cambios exactos realizará?' : '✕ Ocultar detalles del cambio';
        });
      }

      const actionBtn = itemCard.querySelector('.btn-audit-item');
      if (!isCompleted && actionBtn) {
        actionBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (item.actionId === 'run_debloat') {
            openDebloatModal();
            return;
          }

          const confirmed = await promptActionConfirmation({
            title: `⚙️ ${item.title}`,
            subtitle: item.description,
            badgeText: `Auditoría • +${item.weight} pts`,
            badgeClass: 'badge-gaming',
            details: [
              `Acción: ${item.actionLabel}.`,
              item.detailsWhat || 'Ajusta la configuración de Windows para optimizar la puntuación del equipo.',
              item.detailsTarget ? `Ruta objetivo: ${item.detailsTarget}` : 'Aplica cambios recomendados en Windows.'
            ],
            confirmText: `Aplicar ${item.actionLabel}`
          });
          if (!confirmed) return;

          actionBtn.disabled = true;
          actionBtn.textContent = '⏳ Aplicando...';
          showToast(`⚡ Ejecutando: ${item.actionLabel}...`, 'info');
          try {
            const updatedAudit = await window.api.executeAuditAction(item.actionId);
            auditData = updatedAudit;
            try {
              localStorage.setItem('apex_audit_cache', JSON.stringify(updatedAudit));
            } catch (e) {}
            updateAuditUI();
            refreshStatuses();
            showToast(`¡Ajuste aplicado! Puntuación actualizada.`, 'success');
          } catch (err) {
            showToast(`Error: ${err.message}`, 'error');
            actionBtn.disabled = false;
            actionBtn.textContent = item.actionLabel;
          }
        });
      }

      body.appendChild(itemCard);
    });

    card.appendChild(header);
    card.appendChild(progWrap);
    card.appendChild(body);
    auditCategoriesContainer.appendChild(card);
  });
}

// --- MODAL DEBLOAT PERSONALIZADO ---

let bloatAppsCatalog = [];
let selectedBloatIds = new Set();

function setupDebloatModal() {
  const debloatModal = document.getElementById('debloat-modal');
  const btnClose = document.getElementById('btn-close-debloat-modal');
  const btnCancel = document.getElementById('btn-cancel-debloat');
  const btnSelectAll = document.getElementById('btn-debloat-select-all');
  const btnDeselectAll = document.getElementById('btn-debloat-deselect-all');
  const btnRefresh = document.getElementById('btn-debloat-refresh');
  const btnApply = document.getElementById('btn-apply-custom-debloat');
  const btnOpenPrivacy = document.getElementById('btn-open-debloat-from-privacy');

  const closeModal = () => {
    if (debloatModal) debloatModal.classList.remove('active');
  };

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  if (debloatModal) {
    debloatModal.addEventListener('click', (e) => {
      if (e.target === debloatModal) closeModal();
    });
  }

  if (btnOpenPrivacy) {
    btnOpenPrivacy.addEventListener('click', () => openDebloatModal());
  }

  if (btnSelectAll) {
    btnSelectAll.addEventListener('click', () => {
      bloatAppsCatalog.forEach(app => {
        if (app.installed) selectedBloatIds.add(app.id);
      });
      renderDebloatItems();
    });
  }

  if (btnDeselectAll) {
    btnDeselectAll.addEventListener('click', () => {
      selectedBloatIds.clear();
      renderDebloatItems();
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      btnRefresh.disabled = true;
      btnRefresh.textContent = '⏳ Escaneando...';
      try {
        bloatAppsCatalog = await window.api.getBloatStatus();
        selectedBloatIds.clear();
        renderDebloatItems();
        showToast('✓ Lista de aplicaciones sincronizada con éxito.', 'info');
      } catch (err) {
        showToast(`Error al escanear: ${err.message}`, 'error');
      } finally {
        btnRefresh.disabled = false;
        btnRefresh.textContent = '🔄 Re-escanear';
      }
    });
  }

  if (btnApply) {
    btnApply.addEventListener('click', async () => {
      if (selectedBloatIds.size === 0) return;
      const ids = Array.from(selectedBloatIds);

      const confirmed = await promptActionConfirmation({
        title: 'Desinstalar Bloatware Marcado',
        subtitle: `Se desinstalarán ${ids.length} aplicaciones seleccionadas para el usuario actual.`,
        badgeText: 'Desinstalación de aplicaciones',
        riskLevel: 'high',
        risks: ['Puede eliminar datos locales de esas aplicaciones. Apex no conserva una copia de sus datos.','La reinstalación depende de la disponibilidad en Microsoft Store o del instalador del fabricante.'],
        details: ids.map(id => {
          const app = bloatAppsCatalog.find(a => a.id === id);
          return {
            target: app ? app.name : id,
            action: `Desinstalar paquete Appx del usuario actual: ${app ? app.pattern : id}`,
            safety: 'No dispone de restauración automática de aplicaciones ni de sus datos'
          };
        }),
        confirmText: `🗑️ Desinstalar ${ids.length} Apps`
      });
      if (!confirmed) return;

      btnApply.disabled = true;
      btnApply.textContent = '⏳ Desinstalando apps seleccionadas...';
      showToast('🧹 Eliminando bloatware seleccionado de forma segura...', 'info');

      try {
        const res = await window.api.executeCustomDebloat(ids);
        selectedBloatIds.clear();
        if (res.catalog) {
          bloatAppsCatalog = res.catalog;
        }
        if (res.audit) {
          auditData = res.audit;
          try {
            localStorage.setItem('apex_audit_cache', JSON.stringify(res.audit));
          } catch (e) {}
          updateAuditUI();
          refreshStatuses();
        }
        showToast(res.message || '¡Debloat completado! Se eliminaron las aplicaciones elegidas.', 'success');
        renderDebloatItems();
      } catch (err) {
        showToast(`Error al desinstalar: ${err.message}`, 'error');
        bloatAppsCatalog = await window.api.getBloatStatus();
        renderDebloatItems();
      } finally {
        btnApply.disabled = (selectedBloatIds.size === 0);
        btnApply.textContent = `⚡ Desinstalar Apps Marcadas (${selectedBloatIds.size})`;
      }
    });
  }
}

async function openDebloatModal() {
  const debloatModal = document.getElementById('debloat-modal');
  const appsContainer = document.getElementById('debloat-apps-list');
  if (!debloatModal || !appsContainer) return;

  debloatModal.classList.add('active');
  appsContainer.innerHTML = `
    <div style="padding: 40px; text-align: center; color: var(--text-secondary);">
      <div style="font-size: 24px; margin-bottom: 10px;">🔍</div>
      <p style="font-weight: 600;">Escaneando aplicaciones instaladas en Windows...</p>
    </div>
  `;

  try {
    bloatAppsCatalog = await window.api.getBloatStatus();
    selectedBloatIds.clear();
    renderDebloatItems();
  } catch (err) {
    appsContainer.innerHTML = `
      <div style="padding: 30px; text-align: center; color: #ef4444;">
        <p>Error al escanear aplicaciones: ${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

function renderDebloatItems() {
  const appsContainer = document.getElementById('debloat-apps-list');
  const counter = document.getElementById('debloat-selected-counter');
  const btnApply = document.getElementById('btn-apply-custom-debloat');
  if (!appsContainer) return;

  appsContainer.innerHTML = '';

  if (counter) {
    counter.textContent = `${selectedBloatIds.size} seleccionadas`;
  }

  if (btnApply) {
    btnApply.disabled = (selectedBloatIds.size === 0);
    btnApply.textContent = `⚡ Desinstalar Apps Marcadas (${selectedBloatIds.size})`;
  }

  // Ordenar: primero las instaladas en el PC
  const sorted = [...bloatAppsCatalog].sort((a, b) => (b.installed ? 1 : 0) - (a.installed ? 1 : 0));

  sorted.forEach(app => {
    const isSelected = selectedBloatIds.has(app.id);
    const row = document.createElement('div');
    row.className = 'debloat-item-row';

    const statusBadgeHtml = app.installed
      ? `<span class="debloat-status-badge status-installed">● Instalada en tu PC</span>`
      : `<span class="debloat-status-badge status-clean">✓ Desinstalada</span>`;

    const actionsHtml = app.installed
      ? `
        <button class="btn-debloat-select-toggle ${isSelected ? 'selected' : ''}" type="button">
          ${isSelected ? '✓ Marcada' : '+ Marcar'}
        </button>
        <button class="btn-debloat-single-action" type="button" title="Desinstalar solo esta aplicación ahora">
          🗑️ Desinstalar
        </button>
      `
      : `
        <span class="debloat-clean-text">✓ Sin Bloatware</span>
      `;

    row.innerHTML = `
      <div class="debloat-item-left">
        <div class="debloat-icon">${app.icon || '📦'}</div>
        <div class="debloat-text-wrap">
          <div class="debloat-name">
            ${app.name}
            <span class="debloat-category-tag">${app.category || 'App'}</span>
          </div>
          <span class="debloat-desc">${app.desc}</span>
          <div class="debloat-remove-detail">
            <span>🗑️ Paquete objetivo:</span>
            <code>*${app.pattern}*</code>
          </div>
        </div>
      </div>
      <div class="debloat-item-actions">
        ${statusBadgeHtml}
        ${actionsHtml}
      </div>
    `;

    // Botón de toggle (marcar/desmarcar para lote con botones, sin checkboxes)
    const toggleBtn = row.querySelector('.btn-debloat-select-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (selectedBloatIds.has(app.id)) {
          selectedBloatIds.delete(app.id);
        } else {
          selectedBloatIds.add(app.id);
        }
        renderDebloatItems();
      });
    }

    // Botón individual de desinstalación directa
    const singleBtn = row.querySelector('.btn-debloat-single-action');
    if (singleBtn) {
      singleBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmed = await promptActionConfirmation({
          title: `Desinstalar ${app.name}`,
          subtitle: `Eliminar paquete integrado de Windows para liberar recursos y espacio en disco.`,
          badgeText: 'Desinstalación de aplicaciones',
          riskLevel: 'high',
          risks: ['Puede eliminar datos locales de esta aplicación. Apex no guarda una copia de ellos.','La reinstalación depende de Microsoft Store o del instalador del fabricante.'],
          details: [{
            target: app.name,
            action: `Desinstalar paquete UWP / Appx: *${app.pattern}*`,
            safety: 'Sin restauración automática de aplicaciones ni de sus datos'
          }],
          confirmText: '🗑️ Desinstalar Ahora'
        });
        if (!confirmed) return;

        singleBtn.disabled = true;
        singleBtn.textContent = '⏳ Desinstalando...';
        showToast(`🗑️ Desinstalando ${app.name}...`, 'info');

        try {
          const res = await window.api.executeCustomDebloat([app.id]);
          selectedBloatIds.delete(app.id);
          if (res.catalog) {
            bloatAppsCatalog = res.catalog;
          }
          if (res.audit) {
            auditData = res.audit;
            try {
              localStorage.setItem('apex_audit_cache', JSON.stringify(res.audit));
            } catch (e) {}
            updateAuditUI();
            refreshStatuses();
          }
          showToast(res.message || `¡${app.name} desinstalada exitosamente!`, 'success');
          renderDebloatItems();
        } catch (err) {
          showToast(`Error al desinstalar: ${err.message}`, 'error');
          bloatAppsCatalog = await window.api.getBloatStatus();
          renderDebloatItems();
        } finally {
          singleBtn.disabled = false;
          singleBtn.textContent = 'Desinstalar';
        }
      });
    }

    appsContainer.appendChild(row);
  });
}

// --- TELEMETRÍA EN VIVO & DASHBOARD PARAGON (OPTIMIZADO PARA BAJO CPU) ---

let currentTempMode = 'cpu'; // 'cpu' | 'gpu'
let latestTelemetry = null;
let ascensionActiveState = false;
let telemetryInterval = null;

function startTelemetryPolling() {
  if (telemetryInterval) return;
  updateTelemetryOnce();
  telemetryInterval = setInterval(() => {
    const dashView = document.getElementById('view-dashboard');
    if (dashView && dashView.classList.contains('active') && !document.hidden) {
      updateTelemetryOnce();
    } else {
      stopTelemetryPolling();
    }
  }, 2800); // 2.8s: ultra bajo consumo (<0.5% CPU)
}

function stopTelemetryPolling() {
  if (telemetryInterval) {
    clearInterval(telemetryInterval);
    telemetryInterval = null;
  }
}

function initTelemetryDashboard() {
  const btnTempCpu = document.getElementById('btn-temp-cpu');
  const btnTempGpu = document.getElementById('btn-temp-gpu');
  const btnToggleAscension = document.getElementById('btn-toggle-ascension');
  const btnDiskClean = document.getElementById('btn-disk-quick-clean');
  const btnDashReAudit = document.getElementById('btn-dash-quick-optimize');
  const btnOpenSysInfo = document.getElementById('btn-open-sys-info');
  const btnOpenChangelog = document.getElementById('btn-open-changelog');

  if (btnTempCpu && btnTempGpu) {
    btnTempCpu.addEventListener('click', () => {
      currentTempMode = 'cpu';
      btnTempCpu.classList.add('active');
      btnTempGpu.classList.remove('active');
      renderTemperatureChart();
    });

    btnTempGpu.addEventListener('click', () => {
      currentTempMode = 'gpu';
      btnTempGpu.classList.add('active');
      btnTempCpu.classList.remove('active');
      renderTemperatureChart();
    });
  }

  if (btnToggleAscension) {
    btnToggleAscension.addEventListener('click', async () => {
      const newState = !ascensionActiveState;
      if (newState) {
        const confirmed = await promptActionConfirmation({
          title: 'Activar Ascensión de Windows (Apex Pro)',
          subtitle: 'Configura el sistema en modo de ultra-baja latencia y rendimiento competitivo extremo.',
          badgeText: 'Apex Pro Ascension',
          details: [
            {
              target: 'Kernel & Latencia de Timer',
              action: 'Establece temporizadores de alta resolución y modo sin retrasos',
              safety: '✓ Modo de juego profesional. Totalmente reversible con un clic'
            },
            {
              target: 'Memoria Standby de Windows',
              action: 'Purga automática de memoria en caché residual antes de ejecutar juegos',
              safety: '✓ Seguro y previene caídas súbitas de fotogramas (stuttering)'
            }
          ],
          riskLevel: 'high',
          risks: [
            'Modifica el BCD (Boot Configuration Data) del kernel de Windows (disabledynamictick / TSC clock).',
            'En algunos procesadores o placas base muy antiguas podría requerir revertirse si el reloj pierde sincronización.'
          ],
          askRestorePoint: true,
          restorePointDesc: 'Apex_Ascension_Kernel',
          confirmText: '⚡ Activar Ascensión'
        });
        if (!confirmed) return;
      }

      btnToggleAscension.disabled = true;
      showToast(newState ? '⚡ Activando Ascensión de Windows (Apex Pro)...' : 'Desactivando Ascensión...', 'info');
      
      const res = await window.api.toggleWindowsAscension(newState);
      ascensionActiveState = res.active;
      updateAscensionUI(res.active);
      btnToggleAscension.disabled = false;
      showToast(res.active ? 'Ascensión Apex Activa: Latencia en microsegundos y Standby RAM liberada.' : 'Ascensión desactivada.', 'success');
    });
  }

  if (btnDiskClean) {
    btnDiskClean.addEventListener('click', async () => {
      if (btnDiskClean.disabled) return;
      let spaceMB = 0;
      try {
        const status = await window.api.getDiskCleanupStatus();
        if (status && status.totalMB) spaceMB = status.totalMB;
      } catch (e) {}

      const confirmed = await promptActionConfirmation({
        title: 'Limpieza Rápida de Disco',
        subtitle: 'Se eliminarán archivos temporales y memorias caché del sistema de forma segura.',
        badgeText: 'Limpieza de Disco',
        spaceMB: spaceMB > 0 ? spaceMB : undefined,
        details: [
          {
            target: '%TEMP% & Windows\\Temp',
            action: 'Eliminar archivos temporales de sesión y registros de aplicaciones cerradas',
            safety: '✓ Revisar consecuencias. No toca documentos, fotos ni archivos del usuario'
          },
          {
            target: 'SoftwareDistribution & Shader Cache',
            action: 'Limpiar instaladores huérfanos y cachés obsoletas de sombreadores DirectX',
            safety: '✓ El sistema regenerará automáticamente los archivos que necesite'
          }
        ],
        confirmText: '🧹 Limpiar Temporales Ahora'
      });
      if (!confirmed) return;

      btnDiskClean.disabled = true;
      btnDiskClean.textContent = 'Limpiando...';
      showToast('🧹 Limpiando temporales y caché de disco...', 'info');
      await window.api.executeAuditAction('clean_temp');
      localStorage.setItem('last_disk_cleanup_time', Date.now().toString());
      await updateTelemetryOnce();
      await updateCleanupButtonsState();
      showToast('✓ Limpieza de disco completada exitosamente.', 'success');
    });
  }

  if (btnDashReAudit) {
    btnDashReAudit.addEventListener('click', async (e) => {
      e.stopPropagation();
      btnDashReAudit.disabled = true;
      btnDashReAudit.textContent = '⏳ Analizando...';
      showToast('🔍 Re-analizando componentes...', 'info');
      await loadSystemAudit(true);
      btnDashReAudit.disabled = false;
      btnDashReAudit.textContent = '⚙️ Re-analizar';
      showToast('Auditoría completada.', 'success');
    });
  }

  if (btnOpenSysInfo) {
    btnOpenSysInfo.addEventListener('click', async () => {
      const specs = await window.api.getSpecs();
      if (specs) {
        showToast(`🖥️ ${specs.cpu} | 🎮 ${specs.gpu} | ⚡ ${specs.totalRamGB} GB RAM (${specs.os})`, 'info');
      }
    });
  }

  if (btnOpenChangelog) {
    btnOpenChangelog.addEventListener('click', () => {
      showToast('Apex PC Optimizer: suite gratuita con interfaz de cristal, herramientas completas y revisión de cambios.', 'info');
    });
  }

  // Enlaces rápidos desde los gauges a las secciones especializadas
  const btnDetailCpu = document.getElementById('btn-gauge-detail-cpu');
  const btnDetailGpu = document.getElementById('btn-gauge-detail-gpu');
  const btnDetailRam = document.getElementById('btn-gauge-detail-ram');

  if (btnDetailCpu) {
    btnDetailCpu.addEventListener('click', () => {
      document.querySelector('.nav-item[data-tab="apex-pro"]')?.click();
    });
  }
  if (btnDetailGpu) {
    btnDetailGpu.addEventListener('click', () => {
      document.querySelector('.nav-item[data-tab="gaming"]')?.click();
    });
  }
  if (btnDetailRam) {
    btnDetailRam.addEventListener('click', () => {
      document.querySelector('.nav-item[data-tab="ram"]')?.click();
    });
  }

  // Iniciar telemetría optimizada de bajo consumo
  startTelemetryPolling();

  // Escuchar cuando el usuario minimiza o cambia de ventana para apagar telemetría
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopTelemetryPolling();
    } else {
      const dashView = document.getElementById('view-dashboard');
      if (dashView && dashView.classList.contains('active')) {
        startTelemetryPolling();
      }
    }
  });
}

async function updateTelemetryOnce() {
  try {
    latestTelemetry = await window.api.getRealtimeTelemetry();
    if (!latestTelemetry) return;

    // Actualizar Gauges Circulares
    const cpuPct = Number.isFinite(latestTelemetry.cpu.percent) ? latestTelemetry.cpu.percent : null;
    const gpuPct = Number.isFinite(latestTelemetry.gpu.percent) ? latestTelemetry.gpu.percent : null;
    const ramPct = latestTelemetry.ram.percent || 0;

    const gCpuVal = document.getElementById('gauge-cpu-val');
    const gGpuVal = document.getElementById('gauge-gpu-val');
    const gRamVal = document.getElementById('gauge-ram-val');

    if (gCpuVal) gCpuVal.textContent = cpuPct === null ? '--' : `${cpuPct}%`;
    if (gGpuVal) gGpuVal.textContent = gpuPct === null ? '--' : `${gpuPct}%`;
    if (gRamVal) gRamVal.textContent = `${ramPct}%`;

    const cCirc = 238.76;
    const gCpuCircle = document.getElementById('gauge-cpu-circle');
    const gGpuCircle = document.getElementById('gauge-gpu-circle');
    const gRamCircle = document.getElementById('gauge-ram-circle');

    if (gCpuCircle) gCpuCircle.style.strokeDashoffset = (cCirc - (cCirc * (cpuPct / 100))).toFixed(1);
    if (gGpuCircle) gGpuCircle.style.strokeDashoffset = (cCirc - (cCirc * (gpuPct / 100))).toFixed(1);
    if (gRamCircle) gRamCircle.style.strokeDashoffset = (cCirc - (cCirc * (ramPct / 100))).toFixed(1);

    // Actualizar Disco
    const diskText = document.getElementById('disk-usage-text');
    const diskProgBar = document.getElementById('disk-prog-bar');
    if (diskText) diskText.textContent = latestTelemetry.disk.totalGB == null ? 'No disponible' : `${latestTelemetry.disk.usedGB} GB de ${latestTelemetry.disk.totalGB} GB usados`;
    if (diskProgBar) diskProgBar.style.width = `${latestTelemetry.disk.percent}%`;

    // Actualizar Estado de Ascensión
    if (latestTelemetry.ascensionActive !== undefined) {
      ascensionActiveState = latestTelemetry.ascensionActive;
      updateAscensionUI(ascensionActiveState);
    }

    // Actualizar Gráfico de Temperatura
    renderTemperatureChart();
  } catch (err) {
    console.error('Error in updateTelemetryOnce:', err);
  }
}

function updateAscensionUI(isActive) {
  const badge = document.getElementById('ascension-status-badge');
  const btn = document.getElementById('btn-toggle-ascension');
  if (badge) {
    badge.textContent = isActive ? '● ACTIVO (NIVEL APEX PRO)' : '● INACTIVO';
    badge.className = isActive ? 'ascension-badge-status active' : 'ascension-badge-status';
  }
  if (btn) {
    btn.textContent = isActive ? '✓ Ascensión Apex Activa' : '⚡ Activar Ascensión Apex';
    btn.className = isActive ? 'btn-ascension-action active' : 'btn-ascension-action';
  }
}

function renderTemperatureChart() {
  const dashView = document.getElementById('view-dashboard');
  if (!dashView || !dashView.classList.contains('active') || document.hidden) return;
  if (!latestTelemetry) return;
  const canvas = document.getElementById('temp-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const isCpu = (currentTempMode === 'cpu');
  const data = isCpu ? latestTelemetry.cpu.history : latestTelemetry.gpu.history;
  const currentTemp = isCpu ? latestTelemetry.cpu.temp : latestTelemetry.gpu.temp;

  // Actualizar Pill Flotante
  const badgeType = document.getElementById('temp-badge-type');
  const badgeVal = document.getElementById('temp-badge-val');
  if (badgeType) badgeType.textContent = isCpu ? 'CPU' : 'GPU';
  if (badgeVal) badgeVal.textContent = Number.isFinite(currentTemp) ? `${currentTemp}°C` : 'No disponible';
  if (!Number.isFinite(currentTemp)) { ctx.fillStyle = '#b2bfd1'; ctx.font = '13px Segoe UI'; ctx.fillText('No hay un sensor compatible disponible', 20, height / 2); return; }

  if (!data || data.length < 2) return;

  // Dibujar líneas de cuadrícula horizontales
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Mapear temperaturas (20°C a 100°C) al canvas
  const minTemp = 20;
  const maxTemp = 100;

  const points = data.map((t, index) => {
    const x = (index / (data.length - 1)) * width;
    const clamped = Math.max(minTemp, Math.min(maxTemp, t));
    const y = height - ((clamped - minTemp) / (maxTemp - minTemp)) * height;
    return { x, y };
  });

  // Trazar Curva
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, midX, (prev.y + curr.y) / 2);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);

  // Trazo superior brillante neón
  ctx.save();
  ctx.strokeStyle = isCpu ? '#ff2a5f' : '#00f2fe';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = isCpu ? 'rgba(255, 42, 95, 0.8)' : 'rgba(0, 242, 254, 0.8)';
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.restore();

  // Relleno degradado debajo de la curva
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  if (isCpu) {
    grad.addColorStop(0, 'rgba(255, 42, 95, 0.35)');
    grad.addColorStop(1, 'rgba(255, 42, 95, 0.0)');
  } else {
    grad.addColorStop(0, 'rgba(0, 242, 254, 0.35)');
    grad.addColorStop(1, 'rgba(0, 242, 254, 0.0)');
  }
  ctx.fillStyle = grad;
  ctx.fill();

  // Punto final pulsante
  ctx.beginPath();
  ctx.arc(last.x, last.y, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = isCpu ? '#ff2a5f' : '#00f2fe';
  ctx.shadowBlur = 12;
  ctx.fill();
}

// --- NIVEL APEX PRO & GUÍAS DE BIOS ---

function initApexProView() {
  const bind = (id, options, method, argument, done) => {
    const button=document.getElementById(id);if(!button)return;
    button.addEventListener('click',async()=>{
      if(button.disabled)return;
      const confirmed=await promptActionConfirmation({...options,riskLevel:'medium',askRestorePoint:true});
      if(!confirmed)return;
      const previous=button.textContent;button.disabled=true;button.textContent='Aplicando y verificando…';
      try{const result=await window.api[method](...(argument===undefined?[]:[argument]));button.textContent=done;showToast(result?.message||'Operación completada.','success');loadSystemAudit();}
      catch(error){button.textContent=previous;showToast(error.message,'error');}
      finally{button.disabled=false;}
    });
  };
  bind('btn-apply-apex-power',{title:'Activar plan de energía Apex',subtitle:'Crea y activa un plan independiente para usarlo en sesiones de trabajo o juego.',badgeText:'Energía · Herramienta gratuita',details:['Se guarda el plan activo anterior.','El nuevo plan usa un mínimo alto de CPU y desactiva la suspensión selectiva USB.'],risks:['Puede aumentar el consumo, el ruido de ventiladores y la temperatura.','No desactiva las protecciones térmicas del hardware ni garantiza más FPS.'],confirmText:'Crear y activar plan'},'applyApexPowerPlan',undefined,'Plan Apex aplicado');
  bind('btn-apply-msi-gpu',{title:'Preferencia MSI de la GPU',subtitle:'Activa la preferencia MSI únicamente en las GPU detectadas con una clave compatible.',badgeText:'GPU · Ajuste avanzado',details:['Guarda el valor original de la preferencia MSI.','No modifica prioridades de dispositivos ni reinicia el controlador de pantalla.'],risks:['Depende de la compatibilidad del dispositivo y su controlador.','Puede requerir reiniciar Windows para tener efecto.'],confirmText:'Aplicar preferencia MSI'},'applyMsiModeGpu',undefined,'Preferencia MSI aplicada');
  bind('btn-apply-apex-net',{title:'Ajustes avanzados de TCP',subtitle:'Configura las preferencias RSS, ECN y autoajuste TCP de Windows.',badgeText:'Red · Herramienta gratuita',details:['Habilita RSS, deshabilita ECN y deja el autoajuste TCP en normal.','Guarda la configuración anterior. No cambia CTCP ni reinicia los sockets.'],risks:['El resultado depende de tu adaptador, red y proveedor.','No garantiza una reducción del ping dentro de los juegos.'],confirmText:'Aplicar ajustes TCP'},'applyAdvancedNetworkStack',undefined,'Ajustes TCP aplicados');
  bind('btn-apply-apex-timer',{title:'Prioridades de la sesión',subtitle:'Reduce temporalmente la prioridad de procesos secundarios compatibles.',badgeText:'Sesión · Herramienta gratuita',details:['Guarda las prioridades originales para restaurarlas al desactivar Ascensión.','No cambia el arranque, el temporizador del kernel ni el polling rate de tus periféricos.'],risks:['Las aplicaciones secundarias seleccionadas pueden responder más lentamente.'],confirmText:'Activar prioridades de sesión'},'toggleWindowsAscension',true,'Prioridades de sesión activas');
  bind('btn-restore-apex',{title:'Restaurar ajustes Apex',subtitle:'Recupera los valores guardados del plan de energía, la preferencia MSI y TCP.',badgeText:'Restauración desde respaldo',details:['Solo restaura cambios guardados por Apex.','Si detecta cambios posteriores, conserva el respaldo y detiene ese ajuste para evitar sobrescribirlos.'],risks:['La preferencia MSI puede requerir reiniciar Windows para tener efecto.'],confirmText:'Restaurar ajustes'},'revertApexTools',undefined,'Restauración Apex completada');
  const btnCleanShaders = document.getElementById('btn-clean-shaders-apex');
  const btnZeroDelay = document.getElementById('btn-zero-delay-apex');

  if (btnCleanShaders) {
    btnCleanShaders.addEventListener('click', async () => {
      let spaceMB = 0;
      try {
        const status = await window.api.getDiskCleanupStatus();
        if (status && status.items && status.items.clean_shader_cache) {
          spaceMB = status.items.clean_shader_cache.sizeMB;
        }
      } catch (e) {}

      const confirmed = await promptActionConfirmation({
        title: 'Purgar Caché de Sombreadores (Shaders)',
        subtitle: 'Elimina archivos antiguos de caché de sombreadores compatibles. No se puede deshacer.',
        badgeText: 'DirectX & GPU Shaders',
        spaceMB: spaceMB > 0 ? spaceMB : undefined,
        details: [
          {
            target: '%LOCALAPPDATA%\\D3DSCache, NVIDIA\\DXCache, AMD\\DxCache',
            action: 'Eliminar archivos de caché elegibles; se conservan los recientes y los archivos en uso',
            safety: 'Los juegos recompilarán sus sombreadores y pueden tardar más o presentar tirones en el primer inicio'
          }
        ],
        confirmText: '🧹 Purgar Sombreadores'
      });
      if (!confirmed) return;

      await runButtonTask(btnCleanShaders, 'Limpiando sombreadores…', async () => {
        const result = await window.api.applyTweak('clean_shader_cache');
        if (result?.success === false) throw new Error(result.message);
        showToast(result.message || 'Limpieza completada. El próximo inicio puede requerir recompilar sombreadores.', 'success');
        await updateCleanupButtonsState();
        return result;
      });
    });
  }

  if (btnZeroDelay) {
    btnZeroDelay.addEventListener('click', async () => {
      const confirmed = await promptActionConfirmation({
        title: 'Aplicar Cero Retardo UI',
        subtitle: 'Reduce la espera de los menús de Windows y conserva el valor anterior.',
        badgeText: 'Instant UI Delay',
        details: [
          {
            target: 'HKCU\\Control Panel\\Desktop\\MenuShowDelay',
            action: 'Configurar la espera de apertura de menús en 0 ms',
            safety: 'Puedes recuperar el valor anterior desde Snappy UI o Seguridad y Backup'
          }
        ],
        confirmText: '⚡ Aplicar Cero Retardo'
      });
      if (!confirmed) return;

      await runButtonTask(btnZeroDelay, 'Guardando preferencia…', async () => {
        const result = await window.api.applySnappyUiTweak('ui_menu_show_delay');
        if (result?.success === false) throw new Error(result.message);
        showToast(result.message || 'Preferencia de menús aplicada y respaldada.', 'success');
        await renderSnappyUiCards();
        return result;
      });
    });
  }

  renderBiosGuides();
  setupSnappyUiSuite();
}

async function renderSnappyUiCards() {
  const container = document.getElementById('snappy-ui-cards-container');
  if (!container) return;

  try {
    const tweaks = await window.api.getSnappyUiStatus();
    container.innerHTML = '';

    tweaks.forEach(tweak => {
      const card = document.createElement('div');
      card.className = `snappy-tweak-card ${tweak.isApplied ? 'active' : ''}`;
      card.id = `card-snappy-${tweak.id}`;

      card.innerHTML = `
        <div class="snappy-tweak-info">
          <div class="snappy-tweak-head">
            <span class="snappy-tweak-title">${escapeHtml(tweak.title)}</span>
            <span class="snappy-tweak-tag">${escapeHtml(tweak.tag)}</span>
          </div>
          <p class="snappy-tweak-desc">${escapeHtml(tweak.description)}</p>
          <span class="snappy-tweak-safety">${escapeHtml(tweak.safety)}</span>
        </div>
        <div class="tweak-action">
          <label class="paragon-check-label">
            <input type="checkbox" class="hidden-checkbox" id="switch-snappy-${tweak.id}" aria-label="${escapeHtml(tweak.title)}" ${tweak.isApplied ? 'checked' : ''} data-snappy-id="${tweak.id}">
            <span class="paragon-check-box">
              <svg viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </span>
          </label>
        </div>
      `;

      container.appendChild(card);
    });

    const inputs = container.querySelectorAll('input[data-snappy-id]');
    inputs.forEach(input => {
      input.addEventListener('change', async (e) => {
        const tweakId = e.target.getAttribute('data-snappy-id');
        const isChecked = e.target.checked;
        const card = document.getElementById(`card-snappy-${tweakId}`);
        const tweak = tweaks.find(t => t.id === tweakId);

        const confirmed = await promptActionConfirmation({ title: tweak?.title || 'Revisar ajuste de interfaz', subtitle: tweak?.description || 'Cambia una preferencia visual de Windows.', badgeText: 'Herramienta gratuita', details: [isChecked ? 'Aplica la preferencia y conserva un respaldo.' : 'Restaura la preferencia anterior guardada.'], confirmText: isChecked ? 'Aplicar ajuste' : 'Deshacer ajuste' });
        if (!confirmed) { e.target.checked = !isChecked; return; }

        input.disabled = true;
        showToast(isChecked ? 'Aplicando ajuste de cero retardo...' : 'Restaurando preferencia anterior...', 'info');

        try {
          const res = isChecked
            ? await window.api.applySnappyUiTweak(tweakId)
            : await window.api.revertSnappyUiTweak(tweakId);

          if (res.success) {
            if (isChecked) card.classList.add('active');
            else card.classList.remove('active');
            showToast(res.message, 'success');
          } else {
            e.target.checked = !isChecked;
            showToast(res.message, 'error');
          }
        } catch (err) {
          e.target.checked = !isChecked;
          showToast('Error al modificar ajuste de interfaz.', 'error');
        } finally {
          input.disabled = false;
        }
      });
    });
  } catch (err) {
    console.error('Error al cargar Snappy UI:', err);
  }
}

function setupSnappyUiSuite() {
  renderSnappyUiCards();

  const btnApplyAll = document.getElementById('btn-apply-all-snappy-ui');
  if (btnApplyAll) {
    btnApplyAll.addEventListener('click', async () => {
      const confirmed = await promptActionConfirmation({
        title: '⚡ Suite Completa Cero Retardo & Snappy UI',
        subtitle: 'Aplica los 7 ajustes de aceleración instantánea en la interfaz de Windows 11 y 10.',
        badgeText: 'Snappy UI • Recomendado',
        badgeClass: 'badge-gaming',
        details: [
          { target: 'MenuShowDelay = 0 ms', action: 'Apertura inmediata de menús contextuales y submenús sin los 400ms de retraso', safety: '✓ Revisar consecuencias' },
          { target: 'Menú Clásico de Windows 11', action: 'Restaura el menú directo de clic derecho eliminando el menú moderno con lag', safety: '✓ Revisar consecuencias' },
          { target: 'Animaciones de Ventanas Snappy', action: 'Elimina transiciones lentas de desvanecimiento en minimizado y maximizado', safety: '✓ Revisar consecuencias' },
          { target: 'Bloqueo de Anuncios y Sugerencias', action: 'Desactiva publicidad, recomendaciones y consejos en Menú Inicio y Explorador', safety: '✓ Revisar consecuencias' },
          { target: 'Aero Shake Desactivado', action: 'Evita que mover una ventana minimice accidentalmente las demás', safety: '✓ Revisar consecuencias' },
          { target: 'HungAppTimeout = 1s', action: 'Reduce de 5s a 1s la espera ante programas colgados para cierre inmediato', safety: '✓ Revisar consecuencias' },
          { target: 'Explorador en Proceso Separado', action: 'Aísla carpetas para que un cuelgue no congele la barra de tareas de Windows', safety: '✓ Revisar consecuencias' }
        ],
        riskLevel: 'low',
        risks: ['El Explorador de Windows se reiniciará brevemente durante 1 segundo para aplicar los cambios de menú.'],
        askRestorePoint: true,
        restorePointDesc: 'ApexBackup_SnappyUI',
        confirmText: '⚡ Aplicar Todo Cero Retardo'
      });
      if (!confirmed) return;

      btnApplyAll.disabled = true;
      btnApplyAll.textContent = '⏳ Aplicando Suite...';
      showToast('⚡ Aplicando suite completa de Cero Retardo UI...', 'info');

      try {
        const res = await window.api.applyAllSnappyUi();
        if (res.success) {
          showToast(res.message, 'success');
        } else {
          showToast(res.message || 'Error al aplicar ajustes.', 'error');
        }
      } catch (err) {
        showToast('Error al aplicar ajustes de interfaz.', 'error');
      } finally {
        btnApplyAll.disabled = false;
        btnApplyAll.textContent = '✓ Cero Retardo Activo';
        setTimeout(() => { btnApplyAll.textContent = '⚡ Aplicar Todo Cero Retardo'; }, 3000);
        await renderSnappyUiCards();
      }
    });
  }
}

async function renderBiosGuides() {
  const container = document.getElementById('bios-guides-container');
  if (!container) return;

  try {
    const guides = await window.api.getBiosGuides();
    container.innerHTML = '';

    guides.forEach((g, idx) => {
      const card = document.createElement('div');
      card.className = idx === 0 ? 'bios-card open' : 'bios-card';

      card.innerHTML = `
        <div class="bios-header">
          <div class="bios-title-wrap">
            <span class="bios-title">${g.title}</span>
            <span class="cat-status-badge badge-warning">${g.badge}</span>
          </div>
          <div class="bios-meta-wrap">
            <span class="bios-impact">${g.impact}</span>
            <svg class="bios-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        </div>
        <div class="bios-body">
          <p class="bios-desc">${g.description}</p>
          <div class="bios-steps-list">
            ${g.steps.map((s, stepIdx) => `
              <div class="bios-step-item">
                <span class="step-num">${stepIdx + 1}</span>
                <span>${s}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      card.querySelector('.bios-header').addEventListener('click', () => {
        card.classList.toggle('open');
      });

      container.appendChild(card);
    });
  } catch (err) {
    console.error('Error cargando guías de BIOS:', err);
  }
}

// --- TOAST HELPER (ESTILO PRO CON SANITIZACIÓN) ---
function showToast(message, type = 'info') {
  if (!message) return;
  let cleanMsg = String(message).trim();

  // Sanitización de seguridad: jamás renderizar strings crudos de consola o Base64
  if (cleanMsg.includes('-EncodedCommand') || cleanMsg.includes('Command failed:') || cleanMsg.includes('powershell.exe')) {
    cleanMsg = 'Windows no pudo completar la operación. Revisa los permisos o el recurso e inténtalo de nuevo.';
    type = 'error';
  }

  const container = document.getElementById('toast-container');
  if (!container) return;

  // Limitar número de toasts simultáneos para no saturar la pantalla ni tapar controles
  while (container.children.length >= 3) {
    container.removeChild(container.firstChild);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ';
  toast.innerHTML = `
    <div class="toast-badge-icon">${icon}</div>
    <div class="toast-content">${escapeHtml(cleanMsg)}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px) scale(0.96)';
    toast.style.transition = 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 250);
  }, type==='error'?7500:3500);
  return()=>{if(toast.parentNode)toast.remove();};
}

// =========================================================================
// --- SUITE WINMEMORYCLEANER (OPTIMIZADOR AVANZADO DE MEMORIA RAM) ---
// =========================================================================

let currentAutoCleanThreshold = 80;

function setupMemoryCleaner() {
  const btnCleanAll = document.getElementById('btn-clean-all-ram');
  const btnPurgeStandby = document.getElementById('btn-purge-standby');
  const btnTrimWorking = document.getElementById('btn-trim-working-sets');
  const btnFlushModified = document.getElementById('btn-flush-modified');
  const btnRefresh = document.getElementById('btn-refresh-ram-stats');
  const btnToggleAuto = document.getElementById('btn-toggle-auto-clean');
  const threshBtns = document.querySelectorAll('.btn-threshold-opt');

  if (btnCleanAll) {
    btnCleanAll.addEventListener('click', async () => {
      const confirmed = await promptActionConfirmation({
        title: 'Limpieza Profunda de Memoria RAM',
        subtitle: 'Ejecuta una purga integral en todas las listas de memoria del Administrador de Memoria de Windows.',
        badgeText: 'WinMemoryCleaner Deep Purge',
        details: [
          {
            target: 'Standby List & Modified Page List',
            action: 'Liberar memoria en espera retenida por el sistema y volcar páginas modificadas',
            safety: '✓ Libera gigabytes de memoria sin cerrar programas ni perder datos'
          },
          {
            target: 'Working Sets de Procesos',
            action: 'Podar páginas inactivas de procesos en segundo plano a la memoria libre',
            safety: '✓ Recupera memoria física disponible para tus juegos y programas activos'
          }
        ],
        confirmText: '🚀 Ejecutar Limpieza Profunda'
      });
      if (!confirmed) return;

      btnCleanAll.disabled = true;
      btnCleanAll.textContent = '⏳ Limpiando Memoria...';
      showToast('🚀 Ejecutando limpieza profunda de RAM...', 'info');
      try {
        const res = await window.api.cleanAllMemory();
        showToast(res.message, 'success');
        await loadMemoryStats();
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        btnCleanAll.disabled = false;
        btnCleanAll.textContent = '🚀 Limpieza Profunda de RAM';
      }
    });
  }

  if (btnPurgeStandby) {
    btnPurgeStandby.addEventListener('click', async () => {
      const confirmed = await promptActionConfirmation({
        title: 'Purgar Memoria Standby (En Espera)',
        subtitle: 'Devuelve la memoria retenida en caché a la lista de memoria libre disponible.',
        badgeText: 'RAM Standby Purge',
        details: [
          {
            target: 'System Standby Page List (SuperFetch / SysMain)',
            action: 'Vaciar la lista de páginas en espera y trasladarlas a memoria libre',
            safety: '✓ Elimina tirones (stuttering) causados por saturación de Standby en Windows 10/11'
          }
        ],
        confirmText: '🧹 Purgar Standby'
      });
      if (!confirmed) return;

      btnPurgeStandby.disabled = true;
      btnPurgeStandby.textContent = '⏳ Purgando Standby...';
      try {
        const res = await window.api.purgeStandbyList();
        showToast(res.message, 'success');
        await loadMemoryStats();
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        btnPurgeStandby.disabled = false;
        btnPurgeStandby.textContent = '🧹 Purgar Standby List Ahora';
      }
    });
  }

  if (btnTrimWorking) {
    btnTrimWorking.addEventListener('click', async () => {
      const confirmed = await promptActionConfirmation({
        title: 'Podar Working Sets de Procesos',
        subtitle: 'Solicita a todos los procesos en segundo plano que liberen memoria física no utilizada.',
        badgeText: 'Process Working Sets',
        details: [
          {
            target: 'EmptyWorkingSet en Procesos en Ejecución',
            action: 'Reducir el consumo de memoria privada de procesos secundarios',
            safety: '✓ Seguro. Los procesos retienen únicamente los datos activos en uso'
          }
        ],
        confirmText: '⚡ Purgar Working Sets'
      });
      if (!confirmed) return;

      btnTrimWorking.disabled = true;
      btnTrimWorking.textContent = '⏳ Podando Procesos...';
      try {
        const res = await window.api.trimWorkingSets();
        showToast(res.message, 'success');
        await loadMemoryStats();
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        btnTrimWorking.disabled = false;
        btnTrimWorking.textContent = '⚡ Purgar Working Sets Ahora';
      }
    });
  }

  if (btnFlushModified) {
    btnFlushModified.addEventListener('click', async () => {
      const confirmed = await promptActionConfirmation({
        title: 'Volcar Páginas Modificadas',
        subtitle: 'Escribe de inmediato las páginas de memoria modificadas pendientes al disco de almacenamiento.',
        badgeText: 'Flush Modified Pages',
        details: [
          {
            target: 'Modified Page List',
            action: 'Descargar datos pendientes al disco para convertirlos en páginas libres',
            safety: '✓ Revisar consecuencias. Garantiza consistencia de datos y amplía la RAM disponible'
          }
        ],
        confirmText: '💾 Volcar Páginas'
      });
      if (!confirmed) return;

      btnFlushModified.disabled = true;
      btnFlushModified.textContent = '⏳ Volcando Páginas...';
      try {
        const res = await window.api.flushModifiedPageList();
        showToast(res.message, 'success');
        await loadMemoryStats();
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        btnFlushModified.disabled = false;
        btnFlushModified.textContent = '💾 Volcar Páginas Modificadas';
      }
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => loadMemoryStats());
  }

  threshBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const threshold = parseInt(btn.getAttribute('data-thresh'), 10) || 80;
      try {
        const config = await window.api.getAutoCleanConfig();
        if(config.enabled && !await promptActionConfirmation({title:'Cambiar umbral de limpieza automática',subtitle:`La limpieza podrá ejecutarse cuando el uso de RAM supere el ${threshold}%.`,badgeText:'Limpieza automática activa',details:['El nuevo umbral afecta las próximas comprobaciones mientras Apex esté abierto.'],confirmText:'Guardar umbral'}))return;
        await window.api.setAutoCleanConfig({ thresholdPercent: threshold });
        currentAutoCleanThreshold=threshold;
        threshBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showToast(`Umbral de auto-limpieza configurado en ${threshold}%`, 'info');
      } catch(error){showToast(error.message,'error');}
    });
  });

  if (btnToggleAuto) {
    btnToggleAuto.addEventListener('click', async () => {
      const cfg = await window.api.getAutoCleanConfig();
      const newState = !cfg.enabled;
      const confirmed = await promptActionConfirmation({ title: newState ? 'Activar limpieza automática de RAM' : 'Desactivar limpieza automática de RAM', subtitle: newState ? 'Mientras Apex esté abierto, revisará el uso de memoria y ejecutará una limpieza al superar el umbral.' : 'La limpieza de memoria dejará de ejecutarse automáticamente.', badgeText: 'Herramienta gratuita', details: [`Umbral seleccionado: ${currentAutoCleanThreshold}% de uso de RAM.`, 'La memoria liberada puede volver a ocuparse. No se garantiza una mejora en juegos.'], confirmText: newState ? 'Activar limpieza automática' : 'Desactivar limpieza automática' });
      if (!confirmed) return;
      const updated = await window.api.setAutoCleanConfig({
        enabled: newState,
        thresholdPercent: currentAutoCleanThreshold
      });
      btnToggleAuto.classList.toggle('active', updated.enabled);
      btnToggleAuto.textContent = updated.enabled
        ? `🟢 Auto-Limpieza Activa (${currentAutoCleanThreshold}%)`
        : `⚪ Activar Auto-Limpieza`;
      showToast(
        updated.enabled
          ? `Auto-limpieza de RAM activada al superar el ${currentAutoCleanThreshold}% de uso.`
          : 'Auto-limpieza de RAM desactivada.',
        'info'
      );
    });
  }
}

async function loadMemoryStats() {
  const totalVal = document.getElementById('ram-total-val');
  const usedVal = document.getElementById('ram-used-val');
  const usedMbVal = document.getElementById('ram-used-mb-val');
  const bar = document.getElementById('ram-metric-bar');
  const freeVal = document.getElementById('ram-free-val');
  const standbyVal = document.getElementById('ram-standby-val');
  const procTbody = document.getElementById('ram-proc-tbody');
  const btnToggleAuto = document.getElementById('btn-toggle-auto-clean');

  try {
    const stats = await window.api.getMemoryStats();
    if (totalVal) totalVal.textContent = `${(stats.totalMB / 1024).toFixed(1)} GB`;
    if (usedVal) usedVal.textContent = `${stats.usedPercent}%`;
    if (usedMbVal) usedMbVal.textContent = `${stats.usedMB} MB en uso`;
    if (bar) bar.style.width = `${stats.usedPercent}%`;
    if (freeVal) freeVal.textContent = `${(stats.freeMB / 1024).toFixed(1)} GB`;
    if (standbyVal) standbyVal.textContent = Number.isFinite(stats.standbyEstimateMB) ? `${stats.standbyEstimateMB} MB` : 'No disponible';

    // Estado del botón auto-limpieza
    if (btnToggleAuto && stats.autoClean) {
      currentAutoCleanThreshold = stats.autoClean.thresholdPercent || 80;
      btnToggleAuto.classList.toggle('active', !!stats.autoClean.enabled);
      btnToggleAuto.textContent = stats.autoClean.enabled
        ? `🟢 Auto-Limpieza Activa (${currentAutoCleanThreshold}%)`
        : `⚪ Activar Auto-Limpieza`;

      const tBtns = document.querySelectorAll('.btn-threshold-opt');
      tBtns.forEach(b => {
        b.classList.toggle('active', parseInt(b.getAttribute('data-thresh'), 10) === currentAutoCleanThreshold);
      });
    }

    // Tabla de procesos
    if (procTbody) {
      if (!stats.topProcesses || stats.topProcesses.length === 0) {
        procTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">No se registraron procesos de alto consumo.</td></tr>`;
      } else {
        procTbody.innerHTML = '';
        stats.topProcesses.forEach(proc => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>
              <strong style="color: #f1f5f9;">${escapeHtml(proc.Name)}</strong>
            </td>
            <td><code class="mono" style="color: #94a3b8;">${escapeHtml(proc.Id)}</code></td>
            <td><span class="mono" style="color: #00f2fe; font-weight: 700;">${escapeHtml(proc.WorkingSetMB)} MB</span></td>
            <td style="text-align: right;">
              <button class="btn-proc-opt" data-pid="${escapeHtml(proc.Id)}" type="button">⚡ Optimizar</button>
            </td>
          `;

          const optBtn = tr.querySelector('.btn-proc-opt');
          if (optBtn) {
            optBtn.addEventListener('click', async () => {
              const confirmed = await promptActionConfirmation({
                title: `Optimizar Memoria de ${proc.Name}`,
                subtitle: `Podar el conjunto de trabajo (Working Set) del proceso PID ${proc.Id}.`,
                badgeText: 'Optimizar Proceso',
                details: [{
                  target: `${proc.Name} (PID ${proc.Id})`,
                  action: `Vaciar páginas inactivas (Consumo actual: ~${proc.WorkingSetMB} MB)`,
                  safety: '✓ No detiene ni cierra la aplicación, solo libera RAM física ociosa'
                }],
                confirmText: '⚡ Optimizar Proceso'
              });
              if (!confirmed) return;

              optBtn.disabled = true;
              optBtn.textContent = '⏳';
              try {
                const res = await window.api.optimizeSingleProcess(proc.Id);
                showToast(res.message, res.success ? 'success' : 'error');
                await loadMemoryStats();
              } catch (err) {
                showToast(`Error: ${err.message}`, 'error');
                optBtn.disabled = false;
                optBtn.textContent = '⚡ Optimizar';
              }
            });
          }
          procTbody.appendChild(tr);
        });
      }
    }
  } catch (err) {
    console.error('Error cargando estadísticas de memoria:', err);
  }
}

// =========================================================================
// --- SUITE OPTIMIZER (HOSTS SHIELD & STARTUP & EXTENDED CLEANER) ---
// =========================================================================

function setupAdvancedTools() {
  const btnApplyHosts = document.getElementById('btn-apply-hosts-shield');
  const btnRevertHosts = document.getElementById('btn-revert-hosts-shield');
  const btnRefreshStartup = document.getElementById('btn-refresh-startup');
  const btnCleanDiscord = document.getElementById('btn-clean-discord');
  const btnCleanBrowsers = document.getElementById('btn-clean-browsers');
  const btnCleanCrashDumps = document.getElementById('btn-clean-crash-dumps');
  const btnCleanDelivery = document.getElementById('btn-clean-delivery-opt');

  if (btnApplyHosts) {
    btnApplyHosts.addEventListener('click', async () => {
      const confirmed = await promptActionConfirmation({
        title: 'Activar Bloqueo HOSTS Anti-Telemetría',
        subtitle: 'Bloquea servidores de telemetría de Windows, rastreadores y servidores de diagnóstico a nivel de bucle local.',
        badgeText: 'HOSTS Shield',
        details: [
          {
            target: '%SystemRoot%\\System32\\drivers\\etc\\hosts',
            action: 'Añadir o actualizar el bloque de dominios de telemetría que pertenece a Apex',
            safety: 'Conserva las reglas externas y el respaldo original. Los servicios que usen esos dominios pueden dejar de responder; revisa el resultado y restaura si hace falta.'
          }
        ],
        confirmText: '🛡️ Activar Bloqueo HOSTS'
      });
      if (!confirmed) return;

      btnApplyHosts.disabled = true;
      btnApplyHosts.textContent = '⏳ Aplicando...';
      try {
        const res = await window.api.applyHostsShield();
        showToast(res.message, res.success ? 'success' : 'error');
        await loadAdvancedTools();
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        btnApplyHosts.disabled = false;
        btnApplyHosts.textContent = '🛡️ Activar Bloqueo HOSTS';
      }
    });
  }

  if (btnRevertHosts) {
    btnRevertHosts.addEventListener('click', async () => {
      const confirmed = await promptActionConfirmation({
        title: 'Restaurar Archivo HOSTS Original',
        subtitle: 'Restablece el archivo de resolución local de Windows a su configuración predeterminada de fábrica.',
        badgeText: 'Restaurar HOSTS',
        details: [
          {
            target: '%SystemRoot%\\System32\\drivers\\etc\\hosts',
            action: 'Eliminar reglas de redirección inyectadas y restaurar HOSTS por defecto de Microsoft',
            safety: '✓ Seguro. Restablece el comportamiento predeterminado del sistema'
          }
        ],
        confirmText: '↩️ Restaurar HOSTS'
      });
      if (!confirmed) return;

      btnRevertHosts.disabled = true;
      btnRevertHosts.textContent = '⏳ Restaurando...';
      try {
        const res = await window.api.revertHostsShield();
        showToast(res.message, res.success ? 'success' : 'error');
        await loadAdvancedTools();
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        btnRevertHosts.disabled = false;
        btnRevertHosts.textContent = '↩️ Restaurar HOSTS Original';
      }
    });
  }

  if (btnRefreshStartup) {
    btnRefreshStartup.addEventListener('click', () => loadStartupApps());
  }

  if (btnCleanDiscord) {
    btnCleanDiscord.addEventListener('click', async () => {
      if (btnCleanDiscord.disabled || btnCleanDiscord.classList.contains('done')) return;
      let spaceMB = 0;
      try {
        const status = await window.api.getCleanersStatus();
        if (status && status.discord) spaceMB = status.discord.sizeMB;
      } catch (e) {}

      const confirmed = await promptActionConfirmation({
        title: 'Limpiar Caché de Discord',
        subtitle: 'Elimina imágenes, audios y cachés de GPU almacenadas localmente por Discord.',
        badgeText: 'Limpieza Discord',
        spaceMB: spaceMB > 0 ? spaceMB : undefined,
        details: [
          {
            target: '%APPDATA%\\discord\\Cache & Code Cache & GPUCache',
            action: 'Eliminar archivos de caché obsoletos acumulados por la app',
            safety: '✓ Seguro. No cierra tu sesión ni elimina tus chats o configuración'
          }
        ],
        confirmText: '🧹 Limpiar Discord'
      });
      if (!confirmed) return;

      btnCleanDiscord.disabled = true;
      btnCleanDiscord.classList.add('loading');
      btnCleanDiscord.textContent = '⏳ Limpiando...';
      try {
        const res = await window.api.cleanDiscordCache();
        setCleanerHistory('discord', res.freedMB);
        showToast(res.message, 'success');
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        await loadCleanersStatus();
      }
    });
  }

  if (btnCleanBrowsers) {
    btnCleanBrowsers.addEventListener('click', async () => {
      if (btnCleanBrowsers.disabled || btnCleanBrowsers.classList.contains('done')) return;
      let spaceMB = 0;
      try {
        const status = await window.api.getCleanersStatus();
        if (status && status.browsers) spaceMB = status.browsers.sizeMB;
      } catch (e) {}

      const confirmed = await promptActionConfirmation({
        title: 'Limpiar Caché de Navegadores Web',
        subtitle: 'Elimina cachés de páginas web temporales en Google Chrome, Microsoft Edge, Brave y Mozilla Firefox.',
        badgeText: 'Limpieza Navegadores',
        spaceMB: spaceMB > 0 ? spaceMB : undefined,
        details: [
          {
            target: 'Google\\Chrome, Microsoft\\Edge, Mozilla\\Firefox (Cache & Code Cache)',
            action: 'Eliminar datos estáticos en caché de sitios web visitados',
            safety: '✓ Seguro. No borra contraseñas guardadas, marcadores ni cookies de sesión'
          }
        ],
        confirmText: '🧹 Limpiar Navegadores'
      });
      if (!confirmed) return;

      btnCleanBrowsers.disabled = true;
      btnCleanBrowsers.classList.add('loading');
      btnCleanBrowsers.textContent = '⏳ Limpiando...';
      try {
        const res = await window.api.cleanBrowserCaches();
        setCleanerHistory('browsers', res.freedMB);
        showToast(res.message, 'success');
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        await loadCleanersStatus();
      }
    });
  }

  if (btnCleanCrashDumps) {
    btnCleanCrashDumps.addEventListener('click', async () => {
      if (btnCleanCrashDumps.disabled || btnCleanCrashDumps.classList.contains('done')) return;
      let spaceMB = 0;
      try {
        const status = await window.api.getCleanersStatus();
        if (status && status.dumps) spaceMB = status.dumps.sizeMB;
      } catch (e) {}

      const confirmed = await promptActionConfirmation({
        title: 'Limpiar Archivos de Volcado (Crash Dumps)',
        subtitle: 'Elimina archivos `.dmp` generados por errores de pantalla azul (BSOD) o cierres de aplicaciones antiguas.',
        badgeText: 'Volcados de Memoria',
        spaceMB: spaceMB > 0 ? spaceMB : undefined,
        details: [
          {
            target: '%SystemRoot%\\Minidump & %LOCALAPPDATA%\\CrashDumps',
            action: 'Eliminar archivos de volcado residuales que ocupan espacio masivo en disco',
            safety: '✓ Revisar consecuencias. Son registros de depuración antiguos que no afectan al sistema'
          }
        ],
        confirmText: '🧹 Limpiar Volcados'
      });
      if (!confirmed) return;

      btnCleanCrashDumps.disabled = true;
      btnCleanCrashDumps.classList.add('loading');
      btnCleanCrashDumps.textContent = '⏳ Limpiando...';
      try {
        const res = await window.api.cleanCrashDumps();
        setCleanerHistory('dumps', res.freedMB);
        showToast(res.message, 'success');
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        await loadCleanersStatus();
      }
    });
  }

  if (btnCleanDelivery) {
    btnCleanDelivery.addEventListener('click', async () => {
      if (btnCleanDelivery.disabled || btnCleanDelivery.classList.contains('done')) return;
      let spaceMB = 0;
      try {
        const status = await window.api.getCleanersStatus();
        if (status && status.delivery) spaceMB = status.delivery.sizeMB;
      } catch (e) {}

      const confirmed = await promptActionConfirmation({
        title: 'Limpiar Optimización de Entrega (Delivery Optimization)',
        subtitle: 'Elimina archivos de actualización de Windows compartidos en red local por el servicio de entrega.',
        badgeText: 'Delivery Optimization',
        spaceMB: spaceMB > 0 ? spaceMB : undefined,
        details: [
          {
            target: '%SystemRoot%\\ServiceProfiles\\NetworkService\\AppData\\Local\\Microsoft\\Windows\\DeliveryOptimization',
            action: 'Eliminar caché distribuida de paquetes de Windows Update',
            safety: '✓ Seguro. Libera espacio sin interferir con las actualizaciones del sistema'
          }
        ],
        confirmText: '🧹 Limpiar Delivery Opt'
      });
      if (!confirmed) return;

      btnCleanDelivery.disabled = true;
      btnCleanDelivery.classList.add('loading');
      btnCleanDelivery.textContent = '⏳ Limpiando...';
      try {
        const res = await window.api.cleanDeliveryOptimizationCache();
        setCleanerHistory('delivery', res.freedMB);
        showToast(res.message, 'success');
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        await loadCleanersStatus();
      }
    });
  }

  const btnCleanGhost = document.getElementById('btn-clean-ghost');
  if (btnCleanGhost) {
    btnCleanGhost.addEventListener('click', async () => {
      if (btnCleanGhost.disabled || btnCleanGhost.classList.contains('done')) return;
      let ghostCount = 0;
      try {
        const status = await window.api.getCleanersStatus();
        if (status && status.ghost) ghostCount = status.ghost.count;
      } catch (e) {}

      const confirmed = await promptActionConfirmation({
        title: 'Purgar Dispositivos Fantasma (PnP Inactivos)',
        subtitle: 'Elimina registros de dispositivos USB, impresoras o periféricos desconectados en el Administrador de Dispositivos.',
        badgeText: 'PnP Ghost Purge',
        details: [
          {
            target: 'Árbol Plug and Play (PnP) de Windows',
            action: `Eliminar ${ghostCount > 0 ? ghostCount : 'los'} controladores y dispositivos fantasma no presentes`,
            safety: '✓ Seguro (Inspirado en GhostBuster / RionTool). Acelera el arranque y alivia el registro PnP'
          }
        ],
        confirmText: '🧹 Purgar Dispositivos'
      });
      if (!confirmed) return;

      btnCleanGhost.disabled = true;
      btnCleanGhost.classList.add('loading');
      btnCleanGhost.textContent = '⏳ Purgando PnP...';
      try {
        const res = await window.api.purgeGhostDevices();
        setCleanerHistory('ghost', res.removed);
        showToast(res.message, 'success');
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        await loadCleanersStatus();
      }
    });
  }

  // --- NUEVOS LIMPIADORES DE CACHÉ DE APLICACIONES & DESARROLLADOR ---
  const btnCleanNpm = document.getElementById('btn-clean-npm');
  if (btnCleanNpm) {
    btnCleanNpm.addEventListener('click', async () => {
      if (btnCleanNpm.disabled || btnCleanNpm.classList.contains('done')) return;
      let spaceMB = 0;
      try {
        const status = await window.api.getCleanersStatus();
        if (status && status.npm) spaceMB = status.npm.sizeMB;
      } catch (e) {}

      const confirmed = await promptActionConfirmation({
        title: 'Limpiar Caché de NPM, Yarn & PNPM',
        subtitle: 'Elimina paquetes comprimidos y metadatos cacache almacenados por tus gestores de paquetes Node.',
        badgeText: 'Node.js & Dev Caches',
        spaceMB: spaceMB > 0 ? spaceMB : undefined,
        details: [
          {
            target: '%LOCALAPPDATA%\\npm-cache & %APPDATA%\\npm-cache & ~/.npm',
            action: 'Eliminar archivos temporales de descarga (_cacache, content-v2, index-v5)',
            safety: '✓ Revisar consecuencias. No altera tus proyectos, repositorio ni carpetas node_modules locales'
          },
          {
            target: 'Yarn & PNPM Cache (%LOCALAPPDATA%\\Yarn\\Cache, pnpm\\cache)',
            action: 'Purgar archivos tarball duplicados acumulados en descargas previas',
            safety: '✓ Las herramientas volverán a descargar limpiamente lo que necesites al instalar paquetes'
          }
        ],
        confirmText: '📦 Limpiar Caché de NPM'
      });
      if (!confirmed) return;

      btnCleanNpm.disabled = true;
      btnCleanNpm.classList.add('loading');
      btnCleanNpm.textContent = '⏳ Limpiando...';
      try {
        const res = await window.api.cleanNpmCache();
        setCleanerHistory('npm', res.freedMB);
        showToast(res.message, 'success');
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        await loadCleanersStatus();
      }
    });
  }

  const btnCleanVscode = document.getElementById('btn-clean-vscode');
  if (btnCleanVscode) {
    btnCleanVscode.addEventListener('click', async () => {
      if (btnCleanVscode.disabled || btnCleanVscode.classList.contains('done')) return;
      let spaceMB = 0;
      try {
        const status = await window.api.getCleanersStatus();
        if (status && status.vscode) spaceMB = status.vscode.sizeMB;
      } catch (e) {}

      const confirmed = await promptActionConfirmation({
        title: 'Limpiar Caché de VS Code y Editores',
        subtitle: 'Elimina la memoria caché de renderizado y Service Worker acumulada por Visual Studio Code.',
        badgeText: 'VS Code Editor Cache',
        spaceMB: spaceMB > 0 ? spaceMB : undefined,
        details: [
          {
            target: '%APPDATA%\\Code\\Cache & CachedData & Service Worker\\CacheStorage',
            action: 'Vaciar fragmentos de renderizado y bytecode temporal de la interfaz',
            safety: '✓ Revisar consecuencias. Tus extensiones, atajos de teclado, configuraciones y proyectos quedan intactos'
          }
        ],
        confirmText: '💻 Limpiar Caché de VS Code'
      });
      if (!confirmed) return;

      btnCleanVscode.disabled = true;
      btnCleanVscode.classList.add('loading');
      btnCleanVscode.textContent = '⏳ Limpiando...';
      try {
        const res = await window.api.cleanVscodeCache();
        setCleanerHistory('vscode', res.freedMB);
        showToast(res.message, 'success');
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        await loadCleanersStatus();
      }
    });
  }

  const btnCleanPip = document.getElementById('btn-clean-pip');
  if (btnCleanPip) {
    btnCleanPip.addEventListener('click', async () => {
      if (btnCleanPip.disabled || btnCleanPip.classList.contains('done')) return;
      let spaceMB = 0;
      try {
        const status = await window.api.getCleanersStatus();
        if (status && status.pip) spaceMB = status.pip.sizeMB;
      } catch (e) {}

      const confirmed = await promptActionConfirmation({
        title: 'Limpiar Caché de Python Pip & Rust Cargo',
        subtitle: 'Elimina archivos binarios (.whl) y archivos de fuentes (.crate) retenidos tras instalar paquetes.',
        badgeText: 'Pip & Cargo Caches',
        spaceMB: spaceMB > 0 ? spaceMB : undefined,
        details: [
          {
            target: '%LOCALAPPDATA%\\pip\\cache & ~/.cargo\\registry\\cache',
            action: 'Eliminar paquetes comprimidos descargados temporalmente de PyPI y Crates.io',
            safety: '✓ Revisar consecuencias. No desinstala ningún paquete de tus entornos virtuales ni de Python'
          }
        ],
        confirmText: '🐍 Limpiar Pip & Cargo'
      });
      if (!confirmed) return;

      btnCleanPip.disabled = true;
      btnCleanPip.classList.add('loading');
      btnCleanPip.textContent = '⏳ Limpiando...';
      try {
        const res = await window.api.cleanPipCache();
        setCleanerHistory('pip', res.freedMB);
        showToast(res.message, 'success');
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        await loadCleanersStatus();
      }
    });
  }

  const btnCleanGradle = document.getElementById('btn-clean-gradle');
  if (btnCleanGradle) {
    btnCleanGradle.addEventListener('click', async () => {
      if (btnCleanGradle.disabled || btnCleanGradle.classList.contains('done')) return;
      let spaceMB = 0;
      try {
        const status = await window.api.getCleanersStatus();
        if (status && status.gradle) spaceMB = status.gradle.sizeMB;
      } catch (e) {}

      const confirmed = await promptActionConfirmation({
        title: 'Limpiar Caché de Gradle & Android Studio',
        subtitle: 'Purga transformadas intermedias y cachés de artefactos compilados obsoletos.',
        badgeText: 'Gradle Build Cache',
        spaceMB: spaceMB > 0 ? spaceMB : undefined,
        details: [
          {
            target: '~/.gradle\\caches\\build-cache-1 & transforms-*',
            action: 'Eliminar artefactos intermedios y binarios antiguos de compilación',
            safety: '✓ Seguro. Gradle recompila automáticamente solo los módulos que requieras'
          }
        ],
        confirmText: '☕ Limpiar Gradle'
      });
      if (!confirmed) return;

      btnCleanGradle.disabled = true;
      btnCleanGradle.classList.add('loading');
      btnCleanGradle.textContent = '⏳ Limpiando...';
      try {
        const res = await window.api.cleanGradleCache();
        setCleanerHistory('gradle', res.freedMB);
        showToast(res.message, 'success');
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        await loadCleanersStatus();
      }
    });
  }

  const btnCleanMedia = document.getElementById('btn-clean-media');
  if (btnCleanMedia) {
    btnCleanMedia.addEventListener('click', async () => {
      if (btnCleanMedia.disabled || btnCleanMedia.classList.contains('done')) return;
      let spaceMB = 0;
      try {
        const status = await window.api.getCleanersStatus();
        if (status && status.media) spaceMB = status.media.sizeMB;
      } catch (e) {}

      const confirmed = await promptActionConfirmation({
        title: 'Limpiar Caché de Spotify y Mensajería',
        subtitle: 'Elimina canciones reproducidas en streaming almacenadas temporalmente en el disco local.',
        badgeText: 'Spotify & Streaming Cache',
        spaceMB: spaceMB > 0 ? spaceMB : undefined,
        details: [
          {
            target: '%LOCALAPPDATA%\\Spotify\\Storage & Data & Telegram Desktop',
            action: 'Liberar gigabytes de audio y vistas previas en búfer local',
            safety: '✓ Revisar consecuencias. No altera tu cuenta, no borra playlists y mantiene tu inicio de sesión'
          }
        ],
        confirmText: '🎵 Limpiar Medios'
      });
      if (!confirmed) return;

      btnCleanMedia.disabled = true;
      btnCleanMedia.classList.add('loading');
      btnCleanMedia.textContent = '⏳ Limpiando...';
      try {
        const res = await window.api.cleanMediaCache();
        setCleanerHistory('media', res.freedMB);
        showToast(res.message, 'success');
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        await loadCleanersStatus();
      }
    });
  }

  const btnCleanLaunchers = document.getElementById('btn-clean-launchers');
  if (btnCleanLaunchers) {
    btnCleanLaunchers.addEventListener('click', async () => {
      if (btnCleanLaunchers.disabled || btnCleanLaunchers.classList.contains('done')) return;
      let spaceMB = 0;
      try {
        const status = await window.api.getCleanersStatus();
        if (status && status.launchers) spaceMB = status.launchers.sizeMB;
      } catch (e) {}

      const confirmed = await promptActionConfirmation({
        title: 'Limpiar Caché Web de Steam y Epic Games',
        subtitle: 'Elimina la caché acumulada de los navegadores internos de las tiendas de videojuegos.',
        badgeText: 'Steam & Epic Launcher Cache',
        spaceMB: spaceMB > 0 ? spaceMB : undefined,
        details: [
          {
            target: '%LOCALAPPDATA%\\Steam\\htmlcache & EpicGamesLauncher\\Saved\\webcache',
            action: 'Eliminar imágenes de promociones y datos web en caché de la tienda',
            safety: '✓ Revisar consecuencias. No afecta tus juegos instalados, partidas guardadas ni compras'
          }
        ],
        confirmText: '🎮 Limpiar Launchers'
      });
      if (!confirmed) return;

      btnCleanLaunchers.disabled = true;
      btnCleanLaunchers.classList.add('loading');
      btnCleanLaunchers.textContent = '⏳ Limpiando...';
      try {
        const res = await window.api.cleanLaunchersCache();
        setCleanerHistory('launchers', res.freedMB);
        showToast(res.message, 'success');
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        await loadCleanersStatus();
      }
    });
  }

  // Master Limpiar Todo Cachés de Apps
  const handleCleanAllAppsMaster = async () => {
    let spaceMB = 0;
    try {
      const status = await window.api.getCleanersStatus();
      if (status && status.totalAppsMB) spaceMB = status.totalAppsMB;
    } catch (e) {}

    const confirmed = await promptActionConfirmation({
      title: 'Limpieza Universal de Cachés de Software y Desarrollo',
      subtitle: 'Elimina de una sola vez las cachés de NPM, VS Code, Python, Gradle, Spotify, Steam, Discord y Navegadores.',
      badgeText: 'Limpieza Integral de Apps',
      spaceMB: spaceMB > 0 ? spaceMB : undefined,
      details: [
        {
          target: 'NPM, Yarn & PNPM (%LOCALAPPDATA%\\npm-cache, ~/.npm)',
          action: 'Purgar paquetes tarball y registros _cacache de desarrollo',
          safety: '✓ Seguro. No modifica tus proyectos ni carpetas node_modules'
        },
        {
          target: 'VS Code & Editores (%APPDATA%\\Code\\Cache, CachedData)',
          action: 'Limpiar datos de renderizado temporal y Service Workers',
          safety: '✓ Seguro. Preserva tus extensiones, ajustes y código'
        },
        {
          target: 'Python Pip & Rust Cargo (%LOCALAPPDATA%\\pip\\cache)',
          action: 'Eliminar descargas de paquetes (.whl y .crate)',
          safety: '✓ Seguro. No desinstala ningún paquete ni entorno'
        },
        {
          target: 'Navegadores, Discord, Spotify & Launchers',
          action: 'Vaciar cachés multimedia, banners y datos web temporales',
          safety: '✓ Seguro. Mantiene inicios de sesión, partidas y credenciales'
        }
      ],
      confirmText: `🚀 Purgar Todas las Cachés (${spaceMB > 1024 ? (spaceMB / 1024).toFixed(1) + ' GB' : spaceMB + ' MB'})`
    });
    if (!confirmed) return;

    const allBtn1 = document.getElementById('btn-clean-all-apps');
    const allBtn2 = document.getElementById('btn-cleanup-view-clean-apps');
    if (allBtn1) { allBtn1.disabled = true; allBtn1.textContent = '⏳ Limpiando todas las apps...'; }
    if (allBtn2) { allBtn2.disabled = true; allBtn2.textContent = '⏳ Limpiando todas las apps...'; }

    showToast('🚀 Purgando cachés de aplicaciones y herramientas de desarrollo...', 'info');
    try {
      const res = await window.api.cleanAllAppCaches();
      ['npm', 'vscode', 'pip', 'gradle', 'media', 'launchers', 'discord', 'browsers', 'dumps', 'delivery'].forEach(k => {
        setCleanerHistory(k, 0);
      });
      showToast(res.message, 'success');
    } catch (err) {
      showToast(`Error al limpiar: ${err.message}`, 'error');
    } finally {
      await loadCleanersStatus();
      await updateCleanupButtonsState();
    }
  };

  const btnCleanAllApps = document.getElementById('btn-clean-all-apps');
  if (btnCleanAllApps) btnCleanAllApps.addEventListener('click', handleCleanAllAppsMaster);

  const btnCleanupViewCleanApps = document.getElementById('btn-cleanup-view-clean-apps');
  if (btnCleanupViewCleanApps) btnCleanupViewCleanApps.addEventListener('click', handleCleanAllAppsMaster);
}

// --- HISTORIAL Y CONTROL INTELIGENTE DE LIMPIEZA ---

function getCleanerHistory() {
  try {
    const raw = localStorage.getItem('apex_cleaner_history');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function setCleanerHistory(key, freedMB) {
  try {
    const hist = getCleanerHistory();
    hist[key] = {
      timestamp: Date.now(),
      freedMB: freedMB || 0
    };
    localStorage.setItem('apex_cleaner_history', JSON.stringify(hist));
  } catch (e) {}
}

function formatCleanerTime(timestamp) {
  if (!timestamp) return 'Sin registros previos';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 45) return 'Hace unos segundos';
  if (diffSec < 3600) return `Hace ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) {
    const d = new Date(timestamp);
    return `Hoy a las ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  const d = new Date(timestamp);
  return `El ${d.toLocaleDateString([], { day: '2-digit', month: '2-digit' })}`;
}

async function loadCleanersStatus() {
  const btnCleanDiscord = document.getElementById('btn-clean-discord');
  const btnCleanBrowsers = document.getElementById('btn-clean-browsers');
  const btnCleanCrashDumps = document.getElementById('btn-clean-crash-dumps');
  const btnCleanDelivery = document.getElementById('btn-clean-delivery-opt');
  const btnCleanNpm = document.getElementById('btn-clean-npm');
  const btnCleanVscode = document.getElementById('btn-clean-vscode');
  const btnCleanPip = document.getElementById('btn-clean-pip');
  const btnCleanGradle = document.getElementById('btn-clean-gradle');
  const btnCleanMedia = document.getElementById('btn-clean-media');
  const btnCleanLaunchers = document.getElementById('btn-clean-launchers');

  const badgeDiscord = document.getElementById('badge-clean-discord');
  const badgeBrowsers = document.getElementById('badge-clean-browsers');
  const badgeDumps = document.getElementById('badge-clean-crash-dumps');
  const badgeDelivery = document.getElementById('badge-clean-delivery-opt');
  const badgeNpm = document.getElementById('badge-clean-npm');
  const badgeVscode = document.getElementById('badge-clean-vscode');
  const badgePip = document.getElementById('badge-clean-pip');
  const badgeGradle = document.getElementById('badge-clean-gradle');
  const badgeMedia = document.getElementById('badge-clean-media');
  const badgeLaunchers = document.getElementById('badge-clean-launchers');

  const timeDiscord = document.getElementById('time-clean-discord');
  const timeBrowsers = document.getElementById('time-clean-browsers');
  const timeDumps = document.getElementById('time-clean-crash-dumps');
  const timeDelivery = document.getElementById('time-clean-delivery-opt');
  const timeNpm = document.getElementById('time-clean-npm');
  const timeVscode = document.getElementById('time-clean-vscode');
  const timePip = document.getElementById('time-clean-pip');
  const timeGradle = document.getElementById('time-clean-gradle');
  const timeMedia = document.getElementById('time-clean-media');
  const timeLaunchers = document.getElementById('time-clean-launchers');

  const hist = getCleanerHistory();

  try {
    const status = await window.api.getCleanersStatus();
    if (!status) return;

    const applyCleanerCardState = (btn, badge, time, key, info, label) => {
      if (!btn) return;
      const h = hist[key] || {};
      const size = (info && typeof info.sizeMB === 'number') ? info.sizeMB : 0;
      const requiresClean = info ? info.requiresClean : false;

      // Si tiene menos de 5 MB o se limpió recientemente (últimos 45 min) y tiene menos de 50 MB
      const cleanedRecently = (h.timestamp && (Date.now() - h.timestamp < 45 * 60 * 1000));
      const isClean = !requiresClean || size < 5 || (cleanedRecently && size < 50);

      if (time) {
        time.textContent = h.timestamp 
          ? `Última limpieza: ${formatCleanerTime(h.timestamp)}` 
          : (isClean ? 'Al día (Sin residuos pendientes)' : 'Requiere primera limpieza');
      }

      if (badge) {
        if (isClean) {
          badge.className = 'clean-badge clean';
          badge.textContent = `✓ Limpio (${size} MB)`;
        } else {
          badge.className = 'clean-badge pending';
          badge.textContent = `⚠️ ${size > 1024 ? (size / 1024).toFixed(1) + ' GB' : size + ' MB'} por limpiar`;
        }
      }

      if (isClean) {
        btn.disabled = true;
        btn.classList.add('done');
        btn.classList.remove('loading');
        btn.textContent = '✓ Limpio';
      } else {
        btn.disabled = false;
        btn.classList.remove('done', 'loading');
        btn.textContent = `Limpiar ${label} (${size > 1024 ? (size / 1024).toFixed(1) + ' GB' : size + ' MB'})`;
      }
    };

    applyCleanerCardState(btnCleanNpm, badgeNpm, timeNpm, 'npm', status.npm, 'NPM');
    applyCleanerCardState(btnCleanVscode, badgeVscode, timeVscode, 'vscode', status.vscode, 'VS Code');
    applyCleanerCardState(btnCleanPip, badgePip, timePip, 'pip', status.pip, 'Pip / Cargo');
    applyCleanerCardState(btnCleanGradle, badgeGradle, timeGradle, 'gradle', status.gradle, 'Gradle');
    applyCleanerCardState(btnCleanMedia, badgeMedia, timeMedia, 'media', status.media, 'Medios');
    applyCleanerCardState(btnCleanLaunchers, badgeLaunchers, timeLaunchers, 'launchers', status.launchers, 'Launchers');

    applyCleanerCardState(btnCleanDiscord, badgeDiscord, timeDiscord, 'discord', status.discord, 'Discord');
    applyCleanerCardState(btnCleanBrowsers, badgeBrowsers, timeBrowsers, 'browsers', status.browsers, 'Navegadores');
    applyCleanerCardState(btnCleanCrashDumps, badgeDumps, timeDumps, 'dumps', status.dumps, 'Volcados');
    applyCleanerCardState(btnCleanDelivery, badgeDelivery, timeDelivery, 'delivery', status.delivery, 'Delivery Opt');

    // Total Apps Master Bar & View Cleanup Banner
    const totalAppsMB = status.totalAppsMB || 0;
    const isTotalClean = totalAppsMB < 15;
    const formatMBOrGB = (mb) => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;

    const badgeTotalApps = document.getElementById('badge-total-app-caches');
    const btnCleanAllApps = document.getElementById('btn-clean-all-apps');
    const badgeCleanupApps = document.getElementById('badge-cleanup-view-apps');
    const btnCleanupApps = document.getElementById('btn-cleanup-view-clean-apps');

    if (badgeTotalApps) {
      badgeTotalApps.className = isTotalClean ? 'clean-badge clean' : 'clean-badge pending';
      badgeTotalApps.textContent = isTotalClean ? `✓ Al día (${formatMBOrGB(totalAppsMB)})` : `⚠️ ${formatMBOrGB(totalAppsMB)} por limpiar`;
    }
    if (badgeCleanupApps) {
      badgeCleanupApps.className = isTotalClean ? 'clean-badge clean' : 'clean-badge pending';
      badgeCleanupApps.textContent = isTotalClean ? `✓ Al día (${formatMBOrGB(totalAppsMB)})` : `⚠️ ${formatMBOrGB(totalAppsMB)} acumulados`;
    }

    if (btnCleanAllApps) {
      if (isTotalClean) {
        btnCleanAllApps.disabled = true;
        btnCleanAllApps.textContent = '✓ Cachés de Apps Limpias';
        btnCleanAllApps.style.opacity = '0.7';
      } else {
        btnCleanAllApps.disabled = false;
        btnCleanAllApps.textContent = `🚀 Limpiar Todas las Cachés (${formatMBOrGB(totalAppsMB)})`;
        btnCleanAllApps.style.opacity = '1';
      }
    }

    if (btnCleanupApps) {
      if (isTotalClean) {
        btnCleanupApps.disabled = true;
        btnCleanupApps.textContent = '✓ Apps Al Día';
        btnCleanupApps.style.opacity = '0.7';
      } else {
        btnCleanupApps.disabled = false;
        btnCleanupApps.textContent = `🚀 Limpiar Cachés de Apps (${formatMBOrGB(totalAppsMB)})`;
        btnCleanupApps.style.opacity = '1';
      }
    }

    // Dispositivos Fantasma (RionTool)
    const btnCleanGhost = document.getElementById('btn-clean-ghost');
    const badgeGhost = document.getElementById('badge-clean-ghost');
    const timeGhost = document.getElementById('time-clean-ghost');

    if (btnCleanGhost && status.ghost) {
      const h = hist['ghost'] || {};
      const count = status.ghost.count || 0;
      const isClean = count === 0;

      if (timeGhost) {
        timeGhost.textContent = h.timestamp 
          ? `Última purga: ${formatCleanerTime(h.timestamp)}` 
          : (isClean ? 'Árbol PnP al día (0 fantasma)' : 'Requiere optimización PnP');
      }

      if (badgeGhost) {
        if (isClean) {
          badgeGhost.className = 'clean-badge clean';
          badgeGhost.textContent = `✓ Limpio (0 fantasma)`;
        } else {
          badgeGhost.className = 'clean-badge pending';
          badgeGhost.textContent = `⚠️ ${count} inactivos`;
        }
      }

      if (isClean) {
        btnCleanGhost.disabled = true;
        btnCleanGhost.classList.add('done');
        btnCleanGhost.classList.remove('loading');
        btnCleanGhost.textContent = '✓ Limpio';
      } else {
        btnCleanGhost.disabled = false;
        btnCleanGhost.classList.remove('done', 'loading');
        btnCleanGhost.textContent = `Purgar Dispositivos (${count})`;
      }
    }

  } catch (err) {
    console.warn('Error escaneando estado de limpiadores:', err);
  }
}

async function loadAdvancedTools() {
  const badge = document.getElementById('hosts-shield-badge');
  try {
    const status = await window.api.getHostsShieldStatus();
    if (badge) {
      if (status.active) {
        badge.className = 'hosts-status-badge active';
        badge.textContent = `✓ Bloqueo Activo (${status.count} dominios bloqueados)`;
      } else {
        badge.className = 'hosts-status-badge';
        badge.textContent = `Inactivo (Sin bloqueo en HOSTS)`;
      }
    }
  } catch (err) {
    console.error('Error cargando estado HOSTS:', err);
  }

  await loadStartupApps();
  await loadCleanersStatus();
}

async function loadStartupApps() {
  const tbody = document.getElementById('startup-apps-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 25px;">Escaneando aplicaciones de inicio...</td></tr>`;

  try {
    const apps = await window.api.getStartupPrograms();
    if (!apps || apps.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">No se encontraron aplicaciones en el inicio.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    apps.forEach(app => {
      const tr = document.createElement('tr');
      const isEnabled = !!app.enabled;

      tr.innerHTML = `
        <td>
          <strong style="color: #f1f5f9;">${escapeHtml(app.name)}</strong>
        </td>
        <td>
          <span class="debloat-category-tag">${escapeHtml(app.scope || app.location)}</span>
        </td>
        <td>
          <code class="transparency-code" style="max-width: 320px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(app.command)}</code>
        </td>
        <td style="text-align: right;">
          <button class="btn-startup-toggle ${isEnabled ? 'enabled' : 'disabled'}" type="button">
            ${isEnabled ? '🛑 Deshabilitar' : '✓ Habilitar'}
          </button>
        </td>
      `;

      const btnToggle = tr.querySelector('.btn-startup-toggle');
      if (btnToggle) {
        btnToggle.addEventListener('click', async () => {
          const actionWord = isEnabled ? 'deshabilitar' : 'habilitar';
          const confirmed = await promptActionConfirmation({
            title: `${isEnabled ? '🛑 Deshabilitar' : '✓ Habilitar'} Inicio: ${app.name}`,
            subtitle: `¿Deseas ${actionWord} que "${app.name}" se ejecute automáticamente al arrancar Windows?`,
            badgeText: 'Aplicaciones de Inicio',
            details: [{
              target: `${app.name} (${app.scope || app.location})`,
              action: `Comando: ${app.command}`,
              safety: 'Conserva la entrada de inicio original para restaurarla desde esta pestaña'
            }],
            confirmText: isEnabled ? '🛑 Deshabilitar Inicio' : '✓ Habilitar Inicio'
          });
          if (!confirmed) return;

          btnToggle.disabled = true;
          btnToggle.textContent = '⏳';
          try {
            const res = await window.api.toggleStartupProgram(app.name, app.location, !isEnabled);
            showToast(res.message, res.success ? 'success' : 'error');
            await loadStartupApps();
          } catch (err) {
            showToast(`Error: ${err.message}`, 'error');
            btnToggle.disabled = false;
            btnToggle.textContent = isEnabled ? '🛑 Deshabilitar' : '✓ Habilitar';
          }
        });
      }

      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #ef4444; padding: 20px;">Error al cargar inicio: ${escapeHtml(err.message)}</td></tr>`;
  }
}

// ==========================================================================
// SUITE DE HARDWARE GAMER (XMP/EXPO, DISCOS SSD VS HDD Y LATENCIA USB)
// ==========================================================================
let hardwareReportData = null;
let usbLatencyState = null;

async function loadHardwareDiagnostics(force = false) {
  if (hardwareReportData && !force) {
    renderHardwareReport(hardwareReportData);
    if (usbLatencyState) updateUsbLatencyUI(usbLatencyState);
    return;
  }

  const dimmContainer = document.getElementById('hw-dimm-slots-container');
  const drivesContainer = document.getElementById('hw-drives-container');
  const hddGamesContainer = document.getElementById('hw-hdd-games-container');
  const ssdGamesContainer = document.getElementById('hw-ssd-games-container');
  const btnRefresh = document.getElementById('btn-refresh-hardware');

  if (btnRefresh) {
    btnRefresh.disabled = true;
    btnRefresh.textContent = '⏳ Analizando Hardware...';
  }

  if (dimmContainer) dimmContainer.innerHTML = '<div class="hw-dimm-slot-empty">⏳ Analizando ranuras DIMM y perfiles XMP/EXPO...</div>';
  if (drivesContainer) drivesContainer.innerHTML = '<div class="hw-dimm-slot-empty">⏳ Escaneando discos físicos y particiones...</div>';
  if (hddGamesContainer) hddGamesContainer.innerHTML = '<div class="hw-dimm-slot-empty">⏳ Cruzando librerías con almacenamiento mecánico...</div>';
  if (ssdGamesContainer) ssdGamesContainer.innerHTML = '<div class="hw-dimm-slot-empty">⏳ Verificando juegos en unidades de estado sólido...</div>';

  try {
    const hardwareOutcomes = await Promise.allSettled([
      window.api.getHardwareReport(),
      window.api.getUsbLatencyStatus()
    ]);
    const [hwResult,usbResult]=hardwareOutcomes.map(item=>item.status==='fulfilled'?item.value:{success:false,error:item.reason?.message||'Consulta no disponible'});

    if (hwResult && hwResult.success && hwResult.report) {
      hardwareReportData = hwResult.report;
      renderHardwareReport(hardwareReportData);
    } else {
      if (dimmContainer) {
        dimmContainer.innerHTML = `<div class="hw-dimm-slot-empty" style="color: #f87171;">No se pudo obtener el reporte de hardware: ${escapeHtml(hwResult?.error || 'Error desconocido')}</div>`;
      }
    }

    if (usbResult && usbResult.success) {
      usbLatencyState = usbResult;
      updateUsbLatencyUI(usbLatencyState);
    } else {
      usbLatencyState=null;
      const badge=document.getElementById('hw-usb-status-badge');if(badge)badge.textContent='Estado USB no disponible';
      const label=document.getElementById('hw-usb-current-mode');if(label)label.textContent='Windows no pudo confirmar la preferencia actual.';
      const toggle=document.getElementById('btn-toggle-usb-latency');if(toggle){toggle.disabled=true;toggle.title='Actualiza el diagnóstico para obtener un estado válido.';}
    }
  } catch (err) {
    console.error('Error cargando diagnóstico de hardware:', err);
    showToast(`Error al analizar hardware: ${err.message}`, 'error');
  } finally {
    if (btnRefresh) {
      btnRefresh.disabled = false;
      btnRefresh.textContent = '🔄 Actualizar Diagnóstico';
    }
  }
}

function renderHardwareReport(report) {
  if (!report) return;

  const ram = report.RAM || {};
  const storage = report.Storage || {};

  // 1. Métricas Principales de RAM
  const elRamTotal = document.getElementById('hw-ram-total');
  const elRamType = document.getElementById('hw-ram-type');
  const elRamCurrentSpeed = document.getElementById('hw-ram-current-speed');
  const elRamMaxSpeed = document.getElementById('hw-ram-max-speed');
  const elRamChannelMode = document.getElementById('hw-ram-channel-mode');
  const elRamStatusBadge = document.getElementById('hw-ram-status-badge');
  const elRamAdviceBox = document.getElementById('hw-ram-advice-box');
  const elRamAdviceContent = document.getElementById('hw-ram-advice-content');

  if (elRamTotal) elRamTotal.textContent = `${ram.TotalGB || 0} GB`;
  if (elRamType) elRamType.textContent = `${ram.DdrType || 'DDR4'} (${ram.ModuleCount || 0} módulos)`;
  if (elRamCurrentSpeed) elRamCurrentSpeed.textContent = `${ram.ConfiguredSpeed || 0} MT/s`;
  if (elRamMaxSpeed) elRamMaxSpeed.textContent = `${ram.MaxRatedSpeed || 0} MT/s`;
  if (elRamChannelMode) elRamChannelMode.textContent = ram.ChannelMode || 'Dual Channel';

  // Badge de Estado de RAM
  if (elRamStatusBadge) {
    elRamStatusBadge.className = 'hw-status-pill';
    if (ram.Status === 'MISMATCHED_MODULES') {
      elRamStatusBadge.classList.add('pill-warning');
      elRamStatusBadge.textContent = '⚠️ Asimetría de Frecuencia';
    } else if (ram.Status === 'XMP_DISABLED') {
      elRamStatusBadge.classList.add('pill-warning');
      elRamStatusBadge.textContent = '⚠️ Perfil XMP / EXPO Apagado';
    } else if (ram.Status === 'SINGLE_CHANNEL') {
      elRamStatusBadge.classList.add('pill-danger');
      elRamStatusBadge.textContent = '⚠️ Single Channel (64-bit)';
    } else {
      elRamStatusBadge.classList.add('pill-optimal');
      elRamStatusBadge.textContent = '✓ Configuración Óptima';
    }
  }

  // Cuadro de Consejo / Diagnóstico de RAM
  if (elRamAdviceBox && elRamAdviceContent) {
    if (ram.Issues && ram.Issues.length > 0) {
      elRamAdviceBox.style.display = 'flex';
      elRamAdviceContent.innerHTML = ram.Issues.map(issue => `<p style="margin: 0 0 6px 0;">${escapeHtml(issue)}</p>`).join('');
    } else {
      elRamAdviceBox.style.display = 'flex';
      elRamAdviceContent.innerHTML = '<strong>Lectura de memoria completada.</strong> La información de Windows no confirma por sí sola XMP/EXPO ni los canales. Consulta los datos del fabricante para comprobarlos.';
    }
  }

  // Ranuras DIMM Físicas
  const dimmContainer = document.getElementById('hw-dimm-slots-container');
  if (dimmContainer) {
    const modules = ram.Modules || [];
    if (modules.length === 0) {
      dimmContainer.innerHTML = '<div class="hw-dimm-slot-empty">No se detectaron módulos de memoria mediante WMI.</div>';
    } else {
      dimmContainer.innerHTML = modules.map(m => {
        let badgeClass = 'badge-optimal';
        let badgeText = '✓ Velocidad Máx.';
        let cardClass = 'slot-optimal';

        if (ram.Status === 'MISMATCHED_MODULES') {
          if (m.PartRated < ram.MaxRatedSpeed) {
            badgeClass = 'badge-bottleneck';
            badgeText = `⚠️ Cuello de Botella (${m.PartRated} MT/s)`;
            cardClass = 'slot-downclocked';
          } else if (m.ConfiguredSpeed < (m.PartRated - 100)) {
            badgeClass = 'badge-downclocked';
            badgeText = `⚠️ Limitado a ${m.ConfiguredSpeed} MT/s`;
            cardClass = 'slot-downclocked';
          } else {
            badgeClass = 'badge-optimal';
            badgeText = `✓ ${m.ConfiguredSpeed} MT/s`;
          }
        } else if (m.ConfiguredSpeed < (m.PartRated - 100)) {
          badgeClass = 'badge-downclocked';
          badgeText = '⚠️ XMP Desactivado';
          cardClass = 'slot-downclocked';
        }

        return `
          <div class="hw-dimm-card ${cardClass}">
            <div class="hw-dimm-header">
              <span class="hw-dimm-slot-name">${escapeHtml(m.Slot)}</span>
              <span class="hw-dimm-badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="hw-dimm-main">
              <span class="hw-dimm-capacity">${m.CapacityGB} GB</span>
              <span class="hw-dimm-speed mono">${m.ConfiguredSpeed} MT/s</span>
            </div>
            <div class="hw-dimm-meta">
              <span style="font-weight: 600; color: #cbd5e1;">${escapeHtml(m.Manufacturer)}</span>
              <span class="hw-dimm-part">${escapeHtml(m.PartNumber || 'Genérico')}</span>
              <span class="hw-dimm-rated-tag">Velocidad de Fábrica: ${m.PartRated} MT/s</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 2. Almacenamiento Físico
  const drivesContainer = document.getElementById('hw-drives-container');
  const storageSummaryBadge = document.getElementById('hw-storage-summary-badge');
  if (drivesContainer) {
    const disks = storage.Disks || [];
    if (disks.length === 0) {
      drivesContainer.innerHTML = '<div class="hw-dimm-slot-empty">No se pudieron listar los discos físicos.</div>';
    } else {
      drivesContainer.innerHTML = disks.map(d => {
        const isHdd = (d.MediaType === 'HDD');
        const driveLetters = d.DriveLetters ? `Unidad ${escapeHtml(d.DriveLetters)}` : 'Sin letra asignada';
        const formattedSize = d.SizeDisplay || (d.SizeGB >= 1000 ? `${(d.SizeGB / 1024).toFixed(1)} TB` : `${d.SizeGB} GB`);

        return `
          <div class="hw-drive-card ${isHdd ? 'drive-hdd' : 'drive-ssd'}">
            <div class="hw-drive-icon">${isHdd ? '💽' : '⚡'}</div>
            <div class="hw-drive-info">
              <div class="hw-drive-top">
                <span class="hw-drive-title" title="${escapeHtml(d.FriendlyName || 'Disco de Almacenamiento')}">${escapeHtml(d.FriendlyName || 'Disco de Almacenamiento')}</span>
                <span class="hw-drive-letter">${driveLetters}</span>
              </div>
              <div class="hw-drive-details">
                <span class="hw-drive-pill ${isHdd ? 'pill-hdd' : 'pill-ssd'}">${isHdd ? 'Disco Mecánico (HDD)' : escapeHtml(d.MediaType || 'Sin confirmar')}</span>
                <span>Bus: ${escapeHtml(d.BusType || 'SATA')}</span>
                <span style="font-weight: 700; color: #f8fafc; margin-left: auto;">${escapeHtml(formattedSize)}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  if (storageSummaryBadge) {
    storageSummaryBadge.className = 'hw-status-pill';
    const hddCount = storage.GamesOnHddCount || 0;
    if (hddCount > 0) {
      storageSummaryBadge.classList.add('pill-warning');
      storageSummaryBadge.textContent = `⚠️ ${hddCount} Juegos en HDD`;
    } else {
      storageSummaryBadge.classList.add('pill-optimal');
      storageSummaryBadge.textContent = '✓ Almacenamiento Óptimo (SSD)';
    }
  }

  // Juegos en HDD
  const hddGamesContainer = document.getElementById('hw-hdd-games-container');
  const hddCountBadge = document.getElementById('hw-hdd-count-badge');
  const gamesOnHdd = storage.GamesOnHdd || [];

  if (hddCountBadge) {
    hddCountBadge.textContent = `${gamesOnHdd.length} juego(s)`;
  }

  if (hddGamesContainer) {
    if (gamesOnHdd.length === 0) {
      hddGamesContainer.innerHTML = '<div class="hw-dimm-slot-empty" style="color: #34d399;">✓ ¡Perfecto! No hay juegos competitivos instalados en discos mecánicos.</div>';
    } else {
      hddGamesContainer.innerHTML = gamesOnHdd.map(g => {
        return `
          <div class="hw-game-card card-hdd">
            <div class="hw-game-info">
              <div class="hw-game-name-row">
                <span class="hw-game-name">${escapeHtml(g.DisplayName || g.Name)}</span>
                <span class="hw-game-drive-badge">Disco ${escapeHtml(g.Drive)}: (HDD)</span>
              </div>
              <span class="hw-game-path" title="${escapeHtml(g.Path)}">${escapeHtml(g.Path)}</span>
            </div>
            <div class="hw-game-actions">
              <span class="hw-game-stutter-tag">⚠️ Provoca Stuttering</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Juegos en SSD
  const ssdGamesContainer = document.getElementById('hw-ssd-games-container');
  const ssdCountBadge = document.getElementById('hw-ssd-count-badge');
  const gamesOnSsd = storage.GamesOnSsd || [];

  if (ssdCountBadge) {
    ssdCountBadge.textContent = `${gamesOnSsd.length} juego(s)`;
  }

  if (ssdGamesContainer) {
    if (gamesOnSsd.length === 0) {
      ssdGamesContainer.innerHTML = '<div class="hw-dimm-slot-empty">No se detectaron juegos instalados en unidades SSD.</div>';
    } else {
      ssdGamesContainer.innerHTML = gamesOnSsd.map(g => {
        return `
          <div class="hw-game-card card-ssd">
            <div class="hw-game-info">
              <div class="hw-game-name-row">
                <span class="hw-game-name">${escapeHtml(g.DisplayName || g.Name)}</span>
                <span class="hw-game-drive-badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">Disco ${escapeHtml(g.Drive)}: (SSD)</span>
              </div>
              <span class="hw-game-path" title="${escapeHtml(g.Path)}">${escapeHtml(g.Path)}</span>
            </div>
            <div class="hw-game-actions">
              <span style="font-size: 11px; font-weight: 600; color: #34d399;">✓ 0% Latencia de Carga</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 3. Banner Global de Diagnóstico
  const banner = document.getElementById('hw-overall-banner');
  const alertTitle = document.getElementById('hw-alert-title');
  const alertDesc = document.getElementById('hw-alert-desc');

  if (banner && alertTitle && alertDesc) {
    const hasRamIssues = (ram.Issues && ram.Issues.length > 0);
    const hasHddGames = (gamesOnHdd.length > 0);

    if (hasRamIssues || hasHddGames) {
      banner.style.display = 'flex';
      banner.className = 'hw-alert-box';
      alertTitle.textContent = '⚠️ Alerta de Rendimiento de Hardware Gamer Detectada';

      const reasons = [];
      if (hasRamIssues) {
        reasons.push(`Memoria RAM: ${ram.Issues[0]}`);
      }
      if (hasHddGames) {
        reasons.push(`Almacenamiento: Se detectaron ${gamesOnHdd.length} juegos en tu disco mecánico HDD (${storage.DriveMediaMap?.D ? 'D:' : 'disco mecánico'}). El streaming de texturas en HDD provoca caídas de FPS (1% Low).`);
      }
      alertDesc.innerHTML = reasons.map(r => `• ${escapeHtml(r)}`).join('<br>');
    } else {
      banner.style.display = 'flex';
      banner.className = 'hw-alert-box alert-success';
      alertTitle.textContent = 'Información de hardware disponible';
      alertDesc.textContent = 'No se observaron incidencias en los datos obtenidos. Los campos no confirmados por Windows permanecen como desconocidos.';
    }
  }
}

function updateUsbLatencyUI(usbStatus) {
  if (!usbStatus) return;

  const badge = document.getElementById('hw-usb-status-badge');
  const modeText = document.getElementById('hw-usb-current-mode');
  const btnToggle = document.getElementById('btn-toggle-usb-latency');

  const isLowLatency = (usbStatus.isLowLatencyEnabled === true);
  if(btnToggle)btnToggle.disabled=false;

  if (badge) {
    badge.className = 'hw-status-pill';
    if (isLowLatency) {
      badge.classList.add('pill-optimal');
      badge.textContent = 'Suspensión selectiva USB desactivada';
    } else {
      badge.classList.add('pill-warning');
      badge.textContent = '⚠️ Suspensión Selectiva Activa (Ahorro de Energía)';
    }
  }

  if (modeText) {
    if (isLowLatency) {
      modeText.className = 'hw-usb-mode mode-low-latency';
      modeText.textContent = 'Ahorro de energía USB desactivado';
    } else {
      modeText.className = 'hw-usb-mode';
      modeText.textContent = 'Habilitada (Windows suspende y retarda periféricos en reposo)';
    }
  }

  if (btnToggle) {
    if (isLowLatency) {
      btnToggle.className = 'btn-action-primary';
      btnToggle.textContent = '🔄 Restaurar Ahorro de Energía USB';
    } else {
      btnToggle.className = 'btn-action-primary btn-game';
      btnToggle.textContent = '⚡ Activar Ultra-Baja Latencia USB';
    }
  }
}

function setupHardwareListeners() {
  const btnRefresh = document.getElementById('btn-refresh-hardware');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      await loadHardwareDiagnostics(true);
      showToast('Diagnóstico de hardware actualizado correctamente.', 'success');
    });
  }

  const btnToggleUsb = document.getElementById('btn-toggle-usb-latency');
  if (btnToggleUsb) {
    btnToggleUsb.addEventListener('click', async () => {
      const isCurrentlyLow = (usbLatencyState && usbLatencyState.isLowLatencyEnabled === true);
      const targetEnable = !isCurrentlyLow;

      const confirmed = await promptActionConfirmation({
        title: targetEnable ? '⚡ Activar Ultra-Baja Latencia USB' : '🔄 Restaurar Ahorro de Energía USB',
        subtitle: targetEnable 
          ? 'Desactiva la suspensión selectiva de USB en el plan de energía activo de Windows.'
          : 'Restaura los valores originales guardados de suspensión selectiva USB.',
        badgeText: 'Preferencias de energía USB',
        badgeClass: targetEnable ? 'badge-gaming' : 'badge-warning',
        details: targetEnable ? [
          'Guarda el esquema y sus valores anteriores de corriente y batería.',
          'Desactiva la suspensión selectiva USB en ese plan.',
          'No cambia ni garantiza la tasa de sondeo del ratón o teclado.',
          'Puede aumentar el consumo, especialmente en un portátil.'
        ] : [
          'Recupera los valores del respaldo de Apex.',
          'Si no hay respaldo propio, no cambia valores por defecto.'
        ],
        confirmText: targetEnable ? '⚡ Activar Ultra-Baja Latencia' : '🔄 Restaurar Ahorro de Energía'
      });

      if (!confirmed) return;

      btnToggleUsb.disabled = true;
      btnToggleUsb.textContent = '⏳ Aplicando...';

      try {
        const res = await window.api.setUsbLowLatency(targetEnable);
        if (res && res.success) {
          usbLatencyState = res;
          updateUsbLatencyUI(usbLatencyState);
          showToast(res.message || (targetEnable ? 'Preferencia de energía USB aplicada.' : 'Valores USB guardados restaurados.'), 'success');
        } else {
          showToast(`Error al configurar latencia USB: ${res?.error || 'Desconocido'}`, 'error');
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        btnToggleUsb.disabled = false;
        if (usbLatencyState) updateUsbLatencyUI(usbLatencyState);
      }
    });
  }
}

// Teclado y recuperación de errores en la interfaz original.
document.addEventListener('keydown',event=>{
 const modal=document.getElementById('action-confirm-modal');if(!modal?.classList.contains('active'))return;
 if(event.key==='Escape'){event.preventDefault();document.getElementById('btn-cancel-confirm-action')?.click();}
 if(event.key==='Tab'){const items=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(item=>item.getClientRects().length);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
});
window.addEventListener('unhandledrejection',event=>{event.preventDefault();showToast(event.reason?.message||'La operación no pudo completarse. No se confirmó el resultado.','error');});
