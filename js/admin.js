(function () {
  const ADMIN_KEY = '01/01/2003';
  const UNLOCK_KEY = 'portfolio_admin_unlocked';
  const PAGE_SNAPSHOT_PREFIX = 'portfolio_page_snapshot_';
  const PAGE_REMOVE_HISTORY_PREFIX = 'portfolio_remove_history_';
  const DYNAMIC_PROJECTS_KEY = 'portfolio_dynamic_projects';
  const THEME_KEY = 'portfolio_theme';
  const HERO_SETTINGS_KEY = 'portfolio_hero_settings';
  const DRIVE_UPLOAD_CONFIG_KEY = 'portfolio_drive_upload_config_v1';
  const BACKGROUND_CLEANUP_KEY = 'portfolio_background_cleanup_v2';
  const SYNC_CONFIG_KEY = 'portfolio_sync_config_v1';
  const SYNC_META_KEY = 'portfolio_sync_meta_v1';
  const SYNC_PROVIDER = 'drive-sync';
  const SYNC_PROVIDER_LEGACY = 'github-gist';
  const SYNC_FILE_DEFAULT = 'portfolio-sync.json';
  const PREDEFINED_SYNC_ENABLED = true;
  const PREDEFINED_SYNC_STORE_ID = '022f30fe31719e1e69fdd0a9fb2a0215';
  const PREDEFINED_SYNC_TOKEN = '';
  const PREDEFINED_SYNC_FILE = SYNC_FILE_DEFAULT;
  const PREDEFINED_SYNC_AUTO_PULL = true;
  const PREDEFINED_SYNC_AUTO_PUSH = true;
  const PREDEFINED_SYNC_POLL_SECONDS = 5;
  const GOOGLE_DRIVE_UPLOAD_URL = 'https://script.google.com/macros/s/AKfycbxU0N3Po9vgOabdbYejkAQSY36SCYEek3QMNOdGS-l-87O6bbS4c2j_RMn0rW6aeAVmfw/exec';
  const GOOGLE_DRIVE_UPLOAD_SECRET = 'Nv29xQ7mT4kL8pZa6cUd1fRy3sWh0JbE';
  const PUBLIC_AUTO_PULL_STORE_ID = '022f30fe31719e1e69fdd0a9fb2a0215';
  const PUBLIC_AUTO_PULL_ENABLED = true;
  const SYNC_POLL_DEFAULT_SECONDS = 5;
  const SYNC_PUSH_DEBOUNCE_MS = 1200;
  const SYNC_MAX_TOTAL_BYTES = 420 * 1024;
  const SYNC_MAX_VALUE_BYTES = 180 * 1024;
  const SNAPSHOT_SAVE_DEBOUNCE_MS = 700;
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
  let syncPushTimer = null;
  let syncPollTimer = null;
  let syncPullInFlight = false;
  let snapshotSaveTimer = null;
  let syncRelayIssueNotified = false;
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
  const MAX_UPLOAD_BYTES = {
    image: 2 * 1024 * 1024,
    video: 3 * 1024 * 1024,
    audio: 2 * 1024 * 1024,
    other: 2 * 1024 * 1024
  };
  const MAX_UPLOAD_BYTES_DRIVE = {
    image: 12 * 1024 * 1024,
    video: 180 * 1024 * 1024,
    audio: 30 * 1024 * 1024,
    other: 10 * 1024 * 1024
  };
  const STATIC_PROJECT_ROUTE_MAP = [
    { includes: ['fpga', '2‑bit cpu'], href: 'projects/fpga-learning-board.html' },
    { includes: ['citypulse', 'traffic intelligence'], href: 'projects/citypulse-traffic-intelligence.html' },
    { includes: ['gram jyoti', 'renewable energy monitoring'], href: 'projects/gram-jyoti-renewable-monitoring.html' },
    { includes: ['pragyan rover'], href: 'projects/pragyan-rover.html' }
  ];

  function buildStableRouteId() {
    const pathname = String(window.location.pathname || '/');
    const parts = pathname.split('/').filter(Boolean);

    let route = 'index.html';
    const projectsIndex = parts.lastIndexOf('projects');
    if (projectsIndex >= 0 && parts[projectsIndex + 1]) {
      route = `projects/${parts[projectsIndex + 1]}`;
    } else if (parts.length) {
      route = parts[parts.length - 1];
    }

    const search = String(window.location.search || '');
    if (search) {
      route += search;
    }

    return route.toLowerCase();
  }

  const stablePageIdentity = buildStableRouteId().replace(/[^a-z0-9]/gi, '_');
  const legacyPageIdentity = (window.location.pathname + window.location.search).replace(/[^a-z0-9]/gi, '_');
  const pageStorageKey = PAGE_SNAPSHOT_PREFIX + stablePageIdentity;
  const removeHistoryStorageKey = PAGE_REMOVE_HISTORY_PREFIX + stablePageIdentity;
  const legacyPageStorageKey = PAGE_SNAPSHOT_PREFIX + legacyPageIdentity;
  const legacyRemoveHistoryStorageKey = PAGE_REMOVE_HISTORY_PREFIX + legacyPageIdentity;

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

  function loadDriveUploadConfig() {
    const parsed = safeParse(localStorage.getItem(DRIVE_UPLOAD_CONFIG_KEY) || '');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const endpoint = String(parsed.endpoint || '').trim();
      const secret = String(parsed.secret || '').trim();
      if (endpoint) {
        return { endpoint, secret };
      }
    }

    const fallbackEndpoint = String(GOOGLE_DRIVE_UPLOAD_URL || '').trim();
    const fallbackSecret = String(GOOGLE_DRIVE_UPLOAD_SECRET || '').trim();
    if (!fallbackEndpoint) return null;
    return { endpoint: fallbackEndpoint, secret: fallbackSecret };
  }

  function saveDriveUploadConfig(config) {
    const endpoint = String(config?.endpoint || '').trim();
    const secret = String(config?.secret || '').trim();
    if (!endpoint) {
      localStorage.removeItem(DRIVE_UPLOAD_CONFIG_KEY);
      updateAdminSyncStatus('Drive upload integration disabled.');
      return;
    }

    localStorage.setItem(
      DRIVE_UPLOAD_CONFIG_KEY,
      JSON.stringify({
        endpoint,
        secret
      })
    );
    scheduleSyncPush('drive-upload-config');
    updateAdminSyncStatus('Drive upload integration saved.');
  }

  function updateAdminSyncStatus(message) {
    if (!adminPanel) return;
    const statusNode = adminPanel.querySelector('#admin-sync-status');
    if (!statusNode) return;

    const stored = safeParse(localStorage.getItem(DRIVE_UPLOAD_CONFIG_KEY) || '');
    const hasCustomConfig = !!String(stored?.endpoint || '').trim();
    const active = loadDriveUploadConfig();
    const endpoint = String(active?.endpoint || '').trim();
    const secret = String(active?.secret || '').trim();
    const source = hasCustomConfig ? 'Custom' : 'Default';
    const secretState = secret ? `set (${secret.length} chars)` : 'empty';
    const endpointState = endpoint || 'not configured';

    const suffix = message ? ` | ${String(message).trim()}` : '';
    statusNode.textContent = `Drive Sync: ${source} | Endpoint: ${endpointState} | Secret: ${secretState}${suffix}`;
  }

  function setupDriveUploadConfig() {
    const existing = loadDriveUploadConfig() || { endpoint: '', secret: '' };
    const endpointInput = window.prompt('Google Drive upload endpoint URL (Apps Script Web App URL):', existing.endpoint || '');
    if (endpointInput === null) return;

    const endpoint = String(endpointInput || '').trim();
    if (!endpoint) {
      const clear = window.confirm('Endpoint empty. Disable Drive upload integration?');
      if (!clear) return;
      saveDriveUploadConfig({ endpoint: '', secret: '' });
      window.alert('Drive upload integration disabled.');
      return;
    }

    const secretInput = window.prompt('Upload secret (optional, should match Apps Script UPLOAD_SECRET):', existing.secret || '');
    if (secretInput === null) return;

    saveDriveUploadConfig({ endpoint, secret: String(secretInput || '').trim() });
    window.alert('Drive upload integration saved and will sync across devices.');
  }

  function loadSyncConfig() {
    const parsed = safeParse(localStorage.getItem(SYNC_CONFIG_KEY) || '');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return getPredefinedSyncConfig();
    }

    const provider = String(parsed.provider || '').trim().toLowerCase();
    const syncStoreId = String(parsed.syncStoreId || parsed.gistId || '').trim();
    const token = normalizeTokenInput(parsed.token || '');
    const fileName = String(parsed.fileName || SYNC_FILE_DEFAULT).trim() || SYNC_FILE_DEFAULT;
    const pollSeconds = parseInt(parsed.pollSeconds, 10);
    const autoPull = parsed.autoPull !== false;
    const autoPush = parsed.autoPush !== false;

    if (provider !== SYNC_PROVIDER && provider !== SYNC_PROVIDER_LEGACY) return getPredefinedSyncConfig();
    if (!syncStoreId) return getPredefinedSyncConfig();
    if (!token && !isGoogleDriveUploadConfigured()) return getPredefinedSyncConfig();

    return {
      provider,
      syncStoreId,
      token,
      fileName,
      pollSeconds: Number.isFinite(pollSeconds) && pollSeconds >= 5 ? pollSeconds : SYNC_POLL_DEFAULT_SECONDS,
      autoPull,
      autoPush
    };
  }

  function getPredefinedSyncConfig() {
    if (!PREDEFINED_SYNC_ENABLED) return null;

    const syncStoreId = normalizeSyncStoreIdInput(PREDEFINED_SYNC_STORE_ID);
    const token = normalizeTokenInput(PREDEFINED_SYNC_TOKEN);
    if (!syncStoreId) return null;

    const pollSeconds = Math.max(5, parseInt(PREDEFINED_SYNC_POLL_SECONDS, 10) || SYNC_POLL_DEFAULT_SECONDS);
    const autoPull = PREDEFINED_SYNC_AUTO_PULL !== false;
    const autoPush = PREDEFINED_SYNC_AUTO_PUSH !== false && (!!token || isGoogleDriveUploadConfigured());

    return {
      provider: SYNC_PROVIDER,
      syncStoreId,
      token,
      fileName: String(PREDEFINED_SYNC_FILE || SYNC_FILE_DEFAULT).trim() || SYNC_FILE_DEFAULT,
      pollSeconds,
      autoPull,
      autoPush
    };
  }

  function applyPredefinedSyncConfig(options) {
    const settings = options || {};
    const force = settings.force === true;
    const predefined = getPredefinedSyncConfig();
    if (!predefined) return null;

    if (!force) {
      const existing = safeParse(localStorage.getItem(SYNC_CONFIG_KEY) || '');
      if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
        return predefined;
      }
    }

    saveSyncConfig(predefined);
    return predefined;
  }

  function getPublicPullConfig() {
    if (!PUBLIC_AUTO_PULL_ENABLED || !PUBLIC_AUTO_PULL_STORE_ID) {
      return null;
    }

    return {
      provider: SYNC_PROVIDER,
      syncStoreId: PUBLIC_AUTO_PULL_STORE_ID,
      token: '',
      fileName: SYNC_FILE_DEFAULT,
      pollSeconds: SYNC_POLL_DEFAULT_SECONDS,
      autoPull: true,
      autoPush: false
    };
  }

  function loadPullConfig(options) {
    const settings = options || {};
    const preferConfigured = settings.preferConfigured === true;
    const configured = loadSyncConfig();

    if (configured && (preferConfigured || configured.autoPull !== false)) {
      return configured;
    }

    const publicConfig = getPublicPullConfig();
    if (publicConfig) return publicConfig;

    if (configured) return configured;
    return null;
  }

  function saveSyncConfig(config) {
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
  }

  function setAdminModeAutoPush(enabled) {
    const config = loadSyncConfig();
    if (!config) return false;

    const nextEnabled = enabled === true;
    if (config.autoPush === nextEnabled) return true;

    saveSyncConfig({ ...config, autoPush: nextEnabled });
    return true;
  }

  function clearSyncConfig() {
    localStorage.removeItem(SYNC_CONFIG_KEY);
    localStorage.removeItem(SYNC_META_KEY);
  }

  function scrubStoredSyncTokenIfDriveRelayEnabled() {
    if (!isGoogleDriveUploadConfigured()) return;

    const parsed = safeParse(localStorage.getItem(SYNC_CONFIG_KEY) || '');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;

    const token = String(parsed.token || '').trim();
    if (!token) return;

    parsed.token = '';
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(parsed));
  }

  function loadSyncMeta() {
    const parsed = safeParse(localStorage.getItem(SYNC_META_KEY) || '');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { lastAppliedAt: '', lastPushedAt: '' };
    }

    return {
      lastAppliedAt: String(parsed.lastAppliedAt || ''),
      lastPushedAt: String(parsed.lastPushedAt || '')
    };
  }

  function saveSyncMeta(meta) {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  }

  function updateSyncMeta(updater) {
    const current = loadSyncMeta();
    const next = updater({ ...current }) || current;
    saveSyncMeta(next);
  }

  function buildSyncPayload() {
    return {
      version: 1,
      source: window.location.origin || 'file://local',
      updatedAt: new Date().toISOString(),
      data: collectPortfolioStorageData()
    };
  }

  function compareIsoDate(a, b) {
    const ta = Date.parse(String(a || ''));
    const tb = Date.parse(String(b || ''));
    if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
    if (ta > tb) return 1;
    if (ta < tb) return -1;
    return 0;
  }

  function normalizeSyncStoreIdInput(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const directMatch = raw.match(/^[a-f0-9]{20,}$/i);
    if (directMatch) return directMatch[0];

    const urlMatch = raw.match(/gist\.github\.com\/[\w-]+\/([a-f0-9]{20,})/i);
    if (urlMatch && urlMatch[1]) return urlMatch[1];

    const genericMatch = raw.match(/([a-f0-9]{20,})/i);
    if (genericMatch && genericMatch[1]) return genericMatch[1];

    return '';
  }

  function normalizeTokenInput(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const withoutQuotes = raw.replace(/^['"]+|['"]+$/g, '');
    const withoutPrefix = withoutQuotes
      .replace(/^bearer\s+/i, '')
      .replace(/^token\s+/i, '');

    return withoutPrefix
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, '')
      .replace(/[^A-Za-z0-9_]/g, '');
  }

  async function githubApiRequest(url, options, token) {
    const cleanToken = normalizeTokenInput(token || '');
    const requestOptions = options || {};
    const requestHeaders = requestOptions.headers || {};
    const baseHeaders = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...requestHeaders
    };

    if (!cleanToken) {
      return fetch(url, {
        ...requestOptions,
        headers: baseHeaders,
        cache: 'no-store'
      });
    }

    let lastResponse = null;
    const authSchemes = ['Bearer', 'token'];
    for (const scheme of authSchemes) {
      const response = await fetch(url, {
        ...requestOptions,
        headers: {
          ...baseHeaders,
          Authorization: `${scheme} ${cleanToken}`
        },
        cache: 'no-store'
      });

      lastResponse = response;
      if (response.status !== 401) {
        return response;
      }
    }

    return lastResponse;
  }

  async function requestSyncRelay(action, config, payload) {
    const relayBody = {
      action,
      syncStoreId: String(config?.syncStoreId || config?.gistId || ''),
      fileName: String(config?.fileName || SYNC_FILE_DEFAULT),
      payload: payload || null
    };

    const sendRelayRequest = async (candidate) => {
      const endpoint = String(candidate?.endpoint || '').trim();
      if (!endpoint) {
        throw new Error('Sync relay endpoint is not configured.');
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
          ...relayBody,
          secret: String(candidate?.secret || '')
        }),
        cache: 'no-store'
      });

      const rawText = await response.text();
      const parsed = safeParse(rawText || '');

      if (!response.ok) {
        const message = String(parsed?.error || parsed?.message || `Sync relay request failed (${response.status}).`);
        throw new Error(message);
      }

      if (!parsed || parsed.ok === false) {
        const message = String(parsed?.error || 'Sync relay request failed.');
        throw new Error(message);
      }

      return parsed;
    };

    const driveConfig = loadDriveUploadConfig() || { endpoint: '', secret: '' };
    const fallbackConfig = {
      endpoint: String(GOOGLE_DRIVE_UPLOAD_URL || '').trim(),
      secret: String(GOOGLE_DRIVE_UPLOAD_SECRET || '').trim()
    };

    try {
      return await sendRelayRequest(driveConfig);
    } catch (initialError) {
      const message = String(initialError?.message || '');
      const canRetryWithFallback = /missing file payload|unauthorized secret|sync relay request failed/i.test(message)
        && !!fallbackConfig.endpoint
        && (fallbackConfig.endpoint !== String(driveConfig.endpoint || '').trim()
          || fallbackConfig.secret !== String(driveConfig.secret || '').trim());

      if (canRetryWithFallback) {
        localStorage.setItem(
          DRIVE_UPLOAD_CONFIG_KEY,
          JSON.stringify({
            endpoint: fallbackConfig.endpoint,
            secret: fallbackConfig.secret
          })
        );

        try {
          return await sendRelayRequest(fallbackConfig);
        } catch (fallbackError) {
          const fallbackMessage = String(fallbackError?.message || message || 'Sync relay request failed.');
          if (!syncRelayIssueNotified && /missing file payload|unauthorized secret/i.test(fallbackMessage)) {
            syncRelayIssueNotified = true;
            window.alert('Drive Cloud Sync relay is using an old Apps Script deployment or wrong secret. Redeploy the latest Apps Script version and verify Drive Upload secret.');
          }
          throw new Error(fallbackMessage);
        }
      }

      if (!syncRelayIssueNotified && /missing file payload|unauthorized secret/i.test(message)) {
        syncRelayIssueNotified = true;
        window.alert('Drive Cloud Sync relay is using an old Apps Script deployment or wrong secret. Redeploy the latest Apps Script version and verify Drive Upload secret.');
      }

      throw initialError;
    }
  }

  async function readGithubErrorMessage(response, fallbackLabel) {
    const fallback = `${fallbackLabel} (${response.status}).`;
    try {
      const text = await response.text();
      const parsed = safeParse(text || '');
      const apiMessage = parsed && parsed.message ? String(parsed.message) : '';
      if (apiMessage) return `${fallback} ${apiMessage}`;
      return fallback;
    } catch {
      return fallback;
    }
  }

  async function validateSyncConfig(config) {
    if (!config.token && isGoogleDriveUploadConfigured()) {
      return true;
    }

    const response = await githubApiRequest(
      `https://api.github.com/gists/${encodeURIComponent(config.syncStoreId || config.gistId || '')}`,
      { method: 'GET' },
      config.token
    );

    if (!response.ok) {
      throw new Error(await readGithubErrorMessage(response, 'Cloud sync validation failed'));
    }

    return true;
  }

  function applyPortfolioDataObject(dataObj) {
    if (!dataObj || typeof dataObj !== 'object' || Array.isArray(dataObj)) return false;

    const keysToRemove = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith('portfolio_') && key !== SYNC_CONFIG_KEY && key !== SYNC_META_KEY) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));

    let appliedAny = false;
    Object.entries(dataObj).forEach(([key, value]) => {
      if (!key.startsWith('portfolio_')) return;
      if (key === SYNC_CONFIG_KEY || key === SYNC_META_KEY) return;
      if (typeof value !== 'string') return;
      localStorage.setItem(key, value);
      appliedAny = true;
    });

    return appliedAny;
  }

  function applyStateFromStorageToDom() {
    restoreSnapshot();
    restoreRemoveHistory();
    applyHeroSettings(loadHeroSettings());
    remapProjectLinks();
    sortProjectTilesByYear();
    sortTimelineByYear();
    refreshTimelineSupportState();

    if (document.documentElement.classList.contains('admin-mode')) {
      makeEditable(true);
      refreshProjectEditButtons(true);
    }
  }

  async function fetchSyncStorePayload(config) {
    if (!config.token && isGoogleDriveUploadConfigured()) {
      const relayResult = await requestSyncRelay('syncPull', config, null);
      const relayPayload = relayResult.payload;
      if (!relayPayload || typeof relayPayload !== 'object' || Array.isArray(relayPayload)) {
        throw new Error('Sync payload is invalid JSON.');
      }
      return relayPayload;
    }

    const response = await githubApiRequest(
      `https://api.github.com/gists/${encodeURIComponent(config.syncStoreId || config.gistId || '')}`,
      { method: 'GET' },
      config.token
    );

    if (!response.ok) {
      throw new Error(await readGithubErrorMessage(response, 'Sync pull failed'));
    }

    const remoteStore = await response.json();
    const files = remoteStore && remoteStore.files ? remoteStore.files : {};
    const preferred = files[config.fileName];
    const firstFile = preferred || Object.values(files)[0];
    let content = firstFile && typeof firstFile.content === 'string' ? firstFile.content : '';

    const isTruncated = !!(firstFile && firstFile.truncated === true);
    const rawUrl = firstFile && typeof firstFile.raw_url === 'string' ? firstFile.raw_url : '';

    if ((isTruncated || !content) && rawUrl) {
      try {
        const rawResponse = await fetch(rawUrl, { cache: 'no-store' });
        if (rawResponse.ok) {
          content = await rawResponse.text();
        }
      } catch {
        // keep existing content fallback
      }
    }

    const normalizedContent = String(content || '').replace(/^\uFEFF/, '').trim();
    const parsed = safeParse(normalizedContent);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Sync payload is invalid JSON.');
    }

    return parsed;
  }

  async function pushSyncToRemote(reason) {
    const config = loadSyncConfig();
    if (!config) return false;

    const payload = buildSyncPayload();

    if (!config.token && isGoogleDriveUploadConfigured()) {
      await requestSyncRelay('syncPush', config, payload);

      updateSyncMeta((meta) => {
        meta.lastPushedAt = payload.updatedAt;
        return meta;
      });

      if (reason === 'manual' && adminPanel) {
        window.alert('Drive Cloud Sync push completed.');
      }

      return true;
    }

    const body = {
      files: {
        [config.fileName]: {
          content: JSON.stringify(payload, null, 2)
        }
      }
    };

    const response = await githubApiRequest(
      `https://api.github.com/gists/${encodeURIComponent(config.syncStoreId || config.gistId || '')}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      },
      config.token
    );

    if (!response.ok) {
      const originalError = await readGithubErrorMessage(response, 'Sync push failed');

      throw new Error(originalError);
    }

    updateSyncMeta((meta) => {
      meta.lastPushedAt = payload.updatedAt;
      return meta;
    });

    if (reason === 'manual' && adminPanel) {
      window.alert('Drive Cloud Sync push completed.');
    }

    return true;
  }

  async function pullSyncFromRemote(options) {
    const settings = options || {};
    const manual = settings.manual === true;
    const forceReload = settings.forceReload === true;
    const config = loadPullConfig({ preferConfigured: manual });
    if (!config) {
      if (manual) window.alert('Drive Cloud Sync is not configured.');
      return false;
    }

    if (syncPullInFlight) return false;

    syncPullInFlight = true;
    try {
      let effectiveConfig = config;
      let payload;

      try {
        payload = await fetchSyncStorePayload(effectiveConfig);
      } catch (primaryError) {
        const publicConfig = getPublicPullConfig();
        const canFallback = !manual && publicConfig && (effectiveConfig.syncStoreId || effectiveConfig.gistId) !== (publicConfig.syncStoreId || publicConfig.gistId);

        if (!canFallback) {
          throw primaryError;
        }

        payload = await fetchSyncStorePayload(publicConfig);
        effectiveConfig = publicConfig;
      }

      const updatedAt = String(payload.updatedAt || '');
      const lastAppliedAt = loadSyncMeta().lastAppliedAt;

      if (!updatedAt) {
        if (manual) window.alert('Drive Cloud Sync payload is missing updated timestamp.');
        return false;
      }

      if (!manual && compareIsoDate(updatedAt, lastAppliedAt) <= 0) {
        return false;
      }

      const applied = applyPortfolioDataObject(payload.data || {});
      if (!applied) {
        if (manual) window.alert('No portfolio data found in Drive Cloud Sync payload.');
        return false;
      }

      updateSyncMeta((meta) => {
        meta.lastAppliedAt = updatedAt;
        return meta;
      });

      applyStateFromStorageToDom();
      if (!manual || forceReload) {
        window.setTimeout(() => {
          window.location.reload();
        }, 80);
      }
      if (manual) {
        window.alert('Drive Cloud Sync pull completed. This device is now up to date.');
      }
      return true;
    } catch (error) {
      if (manual) {
        window.alert(String(error?.message || 'Drive Cloud Sync pull failed.'));
      }
      return false;
    } finally {
      syncPullInFlight = false;
    }
  }

  function scheduleSyncPush(reason) {
    const config = loadSyncConfig();
    if (!config || !config.autoPush) return;

    if (syncPushTimer) {
      window.clearTimeout(syncPushTimer);
      syncPushTimer = null;
    }

    syncPushTimer = window.setTimeout(async () => {
      syncPushTimer = null;
      try {
        await pushSyncToRemote(reason || 'auto');
      } catch {
        // silent auto-sync failure
      }
    }, SYNC_PUSH_DEBOUNCE_MS);
  }

  function startSyncPolling() {
    if (syncPollTimer) {
      window.clearInterval(syncPollTimer);
      syncPollTimer = null;
    }

    const config = loadPullConfig();
    if (!config || !config.autoPull) return;

    const intervalMs = Math.max(5, config.pollSeconds || SYNC_POLL_DEFAULT_SECONDS) * 1000;
    syncPollTimer = window.setInterval(() => {
      pullSyncFromRemote({ manual: false });
    }, intervalMs);
  }

  async function setupCloudSync() {
    const nextConfig = applyPredefinedSyncConfig({ force: true });
    if (!nextConfig) {
      window.alert('Predefined Drive Cloud Sync is not available.');
      return;
    }

    startSyncPolling();

    if (nextConfig.autoPush) {
      try {
        await pushSyncToRemote('manual');
      } catch (error) {
        window.alert(String(error?.message || 'Drive Cloud Sync push failed.'));
        return;
      }
    }

    pullSyncFromRemote({ manual: false });
    window.alert('Drive Cloud Sync is running with predefined defaults on this device.');
  }

  function bindSyncRefreshTriggers() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      pullSyncFromRemote({ manual: false });
    });

    window.addEventListener('focus', () => {
      pullSyncFromRemote({ manual: false });
    });

    window.addEventListener('pageshow', () => {
      pullSyncFromRemote({ manual: false });
    });

    window.addEventListener('online', () => {
      pullSyncFromRemote({ manual: false });
    });

    document.addEventListener('click', (event) => {
      const toggle = event.target && event.target.closest ? event.target.closest('#theme-toggle') : null;
      if (!toggle) return;
      scheduleSyncPush('theme-toggle');
    }, true);
  }

  function isAdminHostAllowed() {
    const protocol = String(window.location.protocol || '').toLowerCase();
    if (protocol === 'file:' || protocol === 'http:' || protocol === 'https:') return true;
    return false;
  }

  function inferUploadKind(accept) {
    const value = String(accept || '').toLowerCase();
    if (value.includes('video')) return 'video';
    if (value.includes('image')) return 'image';
    if (value.includes('audio')) return 'audio';
    return 'other';
  }

  function formatSize(bytes) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)}MB`;
  }

  function isGoogleDriveUploadConfigured() {
    const config = loadDriveUploadConfig();
    return !!String(config?.endpoint || '').trim();
  }

  function extractGoogleDriveFileId(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const filePathMatch = raw.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{10,})/i);
    if (filePathMatch && filePathMatch[1]) return filePathMatch[1];

    const openIdMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]{10,})/i);
    if (openIdMatch && openIdMatch[1]) return openIdMatch[1];

    const ucMatch = raw.match(/\/d\/([a-zA-Z0-9_-]{10,})/i);
    if (ucMatch && ucMatch[1]) return ucMatch[1];

    return '';
  }

  function normalizeMediaUrlForPlayback(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const driveId = extractGoogleDriveFileId(raw);
    if (!driveId) return raw;

    return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read file.'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadFileToGoogleDrive(file, kind) {
    const config = loadDriveUploadConfig();
    const endpoint = String(config?.endpoint || '').trim();
    if (!endpoint) return null;

    const dataUrl = await readFileAsDataUrl(file);
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
    if (!base64) {
      throw new Error('Unable to encode file for upload.');
    }

    const payload = {
      fileName: String(file?.name || `upload-${Date.now()}`),
      mimeType: String(file?.type || 'application/octet-stream'),
      kind: String(kind || 'other'),
      contentBase64: base64,
      secret: String(config?.secret || '')
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Google Drive upload failed (${response.status}).`);
    }

    const result = await response.json();
    if (!result || result.ok === false) {
      throw new Error(String(result?.error || 'Google Drive upload failed.'));
    }

    const candidate =
      String(result.streamUrl || result.url || result.webContentLink || result.fileUrl || '').trim() ||
      (result.fileId ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(String(result.fileId))}` : '');

    if (!candidate) {
      throw new Error('Upload succeeded but no media URL was returned.');
    }

    return normalizeMediaUrlForPlayback(candidate);
  }

  function validateUploadSize(file, kind) {
    if (!file) return { ok: false, message: 'No file selected.' };
    const useDriveLimits = isGoogleDriveUploadConfigured() && (kind === 'image' || kind === 'video' || kind === 'audio');
    const limits = useDriveLimits ? MAX_UPLOAD_BYTES_DRIVE : MAX_UPLOAD_BYTES;
    const limit = limits[kind] || limits.other;
    if (file.size <= limit) return { ok: true, message: '' };

    return {
      ok: false,
      message: `File too large (${formatSize(file.size)}). Max allowed for ${kind} is ${formatSize(limit)}.`
    };
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
    scheduleSyncPush('hero-settings');
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
    scheduleSyncPush('dynamic-projects');
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
    let raw = localStorage.getItem(pageStorageKey);
    if (!raw && legacyPageStorageKey !== pageStorageKey) {
      raw = localStorage.getItem(legacyPageStorageKey);
      if (raw) {
        localStorage.setItem(pageStorageKey, raw);
      }
    }
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

    const serialized = JSON.stringify(snapshot);
    try {
      localStorage.setItem(pageStorageKey, serialized);
      if (legacyPageStorageKey !== pageStorageKey) {
        localStorage.setItem(legacyPageStorageKey, serialized);
      }
      scheduleSyncPush('snapshot');
    } catch (error) {
      window.alert('Save failed: browser storage is full. Use smaller media files or use hosted media URLs for cross-device sync.');
      throw error;
    }
  }

  function flushPendingSnapshotSave() {
    if (!snapshotSaveTimer) return;
    window.clearTimeout(snapshotSaveTimer);
    snapshotSaveTimer = null;
    saveSnapshot();
  }

  function scheduleSnapshotSave() {
    if (!document.documentElement.classList.contains('admin-mode')) return;

    if (snapshotSaveTimer) {
      window.clearTimeout(snapshotSaveTimer);
      snapshotSaveTimer = null;
    }

    snapshotSaveTimer = window.setTimeout(() => {
      snapshotSaveTimer = null;
      saveSnapshot();
    }, SNAPSHOT_SAVE_DEBOUNCE_MS);
  }

  function bindEditableAutoSave() {
    const shouldTrackNode = (node) => {
      if (!node || !(node instanceof Element)) return false;
      if (node.closest('#admin-panel')) return false;

      if (node.closest('[contenteditable="true"]')) return true;
      if (node.getAttribute && node.getAttribute('contenteditable') === 'true') return true;
      return false;
    };

    document.addEventListener('input', (event) => {
      if (!document.documentElement.classList.contains('admin-mode')) return;
      if (!shouldTrackNode(event.target)) return;
      scheduleSnapshotSave();
    }, true);

    document.addEventListener('blur', (event) => {
      if (!document.documentElement.classList.contains('admin-mode')) return;
      if (!shouldTrackNode(event.target)) return;
      flushPendingSnapshotSave();
    }, true);
  }

  function persistRemoveHistory() {
    const serialized = JSON.stringify(removeHistory);
    localStorage.setItem(removeHistoryStorageKey, serialized);
    if (legacyRemoveHistoryStorageKey !== removeHistoryStorageKey) {
      localStorage.setItem(legacyRemoveHistoryStorageKey, serialized);
    }
    scheduleSyncPush('remove-history');
  }

  function estimateUtf8Bytes(value) {
    const text = String(value || '');
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(text).length;
    }
    return unescape(encodeURIComponent(text)).length;
  }

  function sanitizeSnapshotForSync(value) {
    const raw = String(value || '');
    if (!raw) return '';

    let next = raw;
    next = next.replace(/(src|poster)=(["'])data:[^"']*\2/gi, '$1=$2$2');
    next = next.replace(/data-support-image=(["'])data:[^"']*\1/gi, 'data-support-image=$1$1');
    next = next.replace(/url\((['"]?)data:[^)]+\1\)/gi, 'url()');
    return next;
  }

  function collectPortfolioStorageData() {
    const data = {};
    let totalBytes = 0;

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith('portfolio_')) continue;
      if (key === SYNC_CONFIG_KEY || key === SYNC_META_KEY) continue;

      const value = localStorage.getItem(key);
      if (typeof value === 'string') {
        const normalizedValue = key.startsWith(PAGE_SNAPSHOT_PREFIX)
          ? sanitizeSnapshotForSync(value)
          : value;

        const entryBytes = estimateUtf8Bytes(normalizedValue);
        if (entryBytes > SYNC_MAX_VALUE_BYTES) continue;
        if (totalBytes + entryBytes > SYNC_MAX_TOTAL_BYTES) continue;

        data[key] = normalizedValue;
        totalBytes += entryBytes;
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
      if (key && key.startsWith('portfolio_') && key !== SYNC_CONFIG_KEY && key !== SYNC_META_KEY) {
        keys.push(key);
      }
    }
    keys.forEach((key) => localStorage.removeItem(key));
    scheduleSyncPush('clear-storage');
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

        scheduleSyncPush('import-backup');

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
    let raw = localStorage.getItem(removeHistoryStorageKey);
    if (!raw && legacyRemoveHistoryStorageKey !== removeHistoryStorageKey) {
      raw = localStorage.getItem(legacyRemoveHistoryStorageKey);
      if (raw) {
        localStorage.setItem(removeHistoryStorageKey, raw);
      }
    }
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

        const validation = validateUploadSize(file, 'image');
        if (!validation.ok) {
          window.alert(validation.message);
          return;
        }

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
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      const kind = inferUploadKind(accept);

      for (const file of files) {
        const validation = validateUploadSize(file, kind);
        if (!validation.ok) {
          window.alert(validation.message);
          continue;
        }

        if (isGoogleDriveUploadConfigured() && (kind === 'image' || kind === 'video' || kind === 'audio')) {
          try {
            const remoteUrl = await uploadFileToGoogleDrive(file, kind);
            if (!remoteUrl) {
              window.alert('Google Drive upload did not return a URL.');
              continue;
            }
            await Promise.resolve(onLoad(remoteUrl, file));
            continue;
          } catch (error) {
            window.alert(String(error?.message || 'Google Drive upload failed.'));
            continue;
          }
        }

        try {
          const dataUrl = await readFileAsDataUrl(file);
          await Promise.resolve(onLoad(dataUrl, file));
        } catch {
          window.alert('Unable to read selected file.');
        }
      }
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

    const urlInput = window.prompt('Paste image URL (https://...) to sync by reference, or leave blank to upload file(s):', '');
    if (urlInput === null) return;
    const trimmedUrl = normalizeMediaUrlForPlayback(urlInput);
    if (trimmedUrl) {
      const placeholder = block.querySelector('.media-placeholder');
      if (placeholder) placeholder.remove();

      const mediaList = ensureProjectMediaList(block);
      const mediaItem = document.createElement('div');
      mediaItem.className = 'admin-media-item';

      const image = document.createElement('img');
      image.className = 'admin-project-image';
      image.src = trimmedUrl;
      image.alt = 'Project image';
      image.loading = 'lazy';
      mediaItem.appendChild(image);
      attachMediaRemoveButton(mediaItem);
      mediaList.appendChild(mediaItem);
      saveSnapshot();
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

    const urlInput = window.prompt('Paste video URL (https://...) to sync by reference, or leave blank to upload file(s):', '');
    if (urlInput === null) return;
    const trimmedUrl = normalizeMediaUrlForPlayback(urlInput);
    if (trimmedUrl) {
      const placeholder = block.querySelector('.media-placeholder');
      if (placeholder) placeholder.remove();

      const mediaList = ensureProjectMediaList(block);
      const mediaItem = document.createElement('div');
      mediaItem.className = 'admin-media-item';

      const video = document.createElement('video');
      video.className = 'admin-project-video';
      video.controls = true;
      video.src = trimmedUrl;
      mediaItem.appendChild(video);
      attachMediaRemoveButton(mediaItem);
      mediaList.appendChild(mediaItem);
      saveSnapshot();
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

    const urlInput = window.prompt('Paste audio URL (https://...) to sync by reference, or leave blank to upload file(s):', '');
    if (urlInput === null) return;
    const trimmedUrl = normalizeMediaUrlForPlayback(urlInput);
    if (trimmedUrl) {
      const placeholder = block.querySelector('.media-placeholder');
      if (placeholder) placeholder.remove();

      const mediaList = ensureProjectMediaList(block);
      const mediaItem = document.createElement('div');
      mediaItem.className = 'admin-media-item';

      const audio = document.createElement('audio');
      audio.className = 'admin-project-audio';
      audio.controls = true;
      audio.src = trimmedUrl;
      mediaItem.appendChild(audio);
      attachMediaRemoveButton(mediaItem);
      mediaList.appendChild(mediaItem);
      saveSnapshot();
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

  function makeAdminPanelMovable() {
    if (!adminPanel) return;
    const head = adminPanel.querySelector('.admin-head');
    if (!head) return;

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    const onPointerMove = (event) => {
      if (!dragging || !adminPanel) return;

      const margin = 8;
      const maxLeft = Math.max(margin, window.innerWidth - adminPanel.offsetWidth - margin);
      const maxTop = Math.max(margin, window.innerHeight - adminPanel.offsetHeight - margin);
      const nextLeft = clamp(event.clientX - offsetX, margin, maxLeft);
      const nextTop = clamp(event.clientY - offsetY, margin, maxTop);

      adminPanel.style.left = `${nextLeft}px`;
      adminPanel.style.top = `${nextTop}px`;
      adminPanel.style.right = 'auto';
      adminPanel.style.bottom = 'auto';
    };

    const stopDragging = () => {
      dragging = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };

    head.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      if (!adminPanel) return;

      const rect = adminPanel.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      dragging = true;

      adminPanel.style.left = `${rect.left}px`;
      adminPanel.style.top = `${rect.top}px`;
      adminPanel.style.right = 'auto';
      adminPanel.style.bottom = 'auto';

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', stopDragging);
      window.addEventListener('pointercancel', stopDragging);

      event.preventDefault();
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
        <button type="button" id="admin-drive-setup">Drive Upload</button>
        <button type="button" id="admin-push-sync">Sync Push</button>
        <button type="button" id="admin-pull-sync">Sync Pull</button>
        <button type="button" id="admin-clear-sync">Reset Drive Sync</button>
      </div>
      <p id="admin-sync-status" class="admin-note"></p>
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
      <p class="admin-note">Tip: click any image to replace it. Use Drive Upload once, then Set Image/Video/Audio can upload directly to Drive for cross-device sync. Double-click links to edit URL. Double-click a project tile to open its subpage. Double-click popup image to open full-size. Use Attach/Remove Cert for direct certificate control.</p>
    `;

    document.body.appendChild(adminPanel);
    makeAdminPanelMovable();

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

    updateAdminSyncStatus();

    adminPanel.querySelector('#admin-export-backup')?.addEventListener('click', exportAdminBackup);
    adminPanel.querySelector('#admin-import-backup')?.addEventListener('click', importAdminBackup);
    adminPanel.querySelector('#admin-drive-setup')?.addEventListener('click', setupDriveUploadConfig);
    adminPanel.querySelector('#admin-push-sync')?.addEventListener('click', async () => {
      try {
        await pushSyncToRemote('manual');
      } catch (error) {
        window.alert(String(error?.message || 'Drive Cloud Sync push failed.'));
      }
    });
    adminPanel.querySelector('#admin-pull-sync')?.addEventListener('click', () => {
      pullSyncFromRemote({ manual: true });
    });
    adminPanel.querySelector('#admin-clear-sync')?.addEventListener('click', () => {
      const confirmed = window.confirm('Reset Drive Cloud Sync to predefined defaults on this device?');
      if (!confirmed) return;
      clearSyncConfig();
      applyPredefinedSyncConfig({ force: true });
      startSyncPolling();
      pullSyncFromRemote({ manual: false });
      updateAdminSyncStatus('Reset to predefined defaults.');
      window.alert('Drive Cloud Sync reset to predefined defaults on this device.');
    });

    adminPanel.querySelector('#admin-undo-remove')?.addEventListener('click', undoLastRemoval);
    adminPanel.querySelector('#admin-undo-all')?.addEventListener('click', undoAllRemovals);

    adminPanel.querySelector('#admin-lock')?.addEventListener('click', async () => {
      flushPendingSnapshotSave();
      try {
        await pushSyncToRemote('admin-lock');
      } catch {
        // keep lock flow resilient if sync fails
      }
      setAdminModeAutoPush(false);
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
    if (!isAdminHostAllowed()) {
      window.alert('Admin mode is unavailable on this protocol. Open the page using file, http, or https.');
      return;
    }

    const input = window.prompt('Enter admin verification key:');
    if (input === null) return;

    if (input.trim() === ADMIN_KEY) {
      setAdminUnlocked(true);
      setAdminModeAutoPush(true);
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
    const canUseAdmin = isAdminHostAllowed();

    performBackgroundCleanupOnce();
    scrubStoredSyncTokenIfDriveRelayEnabled();
    applyPredefinedSyncConfig({ force: true });
    applyHeroSettings(loadHeroSettings());
    remapProjectLinks();
    bindProfileUnlockTrigger();
    bindGlobalUnlockShortcut();
    enableImageEditing(true);
    bindProjectSubpageOpen();
    bindProjectTileNavigation();
    bindTimelineSupportInteractions();
    bindRemoveHandlers();
    bindEditableAutoSave();
    bindSyncRefreshTriggers();
    startSyncPolling();
    pullSyncFromRemote({ manual: false });

    enforceLockedEditingState();

    if (canUseAdmin && isAdminUnlocked()) {
      setAdminModeAutoPush(true);
      createAdminPanel();
      makeEditable(true);
      refreshProjectEditButtons(true);
    }

    if (!canUseAdmin || !isAdminUnlocked()) {
      setAdminModeAutoPush(false);
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
