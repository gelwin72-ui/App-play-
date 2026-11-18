export type PlatformType = 'android' | 'ios';
export type FileType = 'apk' | 'aab' | 'ipa';
export type AppStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type UserRole = 'USER' | 'OWNER';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED';

export type AppRoute =
  | { name: 'home' }
  | { name: 'explore'; initialFilter?: 'all' | 'android' | 'ios' | 'games'; initialCategory?: string }
  | { name: 'games' }
  | { name: 'upload' }
  | { name: 'my-apps' }
  | { name: 'profile' }
  | { name: 'app-details'; appId: string }
  | { name: 'developer'; developerId: string }
  | { name: 'owner' }
  | { name: 'settings' }
  | { name: 'privacy' }
  | { name: 'terms' }
  | { name: 'about' }
  | { name: 'help' }
  | { name: 'contact' };

export interface PackageInspection {
  valid: boolean;
  sha256: string;
  fileSizeBytes: number;
  entryCount: number;
  hasManifest: boolean;
  detectedPlatformMarker: string;
  malwareScanStatus: string;
  sampleEntries?: string[];
  inspectedAt?: string;
}

export interface TestingChecklist {
  signatureVerified: boolean;
  manifestInspected: boolean;
  screenshotsReviewed: boolean;
  privacyPolicyChecked: boolean;
  manualInstallTested: boolean;
  testDevice?: string;
  testOutcome?: 'PASSED' | 'FAILED' | 'NEEDS_CHANGES';
}

export interface UserAccount {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
  avatarUrl?: string;
  developerBio?: string;
  supportEmail?: string;
  website?: string;
  uploadedCount: number;
  registrationDate: unknown;
  lastActivity: unknown;
}

export interface PublicDeveloper {
  uid: string;
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  website?: string;
  approvedAppCount: number;
  accountStatus: AccountStatus;
  createdAt: unknown;
}

export interface ApplicationRecord {
  appId: string;
  appName: string;
  description: string;
  developerId: string;
  developerName: string;
  platform: PlatformType;
  fileType: FileType;
  fileName: string;
  fileSizeBytes: number;
  fileSha256: string;
  fileStoragePath: string;
  publicDownloadUrl?: string;
  iconStoragePath?: string;
  iconUrl?: string;
  screenshots?: string[];
  version: string;
  category: string;
  isGame: boolean;
  status: AppStatus;
  uploadDate: unknown;
  updatedAt: unknown;
  reviewDate?: unknown;
  reviewerId?: string;
  rejectionReason?: string;
  reviewNotes?: string;
  testingChecklist?: TestingChecklist;
  packageInspection?: PackageInspection;
  privacyPolicyUrl?: string;
  supportContact: string;
  downloadCount: number;
  featured: boolean;
  averageRating?: number;
  ratingCount?: number;
}

export interface CategoryRecord {
  categoryId: string;
  name: string;
  type: 'app' | 'game';
  description?: string;
}

export type NotificationType =
  | 'UPLOAD_RECEIVED'
  | 'SUBMISSION_ALERT'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'ANNOUNCEMENT'
  | 'SECURITY_ALERT'
  | 'ACCOUNT_UPDATE'
  | 'REPORT_ALERT';

export interface NotificationRecord {
  notificationId: string;
  recipientId: string;
  senderId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedAppId?: string;
  read: boolean;
  createdAt: unknown;
}

export interface ReportRecord {
  reportId: string;
  appId: string;
  appName: string;
  reporterId: string;
  reason: 'MALWARE' | 'COPYRIGHT' | 'MISLEADING' | 'INAPPROPRIATE' | 'BROKEN_BINARY' | 'OTHER';
  details: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
  resolutionNotes?: string;
  createdAt: unknown;
}

export interface ReviewRecord {
  reviewId: string;
  appId: string;
  authorId: string;
  authorName: string;
  reviewType: 'USER_REVIEW' | 'OWNER_TEST';
  rating?: number;
  comment: string;
  testDevice?: string;
  testOutcome?: 'PASSED' | 'FAILED' | 'NEEDS_CHANGES';
  createdAt: unknown;
}

export interface DownloadEventRecord {
  downloadId: string;
  appId: string;
  appName: string;
  platform: PlatformType;
  fileType: FileType;
  downloaderId?: string;
  createdAt: unknown;
}

export interface AnnouncementRecord {
  announcementId: string;
  title: string;
  body: string;
  severity: 'INFO' | 'UPDATE' | 'WARNING';
  authorId: string;
  active: boolean;
  createdAt: unknown;
}

export interface AdminSettingsRecord {
  settingId: string;
  maxApkSizeMb: number;
  maxAabSizeMb: number;
  maxIpaSizeMb: number;
  maxIconSizeMb: number;
  maxScreenshotSizeMb: number;
  maxAppsPerUser: number;
  requireEmailVerification: boolean;
  allowGuestDownloads: boolean;
  updatedAt: unknown;
  updatedBy?: string;
}

export interface AuditLogRecord {
  logId: string;
  actorId: string;
  actorEmail?: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: unknown;
}

export interface DeletionRequestRecord {
  requestId: string;
  appId: string;
  appName: string;
  developerId: string;
  reason: string;
  status: 'PENDING' | 'COMPLETED' | 'DECLINED';
  createdAt: unknown;
  resolvedAt?: unknown;
}

export const DEFAULT_ADMIN_SETTINGS: Omit<AdminSettingsRecord, 'updatedAt'> = {
  settingId: 'platform',
  maxApkSizeMb: 100,
  maxAabSizeMb: 120,
  maxIpaSizeMb: 150,
  maxIconSizeMb: 2,
  maxScreenshotSizeMb: 4,
  maxAppsPerUser: 20,
  requireEmailVerification: true,
  allowGuestDownloads: true,
};

export const DEFAULT_CATEGORIES: CategoryRecord[] = [
  { categoryId: 'productivity', name: 'Productivity', type: 'app', description: 'Task managers, note tools, and workflow utilities' },
  { categoryId: 'developer-tools', name: 'Developer Tools', type: 'app', description: 'Inspectors, terminal clients, and API utilities' },
  { categoryId: 'utilities', name: 'Utilities', type: 'app', description: 'System tools, file managers, and calculators' },
  { categoryId: 'social', name: 'Communication', type: 'app', description: 'Messaging, community, and collaboration apps' },
  { categoryId: 'education', name: 'Education', type: 'app', description: 'Learning tools, reference guides, and study aids' },
  { categoryId: 'finance', name: 'Finance', type: 'app', description: 'Budgeting, expense tracking, and calculators' },
  { categoryId: 'media', name: 'Photo & Media', type: 'app', description: 'Audio players, camera tools, and image editors' },
  { categoryId: 'health', name: 'Health & Fitness', type: 'app', description: 'Workouts, habits, and wellness trackers' },
  { categoryId: 'action-games', name: 'Action', type: 'game', description: 'Fast-paced arcade and action titles' },
  { categoryId: 'strategy-games', name: 'Strategy', type: 'game', description: 'Tactical, turn-based, and resource games' },
  { categoryId: 'puzzle-games', name: 'Puzzle', type: 'game', description: 'Logic puzzles, word games, and brain teasers' },
  { categoryId: 'indie-games', name: 'Indie Arcade', type: 'game', description: 'Independent mobile games from solo creators' },
];
