(function () {
  const ADMIN_KEY = '01/01/2003';
  const UNLOCK_KEY = 'portfolio_admin_unlocked';
  const PAGE_SNAPSHOT_PREFIX = 'portfolio_page_snapshot_';
  const PAGE_REMOVE_HISTORY_PREFIX = 'portfolio_remove_history_';
  const DYNAMIC_PROJECTS_KEY = 'portfolio_dynamic_projects';
  const THEME_KEY = 'portfolio_theme';
  const HERO_SETTINGS_KEY = 'portfolio_hero_settings';
  const BACKGROUND_CLEANUP_KEY = 'portfolio_background_cleanup_v2';
  const CLICK_WINDOW_MS = 2200;
  const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const MONTH_ALIASES = {
    january: 'jan',
    february: 'feb',
    march: 'mar',
    april: 'apr',
    june: 'jun',
    july: 'jul',
    august: 'aug',
    september: 'sep',
    october: 'oct',
    november: 'nov',
    december: 'dec'
  };

  let clickCount = 0;
  let clickTimer = null;
  let adminPanel = null;
  let removeMode = false;
  let removeHistory = [];
  let supportPopup = null;
  let supportHintTimer = null;
  let timelineCertAction = '';
  const DEFAULT_HERO_SETTINGS = {
    design: 'diagonal',
    color1: '#041229',
    color2: '#2b0f5b',
    color3: '#8b2b7b'
  };
  const HERO_PRESETS = {
    techBlue: { design: 'diagonal', color1: '#041229', color2: '#0d2b56', color3: '#1f5fa8' },
    neonPurple: { design: 'aurora', color1: '#160a35', color2: '#5f1da8', color3: '#d13bff' },
    sunset: { design: 'radial', color1: '#2b1636', color2: '#d56a2a', color3: '#ffd166' }
  };
  const STATIC_PROJECT_ROUTE_MAP = [
    { includes: ['fpga', '2‑bit cpu'], href: 'projects/fpga-learning-board.html' },
    { includes: ['citypulse', 'traffic intelligence'], href: 'projects/citypulse-traffic-intelligence.html' },
    { includes: ['gram jyoti', 'renewable energy monitoring'], href: 'projects/gram-jyoti-renewable-monitoring.html' },
    { includes: ['pragyan rover'], href: 'projects/pragyan-rover.html' }
  ];

  const pageIdentity = (window.location.pathname + window.location.search).replace(/[^a-z0-9]/gi, '_');
  const pageStorageKey = PAGE_SNAPSHOT_PREFIX + pageIdentity;
  const removeHistoryStorageKey = PAGE_REMOVE_HISTORY_PREFIX + pageIdentity;

  function isAdminUnlocked() {
    if (sessionStorage.getItem(UNLOCK_KEY) === 'true') {
      return true;
    }

    if (localStorage.getItem(UNLOCK_KEY) === 'true') {
      sessionStorage.setItem(UNLOCK_KEY, 'true');
      return true;
    }

    return false;
  }

  function setAdminUnlocked(enabled) {
    if (enabled) {
      sessionStorage.setItem(UNLOCK_KEY, 'true');
      localStorage.setItem(UNLOCK_KEY, 'true');
      return;
    }

    sessionStorage.removeItem(UNLOCK_KEY);
    localStorage.removeItem(UNLOCK_KEY);
  }

  function safeParse(json) {
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function stripInlineBackgroundDeclarations(styleValue) {
    const raw = String(styleValue || '').trim();
    if (!raw) return '';

    const declarations = raw
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean);

    const kept = declarations.filter((declaration) => {
      const prop = declaration.split(':')[0].trim().toLowerCase();
      return !(prop === 'background' || prop === 'background-color' || prop === 'background-image');
    });

    return kept.join('; ');
  }

  function sanitizeInlineBackgroundStylesInRoot(root) {
    if (!root || !root.querySelectorAll) return false;

    let changed = false;
    const styledNodes = root.querySelectorAll('[style]');
    styledNodes.forEach((node) => {
      const styleAttr = node.getAttribute('style') || '';
      const cleaned = stripInlineBackgroundDeclarations(styleAttr);
      if (cleaned === styleAttr.trim()) return;

      if (cleaned) {
        node.setAttribute('style', cleaned);
      } else {
        node.removeAttribute('style');
      }
      changed = true;
    });

    return changed;
  }

  function sanitizeSnapshotHtml(rawHtml) {
    const raw = String(rawHtml || '');
    if (!raw.trim()) return { changed: false, html: raw };

    const host = document.createElement('div');
    host.innerHTML = raw;
    const changed = sanitizeInlineBackgroundStylesInRoot(host);

    return { changed, html: host.innerHTML };
  }

  function cleanupSnapshotBackgroundStyles() {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith(PAGE_SNAPSHOT_PREFIX)) {
        keys.push(key);
      }
    }

    keys.forEach((key) => {
      const parsed = safeParse(localStorage.getItem(key) || '');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;

      const fields = ['header', 'main', 'footer', 'resume'];
      let changedAny = false;

      fields.forEach((field) => {
        if (typeof parsed[field] !== 'string') return;
        const result = sanitizeSnapshotHtml(parsed[field]);
        if (!result.changed) return;
        parsed[field] = result.html;
        changedAny = true;
      });

      if (changedAny) {
        localStorage.setItem(key, JSON.stringify(parsed));
      }
    });
  }

  function cleanupCurrentPageBackgroundStyles() {
    const main = document.querySelector('main');
    if (!main) return;
    sanitizeInlineBackgroundStylesInRoot(main);
  }

  function performBackgroundCleanupOnce() {
    if (localStorage.getItem(BACKGROUND_CLEANUP_KEY) === 'true') return;

    cleanupSnapshotBackgroundStyles();
    cleanupCurrentPageBackgroundStyles();
    localStorage.setItem(BACKGROUND_CLEANUP_KEY, 'true');
  }

  function normalizeHexColor(value, fallback) {
    const raw = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
    return fallback;
  }

  function loadHeroSettings() {
    const parsed = safeParse(localStorage.getItem(HERO_SETTINGS_KEY) || '');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...DEFAULT_HERO_SETTINGS };
    }

    return {
      design: typeof parsed.design === 'string' ? parsed.design : DEFAULT_HERO_SETTINGS.design,
      color1: normalizeHexColor(parsed.color1, DEFAULT_HERO_SETTINGS.color1),
      color2: normalizeHexColor(parsed.color2, DEFAULT_HERO_SETTINGS.color2),
      color3: normalizeHexColor(parsed.color3, DEFAULT_HERO_SETTINGS.color3)
    };
  }

  function saveHeroSettings(settings) {
    localStorage.setItem(HERO_SETTINGS_KEY, JSON.stringify(settings));
  }

  function applyHeroSettings(settings) {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    const next = {
      design: settings.design || DEFAULT_HERO_SETTINGS.design,
      color1: normalizeHexColor(settings.color1, DEFAULT_HERO_SETTINGS.color1),
      color2: normalizeHexColor(settings.color2, DEFAULT_HERO_SETTINGS.color2),
      color3: normalizeHexColor(settings.color3, DEFAULT_HERO_SETTINGS.color3)
    };

    document.documentElement.style.setProperty('--hero-c1', next.color1);
    document.documentElement.style.setProperty('--hero-c2', next.color2);
    document.documentElement.style.setProperty('--hero-c3', next.color3);
    document.body.setAttribute('data-hero-design', next.design);
  }

  function bindHeroDesignControls() {
    if (!adminPanel) return;
    const row = adminPanel.querySelector('#admin-banner-actions');
    if (!row) return;

    const designSelect = row.querySelector('#admin-hero-design');
    const color1 = row.querySelector('#admin-hero-color-1');
    const color2 = row.querySelector('#admin-hero-color-2');
    const color3 = row.querySelector('#admin-hero-color-3');
    const applyBtn = row.querySelector('#admin-apply-hero-style');
    const resetBtn = row.querySelector('#admin-reset-hero-style');
    const presetButtons = Array.from(row.querySelectorAll('[data-hero-preset]'));

    if (!designSelect || !color1 || !color2 || !color3 || !applyBtn || !resetBtn) return;

    const current = loadHeroSettings();
    designSelect.value = current.design;
    color1.value = current.color1;
    color2.value = current.color2;
    color3.value = current.color3;

    applyBtn.addEventListener('click', () => {
      const next = {
        design: designSelect.value,
        color1: color1.value,
        color2: color2.value,
        color3: color3.value
      };

      saveHeroSettings(next);
      applyHeroSettings(next);
      saveSnapshot();
      window.alert('Banner style updated.');
    });

    presetButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.getAttribute('data-hero-preset') || '';
        const preset = HERO_PRESETS[key];
        if (!preset) return;

        designSelect.value = preset.design;
        color1.value = preset.color1;
        color2.value = preset.color2;
        color3.value = preset.color3;

        saveHeroSettings(preset);
        applyHeroSettings(preset);
        saveSnapshot();
      });
    });

    resetBtn.addEventListener('click', () => {
      const defaults = { ...DEFAULT_HERO_SETTINGS };
      designSelect.value = defaults.design;
      color1.value = defaults.color1;
      color2.value = defaults.color2;
      color3.value = defaults.color3;
      saveHeroSettings(defaults);
      applyHeroSettings(defaults);
      saveSnapshot();
      window.alert('Banner style reset to default.');
    });
  }

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
  }

  function loadDynamicProjects() {
    const raw = localStorage.getItem(DYNAMIC_PROJECTS_KEY);
    const parsed = safeParse(raw || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  }

  function saveDynamicProjects(projects) {
    localStorage.setItem(DYNAMIC_PROJECTS_KEY, JSON.stringify(projects));
  }

  function createDynamicProjectRecord(payload) {
    const projects = loadDynamicProjects();
    const base = slugify(payload.title) || 'project';
    let projectId = base;
    let index = 2;

    while (projects[projectId]) {
      projectId = `${base}-${index}`;
      index += 1;
    }

    projects[projectId] = {
      id: projectId,
      title: payload.title,
      year: payload.year,
      tools: payload.tools,
      summary: payload.summary,
      impact: payload.impact,
      explanation: `Add detailed explanation for ${payload.title}.`,
      requirements: {
        hardware: 'Add hardware requirements',
        software: 'Add software requirements',
        inputs: 'Add input/configuration requirements'
      },
      outcome: {
        technical: 'Add technical outcome',
        impact: 'Add impact outcome',
        futureScope: 'Add future scope outcome'
      },
      scriptSnippet: `# ${payload.title}\n# Add script steps here`,
      imageNote: `Add image file at: images/projects/${projectId}.jpg`,
      videoNote: `Add video file at: videos/projects/${projectId}.mp4`
    };

    saveDynamicProjects(projects);
    return projectId;
  }

  function restoreSnapshot() {
    const raw = localStorage.getItem(pageStorageKey);
    if (!raw) return;

    const snapshot = safeParse(raw);
    if (!snapshot) return;

    const mapping = [
      ['header', 'header'],
      ['main', 'main'],
      ['footer', 'footer'],
      ['resume', '.resume']
    ];

    mapping.forEach(([key, selector]) => {
      if (!snapshot[key]) return;
      const el = document.querySelector(selector);
      if (el) {
        el.innerHTML = snapshot[key];
      }
    });
  }

  function saveSnapshot() {
    const snapshot = {};
    const header = document.querySelector('header');
    const main = document.querySelector('main');
    const footer = document.querySelector('footer');
    const resume = document.querySelector('.resume');

    if (header) snapshot.header = header.innerHTML;
    if (main) snapshot.main = main.innerHTML;
    if (footer) snapshot.footer = footer.innerHTML;
    if (resume) snapshot.resume = resume.innerHTML;

    localStorage.setItem(pageStorageKey, JSON.stringify(snapshot));
  }

  function persistRemoveHistory() {
    localStorage.setItem(removeHistoryStorageKey, JSON.stringify(removeHistory));
  }

  function collectPortfolioStorageData() {
    const data = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith('portfolio_')) continue;
      const value = localStorage.getItem(key);
      if (typeof value === 'string') {
        data[key] = value;
      }
    }
    return data;
  }

  function exportAdminBackup() {
    saveSnapshot();

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: collectPortfolioStorageData()
    };

    const dateStamp = new Date().toISOString().slice(0, 10);
    const fileName = `portfolio-backup-${dateStamp}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    window.alert('Backup exported successfully.');
  }

  function clearPortfolioStorageKeys() {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith('portfolio_')) {
        keys.push(key);
      }
    }
    keys.forEach((key) => localStorage.removeItem(key));
  }

  function normalizeBackupData(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    const source = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
    return Object.entries(source).filter(([key, value]) => key.startsWith('portfolio_') && typeof value === 'string');
  }

  function importAdminBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || '');
        const parsed = safeParse(text);
        if (!parsed) {
          window.alert('Invalid backup file. Could not parse JSON.');
          return;
        }

        const entries = normalizeBackupData(parsed);
        if (!entries.length) {
          window.alert('No valid portfolio backup data found in this file.');
          return;
        }

        const replaceExisting = window.confirm('Replace existing portfolio backup data before import?\nChoose OK to replace, Cancel to merge.');
        if (replaceExisting) {
          clearPortfolioStorageKeys();
        }

        entries.forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });

        if (!localStorage.getItem(THEME_KEY)) {
          localStorage.setItem(THEME_KEY, 'light');
        }

        window.alert('Backup imported successfully. Page will reload now.');
        window.location.reload();
      };

      reader.readAsText(file);
    };
    input.click();
  }

  function restoreRemoveHistory() {
    const raw = localStorage.getItem(removeHistoryStorageKey);
    if (!raw) return;
    const parsed = safeParse(raw);
    if (!Array.isArray(parsed)) return;
    removeHistory = parsed;
  }

  function getContainerSelectorForMode(mode) {
    if (mode === 'project') return '.projects-grid';
    if (mode === 'skill') return '.skills-grid';
    if (mode === 'research') return '.timeline';
    return '';
  }

  function pushRemovedItem(target, mode) {
    const parent = target.parentElement;
    const containerSelector = getContainerSelectorForMode(mode);
    if (!parent || !containerSelector) return;

    const index = Array.from(parent.children).indexOf(target);
    if (index < 0) return;

    removeHistory.push({
      mode,
      html: target.outerHTML,
      index,
      containerSelector
    });

    if (removeHistory.length > 40) {
      removeHistory.shift();
    }

    persistRemoveHistory();
  }

  function undoLastRemoval() {
    if (!removeHistory.length) {
      window.alert('No removed item to restore.');
      return;
    }

    const last = removeHistory.pop();
    persistRemoveHistory();

    restoreRemovedRecord(last, false);
  }

  function restoreRemovedRecord(last, silent) {
    if (!last) return false;

    const container = document.querySelector(last.containerSelector);
    if (!container) {
      if (!silent) window.alert('Unable to restore on this page.');
      return false;
    }

    const template = document.createElement('template');
    template.innerHTML = (last.html || '').trim();
    const node = template.content.firstElementChild;
    if (!node) return false;

    const children = container.children;
    if (typeof last.index === 'number' && last.index >= 0 && last.index < children.length) {
      container.insertBefore(node, children[last.index]);
    } else {
      container.appendChild(node);
    }

    if (last.mode === 'research') {
      sortTimelineByYear();
      refreshTimelineSupportState();
    }

    if (document.documentElement.classList.contains('admin-mode')) {
      makeEditable(true);
    }

    saveSnapshot();
    return true;
  }

  function undoAllRemovals() {
    if (!removeHistory.length) {
      window.alert('No removed items to restore.');
      return;
    }

    let restoredCount = 0;
    while (removeHistory.length) {
      const record = removeHistory.pop();
      const restored = restoreRemovedRecord(record, true);
      if (restored) restoredCount += 1;
    }

    persistRemoveHistory();
    window.alert(`${restoredCount} item(s) restored.`);
  }

  function makeEditable(enabled) {
    const editableNodes = document.querySelectorAll(
      'h1, h2, h3, p, li, span, strong, em, pre, code, .skill-name, .tools, .impact, .date'
    );
    const resumeRoot = document.querySelector('.resume');
    const resumeNav = document.querySelector('.resume .subpage-nav');

    editableNodes.forEach((node) => {
      if (node.closest('#admin-panel')) return;
      if (node.id === 'theme-toggle') return;
      if (node.closest('.projects-grid .project-link')) return;
      if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return;
      node.contentEditable = enabled ? 'true' : 'false';
    });

    if (resumeRoot) {
      resumeRoot.contentEditable = enabled ? 'true' : 'false';
      if (resumeNav) {
        resumeNav.contentEditable = 'false';
      }
    }

    document.documentElement.classList.toggle('admin-mode', enabled);
  }

  function enforceLockedEditingState() {
    const editableNodes = document.querySelectorAll('[contenteditable]');
    editableNodes.forEach((node) => {
      if (node.closest('#admin-panel')) return;
      node.contentEditable = 'false';
      node.removeAttribute('contenteditable');
    });

    document.documentElement.classList.remove('admin-mode');
  }

  function enableImageEditing(enabled) {
    if (!enabled) return;

    document.addEventListener('click', (event) => {
      if (!document.documentElement.classList.contains('admin-mode')) return;
      const image = event.target.closest('img');
      if (!image) return;
      if (image.closest('#admin-panel')) return;

      event.preventDefault();

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          image.src = String(reader.result || '');
          saveSnapshot();
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }, true);

    document.addEventListener('dblclick', (event) => {
      if (!document.documentElement.classList.contains('admin-mode')) return;
      const link = event.target.closest('a');
      if (!link) return;
      if (link.closest('#admin-panel')) return;
      if (link.closest('.projects-grid')) return;
      if (link.closest('.subpage-nav')) return;

      event.preventDefault();
      const nextHref = window.prompt('Edit link URL:', link.getAttribute('href') || '');
      if (nextHref !== null) {
        link.setAttribute('href', nextHref.trim());
        saveSnapshot();
      }
    }, true);
  }

  function bindProjectSubpageOpen() {
    document.addEventListener('dblclick', (event) => {
      if (!document.documentElement.classList.contains('admin-mode')) return;
      const projectNode = event.target.closest('.projects-grid .project-link, .projects-grid .card');
      if (!projectNode) return;
      if (projectNode.closest('#admin-panel')) return;

      const projectLink = projectNode.classList.contains('project-link') ? projectNode : projectNode.closest('.project-link');
      const href = (projectLink && projectLink.getAttribute('href')) || projectNode.getAttribute('data-project-href') || '';
      if (!href) return;

      event.preventDefault();
      window.location.href = href;
    }, true);
  }

  function resolveStaticProjectHrefFromTitle(title) {
    const normalized = String(title || '').trim().toLowerCase();
    if (!normalized) return '';

    for (const route of STATIC_PROJECT_ROUTE_MAP) {
      if (route.includes.some((token) => normalized.includes(token))) {
        return route.href;
      }
    }

    return '';
  }

  function remapProjectLinks() {
    const links = Array.from(document.querySelectorAll('.projects-grid .project-link'));
    if (!links.length) return;

    links.forEach((link) => {
      const currentHref = link.getAttribute('href') || '';
      if (currentHref.includes('dynamic-project.html?id=')) return;

      const titleText = link.querySelector('h3')?.textContent || '';
      const mappedHref = resolveStaticProjectHrefFromTitle(titleText);
      if (!mappedHref) return;

      link.setAttribute('href', mappedHref);
      const card = link.querySelector('.card');
      if (card) card.setAttribute('data-project-href', mappedHref);
    });
  }

  function bindProjectTileNavigation() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('.projects-grid .project-link');
      if (!link) return;
      if (event.target.closest('.admin-edit-project-btn')) return;
      if (document.documentElement.classList.contains('admin-mode') && removeMode) return;

      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const href = link.getAttribute('href') || '';
      if (!href || href === '#') return;

      event.preventDefault();
      window.location.href = href;
    }, true);
  }

  function sortTimelineByYear() {
    const timeline = document.querySelector('.timeline');
    if (!timeline) return;

    const items = Array.from(timeline.querySelectorAll('li'));
    items.sort((a, b) => {
      const ay = parseInt((a.querySelector('.date')?.textContent || '').trim(), 10) || 0;
      const by = parseInt((b.querySelector('.date')?.textContent || '').trim(), 10) || 0;
      return by - ay;
    });

    items.forEach((item) => timeline.appendChild(item));
  }

  function getSupportImageFromTimelineItem(item) {
    if (!item) return '';
    return String(item.getAttribute('data-support-image') || '').trim();
  }

  function getTimelineItemTitle(item) {
    if (!item) return 'Supportive image';
    const title = item.querySelector('.body h3')?.textContent || 'Supportive image';
    return String(title).trim() || 'Supportive image';
  }

  function refreshTimelineSupportState() {
    const items = document.querySelectorAll('.timeline li');
    items.forEach((item) => {
      const hasSupportImage = !!getSupportImageFromTimelineItem(item);
      item.classList.toggle('timeline-support-enabled', hasSupportImage);
      const heading = item.querySelector('.body h3');
      const existingBadge = item.querySelector('.timeline-support-badge');

      if (hasSupportImage) {
        if (heading && !existingBadge) {
          const badge = document.createElement('span');
          badge.className = 'timeline-support-badge';
          badge.textContent = 'View Certificate';
          heading.appendChild(badge);
        }

        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.setAttribute('aria-label', `Open supportive image for ${getTimelineItemTitle(item)}`);
      } else {
        if (existingBadge) existingBadge.remove();
        item.removeAttribute('role');
        item.removeAttribute('tabindex');
        item.removeAttribute('aria-label');
      }
    });
  }

  function closeSupportPopup() {
    if (!supportPopup) return;
    if (supportHintTimer) {
      window.clearTimeout(supportHintTimer);
      supportHintTimer = null;
    }
    supportPopup.classList.remove('hint-hidden');
    supportPopup.setAttribute('hidden', 'hidden');
    supportPopup.classList.remove('fullsize');
    document.body.classList.remove('research-popup-open');
  }

  function ensureSupportPopup() {
    if (supportPopup) return supportPopup;

    supportPopup = document.createElement('div');
    supportPopup.className = 'research-support-popup';
    supportPopup.setAttribute('hidden', 'hidden');
    supportPopup.innerHTML = `
      <div class="research-support-backdrop" data-support-close="true"></div>
      <div class="research-support-dialog" role="dialog" aria-modal="true" aria-label="Supportive image preview">
        <button type="button" class="research-support-close" data-support-close="true" aria-label="Close supportive image">×</button>
        <div class="research-support-hint">Full Size: double-click image</div>
        <img class="research-support-image" alt="Supportive image" />
      </div>
    `;

    supportPopup.addEventListener('click', (event) => {
      const closeTarget = event.target.closest('[data-support-close="true"]');
      if (!closeTarget) return;
      event.preventDefault();
      closeSupportPopup();
    });

    const dialog = supportPopup.querySelector('.research-support-dialog');
    dialog?.addEventListener('dblclick', (event) => {
      if (event.target.closest('[data-support-close="true"]')) return;
      event.preventDefault();
      supportPopup.classList.toggle('fullsize');
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!supportPopup || supportPopup.hasAttribute('hidden')) return;
      closeSupportPopup();
    });

    document.body.appendChild(supportPopup);
    return supportPopup;
  }

  function openSupportPopup(imageSrc, title) {
    const popup = ensureSupportPopup();
    const image = popup.querySelector('.research-support-image');
    if (!image) return;

    if (supportHintTimer) {
      window.clearTimeout(supportHintTimer);
      supportHintTimer = null;
    }

    image.src = imageSrc;
    image.alt = `${title} supportive image`;
    popup.classList.remove('fullsize');
    popup.classList.remove('hint-hidden');
    popup.removeAttribute('hidden');
    document.body.classList.add('research-popup-open');

    supportHintTimer = window.setTimeout(() => {
      popup.classList.add('hint-hidden');
      supportHintTimer = null;
    }, 2000);
  }

  function setTimelineCertAction(action) {
    timelineCertAction = action || '';
    if (!adminPanel) return;

    const attachButton = adminPanel.querySelector('#admin-attach-cert');
    const removeButton = adminPanel.querySelector('#admin-remove-cert');
    const removeItemButton = adminPanel.querySelector('#admin-remove-item');

    attachButton?.classList.toggle('active-remove', timelineCertAction === 'attach');
    removeButton?.classList.toggle('active-remove', timelineCertAction === 'remove');

    if (timelineCertAction) {
      removeMode = false;
      removeItemButton?.classList.remove('active-remove');
    }

    const note = adminPanel.querySelector('.admin-note');
    if (!note) return;

    if (timelineCertAction === 'attach') {
      note.textContent = 'Attach mode: click a research/certification row to attach or replace certificate image.';
      return;
    }

    if (timelineCertAction === 'remove') {
      note.textContent = 'Remove certificate mode: click a research/certification row to remove its certificate image.';
      return;
    }

    if (removeMode) {
      note.textContent = 'Remove mode: click any project tile, skill tile, or research/certification row to delete it.';
      return;
    }

    note.textContent = 'Tip: click any image to replace it. Double-click links to edit URL. Double-click a project tile to open its subpage. Double-click popup image to open full-size. Use Attach/Remove Cert for direct certificate control.';
  }

  function bindTimelineSupportInteractions() {
    document.addEventListener('click', (event) => {
      const item = event.target.closest('.timeline li');
      if (!item) return;
      if (event.target.closest('#admin-panel')) return;
      if (document.documentElement.classList.contains('admin-mode') && removeMode) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      if (document.documentElement.classList.contains('admin-mode') && timelineCertAction) {
        event.preventDefault();
        event.stopPropagation();

        if (timelineCertAction === 'attach') {
          pickFiles('image/*', false, (dataUrl) => {
            item.setAttribute('data-support-image', dataUrl);
            refreshTimelineSupportState();
            saveSnapshot();
            window.alert('Certificate image attached to selected tile.');
          });
        }

        if (timelineCertAction === 'remove') {
          if (!getSupportImageFromTimelineItem(item)) {
            window.alert('No certificate image found on this tile.');
          } else {
            item.removeAttribute('data-support-image');
            refreshTimelineSupportState();
            saveSnapshot();
            window.alert('Certificate image removed from selected tile.');
          }
        }

        setTimelineCertAction('');
        return;
      }

      const imageSrc = getSupportImageFromTimelineItem(item);
      if (!imageSrc) return;

      event.preventDefault();
      openSupportPopup(imageSrc, getTimelineItemTitle(item));
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const item = event.target.closest('.timeline li');
      if (!item) return;

      const imageSrc = getSupportImageFromTimelineItem(item);
      if (!imageSrc) return;

      event.preventDefault();
      openSupportPopup(imageSrc, getTimelineItemTitle(item));
    });

    document.addEventListener('dblclick', (event) => {
      if (!document.documentElement.classList.contains('admin-mode')) return;
      if (removeMode) return;

      const item = event.target.closest('.timeline li');
      if (!item) return;
      if (item.closest('#admin-panel')) return;

      event.preventDefault();

      pickFiles('image/*', false, (dataUrl) => {
        item.setAttribute('data-support-image', dataUrl);
        refreshTimelineSupportState();
        saveSnapshot();
        window.alert('Supportive image updated for this tile.');
      });
    }, true);
  }

  function normalizeMonthShort(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    if (MONTHS_SHORT.includes(raw)) return raw;
    if (MONTH_ALIASES[raw]) return MONTH_ALIASES[raw];
    const firstThree = raw.slice(0, 3);
    if (MONTHS_SHORT.includes(firstThree)) return firstThree;
    return '';
  }

  function toTitleCaseMonth(monthShort) {
    if (!monthShort) return '';
    return monthShort.charAt(0).toUpperCase() + monthShort.slice(1);
  }

  function parseProjectDateRank(node) {
    const dateText = (node.querySelector('.year')?.textContent || node.querySelector('h3')?.textContent || '').toLowerCase();
    const yearMatch = dateText.match(/(19|20)\d{2}/g);
    const year = yearMatch ? parseInt(yearMatch[yearMatch.length - 1], 10) : 0;

    let monthIndex = -1;
    const monthMatch = dateText.match(/january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|october|oct|november|nov|december|dec/);
    if (monthMatch) {
      const normalized = normalizeMonthShort(monthMatch[0]);
      monthIndex = MONTHS_SHORT.indexOf(normalized);
    }

    return (year * 12) + monthIndex;
  }

  function sortProjectTilesByYear() {
    const grid = document.querySelector('.projects-grid');
    if (!grid) return;

    const items = Array.from(grid.children);
    if (!items.length) return;

    items.sort((a, b) => parseProjectDateRank(b) - parseProjectDateRank(a));
    items.forEach((item) => grid.appendChild(item));
  }

  function addSkillTile() {
    const name = window.prompt('Skill name (e.g., Embedded C):');
    if (!name) return;
    const icon = window.prompt('Skill icon keyword (Material symbol, e.g., memory, code, hub):', 'code') || 'code';

    const grid = document.querySelector('.skills-grid');
    if (!grid) return;

    const tile = document.createElement('div');
    tile.className = 'skill';
    tile.innerHTML = `<span class="skill-icon material-symbols-outlined" aria-hidden="true">${icon.trim()}</span><span class="skill-name">${name.trim()}</span>`;
    grid.appendChild(tile);
    if (document.documentElement.classList.contains('admin-mode')) makeEditable(true);
    saveSnapshot();
  }

  function addProjectTile() {
    const title = window.prompt('Project title:');
    if (!title) return;
    const now = new Date();
    const defaultMonth = toTitleCaseMonth(MONTHS_SHORT[now.getMonth()]);
    const monthInput = window.prompt('Month (3 letters, e.g., Jan):', defaultMonth) || '';
    const monthShort = normalizeMonthShort(monthInput);
    if (!monthShort) {
      window.alert('Invalid month. Use 3 letters like Jan, Feb, Mar...');
      return;
    }

    const yearInput = window.prompt('Year (e.g., 2026):', String(now.getFullYear())) || '';
    const year = yearInput.trim();
    if (!/^\d{4}$/.test(year)) {
      window.alert('Invalid year. Use 4 digits, e.g., 2026.');
      return;
    }

    const monthYearLabel = `${toTitleCaseMonth(monthShort)} ${year}`;
    const tools = window.prompt('Tools (comma separated):', 'Python, OpenCV') || '';
    const summary = window.prompt('Short project summary:') || '';
    const impact = window.prompt('Impact line:') || '';
    const projectId = createDynamicProjectRecord({
      title: title.trim(),
      year: monthYearLabel,
      tools: tools.trim(),
      summary: summary.trim(),
      impact: impact.trim()
    });
    const link = `projects/dynamic-project.html?id=${encodeURIComponent(projectId)}`;

    const grid = document.querySelector('.projects-grid');
    if (!grid) return;

    const wrapper = document.createElement('a');
    wrapper.className = 'project-link';
    wrapper.setAttribute('href', link.trim() || '#');

    wrapper.innerHTML = `
      <article class="card">
        <h3>${title.trim()} <span class="year">(${monthYearLabel})</span></h3>
        <p class="tools">${tools.trim()}</p>
        <p>${summary.trim()}</p>
        <p class="impact">Impact: ${impact.trim()}</p>
      </article>
    `;
    const card = wrapper.querySelector('.card');
    if (card) {
      card.setAttribute('data-project-href', link.trim() || '#');
      card.setAttribute('data-project-id', projectId);
    }

    grid.appendChild(wrapper);
    sortProjectTilesByYear();
    if (document.documentElement.classList.contains('admin-mode')) {
      makeEditable(true);
      refreshProjectEditButtons(true);
    }
    saveSnapshot();
    window.alert(`Project tile added. Subpage created at: ${link}`);
  }

  function clearProjectEditButtons() {
    document.querySelectorAll('.admin-edit-project-btn').forEach((button) => button.remove());
    document.querySelectorAll('.project-link').forEach((link) => link.classList.remove('admin-project-link'));
  }

  function refreshProjectEditButtons(enabled) {
    clearProjectEditButtons();
    if (!enabled) return;
  }

  function addResearchOrCertification() {
    const year = window.prompt('Year (e.g., 2025):');
    if (!year) return;
    const title = window.prompt('Title (Research/Certification name):');
    if (!title) return;
    const description = window.prompt('Description:') || '';

    const timeline = document.querySelector('.timeline');
    if (!timeline) return;

    const item = document.createElement('li');
    item.innerHTML = `
      <div class="date">${year.trim()}</div>
      <div class="body">
        <h3>${title.trim()}</h3>
        <p>${description.trim()}</p>
      </div>
    `;

    timeline.appendChild(item);
    sortTimelineByYear();
    const addSupportImage = window.confirm('Add supportive image for this tile now?');

    if (addSupportImage) {
      pickFiles('image/*', false, (dataUrl) => {
        item.setAttribute('data-support-image', dataUrl);
        refreshTimelineSupportState();
        saveSnapshot();
      });
      if (document.documentElement.classList.contains('admin-mode')) makeEditable(true);
      return;
    }

    refreshTimelineSupportState();
    if (document.documentElement.classList.contains('admin-mode')) makeEditable(true);
    saveSnapshot();
  }

  function addContactTile() {
    const label = window.prompt('Contact tile label (e.g., WhatsApp Me):');
    if (!label) return;

    const href = window.prompt('Contact link (mailto:, tel:, https://...):', 'https://') || '#';
    const iconText = window.prompt('Icon text/emoji (optional):', '🔗') || '';
    const useImage = window.confirm('Use image icon instead of text icon?');

    const actions = document.querySelector('.contact-actions');
    if (!actions) {
      window.alert('Contact actions area not found on this page.');
      return;
    }

    const createTile = (imageSrc) => {
      const anchor = document.createElement('a');
      anchor.href = href.trim() || '#';
      anchor.className = 'btn neutral footer-btn admin-contact-tile';

      if (imageSrc) {
        const img = document.createElement('img');
        img.src = imageSrc;
        img.alt = 'Contact icon';
        img.className = 'admin-contact-icon-img';
        anchor.appendChild(img);
      } else if (iconText.trim()) {
        const icon = document.createElement('span');
        icon.className = 'admin-contact-icon';
        icon.textContent = iconText.trim();
        anchor.appendChild(icon);
      }

      const text = document.createElement('span');
      text.textContent = label.trim();
      anchor.appendChild(text);

      actions.appendChild(anchor);
      if (document.documentElement.classList.contains('admin-mode')) makeEditable(true);
      saveSnapshot();
    };

    if (useImage) {
      pickFiles('image/*', false, (dataUrl) => createTile(dataUrl));
    } else {
      createTile('');
    }
  }

  function findProjectBlockByTitle(titleInput) {
    const wanted = String(titleInput || '').trim().toLowerCase();
    if (!wanted) return null;

    const blocks = Array.from(document.querySelectorAll('.project-block'));
    return blocks.find((block) => {
      const heading = block.querySelector('h2');
      const text = (heading?.textContent || '').trim().toLowerCase();
      return text === wanted || text.includes(wanted);
    }) || null;
  }

  function setProjectSectionText() {
    const sectionName = window.prompt('Section title (e.g., Project Explanation, Project Requirements, Project Outcome):', 'Project Explanation');
    if (!sectionName) return;

    const block = findProjectBlockByTitle(sectionName);
    if (!block) {
      window.alert('Section not found on this page.');
      return;
    }

    const value = window.prompt('Enter section text:');
    if (value === null) return;

    let paragraph = block.querySelector('p:not(.media-note)');
    if (!paragraph) {
      paragraph = document.createElement('p');
      block.appendChild(paragraph);
    }

    paragraph.textContent = value.trim();
    if (document.documentElement.classList.contains('admin-mode')) makeEditable(true);
    saveSnapshot();
  }

  function applySelectedTextColor() {
    if (!document.documentElement.classList.contains('admin-mode')) return;
    if (!adminPanel) return;

    const colorInput = adminPanel.querySelector('#admin-color-picker');
    const color = colorInput?.value || '#0A192F';

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      showAdminColorHint('Select text first, then apply color.', true);
      return;
    }

    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.style.color = color;

    try {
      range.surroundContents(span);
    } catch {
      const extracted = range.extractContents();
      span.appendChild(extracted);
      range.insertNode(span);
    }

    saveSnapshot();
    showAdminColorHint('Color applied to selected text.', false);
  }

  function showAdminColorHint(message, isError) {
    if (!adminPanel) return;
    const hint = adminPanel.querySelector('#admin-color-hint');
    if (!hint) return;

    hint.textContent = message;
    hint.classList.toggle('error', !!isError);
    hint.classList.add('show');

    window.setTimeout(() => {
      if (!hint) return;
      hint.classList.remove('show');
    }, 1500);
  }

  function pickFiles(accept, multiple, onLoad) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = !!multiple;
    input.onchange = () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;

      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => onLoad(String(reader.result || ''), file);
        reader.readAsDataURL(file);
      });
    };
    input.click();
  }

  function ensureProjectMediaList(block) {
    let mediaList = block.querySelector('.admin-media-list');
    if (mediaList) return mediaList;

    mediaList = document.createElement('div');
    mediaList.className = 'admin-media-list';

    const note = block.querySelector('.media-note');
    if (note) {
      block.insertBefore(mediaList, note);
    } else {
      block.appendChild(mediaList);
    }

    return mediaList;
  }

  function attachMediaRemoveButton(mediaItem) {
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'admin-media-remove';
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', (event) => {
      if (!document.documentElement.classList.contains('admin-mode')) return;
      event.preventDefault();
      event.stopPropagation();
      mediaItem.remove();
      saveSnapshot();
    });

    mediaItem.appendChild(removeButton);
  }

  function setProjectImageSection() {
    const block = findProjectBlockByTitle('Project Image') || findProjectBlockByTitle('Image');
    if (!block) {
      window.alert('Project Image section not found.');
      return;
    }

    pickFiles('image/*', true, (dataUrl) => {
      const placeholder = block.querySelector('.media-placeholder');
      if (placeholder) placeholder.remove();

      const mediaList = ensureProjectMediaList(block);
      const mediaItem = document.createElement('div');
      mediaItem.className = 'admin-media-item';

      const image = document.createElement('img');
      image.className = 'admin-project-image';
      image.src = dataUrl;
      image.alt = 'Project image';
      mediaItem.appendChild(image);
      attachMediaRemoveButton(mediaItem);
      mediaList.appendChild(mediaItem);
      saveSnapshot();
    });
  }

  function setProjectVideoSection() {
    const block = findProjectBlockByTitle('Project Video') || findProjectBlockByTitle('Video');
    if (!block) {
      window.alert('Project Video section not found.');
      return;
    }

    pickFiles('video/*', true, (dataUrl) => {
      const placeholder = block.querySelector('.media-placeholder');
      if (placeholder) placeholder.remove();

      const mediaList = ensureProjectMediaList(block);
      const mediaItem = document.createElement('div');
      mediaItem.className = 'admin-media-item';

      const video = document.createElement('video');
      video.className = 'admin-project-video';
      video.controls = true;
      video.src = dataUrl;
      mediaItem.appendChild(video);
      attachMediaRemoveButton(mediaItem);
      mediaList.appendChild(mediaItem);
      saveSnapshot();
    });
  }

  function setProjectAudioSection() {
    const block = findProjectBlockByTitle('Project Audio') || findProjectBlockByTitle('Audio') || findProjectBlockByTitle('Project Video') || findProjectBlockByTitle('Video');
    if (!block) {
      window.alert('Project Audio/Video section not found.');
      return;
    }

    pickFiles('audio/*', true, (dataUrl) => {
      const placeholder = block.querySelector('.media-placeholder');
      if (placeholder) placeholder.remove();

      const mediaList = ensureProjectMediaList(block);
      const mediaItem = document.createElement('div');
      mediaItem.className = 'admin-media-item';

      const audio = document.createElement('audio');
      audio.className = 'admin-project-audio';
      audio.controls = true;
      audio.src = dataUrl;
      mediaItem.appendChild(audio);
      attachMediaRemoveButton(mediaItem);
      mediaList.appendChild(mediaItem);
      saveSnapshot();
    });
  }

  function toggleProjectSection(titleA, titleB) {
    const block = findProjectBlockByTitle(titleA) || (titleB ? findProjectBlockByTitle(titleB) : null);
    if (!block) {
      window.alert('Section not found on this page.');
      return;
    }

    const hidden = block.classList.toggle('admin-section-hidden');
    block.setAttribute('data-admin-hidden', hidden ? 'true' : 'false');
    saveSnapshot();
  }

  function setRemoveMode(mode) {
    removeMode = mode === true ? !removeMode : false;
    if (removeMode) {
      timelineCertAction = '';
    }

    if (!adminPanel) return;
    const removeButton = adminPanel.querySelector('#admin-remove-item');
    if (removeButton) {
      removeButton.classList.toggle('active-remove', removeMode);
    }

    const note = adminPanel.querySelector('.admin-note');
    if (!note) return;

    if (!removeMode) {
      setTimelineCertAction('');
      return;
    }

    setTimelineCertAction('');
    note.textContent = 'Remove mode: click any project tile, skill tile, or research/certification row to delete it.';
  }

  function resolveRemoveTarget(event) {
    const wrapper = event.target.closest('.projects-grid .project-link');
    if (wrapper) return { target: wrapper, mode: 'project' };

    const card = event.target.closest('.projects-grid .card');
    if (card) return { target: card.closest('.project-link') || card, mode: 'project' };

    const skill = event.target.closest('.skills-grid .skill');
    if (skill) return { target: skill, mode: 'skill' };

    const research = event.target.closest('.timeline li');
    if (research) return { target: research, mode: 'research' };

    return null;
  }

  function bindRemoveHandlers() {
    document.addEventListener('click', (event) => {
      if (!document.documentElement.classList.contains('admin-mode')) return;
      if (!removeMode) return;
      if (event.target.closest('#admin-panel')) return;

      const resolved = resolveRemoveTarget(event);
      if (!resolved) return;
      const target = resolved.target;

      event.preventDefault();
      event.stopPropagation();

      const confirmed = window.confirm('Delete selected item?');
      if (!confirmed) return;

      pushRemovedItem(target, resolved.mode);
      target.remove();
      sortProjectTilesByYear();
      saveSnapshot();
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!removeMode) return;
      setRemoveMode(false);
    });
  }

  function createAdminPanel() {
    if (adminPanel) return;

    adminPanel = document.createElement('div');
    adminPanel.id = 'admin-panel';
    adminPanel.innerHTML = `
      <div class="admin-head">Admin Mode</div>
      <div class="admin-actions">
        <button type="button" id="admin-save">Save Changes</button>
        <button type="button" id="admin-undo-remove">Undo Remove</button>
        <button type="button" id="admin-undo-all">Undo All</button>
        <button type="button" id="admin-lock">Lock</button>
      </div>
      <div class="admin-backup-actions">
        <button type="button" id="admin-export-backup">Export Backup</button>
        <button type="button" id="admin-import-backup">Import Backup</button>
      </div>
      <div class="admin-index-actions" id="admin-index-actions">
        <button type="button" id="admin-add-project">Add Project Tile</button>
        <button type="button" id="admin-add-skill">Add Skill Tile</button>
        <button type="button" id="admin-add-research">Add Research/Cert</button>
        <button type="button" id="admin-attach-cert">Attach Cert</button>
        <button type="button" id="admin-remove-cert">Remove Cert</button>
        <button type="button" id="admin-add-contact">Add Contact Tile</button>
        <button type="button" id="admin-remove-item">Remove Item</button>
      </div>
      <div class="admin-project-actions" id="admin-project-actions">
        <button type="button" id="admin-set-text">Set Section Text</button>
        <button type="button" id="admin-set-image">Set Section Image</button>
        <button type="button" id="admin-set-video">Set Section Video</button>
        <button type="button" id="admin-set-audio">Set Section Audio</button>
        <button type="button" id="admin-toggle-image-section">Toggle Image Section</button>
        <button type="button" id="admin-toggle-video-section">Toggle Video Section</button>
      </div>
      <div class="admin-banner-actions" id="admin-banner-actions">
        <label for="admin-hero-design">Banner</label>
        <select id="admin-hero-design" aria-label="Banner design">
          <option value="diagonal">Diagonal</option>
          <option value="radial">Radial</option>
          <option value="split">Split</option>
          <option value="aurora">Aurora</option>
        </select>
        <input type="color" id="admin-hero-color-1" aria-label="Banner color 1" value="#041229" />
        <input type="color" id="admin-hero-color-2" aria-label="Banner color 2" value="#2b0f5b" />
        <input type="color" id="admin-hero-color-3" aria-label="Banner color 3" value="#8b2b7b" />
        <button type="button" id="admin-apply-hero-style">Apply Banner</button>
        <button type="button" id="admin-reset-hero-style">Reset Banner</button>
        <button type="button" data-hero-preset="techBlue">Tech Blue</button>
        <button type="button" data-hero-preset="neonPurple">Neon Purple</button>
        <button type="button" data-hero-preset="sunset">Sunset</button>
      </div>
      <div class="admin-color-row">
        <input type="color" id="admin-color-picker" value="#0A192F" aria-label="Text color picker" />
        <button type="button" id="admin-apply-color">Apply Text Color</button>
        <span id="admin-color-hint" class="admin-color-hint" aria-live="polite"></span>
      </div>
      <p class="admin-note">Tip: click any image to replace it. Double-click links to edit URL. Double-click a project tile to open its subpage. Double-click popup image to open full-size. Use Attach/Remove Cert for direct certificate control.</p>
    `;

    document.body.appendChild(adminPanel);

    const onIndex = !!document.querySelector('.projects-grid');
    const onProjectPage = !!document.querySelector('.project-sections');
    const onHeroPage = !!document.querySelector('.hero');
    const indexActions = adminPanel.querySelector('#admin-index-actions');
    const projectActions = adminPanel.querySelector('#admin-project-actions');
    const bannerActions = adminPanel.querySelector('#admin-banner-actions');
    if (!onIndex && indexActions) {
      indexActions.style.display = 'none';
    }
    if (!onProjectPage && projectActions) {
      projectActions.style.display = 'none';
    }
    if (!onHeroPage && bannerActions) {
      bannerActions.style.display = 'none';
    }

    adminPanel.querySelector('#admin-save')?.addEventListener('click', () => {
      saveSnapshot();
      window.alert('Changes saved for this page.');
    });

    adminPanel.querySelector('#admin-export-backup')?.addEventListener('click', exportAdminBackup);
    adminPanel.querySelector('#admin-import-backup')?.addEventListener('click', importAdminBackup);

    adminPanel.querySelector('#admin-undo-remove')?.addEventListener('click', undoLastRemoval);
    adminPanel.querySelector('#admin-undo-all')?.addEventListener('click', undoAllRemovals);

    adminPanel.querySelector('#admin-lock')?.addEventListener('click', () => {
      setAdminUnlocked(false);
      makeEditable(false);
      document.documentElement.classList.remove('admin-mode');
      removeMode = false;
      refreshProjectEditButtons(false);
      adminPanel.remove();
      adminPanel = null;
      window.alert('Admin mode locked.');
    });

    adminPanel.querySelector('#admin-add-project')?.addEventListener('click', addProjectTile);
    adminPanel.querySelector('#admin-add-skill')?.addEventListener('click', addSkillTile);
    adminPanel.querySelector('#admin-add-research')?.addEventListener('click', addResearchOrCertification);
    adminPanel.querySelector('#admin-attach-cert')?.addEventListener('click', () => {
      setTimelineCertAction(timelineCertAction === 'attach' ? '' : 'attach');
    });
    adminPanel.querySelector('#admin-remove-cert')?.addEventListener('click', () => {
      setTimelineCertAction(timelineCertAction === 'remove' ? '' : 'remove');
    });
    adminPanel.querySelector('#admin-add-contact')?.addEventListener('click', addContactTile);
    adminPanel.querySelector('#admin-remove-item')?.addEventListener('click', () => setRemoveMode(true));
    adminPanel.querySelector('#admin-set-text')?.addEventListener('click', setProjectSectionText);
    adminPanel.querySelector('#admin-set-image')?.addEventListener('click', setProjectImageSection);
    adminPanel.querySelector('#admin-set-video')?.addEventListener('click', setProjectVideoSection);
    adminPanel.querySelector('#admin-set-audio')?.addEventListener('click', setProjectAudioSection);
    adminPanel.querySelector('#admin-toggle-image-section')?.addEventListener('click', () => toggleProjectSection('Project Image', 'Image'));
    adminPanel.querySelector('#admin-toggle-video-section')?.addEventListener('click', () => toggleProjectSection('Project Video', 'Video'));
    adminPanel.querySelector('#admin-apply-color')?.addEventListener('click', applySelectedTextColor);
    bindHeroDesignControls();
  }

  function unlockAdminWithPrompt() {
    const input = window.prompt('Enter admin verification key:');
    if (input === null) return;

    if (input.trim() === ADMIN_KEY) {
      setAdminUnlocked(true);
      createAdminPanel();
      makeEditable(true);
      refreshProjectEditButtons(true);
      window.alert('Admin mode activated. You can now edit directly.');
      return;
    }

    window.alert('Invalid key.');
  }

  function bindProfileUnlockTrigger() {
    const profileImage = document.querySelector('.profile-image');
    if (!profileImage) return;

    profileImage.addEventListener('click', () => {
      if (isAdminUnlocked()) return;

      clickCount += 1;
      if (clickTimer) window.clearTimeout(clickTimer);
      clickTimer = window.setTimeout(() => {
        clickCount = 0;
      }, CLICK_WINDOW_MS);

      if (clickCount >= 5) {
        clickCount = 0;
        unlockAdminWithPrompt();
      }
    });
  }

  function bindGlobalUnlockShortcut() {
    document.addEventListener('keydown', (event) => {
      const isShortcut = event.ctrlKey && event.altKey && String(event.key || '').toLowerCase() === 'a';
      if (!isShortcut) return;
      if (isAdminUnlocked()) return;

      event.preventDefault();
      unlockAdminWithPrompt();
    });
  }

  function initAdminRuntime() {
    performBackgroundCleanupOnce();
    applyHeroSettings(loadHeroSettings());
    remapProjectLinks();
    bindProfileUnlockTrigger();
    bindGlobalUnlockShortcut();
    enableImageEditing(true);
    bindProjectSubpageOpen();
    bindProjectTileNavigation();
    bindTimelineSupportInteractions();
    bindRemoveHandlers();

    enforceLockedEditingState();

    if (isAdminUnlocked()) {
      createAdminPanel();
      makeEditable(true);
      refreshProjectEditButtons(true);
    }

    if (!isAdminUnlocked()) {
      makeEditable(false);
      refreshProjectEditButtons(false);
    }
    sortProjectTilesByYear();
    sortTimelineByYear();
    refreshTimelineSupportState();
  }

  restoreSnapshot();
  restoreRemoveHistory();
  document.addEventListener('DOMContentLoaded', initAdminRuntime);
})();
