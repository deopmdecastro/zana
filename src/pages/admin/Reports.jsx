import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Eye, Euro, Package, Search, TrendingUp, AlertTriangle } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { base44 } from '@/api/base44Client';
import zanaLogoPrimary from '@/img/zana_logo_primary.svg';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { downloadBlob, exportReportsExcel, exportReportsPdf } from '@/lib/reportExport';
import EmptyState from '@/components/ui/empty-state';

function numberOrZero(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function PurchaseAdjustmentsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload?.[0]?.payload ?? {};
  const devolvido = numberOrZero(row?.devolvido);
  const removido = numberOrZero(row?.removido);
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-sm min-w-[220px]">
      <div className="font-body text-xs text-muted-foreground">Produto</div>
      <div className="font-body text-sm font-semibold">{String(label ?? '')}</div>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 font-body text-xs">
        <span className="text-muted-foreground">Devolvido</span>
        <span className="tabular-nums">{devolvido}</span>
        <span className="text-muted-foreground">Removido</span>
        <span className="tabular-nums">{removido}</span>
      </div>
    </div>
  );
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

  const { data: logs = [] } = useQuery({
    queryKey: ['admin-logs-for-reports'],
    queryFn: () => base44.admin.logs.list(500),
  });

  const { data: analytics } = useQuery({
    queryKey: ['admin-analytics-summary'],
    queryFn: () => base44.admin.analytics.summary(30),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const stats = useMemo(() => {
    const productsCount = inventory.length;
    const stockUnits = inventory.reduce((sum, p) => sum + (p.stock ?? 0), 0);
    const lowStock = inventory.filter((p) => (p.stock ?? 0) <= 2).length;
    const purchasesTotal = purchases.reduce((sum, p) => sum + (p.total ?? 0), 0);

    const adjustments = { return_units: 0, return_value: 0, writeoff_units: 0, writeoff_value: 0 };
    for (const l of logs ?? []) {
      if (l?.entity_type !== 'Purchase') continue;
      if (l?.action !== 'return' && l?.action !== 'writeoff') continue;
      const items = Array.isArray(l?.meta?.items) ? l.meta.items : [];
      for (const it of items) {
        const qty = numberOrZero(it?.quantity);
        const unitCost = numberOrZero(it?.unit_cost);
        if (l.action === 'return') {
          adjustments.return_units += qty;
          adjustments.return_value += qty * unitCost;
        } else {
          adjustments.writeoff_units += qty;
          adjustments.writeoff_value += qty * unitCost;
        }
      }
    }

    return { productsCount, stockUnits, lowStock, purchasesTotal, ...adjustments };
  }, [inventory, purchases, logs]);

  const purchaseAdjustments = useMemo(() => {
    const byKey = new Map();
    const events = [];

    for (const l of logs ?? []) {
      if (l?.entity_type !== 'Purchase') continue;
      if (l?.action !== 'return' && l?.action !== 'writeoff') continue;

      const meta = l?.meta && typeof l.meta === 'object' ? l.meta : {};
      const items = Array.isArray(meta?.items) ? meta.items : [];
      const supplierName = meta?.supplier_name ? String(meta.supplier_name) : '';
      const reason = meta?.reason ? String(meta.reason) : '';
      const actorEmail = l?.actor?.email ? String(l.actor.email) : '';

      for (const it of items) {
        const productId = it?.product_id ? String(it.product_id) : '';
        const productName = it?.product_name ? String(it.product_name) : 'Produto';
        const key = productId || productName;
        const qty = numberOrZero(it?.quantity);
        const unitCost = numberOrZero(it?.unit_cost);

        const existing = byKey.get(key) ?? {
          key,
          product_id: productId || null,
          product_name: productName,
          devolvido: 0,
          removido: 0,
          devolvido_value: 0,
          removido_value: 0,
        };

        if (l.action === 'return') {
          existing.devolvido += qty;
          existing.devolvido_value += qty * unitCost;
        } else {
          existing.removido += qty;
          existing.removido_value += qty * unitCost;
        }

        byKey.set(key, existing);

        events.push({
          id: `${l.id}:${key}:${l.action}`,
          created_date: l.created_date,
          action: l.action,
          product_id: productId || null,
          product_name: productName,
          quantity: qty,
          unit_cost: unitCost,
          total_cost: qty * unitCost,
          supplier_name: supplierName || null,
          reason: reason || null,
          actor_email: actorEmail || null,
        });
      }
    }

    const chartData = Array.from(byKey.values())
      .sort((a, b) => (b.devolvido + b.removido) - (a.devolvido + a.removido))
      .slice(0, 10)
      .map((p) => ({
        key: p.key,
        name: p.product_name,
        devolvido: p.devolvido,
        removido: p.removido,
      }));

    const topProducts = Array.from(byKey.values())
      .sort((a, b) => (b.devolvido + b.removido) - (a.devolvido + a.removido))
      .slice(0, 12);

    const latestEvents = events
      .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())
      .slice(0, 20);

    return { chartData, topProducts, latestEvents };
  }, [logs]);

  const cards = [
    { title: 'Produtos', value: stats.productsCount, icon: Package, color: 'text-primary' },
    { title: 'Unidades em Stock', value: stats.stockUnits, icon: TrendingUp, color: 'text-green-700' },
    { title: 'Baixo Stock (≤2)', value: stats.lowStock, icon: AlertTriangle, color: 'text-destructive' },
    { title: 'Total em Compras', value: `${stats.purchasesTotal.toFixed(2)} €`, icon: Euro, color: 'text-accent' },
    { title: 'Devolvidos ao Fornecedor', value: stats.return_units, icon: Package, color: 'text-primary' },
    { title: 'Removidos do Stock', value: stats.writeoff_units, icon: AlertTriangle, color: 'text-destructive' },
  ];

  const exportPdf = async () => {
    const date = new Date().toISOString().slice(0, 10);
    const outName = `relatorios_${date}.pdf`;
    const popup = window.open('', '_blank');

    try {
      if (popup) popup.document.title = outName;

      const blob = await exportReportsPdf({
        filename: outName,
        title,
        logoUrl: zanaLogoPrimary,
        createdAt: new Date(),
        stats,
        analytics,
        mode: 'blob',
      });

      if (!(blob instanceof Blob)) throw new Error('pdf_blob_failed');

      if (popup && !popup.closed) {
        const blobUrl = URL.createObjectURL(blob);
        popup.location.href = blobUrl;
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      } else {
        downloadBlob(outName, blob);
      }

      toast.success('PDF exportado');
    } catch (err) {
      console.error(err);
      if (popup && !popup.closed) popup.close();
      toast.error('Não foi possível exportar PDF');
    }
  };

  const exportExcel = async () => {
    try {
      const date = new Date().toISOString().slice(0, 10);
      await exportReportsExcel({
        filename: `relatorios_${date}.xls`,
        title,
        logoUrl: zanaLogoPrimary,
        createdAt: new Date(),
        stats,
        analytics,
        purchaseAdjustments,
      });
      toast.success('Excel exportado');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível exportar Excel');
    }
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
              <CardTitle className="font-heading text-xl">Devoluções / Remoções (Compras)</CardTitle>
              <div className="text-right min-w-0">
                <div className="font-body text-xs text-muted-foreground">Unidades</div>
                <div className="font-body text-sm tabular-nums text-muted-foreground">
                  Devolvido: {stats.return_units} · Removido: {stats.writeoff_units}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(purchaseAdjustments?.chartData ?? []).length === 0 ? (
              <p className="font-body text-sm text-muted-foreground">Sem devoluções/remover stock registados.</p>
            ) : (
              <div className="space-y-6">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={purchaseAdjustments.chartData} margin={{ top: 18, right: 16, bottom: 10, left: 0 }} barCategoryGap={14}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        interval={0}
                        height={52}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        width={30}
                      />
                      <Tooltip cursor={{ fill: 'hsl(var(--secondary) / 0.35)' }} content={<PurchaseAdjustmentsTooltip />} />
                      <Bar dataKey="devolvido" stackId="a" radius={[8, 8, 0, 0]} fill="hsl(var(--chart-4))" maxBarSize={52}>
                        <LabelList dataKey="devolvido" position="top" className="font-body text-[10px] fill-foreground" />
                        {(purchaseAdjustments.chartData ?? []).map((entry) => (
                          <Cell key={`d:${entry.key}`} fill="hsl(var(--chart-4))" />
                        ))}
                      </Bar>
                      <Bar dataKey="removido" stackId="a" radius={[8, 8, 0, 0]} fill="hsl(var(--destructive))" maxBarSize={52}>
                        {(purchaseAdjustments.chartData ?? []).map((entry) => (
                          <Cell key={`r:${entry.key}`} fill="hsl(var(--destructive))" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-lg border border-border bg-secondary/10 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="font-heading text-lg">Últimas ações</h3>
                    <Badge className="bg-secondary text-foreground text-[10px] tabular-nums">
                      {(purchaseAdjustments?.latestEvents ?? []).length}
                    </Badge>
                  </div>
                  {(purchaseAdjustments?.latestEvents ?? []).length === 0 ? (
                    <EmptyState icon={TrendingUp} description="Sem dados" className="py-6" />
                  ) : (
                    <div className="space-y-2">
                      {(purchaseAdjustments.latestEvents ?? []).map((e) => {
                        const when = e.created_date ? new Date(e.created_date) : null;
                        const dateLabel = when && !Number.isNaN(when.getTime()) ? when.toLocaleString('pt-PT') : '-';
                        const isReturn = e.action === 'return';
                        const badgeCls = isReturn ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive';
                        const badgeLabel = isReturn ? 'Devolvido' : 'Removido';
                        return (
                          <div key={e.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start font-body text-sm">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className={`${badgeCls} text-[10px]`}>{badgeLabel}</Badge>
                                <span className="truncate font-medium">{e.product_name}</span>
                                <span className="text-xs text-muted-foreground tabular-nums">x{e.quantity}</span>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                                <span>{dateLabel}</span>
                                {e.supplier_name ? <span>Fornecedor: {e.supplier_name}</span> : null}
                                {e.actor_email ? <span>Por: {e.actor_email}</span> : null}
                                {e.reason ? <span className="truncate max-w-[520px]" title={e.reason}>Motivo: {e.reason}</span> : null}
                              </div>
                            </div>
                            <div className="text-right tabular-nums text-muted-foreground shrink-0">
                              {numberOrZero(e.total_cost).toFixed(2)} €
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
                  <EmptyState icon={Eye} description="Sem dados" className="py-6" />
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
                  <EmptyState icon={Search} description="Sem dados" className="py-6" />
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
                  <EmptyState icon={Euro} description="Sem dados" className="py-6" />
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
