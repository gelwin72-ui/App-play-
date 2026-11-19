import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '../firebase/config';
import { fileToOptimizedDataUrl } from '../utils/packageInspector';

export interface UploadProgressInfo {
  percent: number;
  bytesTransferred: number;
  totalBytes: number;
  stage: 'inspecting' | 'uploading_binary' | 'uploading_media' | 'saving_record';
}

export async function uploadAppBinary(params: {
  file: File;
  developerId: string;
  appId: string;
  fileType: 'apk' | 'aab' | 'ipa';
  onProgress: (info: UploadProgressInfo) => void;
}): Promise<{ storagePath: string; backend: 'firebase_storage' | 'appverse_vault' }> {
  const { file, developerId, appId, fileType, onProgress } = params;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `submissions/${developerId}/${appId}/package/${safeName}`;

  try {
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file, {
      contentType: 'application/octet-stream',
      customMetadata: {
        developerId,
        appId,
        fileType,
      },
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('STORAGE_TIMEOUT'));
      }, 25000);

      task.on(
        'state_changed',
        (snapshot) => {
          const percent = snapshot.totalBytes
            ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            : 0;
          onProgress({
            percent,
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            stage: 'uploading_binary',
          });
        },
        (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        () => {
          clearTimeout(timeout);
          resolve();
        }
      );
    });

    return { storagePath, backend: 'firebase_storage' };
  } catch (err) {
    // Fallback to controlled APPVERSE Vault if Firebase Storage bucket is not yet enabled or CORS-blocked
    const msg = err instanceof Error ? err.message : String(err);
    const isBucketConfigIssue =
      msg.includes('storage/unknown') ||
      msg.includes('storage/unauthorized') ||
      msg.includes('storage/bucket-not-found') ||
      msg.includes('STORAGE_TIMEOUT') ||
      msg.includes('retry-limit-exceeded') ||
      msg.includes('network');

    if (!isBucketConfigIssue) {
      throw err;
    }

    const isStaticHost =
      typeof window !== 'undefined' && window.location.hostname.endsWith('github.io');
    if (isStaticHost) {
      throw new Error(
        'Firebase Storage is required to upload APK/AAB/IPA binaries from GitHub Pages. Enable Firebase Storage for your project in Firebase Console.'
      );
    }

    onProgress({
      percent: 15,
      bytesTransferred: 0,
      totalBytes: file.size,
      stage: 'uploading_binary',
    });

    const resp = await fetch('/api/storage/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-app-id': appId,
        'x-developer-id': developerId,
        'x-file-name': safeName,
        'x-file-type': fileType,
      },
      body: file,
    });

    if (!resp.ok) {
      const errBody = (await resp.json().catch(() => ({}))) as { error?: string };
      throw new Error(errBody.error || 'Binary upload failed during server validation.');
    }

    const result = (await resp.json()) as { storagePath: string };
    onProgress({
      percent: 100,
      bytesTransferred: file.size,
      totalBytes: file.size,
      stage: 'uploading_binary',
    });

    return { storagePath: result.storagePath, backend: 'appverse_vault' };
  }
}

export async function uploadAppImage(params: {
  file: File;
  developerId: string;
  appId: string;
  kind: 'icon' | 'screenshot';
  index?: number;
}): Promise<{ url: string; storagePath: string }> {
  const { file, developerId, appId, kind, index = 0 } = params;
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const fileName = kind === 'icon' ? `icon.${ext}` : `screen_${index}.${ext}`;
  const folder = kind === 'icon' ? 'icon' : 'screenshots';
  const storagePath = `submissions/${developerId}/${appId}/${folder}/${fileName}`;

  try {
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('STORAGE_TIMEOUT')), 10000);
      task.on(
        'state_changed',
        undefined,
        (err) => {
          clearTimeout(timeout);
          reject(err);
        },
        () => {
          clearTimeout(timeout);
          resolve();
        }
      );
    });

    const url = await getDownloadURL(storageRef);
    return { url, storagePath };
  } catch {
    const isStaticHost =
      typeof window !== 'undefined' && window.location.hostname.endsWith('github.io');

    if (!isStaticHost) {
      try {
        const resp = await fetch('/api/storage/upload-media', {
          method: 'POST',
          headers: {
            'Content-Type': file.type || 'image/png',
            'x-app-id': appId,
            'x-file-name': fileName,
          },
          body: file,
        });
        if (resp.ok) {
          const data = (await resp.json()) as { url: string; storagePath: string };
          return { url: data.url, storagePath: data.storagePath };
        }
      } catch {
        // Fall through to bounded inline thumbnail if Express backend unavailable
      }
    }

    const maxDim = kind === 'icon' ? 96 : 160;
    const dataUrl = await fileToOptimizedDataUrl(file, maxDim, 1480);
    return {
      url: dataUrl.length <= 1480 ? dataUrl : '',
      storagePath: `inline/${appId}/${fileName}`,
    };
  }
}

export async function resolveApprovedPackageDownloadUrl(params: {
  appId: string;
  fileStoragePath: string;
  publicDownloadUrl?: string;
}): Promise<string> {
  const { appId, fileStoragePath, publicDownloadUrl } = params;
  if (publicDownloadUrl && publicDownloadUrl.startsWith('http')) {
    return publicDownloadUrl;
  }
  if (fileStoragePath.startsWith('vault/')) {
    const isStaticHost =
      typeof window !== 'undefined' && window.location.hostname.endsWith('github.io');
    if (isStaticHost) {
      throw new Error(
        'This package is stored in the APPVERSE Express Vault, which is not available on static GitHub Pages. Open the live APPVERSE server or re-upload using Firebase Storage.'
      );
    }
    return `/api/storage/download/${encodeURIComponent(appId)}`;
  }
  const storageRef = ref(storage, fileStoragePath);
  return await getDownloadURL(storageRef);
}

export async function downloadPackageForOwnerReview(params: {
  appId: string;
  fileStoragePath: string;
  fileName: string;
}): Promise<void> {
  const { appId, fileStoragePath, fileName } = params;

  if (fileStoragePath.startsWith('vault/')) {
    const isStaticHost =
      typeof window !== 'undefined' && window.location.hostname.endsWith('github.io');
    if (isStaticHost) {
      throw new Error(
        'This package is stored in the APPVERSE Express Vault, which is not available on static GitHub Pages. Open the live APPVERSE server or re-upload using Firebase Storage.'
      );
    }
    const token = await auth.currentUser?.getIdToken();
    const resp = await fetch(`/api/storage/download/${encodeURIComponent(appId)}?ownerReview=1`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!resp.ok) {
      const errBody = (await resp.json().catch(() => ({}))) as { error?: string };
      throw new Error(errBody.error || 'Unable to download submission package for review.');
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const url = await getDownloadURL(ref(storage, fileStoragePath));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
