import { useState } from 'react';
import { Download, Gamepad2, Smartphone, Star } from 'lucide-react';
import { ApplicationRecord } from '../types';
import { formatBytes } from '../utils/validation';

interface AppCardProps {
  app: ApplicationRecord;
  onSelect: (appId: string) => void;
  compact?: boolean;
}

export function AppIcon({
  iconUrl,
  appName,
  isGame,
  size = 'md',
}: {
  iconUrl?: string;
  appName: string;
  isGame?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [imgError, setImgError] = useState(false);

  const dims =
    size === 'lg'
      ? 'w-20 h-20 rounded-2xl'
      : size === 'sm'
        ? 'w-11 h-11 rounded-xl'
        : 'w-14 h-14 rounded-2xl';

  if (iconUrl && !imgError) {
    return (
      <img
        src={iconUrl}
        alt={`${appName} icon`}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${dims} object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${dims} shrink-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-blue-700 text-white border border-slate-200 dark:border-slate-700`}
      aria-label={`${appName} icon`}
    >
      {isGame ? (
        <Gamepad2 className={size === 'lg' ? 'w-9 h-9' : 'w-6 h-6'} />
      ) : (
        <Smartphone className={size === 'lg' ? 'w-9 h-9' : 'w-6 h-6'} />
      )}
    </div>
  );
}

export function AppCard({ app, onSelect, compact = false }: AppCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(app.appId)}
      className="group w-full text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 hover:border-blue-500/60 dark:hover:border-blue-500/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 flex items-start gap-4"
    >
      <AppIcon
        iconUrl={app.iconUrl}
        appName={app.appName}
        isGame={app.isGame}
        size={compact ? 'sm' : 'md'}
      />

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {app.appName}
          </h3>
          {app.averageRating && app.averageRating > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-300 tabular-nums shrink-0">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              {app.averageRating.toFixed(1)}
            </span>
          ) : null}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
          {app.developerName}
        </p>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          <span>{app.platform === 'android' ? 'Android' : 'iOS'}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono uppercase">{app.fileType}</span>
          <span aria-hidden="true">·</span>
          <span>{app.category}</span>
          {!compact && (
            <>
              <span aria-hidden="true">·</span>
              <span>{formatBytes(app.fileSizeBytes)}</span>
            </>
          )}
        </div>

        {!compact && (
          <div className="pt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <span>v{app.version}</span>
            <span className="inline-flex items-center gap-1">
              <Download className="w-3.5 h-3.5" />
              {app.downloadCount.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
