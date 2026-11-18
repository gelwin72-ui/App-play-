import { useEffect, useState } from 'react';
import { ArrowLeft, Globe, PackageCheck, User } from 'lucide-react';
import { ApplicationRecord, AppRoute, PublicDeveloper } from '../types';
import { fetchPublicDeveloper } from '../services/firestoreService';
import { AppCard } from '../components/AppCard';
import { formatTimestamp } from '../utils/validation';

import { formatReadableFirebaseError } from '../firebase/errors';

interface DeveloperProfilePageProps {
  developerId: string;
  onNavigate: (route: AppRoute) => void;
  onBack: () => void;
}

export function DeveloperProfilePage({ developerId, onNavigate, onBack }: DeveloperProfilePageProps) {
  const [developer, setDeveloper] = useState<PublicDeveloper | null>(null);
  const [apps, setApps] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchPublicDeveloper(developerId)
      .then((res) => {
        setDeveloper(res.developer);
        setApps(res.apps);
      })
      .catch((err) => {
        setError(formatReadableFirebaseError(err));
      })
      .finally(() => setLoading(false));
  }, [developerId]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 space-y-6">
        <div className="h-36 rounded-3xl bg-slate-200/70 dark:bg-slate-800/60 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-14 space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-600 dark:text-slate-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 dark:bg-blue-600 text-white flex items-center justify-center text-2xl font-bold shrink-0">
          {developer?.avatarUrl ? (
            <img
              src={developer.avatarUrl}
              alt={developer.displayName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover rounded-2xl"
            />
          ) : (
            <User className="w-8 h-8" />
          )}
        </div>
        <div className="space-y-1.5 flex-1">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {developer?.displayName || 'Developer Profile'}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <span>@{developer?.username || 'developer'}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
              {apps.length} approved releases
            </span>
            {Boolean(developer?.createdAt) && (
              <>
                <span aria-hidden="true">·</span>
                <span>Joined {formatTimestamp(developer?.createdAt)}</span>
              </>
            )}
          </div>
          {developer?.bio && (
            <p className="text-sm text-slate-600 dark:text-slate-300 pt-1 max-w-2xl">
              {developer.bio}
            </p>
          )}
          {developer?.website && (
            <a
              href={developer.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline pt-1"
            >
              <Globe className="w-3.5 h-3.5" />
              {developer.website}
            </a>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
          Approved Applications
        </h2>
        {apps.length === 0 ? (
          <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-500 dark:text-slate-400">
            This developer currently has no publicly approved applications.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps.map((app) => (
              <AppCard
                key={app.appId}
                app={app}
                onSelect={(id) => onNavigate({ name: 'app-details', appId: id })}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
