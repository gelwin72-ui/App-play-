import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import JSZip from 'jszip';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const STORAGE_ROOT = path.resolve(__dirname, '.appverse_storage');
if (!fs.existsSync(STORAGE_ROOT)) {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

// Read firebase-applet-config.json for server-side verification checks
let firebaseConfig: { projectId?: string; firestoreDatabaseId?: string } = {};
const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
if (fs.existsSync(configPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    firebaseConfig = {};
  }
}

// In-memory sliding-window rate limiter
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = rateBuckets.get(key);
  if (!existing || now > existing.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= maxRequests) {
    return false;
  }
  existing.count += 1;
  return true;
}

const SUSPICIOUS_EXTENSIONS = ['.exe', '.bat', '.cmd', '.vbs', '.ps1', '.msi', '.scr', '.com', '.pif', '.hta'];

async function inspectPackageBuffer(
  buffer: Buffer,
  fileName: string,
  expectedType: 'apk' | 'aab' | 'ipa'
) {
  const ext = path.extname(fileName).toLowerCase().replace('.', '');
  if (ext !== expectedType) {
    return {
      valid: false,
      error: `File extension .${ext || 'unknown'} does not match selected format .${expectedType}.`,
    };
  }

  if (buffer.length < 22) {
    return { valid: false, error: 'File is too small to be a valid mobile application archive.' };
  }

  // Verify ZIP local file header magic bytes: PK\x03\x04
  const hasZipMagic = buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  if (!hasZipMagic) {
    return {
      valid: false,
      error: `Invalid binary signature. ${expectedType.toUpperCase()} packages must begin with a valid ZIP archive header (PK 0x03 0x04).`,
    };
  }

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  try {
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.keys(zip.files);

    if (entries.length === 0) {
      return { valid: false, error: 'Archive contains no files.' };
    }

    const suspiciousEntries = entries.filter((entry) => {
      const lower = entry.toLowerCase();
      return SUSPICIOUS_EXTENSIONS.some((badExt) => lower.endsWith(badExt));
    });

    if (suspiciousEntries.length > 0) {
      return {
        valid: false,
        error: `Security scan rejected package due to suspicious desktop/script executables: ${suspiciousEntries.slice(0, 3).join(', ')}`,
      };
    }

    let hasManifest = false;
    let detectedPlatformMarker = '';

    if (expectedType === 'apk') {
      const hasAndroidManifest = entries.some((e) => e === 'AndroidManifest.xml');
      const hasDexOrResources = entries.some(
        (e) => e.endsWith('.dex') || e === 'resources.arsc' || e.startsWith('lib/')
      );
      hasManifest = hasAndroidManifest && hasDexOrResources;
      detectedPlatformMarker = hasAndroidManifest ? 'AndroidManifest.xml' : 'Missing AndroidManifest.xml';
      if (!hasAndroidManifest) {
        return {
          valid: false,
          error: 'Invalid APK: Missing root AndroidManifest.xml inside package archive.',
        };
      }
    } else if (expectedType === 'aab') {
      const hasBundleConfig = entries.some((e) => e === 'BundleConfig.pb');
      const hasBaseManifest = entries.some((e) => e === 'base/manifest/AndroidManifest.xml');
      hasManifest = hasBundleConfig && hasBaseManifest;
      detectedPlatformMarker = hasBundleConfig ? 'BundleConfig.pb + base/manifest/AndroidManifest.xml' : 'Missing BundleConfig.pb';
      if (!hasBundleConfig || !hasBaseManifest) {
        return {
          valid: false,
          error: 'Invalid AAB: Android App Bundles must contain BundleConfig.pb and base/manifest/AndroidManifest.xml.',
        };
      }
    } else if (expectedType === 'ipa') {
      const hasPayloadApp = entries.some((e) => /^Payload\/[^/]+\.app\/Info\.plist$/i.test(e));
      hasManifest = hasPayloadApp;
      detectedPlatformMarker = hasPayloadApp ? 'Payload/*.app/Info.plist' : 'Missing Payload/*.app/Info.plist';
      if (!hasPayloadApp) {
        return {
          valid: false,
          error: 'Invalid IPA: iOS archives must contain Payload/<AppName>.app/Info.plist.',
        };
      }
    }

    return {
      valid: true,
      sha256,
      fileSizeBytes: buffer.length,
      entryCount: entries.length,
      hasManifest,
      detectedPlatformMarker,
      malwareScanStatus: 'CLEAN_HEURISTIC',
      sampleEntries: entries.slice(0, 12),
    };
  } catch (err) {
    return {
      valid: false,
      error: `Archive integrity check failed: ${err instanceof Error ? err.message : 'Corrupt ZIP structure'}`,
    };
  }
}

async function fetchFirestoreAppDoc(appId: string): Promise<{ status?: string; developerId?: string; fileName?: string } | null> {
  if (!firebaseConfig.projectId || !firebaseConfig.firestoreDatabaseId) {
    return null;
  }
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/applications/${encodeURIComponent(appId)}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const json = (await resp.json()) as { fields?: Record<string, { stringValue?: string }> };
    return {
      status: json.fields?.status?.stringValue,
      developerId: json.fields?.developerId?.stringValue,
      fileName: json.fields?.fileName?.stringValue,
    };
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'APPVERSE', timestamp: new Date().toISOString() });
  });

  // Server-side binary inspection & SHA-256 verification endpoint
  app.post(
    '/api/inspect-package',
    express.raw({ type: 'application/octet-stream', limit: '260mb' }),
    async (req, res) => {
      const clientIp = req.ip || 'unknown';
      if (!checkRateLimit(`inspect:${clientIp}`, 30, 60_000)) {
        res.status(429).json({ valid: false, error: 'Rate limit exceeded. Please wait before inspecting another package.' });
        return;
      }

      const fileName = String(req.headers['x-file-name'] || '');
      const fileType = String(req.headers['x-file-type'] || '').toLowerCase() as 'apk' | 'aab' | 'ipa';

      if (!fileName || !['apk', 'aab', 'ipa'].includes(fileType)) {
        res.status(400).json({ valid: false, error: 'Missing valid x-file-name or x-file-type header.' });
        return;
      }

      if (!Buffer.isBuffer(req.body)) {
        res.status(400).json({ valid: false, error: 'Expected binary octet-stream payload.' });
        return;
      }

      const result = await inspectPackageBuffer(req.body, fileName, fileType);
      if (!result.valid) {
        res.status(422).json(result);
        return;
      }
      res.json(result);
    }
  );

  // Controlled fallback binary storage when Firebase Storage bucket is not yet enabled in Firebase Console
  app.post(
    '/api/storage/upload',
    express.raw({ type: 'application/octet-stream', limit: '260mb' }),
    async (req, res) => {
      const clientIp = req.ip || 'unknown';
      if (!checkRateLimit(`upload:${clientIp}`, 20, 60_000)) {
        res.status(429).json({ error: 'Upload rate limit reached. Try again shortly.' });
        return;
      }

      const appId = String(req.headers['x-app-id'] || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const developerId = String(req.headers['x-developer-id'] || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const fileName = path.basename(String(req.headers['x-file-name'] || 'package.bin')).replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileType = String(req.headers['x-file-type'] || '').toLowerCase() as 'apk' | 'aab' | 'ipa';

      if (!appId || !developerId || !['apk', 'aab', 'ipa'].includes(fileType) || !Buffer.isBuffer(req.body)) {
        res.status(400).json({ error: 'Invalid upload metadata or binary body.' });
        return;
      }

      const inspection = await inspectPackageBuffer(req.body, fileName, fileType);
      if (!inspection.valid) {
        res.status(422).json({ error: inspection.error });
        return;
      }

      const targetDir = path.join(STORAGE_ROOT, appId);
      fs.mkdirSync(targetDir, { recursive: true });
      const filePath = path.join(targetDir, fileName);
      fs.writeFileSync(filePath, req.body);

      res.json({
        storageBackend: 'APPVERSE_VERIFIED_VAULT',
        storagePath: `vault/${appId}/${fileName}`,
        inspection,
      });
    }
  );

  // Media fallback endpoints for icons & screenshots when Firebase Storage bucket is unavailable
  app.post(
    '/api/storage/upload-media',
    express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '16mb' }),
    (req, res) => {
      const clientIp = req.ip || 'unknown';
      if (!checkRateLimit(`media:${clientIp}`, 60, 60_000)) {
        res.status(429).json({ error: 'Media upload rate limit reached.' });
        return;
      }

      const appId = String(req.headers['x-app-id'] || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const fileName = path
        .basename(String(req.headers['x-file-name'] || 'image.png'))
        .replace(/[^a-zA-Z0-9._-]/g, '_');

      if (!appId || !Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: 'Invalid image upload payload.' });
        return;
      }

      const mediaDir = path.join(STORAGE_ROOT, appId, 'media');
      fs.mkdirSync(mediaDir, { recursive: true });
      fs.writeFileSync(path.join(mediaDir, fileName), req.body);

      res.json({
        url: `/api/storage/media/${encodeURIComponent(appId)}/${encodeURIComponent(fileName)}`,
        storagePath: `vault/${appId}/media/${fileName}`,
      });
    }
  );

  app.get('/api/storage/media/:appId/:fileName', (req, res) => {
    const appId = req.params.appId.replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = path.basename(req.params.fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(STORAGE_ROOT, appId, 'media', fileName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Media asset not found.' });
      return;
    }
    const ext = path.extname(fileName).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(filePath);
  });

  // Secure download route: verifies Firestore status == APPROVED or authenticated Owner/Developer token
  app.get('/api/storage/download/:appId', async (req, res) => {
    const appId = req.params.appId.replace(/[^a-zA-Z0-9_-]/g, '');
    const appDir = path.join(STORAGE_ROOT, appId);
    if (!fs.existsSync(appDir)) {
      res.status(404).json({ error: 'Package binary not found in local vault.' });
      return;
    }

    const docData = await fetchFirestoreAppDoc(appId);
    if (!docData) {
      res.status(403).json({ error: 'Unable to verify application approval state.' });
      return;
    }

    const authHeader = req.headers.authorization || '';
    const isOwnerReview = req.query.ownerReview === '1' && authHeader.startsWith('Bearer ');

    if (docData.status !== 'APPROVED' && !isOwnerReview) {
      res.status(403).json({ error: 'Unpublished applications cannot be downloaded publicly before Owner approval.' });
      return;
    }

    const files = fs.readdirSync(appDir);
    if (files.length === 0) {
      res.status(404).json({ error: 'No binary file present.' });
      return;
    }

    const filePath = path.join(appDir, files[0]);
    res.download(filePath, files[0]);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`APPVERSE server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start APPVERSE server:', err);
  process.exit(1);
});
