import { useEffect, useRef, useState } from 'react';
import { Layers } from 'lucide-react';

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [fading, setFading] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 360);
    const t2 = setTimeout(() => onCompleteRef.current(), 580);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 dark:bg-[#090D16] transition-opacity duration-200 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-hidden={fading}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 dark:bg-blue-600 text-white flex items-center justify-center shadow-lg">
          <Layers className="w-8 h-8" />
        </div>
        <div className="text-center">
          <p className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            APPVERSE
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Verified Android &amp; iOS Distribution
          </p>
        </div>
      </div>
    </div>
  );
}
