import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Euro, Package, ShoppingCart, TrendingUp } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ImageWithFallback from '@/components/ui/image-with-fallback';
import EmptyState from '@/components/ui/empty-state';

const STATUS_META = {
  pending: { label: 'Pendente', color: 'hsl(var(--chart-3))' },
  confirmed: { label: 'Confirmada', color: 'hsl(var(--chart-1))' },
  processing: { label: 'Preparação', color: 'hsl(var(--chart-2))' },
  shipped: { label: 'Enviada', color: 'hsl(var(--chart-4))' },
  delivered: { label: 'Entregue', color: 'hsl(var(--chart-5))' },
};

const STATUS_LABEL_SHORT = {
  pending: 'Pend.',
  confirmed: 'Conf.',
  processing: 'Prep.',
  shipped: 'Env.',
  delivered: 'Entr.',
};

function useMediaQuery(query) {
  const getMatches = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

function OrdersByStatusTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const label = String(row?.name ?? '');
  const value = Number(row?.value ?? 0);
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-sm">
      <div className="font-body text-xs text-muted-foreground">Estado</div>
      <div className="font-body text-sm font-semibold">{label}</div>
      <div className="mt-1 font-body text-xs text-muted-foreground">Encomendas</div>
      <div className="font-body text-sm font-semibold">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const isTinyChart = useMediaQuery('(max-width: 420px)');
  const isNarrowChart = useMediaQuery('(max-width: 640px)');
  const { data: products = [] } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => base44.entities.Product.list('-created_date', 500),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 500),
  });

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const pendingOrders = orders.filter((o) => o.status === 'pending').length;
  const activeProducts = products.filter((p) => p.status === 'active').length;

  const statusData = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'].map((status) => ({
    key: status,
    name: STATUS_META[status]?.label ?? status,
    value: orders.filter((o) => o.status === status).length,
    fill: STATUS_META[status]?.color ?? 'hsl(var(--chart-1))',
  }));

  const latestProducts = products.slice(0, 5);

  const stats = [
    { title: 'Receita Total', value: `${totalRevenue.toFixed(2)} €`, icon: Euro, color: 'text-green-600' },
    { title: 'Encomendas', value: orders.length, icon: ShoppingCart, color: 'text-primary' },
    { title: 'Pendentes', value: pendingOrders, icon: TrendingUp, color: 'text-accent' },
    { title: 'Produtos Ativos', value: activeProducts, icon: Package, color: 'text-blue-600' },
  ];

  return (
    <div>
      <h1 className="font-heading text-3xl mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-body text-xs text-muted-foreground">{stat.title}</span>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <p className="font-heading text-2xl">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-xl">Encomendas por Estado</CardTitle>
        </CardHeader>
        <CardContent>          <div className="h-72 relative">
            {orders.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <EmptyState
                  icon={BarChart3}
                  description="Sem dados para mostrar."
                  className="py-0"
                  iconClassName="w-8 h-8"
                />
              </div>
            ) : null}

            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statusData}
                margin={{ top: 18, right: 10, bottom: isTinyChart ? 72 : isNarrowChart ? 46 : 10, left: 0 }}
                barCategoryGap={isNarrowChart ? 12 : 18}
              >
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="key"
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isNarrowChart ? 10 : 12 }}
                  interval={0}
                  height={isTinyChart ? 92 : isNarrowChart ? 64 : 46}
                  angle={isTinyChart ? -45 : isNarrowChart ? -30 : 0}
                  textAnchor={isNarrowChart ? 'end' : 'middle'}
                  tickMargin={isTinyChart ? 18 : isNarrowChart ? 14 : 8}
                  tickFormatter={(statusKey) => {
                    const k = String(statusKey ?? '');
                    if (isNarrowChart) return STATUS_LABEL_SHORT[k] ?? STATUS_META[k]?.label ?? k;
                    return STATUS_META[k]?.label ?? k;
                  }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isNarrowChart ? 10 : 12 }}
                  width={isNarrowChart ? 26 : 28}
                  domain={[0, (dataMax) => Math.max(1, Number(dataMax) || 0)]}
                />
                <Tooltip cursor={{ fill: 'hsl(var(--secondary) / 0.35)' }} content={<OrdersByStatusTooltip />} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={isNarrowChart ? 40 : 56}>
                  {statusData.some((d) => (Number(d.value) || 0) > 0) ? (
                    <LabelList dataKey="value" position="top" className="font-body text-xs fill-foreground" />
                  ) : null}
                  {statusData.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div></CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-heading text-xl">Últimas Encomendas</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.slice(0, 5).length === 0 ? (
            <EmptyState icon={ShoppingCart} description="Sem encomendas ainda" className="py-6" />
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 5).map((order) => {
                const item = Array.isArray(order.items) && order.items.length > 0 ? order.items[0] : null;
                return (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-md gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded bg-secondary/30 overflow-hidden flex-shrink-0">
                        <ImageWithFallback
                          src={item?.product_image}
                          alt={item?.product_name || 'Produto'}
                          className="w-full h-full object-cover"
                          iconClassName="w-4 h-4 text-muted-foreground/60"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-body text-sm font-medium truncate">{order.customer_name}</p>
                        <p className="font-body text-xs text-muted-foreground">{order.items?.length || 0} itens</p>
                      </div>
                    </div>
                    <p className="font-body text-sm font-semibold">{order.total?.toFixed(2)} €</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-heading text-xl">Produtos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {latestProducts.length === 0 ? (
            <EmptyState icon={Package} description="Sem produtos cadastrados" className="py-6" />
          ) : (
            <div className="space-y-3">
              {latestProducts.map((product) => (
                <div key={product.id} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-md">
                  <div className="w-12 h-12 rounded bg-secondary/30 overflow-hidden flex-shrink-0">
                    <ImageWithFallback
                      src={Array.isArray(product.images) ? product.images[0] : ''}
                      alt={product.name || 'Produto'}
                      className="w-full h-full object-cover"
                      iconClassName="w-4 h-4 text-muted-foreground/60"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-body text-sm font-medium truncate">{product.name}</p>
                    <p className="font-body text-xs text-muted-foreground">{product.status || 'sem estado'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

