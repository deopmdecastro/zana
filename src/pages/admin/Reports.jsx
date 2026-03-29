import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Eye, Euro, Package, Search, TrendingUp, AlertTriangle } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import zanaLogoPrimary from '@/img/zana_logo_primary.svg';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { downloadCsv, exportReportsPdf } from '@/lib/reportExport';

function moneyPt(value) {
  const n = Number(value ?? 0) || 0;
  return n.toFixed(2).replace('.', ',');
}

const orderStatusLabels = {
  pending: 'Pendente',
  confirmed: 'Confirmada',
  processing: 'Em preparação',
  shipped: 'Enviada',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
};

const orderStatusBadgeClassName = {
  pending: 'bg-secondary text-secondary-foreground',
  confirmed: 'bg-accent/20 text-accent-foreground',
  processing: 'bg-accent/30 text-accent-foreground',
  shipped: 'bg-primary/10 text-primary',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-destructive/10 text-destructive',
};

export default function AdminReports({ title = 'Relatórios' } = {}) {

  const { data: inventory = [] } = useQuery({
    queryKey: ['admin-inventory'],
    queryFn: () => base44.admin.inventory.list(500),
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ['admin-purchases'],
    queryFn: () => base44.entities.Purchase.list('-purchased_at', 200),
  });

  const { data: analytics } = useQuery({
    queryKey: ['admin-analytics-summary'],
    queryFn: () => base44.admin.analytics.summary(30),
  });

  const stats = useMemo(() => {
    const productsCount = inventory.length;
    const stockUnits = inventory.reduce((sum, p) => sum + (p.stock ?? 0), 0);
    const lowStock = inventory.filter((p) => (p.stock ?? 0) <= 2).length;
    const purchasesTotal = purchases.reduce((sum, p) => sum + (p.total ?? 0), 0);
    return { productsCount, stockUnits, lowStock, purchasesTotal };
  }, [inventory, purchases]);

  const cards = [
    { title: 'Produtos', value: stats.productsCount, icon: Package, color: 'text-primary' },
    { title: 'Unidades em Stock', value: stats.stockUnits, icon: TrendingUp, color: 'text-green-700' },
    { title: 'Baixo Stock (≤2)', value: stats.lowStock, icon: AlertTriangle, color: 'text-destructive' },
    { title: 'Total em Compras', value: `${stats.purchasesTotal.toFixed(2)} €`, icon: Euro, color: 'text-accent' },
  ];

  const exportPdf = async () => {
    try {
      const date = new Date().toISOString().slice(0, 10);
      await exportReportsPdf({
        filename: `relatorios_${date}.pdf`,
        title,
        logoUrl: zanaLogoPrimary,
        createdAt: new Date(),
        stats,
        analytics,
      });
      toast.success('PDF exportado');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível exportar PDF');
    }
  };

  const exportExcel = () => {
    const date = new Date().toISOString().slice(0, 10);
    const rows = [];

    rows.push([title, new Date().toLocaleString('pt-PT')]);
    rows.push([]);
    rows.push(['Resumo']);
    rows.push(['Produtos', stats.productsCount]);
    rows.push(['Unidades em Stock', stats.stockUnits]);
    rows.push(['Baixo Stock (<=2)', stats.lowStock]);
    rows.push(['Total em Compras (€)', moneyPt(stats.purchasesTotal)]);

    const topViewed = analytics?.top_viewed_products ?? [];
    rows.push([]);
    rows.push(['Produtos mais vistos']);
    rows.push(['Produto', 'Views']);
    for (const p of topViewed) rows.push([p.product_name ?? '', p.views ?? 0]);

    const topSearches = analytics?.top_searches ?? [];
    rows.push([]);
    rows.push(['Mais pesquisas']);
    rows.push(['Pesquisa', 'Count']);
    for (const q of topSearches) rows.push([q.query ?? '', q.count ?? 0]);

    const topSold = analytics?.top_sold_products ?? [];
    rows.push([]);
    rows.push(['Mais vendidos']);
    rows.push(['Produto', 'Quantidade']);
    for (const p of topSold) rows.push([p.product_name ?? '', p.quantity ?? 0]);

    const largestOrders = analytics?.largest_orders ?? [];
    rows.push([]);
    rows.push(['Maiores encomendas']);
    rows.push(['Email', 'Status', 'Total (€)']);
    for (const o of largestOrders) rows.push([o.customer_email ?? '', o.status ?? '', moneyPt(o.total ?? 0)]);

    downloadCsv(`relatorios_${date}.csv`, rows);
    toast.success('Excel (CSV) exportado');
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <h1 className="font-heading text-3xl">{title}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-none font-body text-sm gap-2" onClick={exportExcel}>
            <Download className="w-4 h-4" /> Excel
          </Button>
          <Button variant="outline" className="rounded-none font-body text-sm gap-2" onClick={exportPdf}>
            <Download className="w-4 h-4" /> PDF
          </Button>
        </div>
      </div>

      <div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map((c) => (
            <Card key={c.title}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-body text-xs text-muted-foreground">{c.title}</span>
                  <c.icon className={`w-4 h-4 ${c.color}`} />
                </div>
                <p className="font-heading text-2xl">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <CardTitle className="font-heading text-xl">Destaques (30 dias)</CardTitle>
              {(() => {
                const top = (analytics?.top_sold_products ?? [])[0] ?? null;
                if (!top?.product_name) return null;
                const qty = Number(top.quantity ?? 0) || 0;
                return (
                  <div className="text-right min-w-0">
                    <div className="font-body text-xs text-muted-foreground">Mais vendido</div>
                    <div className="font-body text-sm font-medium truncate max-w-[320px]">{top.product_name}</div>
                    <div className="font-body text-xs text-muted-foreground tabular-nums">{qty} un.</div>
                  </div>
                );
              })()}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-4 rounded-lg border border-border bg-secondary/10 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Eye className="w-4 h-4 text-primary shrink-0" />
                    <h3 className="font-heading text-lg truncate">Produtos mais vistos</h3>
                  </div>
                  <Badge className="bg-secondary text-foreground text-[10px] tabular-nums">
                    {(analytics?.top_viewed_products ?? []).length}
                  </Badge>
                </div>
                {(analytics?.top_viewed_products ?? []).length === 0 ? (
                  <p className="font-body text-sm text-muted-foreground">Sem dados</p>
                ) : (
                  <div className="space-y-2">
                    {(analytics?.top_viewed_products ?? []).slice(0, 6).map((p, idx) => (
                      <div key={p.product_id} className="flex items-start justify-between gap-3 font-body text-sm">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs tabular-nums w-6">{idx + 1}.</span>
                            <span className="truncate">{p.product_name}</span>
                          </div>
                        </div>
                        <span className="text-muted-foreground tabular-nums shrink-0">{p.views}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-4 rounded-lg border border-border bg-secondary/10 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Search className="w-4 h-4 text-accent shrink-0" />
                    <h3 className="font-heading text-lg truncate">Mais pesquisas</h3>
                  </div>
                  <Badge className="bg-secondary text-foreground text-[10px] tabular-nums">
                    {(analytics?.top_searches ?? []).length}
                  </Badge>
                </div>
                {(analytics?.top_searches ?? []).length === 0 ? (
                  <p className="font-body text-sm text-muted-foreground">Sem dados</p>
                ) : (
                  <div className="space-y-2">
                    {(analytics?.top_searches ?? []).slice(0, 6).map((q, idx) => (
                      <div key={q.query} className="flex items-start justify-between gap-3 font-body text-sm">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs tabular-nums w-6">{idx + 1}.</span>
                            <span className="truncate">{q.query}</span>
                          </div>
                        </div>
                        <span className="text-muted-foreground tabular-nums shrink-0">{q.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-4 rounded-lg border border-border bg-secondary/10 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Euro className="w-4 h-4 text-primary shrink-0" />
                    <h3 className="font-heading text-lg truncate">Maiores encomendas</h3>
                  </div>
                  <Badge className="bg-secondary text-foreground text-[10px] tabular-nums">
                    {(analytics?.largest_orders ?? []).length}
                  </Badge>
                </div>
                {(analytics?.largest_orders ?? []).length === 0 ? (
                  <p className="font-body text-sm text-muted-foreground">Sem dados</p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_auto] gap-3 text-xs text-muted-foreground font-body">
                      <span>Email</span>
                      <span className="text-right">Total</span>
                    </div>
                    {(analytics?.largest_orders ?? []).slice(0, 8).map((o) => {
                      const status = String(o.status ?? '');
                      const statusLabel = orderStatusLabels[status] ?? (status || '—');
                      const statusCls = orderStatusBadgeClassName[status] ?? 'bg-secondary text-secondary-foreground';
                      return (
                        <div key={o.id} className="grid grid-cols-[1fr_auto] items-center gap-3 font-body text-sm">
                          <div className="min-w-0">
                            <div className="truncate">{o.customer_email}</div>
                            <div className="mt-1">
                              <Badge className={`${statusCls} text-[10px]`}>{statusLabel}</Badge>
                            </div>
                          </div>
                          <div className="text-right tabular-nums text-muted-foreground shrink-0">
                            {Number(o.total ?? 0).toFixed(2)} €
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6">
              <div className="rounded-lg border border-border bg-secondary/10 p-4">
                <ul className="font-body text-sm text-muted-foreground list-disc pl-5 space-y-2">
                  <li>“Total em Compras” soma as compras registadas (inclui drafts/canceladas se existirem).</li>
                  <li>Para stock real, use a página de Inventário e marque compras como “received”.</li>
                  <li>“Produtos mais vistos/pesquisas” dependem do tracking no frontend.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
