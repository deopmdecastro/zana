import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, TrendingUp, Euro, AlertTriangle, Eye, Search, ShoppingCart } from 'lucide-react';

export default function AdminReports() {
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

  return (
    <div>
      <h1 className="font-heading text-3xl mb-6">Relatórios</h1>

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
          <CardTitle className="font-heading text-xl">Destaques (30 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-primary" />
                <h3 className="font-heading text-lg">Produtos mais vistos</h3>
              </div>
              {(analytics?.top_viewed_products ?? []).length === 0 ? (
                <p className="font-body text-sm text-muted-foreground">Sem dados</p>
              ) : (
                <div className="space-y-2">
                  {(analytics?.top_viewed_products ?? []).slice(0, 6).map((p) => (
                    <div key={p.product_id} className="flex items-center justify-between font-body text-sm">
                      <span className="truncate max-w-[320px]">{p.product_name}</span>
                      <span className="text-muted-foreground">{p.views}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Search className="w-4 h-4 text-accent" />
                <h3 className="font-heading text-lg">Mais pesquisas</h3>
              </div>
              {(analytics?.top_searches ?? []).length === 0 ? (
                <p className="font-body text-sm text-muted-foreground">Sem dados</p>
              ) : (
                <div className="space-y-2">
                  {(analytics?.top_searches ?? []).slice(0, 6).map((q) => (
                    <div key={q.query} className="flex items-center justify-between font-body text-sm">
                      <span className="truncate max-w-[320px]">{q.query}</span>
                      <span className="text-muted-foreground">{q.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <ShoppingCart className="w-4 h-4 text-green-700" />
                <h3 className="font-heading text-lg">Mais vendidos</h3>
              </div>
              {(analytics?.top_sold_products ?? []).length === 0 ? (
                <p className="font-body text-sm text-muted-foreground">Sem dados</p>
              ) : (
                <div className="space-y-2">
                  {(analytics?.top_sold_products ?? []).slice(0, 6).map((p) => (
                    <div
                      key={`${p.product_id ?? 'x'}-${p.product_name}`}
                      className="flex items-center justify-between font-body text-sm"
                    >
                      <span className="truncate max-w-[320px]">{p.product_name}</span>
                      <span className="text-muted-foreground">{p.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Euro className="w-4 h-4 text-primary" />
                <h3 className="font-heading text-lg">Maiores compras</h3>
              </div>
              {(analytics?.largest_orders ?? []).length === 0 ? (
                <p className="font-body text-sm text-muted-foreground">Sem dados</p>
              ) : (
                <div className="space-y-2">
                  {(analytics?.largest_orders ?? []).slice(0, 5).map((o) => (
                    <div key={o.id} className="flex items-center justify-between gap-3 font-body text-sm">
                      <span className="truncate max-w-[240px]">{o.customer_email}</span>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-secondary text-foreground text-[10px]">{o.status}</Badge>
                        <span className="text-muted-foreground">{Number(o.total ?? 0).toFixed(2)} €</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <ul className="font-body text-sm text-muted-foreground list-disc pl-5 space-y-2">
              <li>“Total em Compras” soma as compras registadas (inclui drafts/canceladas se existirem).</li>
              <li>Para stock real, use a página de Inventário e marque compras como “received”.</li>
              <li>“Produtos mais vistos/pesquisas” dependem do tracking no frontend.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

