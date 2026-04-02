import React, { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Euro, TrendingUp, Package, ShoppingCart } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { base44 } from '@/api/base44Client';
import zanaLogoPrimary from '@/img/zana_logo_primary.svg';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { downloadBlob, exportFinanceExcel, exportFinancePdf } from '@/lib/reportExport';
import EmptyState from '@/components/ui/empty-state';

function moneyPt(value) {
  const n = Number(value ?? 0) || 0;
  return n.toFixed(2).replace('.', ',');
}

function getPurchaseLineTotals(purchase) {
  const items = Array.isArray(purchase?.items) ? purchase.items : [];
  let stock = 0;
  let logistics = 0;

  for (const it of items) {
    const qty = Number(it?.quantity ?? 0) || 0;
    const unit = Number(it?.unit_cost ?? 0) || 0;
    const line = qty * unit;
    if (!Number.isFinite(line) || line <= 0) continue;

    if (it?.product_id) stock += line;
    else logistics += line;
  }

  return {
    stock: Number(stock.toFixed(2)),
    logistics: Number(logistics.toFixed(2)),
    total: Number((stock + logistics).toFixed(2)),
  };
}

function monthKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabel(key) {
  const [y, m] = String(key ?? '').split('-');
  if (!y || !m) return String(key ?? '');
  return `${m}/${String(y).slice(-2)}`;
}

function FinanceHealthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload ?? {};
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-sm">
      <div className="font-body text-xs text-muted-foreground">{monthLabel(label)}</div>
      <div className="mt-2 grid grid-cols-1 gap-1">
        <div className="flex items-center justify-between gap-4">
          <span className="font-body text-xs text-muted-foreground">Receita</span>
          <span className="font-body text-xs font-semibold">{moneyPt(row.receita)} €</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="font-body text-xs text-muted-foreground">Compras</span>
          <span className="font-body text-xs font-semibold">{moneyPt(row.compras)} €</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="font-body text-xs text-muted-foreground">Resultado</span>
          <span className="font-body text-xs font-semibold">{moneyPt(row.resultado)} €</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminFinance() {
  const title = 'Financeiro';

  const { data: inventory = [] } = useQuery({
    queryKey: ['admin-inventory'],
    queryFn: () => base44.admin.inventory.list(500),
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ['admin-purchases'],
    queryFn: () => base44.entities.Purchase.list('-purchased_at', 200),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 500),
  });


  const queryClient = useQueryClient();



  const stats = useMemo(() => {
    const byCategory = new Map();
    let invested = 0;
    let expected = 0;

    for (const p of inventory) {
      const stock = Number(p.stock ?? 0) || 0;
      const price = Number(p.price ?? 0) || 0;
      const acq = Number(p.acquisition_cost ?? p.last_movement?.unit_cost ?? 0) || 0;

      invested += stock * acq;
      expected += stock * price;

      const category = String(p.category ?? 'outros');
      const row = byCategory.get(category) ?? { category, invested: 0, expected: 0, units: 0, products: 0 };
      row.invested += stock * acq;
      row.expected += stock * price;
      row.units += stock;
      row.products += 1;
      byCategory.set(category, row);
    }

    let purchasesStockTotal = 0;
    let purchasesLogisticsTotal = 0;

    for (const p of purchases ?? []) {
      if (String(p?.status ?? '') === 'cancelled') continue;
      const totals = getPurchaseLineTotals(p);
      purchasesStockTotal += totals.stock;
      purchasesLogisticsTotal += totals.logistics;
    }

    purchasesStockTotal = Number(purchasesStockTotal.toFixed(2));
    purchasesLogisticsTotal = Number(purchasesLogisticsTotal.toFixed(2));
    const purchasesTotal = Number((purchasesStockTotal + purchasesLogisticsTotal).toFixed(2));

    const revenueByStatus = orders.reduce((acc, o) => {
      const status = String(o.status ?? 'pending');
      const total = Number(o.total ?? 0) || 0;
      acc[status] = (acc[status] ?? 0) + total;
      return acc;
    }, {});

    const revenueDelivered = revenueByStatus.delivered ?? 0;
    const revenueOpen =
      (revenueByStatus.pending ?? 0) +
      (revenueByStatus.confirmed ?? 0) +
      (revenueByStatus.processing ?? 0) +
      (revenueByStatus.shipped ?? 0);

    return {
      invested,
      expected,
      marginPotential: expected - invested,
      purchasesTotal,
      purchasesStockTotal,
      purchasesLogisticsTotal,
      byCategory: Array.from(byCategory.values()).sort((a, b) => b.invested - a.invested),
      revenueDelivered,
      revenueOpen,
      revenueCancelled: revenueByStatus.cancelled ?? 0,
    };
  }, [inventory, purchases, orders]);

  const health = useMemo(() => {
    const now = new Date();
    const months = [];

    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = monthKey(d);
      if (k) months.push(k);
    }

    const byMonth = new Map(months.map((k) => [k, { month: k, receita: 0, compras: 0 }]));

    for (const o of orders ?? []) {
      if (String(o?.status ?? '') !== 'delivered') continue;
      const k = monthKey(o?.created_date ?? o?.created_at);
      if (!k || !byMonth.has(k)) continue;
      byMonth.get(k).receita += Number(o?.total ?? 0) || 0;
    }

    for (const p of purchases ?? []) {
      if (String(p?.status ?? '') === 'cancelled') continue;
      const k = monthKey(p?.purchased_at ?? p?.purchased_date ?? p?.created_date ?? p?.created_at);
      if (!k || !byMonth.has(k)) continue;
      byMonth.get(k).compras += getPurchaseLineTotals(p).total || 0;
    }

    const series = months.map((k) => {
      const row = byMonth.get(k) ?? { receita: 0, compras: 0 };
      const receita = Number(row.receita ?? 0) || 0;
      const compras = Number(row.compras ?? 0) || 0;
      return {
        month: k,
        receita: Number(receita.toFixed(2)),
        compras: Number(compras.toFixed(2)),
        resultado: Number((receita - compras).toFixed(2)),
      };
    });

    const sumPeriod = (days) => {
      const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      let receita = 0;
      let compras = 0;

      for (const o of orders ?? []) {
        if (String(o?.status ?? '') !== 'delivered') continue;
        const d = new Date(o?.created_date ?? o?.created_at ?? 0);
        if (!Number.isFinite(d.getTime()) || d < start) continue;
        receita += Number(o?.total ?? 0) || 0;
      }

      for (const p of purchases ?? []) {
        if (String(p?.status ?? '') === 'cancelled') continue;
        const d = new Date(p?.purchased_at ?? p?.purchased_date ?? p?.created_date ?? p?.created_at ?? 0);
        if (!Number.isFinite(d.getTime()) || d < start) continue;
        compras += getPurchaseLineTotals(p).total || 0;
      }

      return { receita, compras, resultado: receita - compras };
    };

    const last30 = sumPeriod(30);
    const last90 = sumPeriod(90);
    const last3Months = series.slice(-3).reduce((acc, r) => acc + (Number(r.resultado ?? 0) || 0), 0);

    return {
      series,
      last30,
      last90,
      profitable: last3Months >= 0,
    };
  }, [orders, purchases]);

  const cards = [
    { title: 'Investido em Stock', value: `${stats.invested.toFixed(2)} €`, icon: Euro, color: 'text-primary' },
    { title: 'Valor Esperado (PVP)', value: `${stats.expected.toFixed(2)} €`, icon: TrendingUp, color: 'text-green-700' },
    { title: 'Margem Potencial', value: `${stats.marginPotential.toFixed(2)} €`, icon: Package, color: 'text-accent' },
    { title: 'Receita (Entregue)', value: `${stats.revenueDelivered.toFixed(2)} €`, icon: ShoppingCart, color: 'text-green-700' },
    { title: 'Despesas (Logística)', value: `${stats.purchasesLogisticsTotal.toFixed(2)} €`, icon: Package, color: 'text-muted-foreground' },
  ];

  const exportPdf = async () => {
    const date = new Date().toISOString().slice(0, 10);
    const outName = `financeiro_${date}.pdf`;
    const popup = window.open('', '_blank');

    try {
      if (popup) popup.document.title = outName;

      const blob = await exportFinancePdf({
        filename: outName,
        title,
        logoUrl: zanaLogoPrimary,
        createdAt: new Date(),
        stats,
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
      await exportFinanceExcel({
        filename: `financeiro_${date}.xls`,
        title,
        logoUrl: zanaLogoPrimary,
        createdAt: new Date(),
        stats,
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
            <CardTitle className="font-heading text-xl">Investimento por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.byCategory.length === 0 ? (
              <EmptyState icon={Package} description="Sem dados" className="py-6" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left p-3 font-body text-xs text-muted-foreground">Categoria</th>
                      <th className="text-right p-3 font-body text-xs text-muted-foreground">Unidades</th>
                      <th className="text-right p-3 font-body text-xs text-muted-foreground">Investido</th>
                      <th className="text-right p-3 font-body text-xs text-muted-foreground">Valor Esperado</th>
                      <th className="text-right p-3 font-body text-xs text-muted-foreground">Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byCategory.map((r) => (
                      <tr key={r.category} className="border-b border-border hover:bg-secondary/20">
                        <td className="p-3 font-body text-sm capitalize">{r.category}</td>
                        <td className="p-3 font-body text-sm text-right">{r.units}</td>
                        <td className="p-3 font-body text-sm text-right">{r.invested.toFixed(2)} €</td>
                        <td className="p-3 font-body text-sm text-right">{r.expected.toFixed(2)} €</td>
                        <td className="p-3 font-body text-sm text-right">{(r.expected - r.invested).toFixed(2)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-5">
                  <div className="font-body text-xs text-muted-foreground">Caixa (estimado)</div>
                  <div className="font-heading text-2xl mt-2">{stats.revenueDelivered.toFixed(2)} €</div>
                  <div className="font-body text-xs text-muted-foreground mt-1">Total de encomendas entregues</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="font-body text-xs text-muted-foreground">Receita pendente</div>
                  <div className="font-heading text-2xl mt-2">{stats.revenueOpen.toFixed(2)} €</div>
                  <div className="font-body text-xs text-muted-foreground mt-1">Encomendas em aberto</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="font-body text-xs text-muted-foreground">Canceladas</div>
                  <div className="font-heading text-2xl mt-2">{stats.revenueCancelled.toFixed(2)} €</div>
                  <div className="font-body text-xs text-muted-foreground mt-1">Total de encomendas canceladas</div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6">
              <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
                <CardTitle className="font-heading text-xl">Saúde do negócio</CardTitle>
                <div
                  className={`px-2 py-1 rounded-full text-[11px] font-body tracking-widest uppercase ${
                    health.profitable ? 'bg-green-100 text-green-800' : 'bg-destructive/10 text-destructive'
                  }`}
                >
                  {health.profitable ? 'Lucrativo' : 'Atenção'}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-5">
                      <div className="font-body text-xs text-muted-foreground">Resultado (30 dias)</div>
                      <div className="font-heading text-2xl mt-2">{health.last30.resultado.toFixed(2)} €</div>
                      <div className="font-body text-xs text-muted-foreground mt-1">
                        Receita: {moneyPt(health.last30.receita)} € · Compras: {moneyPt(health.last30.compras)} €
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-5">
                      <div className="font-body text-xs text-muted-foreground">Resultado (90 dias)</div>
                      <div className="font-heading text-2xl mt-2">{health.last90.resultado.toFixed(2)} €</div>
                      <div className="font-body text-xs text-muted-foreground mt-1">
                        Receita: {moneyPt(health.last90.receita)} € · Compras: {moneyPt(health.last90.compras)} €
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-5">
                      <div className="font-body text-xs text-muted-foreground">Leitura rápida</div>
                      <div className="font-body text-sm mt-2 text-muted-foreground">
                        Este gráfico compara{' '}
                        <span className="text-foreground font-medium">receita (encomendas entregues)</span> com{' '}
                        <span className="text-foreground font-medium">compras ao fornecedor</span> (estimativa de caixa).
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="h-72 mt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={health.series} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        tickFormatter={monthLabel}
                        interval={0}
                        height={32}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        width={46}
                      />
                      <Tooltip cursor={{ stroke: 'hsl(var(--border))' }} content={<FinanceHealthTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="receita" name="Receita" stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="compras" name="Compras" stroke="hsl(var(--chart-2))" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="resultado" name="Resultado" stroke="hsl(var(--chart-5))" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6">
              <ul className="font-body text-sm text-muted-foreground list-disc pl-5 space-y-2">
                <li>“Investido” usa “Preço de Aquisição” do produto; se não existir, usa o último `unit_cost` do inventário.</li>
                <li>“Valor Esperado” usa o “Preço” (PVP) do produto.</li>
                <li>“Caixa/Receita” são estimativas baseadas no total das encomendas (não incluem taxas nem confirmação de pagamento).</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
