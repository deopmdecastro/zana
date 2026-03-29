import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ImageWithFallback from '@/components/ui/image-with-fallback';
import { Package, ShoppingCart, Euro, TrendingUp } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const STATUS_META = {
  pending: { label: 'Pendente', color: 'hsl(var(--chart-3))' },
  confirmed: { label: 'Confirmada', color: 'hsl(var(--chart-1))' },
  processing: { label: 'Preparação', color: 'hsl(var(--chart-2))' },
  shipped: { label: 'Enviada', color: 'hsl(var(--chart-4))' },
  delivered: { label: 'Entregue', color: 'hsl(var(--chart-5))' },
};

export default function Dashboard() {
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
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <XAxis dataKey="name" className="font-body text-xs" />
                <YAxis className="font-body text-xs" />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {statusData.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-heading text-xl">Últimas Encomendas</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.slice(0, 5).length === 0 ? (
            <p className="font-body text-sm text-muted-foreground text-center py-6">Sem encomendas ainda</p>
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
            <p className="font-body text-sm text-muted-foreground text-center py-6">Sem produtos cadastrados</p>
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

