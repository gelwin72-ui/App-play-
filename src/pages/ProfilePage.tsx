import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  FolderGit2,
  LogOut,
  Save,
  Settings,
  Shield,
  User,
} from 'lucide-react';
import { ApplicationRecord, AppRoute } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { updateDeveloperProfileInfo } from '../services/firestoreService';
import { formatReadableFirebaseError } from '../firebase/errors';
import { formatTimestamp } from '../utils/validation';

interface ProfilePageProps {
  myApps: ApplicationRecord[];
  onNavigate: (route: AppRoute) => void;
  onOpenAuth: () => void;
}

export function ProfilePage({ myApps, onNavigate, onOpenAuth }: ProfilePageProps) {
  const { firebaseUser, userProfile, isOwner, isVerified, logout } = useAuth();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile) {
      setUsername(userProfile.username || '');
      setDisplayName(userProfile.displayName || '');
      setBio(userProfile.developerBio || '');
      setSupportEmail(userProfile.supportEmail || userProfile.email || '');
      setWebsite(userProfile.website || '');
      setAvatarUrl(userProfile.avatarUrl || '');
    }
  }, [userProfile]);

  if (!firebaseUser) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-16">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4">
          <User className="w-10 h-10 text-blue-600 mx-auto" />
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Developer Profile
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Sign in to customize your public developer profile, manage account settings, and publish apps.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium"
          >
            Sign In or Register
          </button>
        </div>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      await updateDeveloperProfileInfo({
        uid: firebaseUser.uid,
        username: username || 'developer',
        displayName: displayName || 'Developer',
        bio,
        supportEmail,
        website,
        avatarUrl,
      });
      setMessage('Profile updated and synchronized with public developer listing.');
    } catch (err) {
      setMessage(formatReadableFirebaseError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-8">
      {/* Header Card */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName || 'Profile avatar'}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-2xl object-cover border border-slate-200 dark:border-slate-700"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-bold shrink-0">
              {(displayName || firebaseUser.email || 'U').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                {userProfile?.displayName || firebaseUser.displayName || 'Developer'}
              </h1>
              {isOwner && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <Shield className="w-3.5 h-3.5" />
                  Platform Owner
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              @{userProfile?.username || 'developer'} · {firebaseUser.email}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {isVerified ? 'Email Verified' : 'Unverified Email'} · {myApps.length} submissions · Joined{' '}
              {formatTimestamp(userProfile?.registrationDate)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate({ name: 'my-apps' })}
            className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5"
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            My Apps
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'settings' })}
            className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </button>
          <button
            type="button"
            onClick={async () => {
              await logout();
              onNavigate({ name: 'home' });
            }}
            className="min-h-[40px] px-3.5 rounded-xl border border-red-200 dark:border-red-900/60 text-xs font-medium text-red-600 dark:text-red-400 inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </section>

      {/* Edit Developer Profile Form */}
      <form
        onSubmit={handleSave}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-5"
      >
        <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
          Edit Developer Profile
        </h2>

        {message && (
          <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Display Name
            </label>
            <input
              type="text"
              required
              minLength={1}
              maxLength={80}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Username
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={40}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Public Support Email
            </label>
            <input
              type="email"
              maxLength={160}
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Website URL
            </label>
            <input
              type="url"
              maxLength={300}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yourstudio.dev"
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Profile Avatar URL
          </label>
          <input
            type="url"
            maxLength={1000}
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
            className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Developer Bio
          </label>
          <textarea
            rows={3}
            maxLength={600}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Share what kind of Android or iOS apps you build..."
            className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
