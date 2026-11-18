import JSZip from 'jszip';
import { FileType, PackageInspection } from '../types';

const SUSPICIOUS_EXTENSIONS = ['.exe', '.bat', '.cmd', '.vbs', '.ps1', '.msi', '.scr', '.com', '.pif', '.hta'];

export async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function inspectApplicationPackage(
  file: File,
  expectedType: FileType,
  maxBytes: number
): Promise<{ ok: true; inspection: PackageInspection } | { ok: false; error: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext !== expectedType) {
    return {
      ok: false,
      error: `Selected file ".${ext}" does not match the chosen package type ".${expectedType}".`,
    };
  }

  if (file.size <= 22) {
    return { ok: false, error: 'Package file is empty or corrupted.' };
  }

  if (file.size > maxBytes) {
    const limitMb = Math.round(maxBytes / (1024 * 1024));
    return {
      ok: false,
      error: `File exceeds the platform limit of ${limitMb} MB for .${expectedType.toUpperCase()} packages.`,
    };
  }

  // Validate ZIP local file header magic bytes (PK\x03\x04)
  const headerSlice = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isZipMagic =
    headerSlice[0] === 0x50 &&
    headerSlice[1] === 0x4b &&
    headerSlice[2] === 0x03 &&
    headerSlice[3] === 0x04;

  if (!isZipMagic) {
    return {
      ok: false,
      error: `Invalid binary signature. Authentic .${expectedType.toUpperCase()} archives require a valid ZIP header (PK 0x03 0x04).`,
    };
  }

  try {
    const sha256 = await computeSha256(file);
    const zip = await JSZip.loadAsync(file);
    const entries = Object.keys(zip.files);

    if (entries.length === 0) {
      return { ok: false, error: 'The archive contains zero entries.' };
    }

    const suspicious = entries.filter((entry) =>
      SUSPICIOUS_EXTENSIONS.some((bad) => entry.toLowerCase().endsWith(bad))
    );
    if (suspicious.length > 0) {
      return {
        ok: false,
        error: `Blocked suspicious executable content inside package: ${suspicious.slice(0, 3).join(', ')}`,
      };
    }

    let hasManifest = false;
    let detectedPlatformMarker = '';

    if (expectedType === 'apk') {
      const hasAndroidManifest = entries.includes('AndroidManifest.xml');
      const hasCodeOrRes = entries.some(
        (e) => e.endsWith('.dex') || e === 'resources.arsc' || e.startsWith('lib/')
      );
      if (!hasAndroidManifest) {
        return { ok: false, error: 'Invalid APK: AndroidManifest.xml was not found at archive root.' };
      }
      hasManifest = hasAndroidManifest && hasCodeOrRes;
      detectedPlatformMarker = hasCodeOrRes
        ? 'AndroidManifest.xml + compiled DEX/resources'
        : 'AndroidManifest.xml';
    } else if (expectedType === 'aab') {
      const hasBundleConfig = entries.includes('BundleConfig.pb');
      const hasBaseManifest = entries.includes('base/manifest/AndroidManifest.xml');
      if (!hasBundleConfig || !hasBaseManifest) {
        return {
          ok: false,
          error: 'Invalid AAB: Requires BundleConfig.pb and base/manifest/AndroidManifest.xml.',
        };
      }
      hasManifest = true;
      detectedPlatformMarker = 'BundleConfig.pb + base/manifest/AndroidManifest.xml';
    } else if (expectedType === 'ipa') {
      const hasPlist = entries.some((e) => /^Payload\/[^/]+\.app\/Info\.plist$/i.test(e));
      if (!hasPlist) {
        return {
          ok: false,
          error: 'Invalid IPA: Requires Payload/<AppName>.app/Info.plist.',
        };
      }
      hasManifest = true;
      detectedPlatformMarker = 'Payload/*.app/Info.plist';
    }

    // Also run server-side inspection verification when Express API is available
    const isStaticHost =
      typeof window !== 'undefined' && window.location.hostname.endsWith('github.io');
    if (!isStaticHost) {
      try {
        const serverResp = await fetch('/api/inspect-package', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'x-file-name': file.name,
            'x-file-type': expectedType,
          },
          body: file,
        });
        const contentType = serverResp.headers.get('content-type') || '';
        if (!serverResp.ok && contentType.includes('application/json')) {
          const errData = (await serverResp.json().catch(() => ({}))) as { error?: string };
          if (serverResp.status === 422 || serverResp.status === 429) {
            return { ok: false, error: errData.error || 'Server-side binary security check failed.' };
          }
        }
      } catch {
        // Client inspection already validated archive & hash if offline/proxy unavailable
      }
    }

    return {
      ok: true,
      inspection: {
        valid: true,
        sha256,
        fileSizeBytes: file.size,
        entryCount: entries.length,
        hasManifest,
        detectedPlatformMarker,
        malwareScanStatus: 'CLEAN_HEURISTIC',
        sampleEntries: entries.slice(0, 10),
        inspectedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: `Failed to inspect archive: ${err instanceof Error ? err.message : 'Corrupted package file'}`,
    };
  }
}

export function validateImageFile(file: File, maxMb: number, label: string): string | null {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return `${label} must be a PNG, JPEG, or WebP image.`;
  }
  if (file.size > maxMb * 1024 * 1024) {
    return `${label} exceeds the ${maxMb} MB image size limit.`;
  }
  return null;
}

/**
 * Resize/compress an image client-side into a valid WebP data URL without truncating base64 bytes.
 */
export async function fileToOptimizedDataUrl(
  file: File,
  maxDimension = 512,
  maxDataUrlLen?: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const encode = (dim: number, quality: number): string => {
          const scale = Math.min(1, dim / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return String(reader.result);
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/webp', quality);
        };

        let result = encode(maxDimension, 0.85);
        if (maxDataUrlLen && result.length > maxDataUrlLen) {
          const attempts: [number, number][] = [
            [Math.min(maxDimension, 96), 0.7],
            [Math.min(maxDimension, 64), 0.6],
            [48, 0.5],
            [36, 0.4],
          ];
          for (const [dim, q] of attempts) {
            const candidate = encode(dim, q);
            result = candidate;
            if (candidate.length <= maxDataUrlLen) break;
          }
        }
        resolve(result);
      };
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}
