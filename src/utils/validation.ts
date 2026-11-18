import { AdminSettingsRecord, FileType, PlatformType } from '../types';

export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export const FIELD_LIMITS = {
  appName: { min: 2, max: 80 },
  description: { min: 10, max: 4000 },
  developerName: { min: 1, max: 80 },
  username: { min: 2, max: 40 },
  displayName: { min: 1, max: 80 },
  bio: { max: 600 },
  version: { min: 1, max: 32 },
  category: { min: 2, max: 60 },
  supportContact: { min: 3, max: 160 },
  privacyPolicyUrl: { max: 500 },
  rejectionReason: { max: 1000 },
  reviewNotes: { max: 2000 },
  reportDetails: { min: 5, max: 1000 },
  reviewComment: { min: 2, max: 1500 },
  maxScreenshots: 6,
};

export function generateSafeId(prefix = 'id'): string {
  const random = crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now().toString(36)}_${random}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

export function clampString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, idx);
  return `${val >= 10 || idx === 0 ? val.toFixed(0) : val.toFixed(1)} ${units[idx]}`;
}

export function formatTimestamp(ts: unknown): string {
  if (!ts) return 'Just now';
  try {
    if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
      return (ts as { toDate: () => Date }).toDate().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
    if (ts instanceof Date) {
      return ts.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    if (typeof ts === 'string' || typeof ts === 'number') {
      return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
  } catch {
    return '—';
  }
  return '—';
}

export function getDateFromTimestamp(ts: unknown): Date | null {
  if (!ts) return null;
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate();
  }
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string' || typeof ts === 'number') {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function getMaxBytesForFileType(fileType: FileType, settings: Omit<AdminSettingsRecord, 'updatedAt'>): number {
  switch (fileType) {
    case 'apk':
      return settings.maxApkSizeMb * 1024 * 1024;
    case 'aab':
      return settings.maxAabSizeMb * 1024 * 1024;
    case 'ipa':
      return settings.maxIpaSizeMb * 1024 * 1024;
  }
}

export function validatePlatformAndFileType(platform: PlatformType, fileType: FileType): string | null {
  if (platform === 'android' && fileType !== 'apk' && fileType !== 'aab') {
    return 'Android applications only support APK or AAB packages.';
  }
  if (platform === 'ios' && fileType !== 'ipa') {
    return 'iOS applications only support IPA packages.';
  }
  return null;
}

export function validateAppMetadataInput(input: {
  appName: string;
  description: string;
  version: string;
  category: string;
  supportContact: string;
  privacyPolicyUrl?: string;
}): string | null {
  if (input.appName.trim().length < FIELD_LIMITS.appName.min || input.appName.trim().length > FIELD_LIMITS.appName.max) {
    return `Application name must be between ${FIELD_LIMITS.appName.min} and ${FIELD_LIMITS.appName.max} characters.`;
  }
  if (input.description.trim().length < FIELD_LIMITS.description.min || input.description.trim().length > FIELD_LIMITS.description.max) {
    return `Description must be between ${FIELD_LIMITS.description.min} and ${FIELD_LIMITS.description.max} characters.`;
  }
  if (input.version.trim().length < FIELD_LIMITS.version.min || input.version.trim().length > FIELD_LIMITS.version.max) {
    return `Version number must be between ${FIELD_LIMITS.version.min} and ${FIELD_LIMITS.version.max} characters.`;
  }
  if (input.category.trim().length < FIELD_LIMITS.category.min) {
    return 'Please select an application category.';
  }
  if (input.supportContact.trim().length < FIELD_LIMITS.supportContact.min || input.supportContact.trim().length > FIELD_LIMITS.supportContact.max) {
    return 'Please provide a valid support contact email or URL.';
  }
  if (input.privacyPolicyUrl && input.privacyPolicyUrl.trim().length > 0) {
    try {
      const url = new URL(input.privacyPolicyUrl.trim());
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return 'Privacy Policy URL must start with http:// or https://.';
      }
    } catch {
      return 'Privacy Policy URL must be a valid web URL.';
    }
  }
  return null;
}
