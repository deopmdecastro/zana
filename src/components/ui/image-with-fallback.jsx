import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import zIcon from '@/img/Z.svg';

export default function ImageWithFallback({
  src,
  alt = '',
  className = '',
  wrapperClassName = '',
  iconClassName = 'w-8 h-8 text-muted-foreground/40',
  ...props
}) {
  const [hasError, setHasError] = useState(false);
  const showFallback = !src || hasError;

  if (showFallback) {
    const fallbackWrapperClassName = cn('w-full h-full flex items-center justify-center', wrapperClassName || className);

    return (
      <div className={fallbackWrapperClassName}>
        <div
          className={cn('bg-current', iconClassName)}
          style={{
            WebkitMaskImage: `url(${zIcon})`,
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            WebkitMaskSize: 'contain',
            maskImage: `url(${zIcon})`,
            maskRepeat: 'no-repeat',
            maskPosition: 'center',
            maskSize: 'contain',
          }}
        />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn('w-full h-full object-cover', className)}
      onError={() => setHasError(true)}
      loading="lazy"
      {...props}
    />
  );
}
