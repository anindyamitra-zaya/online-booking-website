import { useState } from 'react';
import { Building2, UserRound } from 'lucide-react';

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackType?: 'person' | 'clinic';
  fallbackLabel?: string;
}

export function SafeImage({
  src,
  alt,
  className = '',
  fallbackType = 'person',
  fallbackLabel,
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 ${className}`}
      >
        {fallbackType === 'clinic' ? (
          <Building2 className="h-8 w-8 mb-1 opacity-80" aria-hidden="true" />
        ) : (
          <UserRound className="h-8 w-8 mb-1 opacity-80" aria-hidden="true" />
        )}
        {fallbackLabel ? (
          <span className="text-xs font-medium px-2 text-center truncate max-w-full">
            {fallbackLabel}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}
