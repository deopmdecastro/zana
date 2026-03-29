import React from 'react';
import { cn } from '@/lib/utils';
import ImageWithFallback from '@/components/ui/image-with-fallback';

export default function AdBanner({ banner, className }) {
  const enabled = banner?.enabled !== false;
  const imageUrl = String(banner?.image_url ?? '').trim();
  if (!enabled || !imageUrl) return null;

  const to = String(banner?.link_to ?? '').trim();
  const alt = String(banner?.alt ?? 'Publicidade').trim() || 'Publicidade';

  const img = (
    <ImageWithFallback
      src={imageUrl}
      alt={alt}
      className="w-full h-full object-cover"
      iconClassName="w-12 h-12 text-muted-foreground/40"
    />
  );

  return (
    <div className={cn('py-10 md:py-12', className)}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="overflow-hidden rounded-lg border border-border bg-card aspect-[16/5]">
          {to ? (
            <a href={to} className="block w-full h-full" aria-label={alt}>
              {img}
            </a>
          ) : (
            img
          )}
        </div>
      </div>
    </div>
  );
}

