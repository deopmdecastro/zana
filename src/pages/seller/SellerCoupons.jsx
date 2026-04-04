import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Search, Tag } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EmptyState from '@/components/ui/empty-state';
import LoadMoreControls from '@/components/ui/load-more-controls';
import { downloadCsv } from '@/lib/reportExport';

function formatDatePt(value) {
  if (!value) return 'Sem limite';
  return new Date(value).toLocaleDateString('pt-PT');
}

function moneyPt(value) {
  const n = Number(value ?? 0) || 0;
  return n.toFixed(2).replace('.', ',');
}

export default function SellerCoupons() {
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['seller-coupons', limit],
    queryFn: () => base44.staff.coupons.list('-created_date', limit),
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return coupons;
    return (coupons ?? []).filter((c) => {
      const hay = [c?.code, c?.description, c?.type].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [coupons, search]);

  const canLoadMore = !isLoading && Array.isArray(coupons) && coupons.length === limit && limit < 500;

  const exportCsv = () => {
    const now = new Date().toISOString().slice(0, 10);
    const rows = [
      ['Código', 'Tipo', 'Valor', 'Usos', 'Máximo usos', 'Subtotal mínimo', 'Expira', 'Ativo', 'Descrição'],
      ...filtered.map((coupon) => [
        coupon.code,
        coupon.type,
        coupon.type === 'percent' ? `${coupon.value}%` : `${moneyPt(coupon.value)} €`,
        coupon.used_count ?? 0,
        coupon.max_uses ?? '∞',
        coupon.min_order_subtotal != null ? `${moneyPt(coupon.min_order_subtotal)} €` : 'Nenhum',
        coupon.expires_at ? formatDatePt(coupon.expires_at) : 'Sem limite',
        coupon.is_active ? 'Sim' : 'Não',
        coupon.description ?? '',
      ]),
    ];

    downloadCsv(`cupons_${now}.csv`, rows);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl">Cupons</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">Consulta e exportação de cupons.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-none font-body text-sm gap-2" onClick={exportCsv}>
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="w-full sm:w-[320px] relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por código, tipo, descrição..."
            className="rounded-none pl-9"
          />
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Código</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Valor</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Usos</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Subtotal mín.</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Expira</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Ativo</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Descrição</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading && filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6">
                  <EmptyState icon={Tag} description="Sem cupons" className="py-8" />
                </td>
              </tr>
            ) : (
              filtered.map((coupon) => (
                <tr key={coupon.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                  <td className="p-3 font-body text-sm font-medium whitespace-nowrap">{coupon.code}</td>
                  <td className="p-3 font-body text-sm whitespace-nowrap">
                    {coupon.type === 'percent' ? `${coupon.value}%` : `${moneyPt(coupon.value)} €`}
                  </td>
                  <td className="p-3 font-body text-sm whitespace-nowrap">
                    {coupon.used_count}/{coupon.max_uses ?? '∞'}
                  </td>
                  <td className="p-3 font-body text-xs text-muted-foreground whitespace-nowrap">
                    {coupon.min_order_subtotal != null ? `${moneyPt(coupon.min_order_subtotal)} €` : '—'}
                  </td>
                  <td className="p-3 font-body text-sm whitespace-nowrap">{formatDatePt(coupon.expires_at)}</td>
                  <td className="p-3 font-body text-xs text-muted-foreground whitespace-nowrap">{coupon.is_active ? 'Sim' : 'Não'}</td>
                  <td className="p-3 font-body text-xs text-muted-foreground">{coupon.description ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <LoadMoreControls
        leftText={`A mostrar ${Math.min(limit, Array.isArray(coupons) ? coupons.length : 0)} cupons.`}
        canLoadMore={canLoadMore}
        onLoadMore={() => setLimit((p) => Math.min(500, p + 50))}
        onShowLess={() => setLimit(50)}
      />
    </div>
  );
}

