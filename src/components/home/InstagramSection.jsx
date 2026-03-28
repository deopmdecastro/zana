import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Instagram, Play } from 'lucide-react';
import zIcon from '@/img/Z.svg';
import { base44 } from '@/api/base44Client';

const instagramHandle = 'zana.acessorios_';
const instagramUrl = `https://www.instagram.com/${instagramHandle}/`;

function parseInstagramUrl(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const type = parts[0];
    const shortcode = parts[1];
    if (!type || !shortcode) return null;
    if (!['p', 'reel', 'tv'].includes(type)) return null;
    return { type, shortcode };
  } catch {
    return null;
  }
}

export default function InstagramSection() {
  const { data: posts = [] } = useQuery({
    queryKey: ['instagram'],
    queryFn: () => base44.instagram.list(12),
  });

  const cards = useMemo(
    () =>
      (posts ?? [])
        .map((p) => {
          const info = parseInstagramUrl(p.url);
          if (!info) return null;
          return { ...p, type: info.type };
        })
        .filter(Boolean),
    [posts],
  );

  return (
    <section className="py-16 md:py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div>
            <h2 className="font-heading text-3xl md:text-4xl text-foreground mb-2">Instagram</h2>
            <p className="font-body text-sm text-muted-foreground">
              Siga-nos em{' '}
              <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                @{instagramHandle}
              </a>{' '}
              para ver novidades, bastidores e inspirações.
            </p>
          </div>

          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm font-body tracking-wider hover:bg-primary/90 transition-colors rounded-none w-full md:w-auto"
          >
            <Instagram className="w-4 h-4" />
            Ver no Instagram
          </a>
        </div>

        {cards.length === 0 ? (
          <div className="bg-card border border-border p-6">
            <p className="font-body text-sm text-muted-foreground">
              Ainda não há links configurados. O admin pode adicionar em <span className="font-mono text-[13px]">/admin/conteudo/instagram</span>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card) => (
              <a
                key={card.id}
                href={card.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block bg-card border border-border overflow-hidden hover:border-primary/40 transition-colors"
                aria-label="Abrir no Instagram"
              >
                <div className={`relative ${card.type === 'reel' ? 'aspect-[9/16]' : 'aspect-square'} bg-secondary/30`}>
                  <img src={zIcon} alt="" className="absolute inset-0 m-auto w-16 opacity-[0.10]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                  {card.type === 'reel' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-white/90 text-primary flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                        <Play className="w-6 h-6 translate-x-0.5" />
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-white">
                      <Instagram className="w-4 h-4" />
                      <span className="font-body text-xs">@{instagramHandle}</span>
                    </div>
                    <span className="font-body text-xs text-white/90">Abrir</span>
                  </div>
                </div>
                <div className="p-4 space-y-1">
                  <span className="font-body text-sm text-foreground/80 group-hover:text-primary transition-colors">
                    {card.type === 'reel' ? 'Reel' : 'Post'}
                  </span>
                  {card.caption ? (
                    <p className="font-body text-xs text-muted-foreground">{card.caption}</p>
                  ) : null}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
