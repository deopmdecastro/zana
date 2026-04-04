import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import zIcon from '@/img/Z.svg';

const API_BASE_URL = (() => {
  try {
    const raw = import.meta.env.VITE_BASE44_APP_BASE_URL;
    const value = typeof raw === 'string' ? raw.trim() : '';
    return value ? value.replace(/\/+$/, '') : '';
  } catch {
    return '';
  }
})();

function resolveMediaSrc(src) {
  const value = String(src ?? '');
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;
  // Only rewrite API paths; keep regular "/" assets (vite/public) untouched.
  if (API_BASE_URL && value.startsWith('/api/')) return `${API_BASE_URL}${value}`;
  return value;
}

export default function ImageWithFallback({
  src,
  alt = '',
  className = '',
  wrapperClassName = '',
  iconClassName = 'w-8 h-8 text-muted-foreground/40',
  loading,
  decoding = 'async',
  ...props
}) {
  const [hasError, setHasError] = useState(false);
  const resolvedSrc = resolveMediaSrc(src);
  const showFallback = !resolvedSrc || hasError;

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (showFallback) {
    const fallbackWrapperClassName = cn('w-full h-full flex items-center justify-center', wrapperClassName || className);

    return (
      <div className={fallbackWrapperClassName}>
        <img
          src={zIcon}
          alt=""
          aria-hidden="true"
          className={cn('pointer-events-none select-none object-contain opacity-30', iconClassName)}
          loading="eager"
        />
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={cn('w-full h-full object-cover', className)}
      onError={() => setHasError(true)}
      loading={loading ?? (String(resolvedSrc).startsWith('data:') ? 'eager' : 'lazy')}
      decoding={decoding}
      {...props}
    />
  );
}
