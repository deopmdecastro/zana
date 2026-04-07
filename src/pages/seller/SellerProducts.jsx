import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, Search } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import ImageWithFallback from '@/components/ui/image-with-fallback';
import LoadMoreControls from '@/components/ui/load-more-controls';
import EmptyState from '@/components/ui/empty-state';
import { getPrimaryImage } from '@/lib/images';

export default function SellerProducts() {
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['seller-products', limit],
    queryFn: () => base44.entities.Product.list('-created_date', limit),
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return (products ?? []).filter((p) => {
      const hay = [p?.name, p?.category, p?.material, p?.status].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [products, search]);

  const canLoadMore = !isLoading && Array.isArray(products) && products.length === limit && limit < 500;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl">Produtos</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">Visualização de produtos (sem edição).</p>
        </div>

        <div className="w-full sm:w-[320px] relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, categoria, estado..."
            className="rounded-none pl-9"
          />
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Produto</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Categoria</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Preço</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Stock</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Estado</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading && filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6">
                  <EmptyState icon={Package} description="Sem produtos" className="py-8" />
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                  <td className="p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded overflow-hidden bg-secondary/20 flex-shrink-0">
                        <ImageWithFallback
                          src={getPrimaryImage(p.images)}
                          alt={p.name || 'Produto'}
                          className="w-full h-full object-cover"
                          iconClassName="w-4 h-4 text-muted-foreground/60"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="font-body text-sm font-medium truncate">{p.name}</div>
                        {p.material ? <div className="font-body text-xs text-muted-foreground truncate">{p.material}</div> : null}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-body text-xs text-muted-foreground whitespace-nowrap">{p.category ?? '—'}</td>
                  <td className="p-3 font-body text-sm font-medium whitespace-nowrap">
                    {Number(p.price ?? 0).toFixed(2).replace('.', ',')} €
                  </td>
                  <td className="p-3 font-body text-sm whitespace-nowrap">{Number(p.stock ?? 0) || 0}</td>
                  <td className="p-3 font-body text-xs text-muted-foreground whitespace-nowrap">{p.status ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <LoadMoreControls
        leftText={`A mostrar ${Math.min(limit, Array.isArray(products) ? products.length : 0)} produtos.`}
        canLoadMore={canLoadMore}
        onLoadMore={() => setLimit((p) => Math.min(500, p + 50))}
        onShowLess={() => setLimit(50)}
      />
    </div>
  );
}
