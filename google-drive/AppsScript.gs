const UPLOAD_SECRET = 'Nv29xQ7mT4kL8pZa6cUd1fRy3sWh0JbE';
const IMAGE_FOLDER_ID = '1qRmd9xdVIY8zR4hLbe9i92rfmtwkEnHw';
const VIDEO_FOLDER_ID = '1ObdbM4GdokiWy-05nqdQX4FWAtxCVQKb';
const AUDIO_FOLDER_ID = '1GjEvlXRADWNe81MOUZ2L99wJdYmMSBp_';
const OTHER_FOLDER_ID = '1ZCfB3kRSY3zzegvyhe6v9mRPIdSozaX0';
const SYNC_PAYLOAD_KEY = 'portfolio_sync_payload_v1';
const SYNC_FILE_PREFIX = 'portfolio_sync_payload_';

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    const action = String(body.action || '').trim().toLowerCase();
    if (action === 'syncpush') {
      return handleSyncPush(body);
    }
    if (action === 'syncpull') {
      return handleSyncPull(body);
    }

    const secret = String(body.secret || '').trim();
    if (String(UPLOAD_SECRET || '').trim() && secret !== String(UPLOAD_SECRET || '').trim()) {
      return jsonResponse({ ok: false, error: 'Unauthorized secret.' }, 401);
    }

    const fileName = String(body.fileName || '').trim();
    const mimeType = String(body.mimeType || 'application/octet-stream').trim();
    const kind = String(body.kind || 'other').trim().toLowerCase();
    const contentBase64 = String(body.contentBase64 || '').trim();

    if (!fileName || !contentBase64) {
      return jsonResponse({ ok: false, error: 'Missing file payload.' }, 400);
    }

    const bytes = Utilities.base64Decode(contentBase64);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);

    const folder = resolveFolder(kind);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileId = file.getId();
    const streamUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
    const previewUrl = `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;

    return jsonResponse({
      ok: true,
      fileId,
      streamUrl,
      previewUrl,
      url: streamUrl,
      name: file.getName(),
      mimeType: file.getMimeType()
    }, 200);
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error && error.message ? error.message : error) }, 500);
  }
}

function handleSyncPush(body) {
  const secret = String(body.secret || '').trim();
  if (String(UPLOAD_SECRET || '').trim() && secret !== String(UPLOAD_SECRET || '').trim()) {
    return jsonResponse({ ok: false, error: 'Unauthorized secret.' }, 401);
  }

  const payload = body.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return jsonResponse({ ok: false, error: 'Invalid sync payload.' }, 400);
  }

  const serialized = JSON.stringify(payload);
  const file = resolveSyncStorageFile(body, true);
  file.setContent(serialized);
  return jsonResponse({ ok: true, updatedAt: String(payload.updatedAt || new Date().toISOString()) }, 200);
}

function handleSyncPull(body) {
  const syncFile = resolveSyncStorageFile(body, false);
  const serializedFromFile = syncFile ? String(syncFile.getBlob().getDataAsString() || '') : '';

  if (serializedFromFile) {
    try {
      const parsedFromFile = JSON.parse(serializedFromFile);
      return jsonResponse({ ok: true, payload: parsedFromFile }, 200);
    } catch (error) {
      return jsonResponse({ ok: false, error: 'Stored sync payload file is corrupted.' }, 500);
    }
  }

  const legacySerialized = PropertiesService.getScriptProperties().getProperty(SYNC_PAYLOAD_KEY) || '';
  if (!legacySerialized) {
    return jsonResponse({ ok: true, payload: null }, 200);
  }

  try {
    const parsed = JSON.parse(legacySerialized);
    const newSyncFile = resolveSyncStorageFile(body, true);
    newSyncFile.setContent(legacySerialized);
    return jsonResponse({ ok: true, payload: parsed }, 200);
  } catch (error) {
    return jsonResponse({ ok: false, error: 'Stored sync payload is corrupted.' }, 500);
  }
}

function resolveSyncStorageFile(body, createIfMissing) {
  const folder = resolveSyncFolder();
  const fileName = buildSyncPayloadFileName(body);
  const files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    return files.next();
  }

  if (!createIfMissing) return null;
  return folder.createFile(fileName, '{}', MimeType.PLAIN_TEXT);
}

function resolveSyncFolder() {
  if (OTHER_FOLDER_ID) return DriveApp.getFolderById(OTHER_FOLDER_ID);
  return DriveApp.getRootFolder();
}

function buildSyncPayloadFileName(body) {
  const rawStoreId = String((body && body.syncStoreId) || 'default').trim().toLowerCase();
  const rawFileName = String((body && body.fileName) || 'portfolio-sync.json').trim().toLowerCase();

  const safeStoreId = rawStoreId.replace(/[^a-z0-9_-]/g, '_').slice(0, 64) || 'default';
  const safeFileName = rawFileName.replace(/[^a-z0-9._-]/g, '_').slice(0, 64) || 'portfolio-sync.json';

  return `${SYNC_FILE_PREFIX}${safeStoreId}__${safeFileName}`;
}

function resolveFolder(kind) {
  if (kind === 'image' && IMAGE_FOLDER_ID) return DriveApp.getFolderById(IMAGE_FOLDER_ID);
  if (kind === 'video' && VIDEO_FOLDER_ID) return DriveApp.getFolderById(VIDEO_FOLDER_ID);
  if (kind === 'audio' && AUDIO_FOLDER_ID) return DriveApp.getFolderById(AUDIO_FOLDER_ID);
  if (OTHER_FOLDER_ID) return DriveApp.getFolderById(OTHER_FOLDER_ID);
  return DriveApp.getRootFolder();
}

function jsonResponse(payload, statusCode) {
  const response = ContentService.createTextOutput(JSON.stringify(payload));
  response.setMimeType(ContentService.MimeType.JSON);
  return response;
}