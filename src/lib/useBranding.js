import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { base44 } from '@/api/base44Client';
import iconZ from '@/img/icon_z.svg';

let currentManifestObjectUrl = null;

const defaults = {
  site_name: 'Zana',
  logo_primary_url: '',
  logo_url: '',
  favicon_url: '',
  app_icon_url: iconZ,
  share_image_url: '',
  theme_color: '#782641',
  background_color: '#f8f5f2',
  secondary_color: '#f1e7db',
};

function getOrCreateLink(rel, type) {
  if (typeof document === 'undefined') return null;
  const existing = document.querySelector(`link[rel="${rel}"]`);
  if (existing) return existing;
  const link = document.createElement('link');
  link.setAttribute('rel', rel);
  if (type) link.setAttribute('type', type);
  document.head.appendChild(link);
  return link;
}

function getOrCreateMeta(name) {
  if (typeof document === 'undefined') return null;
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (meta) return meta;
  meta = document.createElement('meta');
  meta.setAttribute('name', name);
  document.head.appendChild(meta);
  return meta;
}

function getOrCreateMetaProperty(property) {
  if (typeof document === 'undefined') return null;
  let meta = document.querySelector(`meta[property="${property}"]`);
  if (meta) return meta;
  meta = document.createElement('meta');
  meta.setAttribute('property', property);
  document.head.appendChild(meta);
  return meta;
}

function parseHexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHsl(r, g, b) {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / delta) % 6;
        break;
      case gNorm:
        h = (bNorm - rNorm) / delta + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / delta + 4;
        break;
    }
  }

  h = Math.round((h * 60 + 360) % 360);
  s = Math.round(s * 100);
  const lPct = Math.round(l * 100);

  return { h, s, l: lPct };
}

function parseColorToHsl(color) {
  const value = String(color).trim();
  if (value.startsWith('#')) {
    const rgb = parseHexToRgb(value);
    return rgb ? rgbToHsl(...rgb) : null;
  }

  const hslMatch = value.match(/hsla?\(\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)%\s*,\s*(\d+\.?\d*)%/i);
  if (hslMatch) {
    return {
      h: Math.round(Number(hslMatch[1])),
      s: Math.round(Number(hslMatch[2])),
      l: Math.round(Number(hslMatch[3])),
    };
  }

  const rgbMatch = value.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgbMatch) {
    return rgbToHsl(Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3]));
  }

  return null;
}

function formatHslString({ h, s, l }) {
  return `${h} ${s}% ${l}%`;
}

function createDynamicManifest(branding) {
  if (typeof document === 'undefined') return;

  const manifestLink = getOrCreateLink('manifest', 'application/manifest+json');
  if (!manifestLink) return;

  if (currentManifestObjectUrl) {
    URL.revokeObjectURL(currentManifestObjectUrl);
    currentManifestObjectUrl = null;
  }

  const iconUrl = String(branding.app_icon_url ?? '').trim() || String(branding.favicon_url ?? '').trim() || '/icons/icon_z.svg';
  const manifest = {
    name: String(branding.site_name ?? 'Zana Acessórios').trim() || 'Zana Acessórios',
    short_name: String(branding.site_name ?? 'Zana').trim() || 'Zana',
    start_url: '/',
    display: 'standalone',
    background_color: String(branding.theme_color ?? '#f8f5f2'),
    theme_color: String(branding.theme_color ?? '#782641'),
    icons: [
      {
        src: iconUrl,
        sizes: '512x512',
        type: iconUrl.endsWith('.svg') ? 'image/svg+xml' : 'image/png',
        purpose: 'any maskable',
      },
    ],
  };

  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
  currentManifestObjectUrl = URL.createObjectURL(blob);
  manifestLink.setAttribute('href', currentManifestObjectUrl);
}

export function useBranding() {
  const query = useQuery({
    queryKey: ['content-branding'],
    queryFn: () => base44.content.branding(),
    staleTime: 300_000,
  });

  const branding = useMemo(() => {
    const value = query.data?.content ?? null;
    return { ...defaults, ...(value && typeof value === 'object' ? value : {}) };
  }, [query.data]);

  useEffect(() => {
    const favicon = String(branding.favicon_url ?? '').trim();
    if (favicon) {
      const link = getOrCreateLink('icon');
      if (link) link.setAttribute('href', favicon);
    }

    const appIcon = String(branding.app_icon_url ?? '').trim();
    if (appIcon) {
      const appleLink = getOrCreateLink('apple-touch-icon');
      if (appleLink) appleLink.setAttribute('href', appIcon);
    }

    if (branding.theme_color) {
      const themeColor = String(branding.theme_color).trim();
      const themeMeta = getOrCreateMeta('theme-color');
      if (themeMeta) themeMeta.setAttribute('content', themeColor);
      const msMeta = getOrCreateMeta('msapplication-navbutton-color');
      if (msMeta) msMeta.setAttribute('content', themeColor);

      const hsl = parseColorToHsl(themeColor);
      if (hsl) {
        if (typeof document !== 'undefined') {
          const hslString = formatHslString(hsl);
          document.documentElement.style.setProperty('--primary', hslString);
          document.documentElement.style.setProperty('--ring', hslString);
          document.documentElement.style.setProperty('--chart-1', hslString);
          document.documentElement.style.setProperty('--sidebar-primary', hslString);
          document.documentElement.style.setProperty('--sidebar-ring', hslString);
          document.documentElement.style.setProperty(
            '--primary-foreground',
            hsl.l > 55 ? '340 20% 15%' : '30 30% 98%'
          );
        }
      }
    }

    if (branding.background_color) {
      const value = String(branding.background_color).trim();
      const hsl = parseColorToHsl(value);
      if (hsl && typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--background', formatHslString(hsl));
      }
    }

    if (branding.secondary_color) {
      const value = String(branding.secondary_color).trim();
      const hsl = parseColorToHsl(value);
      if (hsl && typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--secondary', formatHslString(hsl));
      }
    }

    const shareImage = String(branding.share_image_url ?? '').trim() || String(branding.app_icon_url ?? '').trim() || '/icons/icon_z.svg';
    if (shareImage) {
      const ogImageMeta = getOrCreateMetaProperty('og:image');
      if (ogImageMeta) ogImageMeta.setAttribute('content', shareImage);
      const twitterImageMeta = getOrCreateMeta('twitter:image');
      if (twitterImageMeta) twitterImageMeta.setAttribute('content', shareImage);
    }

    createDynamicManifest(branding);
  }, [branding.favicon_url, branding.app_icon_url, branding.share_image_url, branding.site_name, branding.theme_color]);

  useEffect(() => {
    const name = String(branding.site_name ?? '').trim();
    if (!name) return;
    if (typeof document === 'undefined') return;
    if (!document.title || document.title === 'Zana') document.title = name;
  }, [branding.site_name]);

  return { ...query, branding };
}

