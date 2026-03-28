import { base44 } from '@/api/base44Client';

export function trackPageView(pathname) {
  if (typeof window === 'undefined') return;
  base44.analytics
    .pageview({ path: pathname ?? window.location.pathname, referrer: document.referrer || null })
    .catch(() => {});
}

export function trackSearch(query) {
  const q = String(query ?? '').trim();
  if (q.length < 2) return;
  base44.analytics.search({ query: q }).catch(() => {});
}

