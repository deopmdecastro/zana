import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, ShoppingCart, Euro, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const activeProducts = products.filter(p => p.status === 'active').length;

  // Revenue by status
  const statusData = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'].map(status => ({
    name: status === 'pending' ? 'Pendente' : status === 'confirmed' ? 'Confirmada' : status === 'processing' ? 'Preparação' : status === 'shipped' ? 'Enviada' : 'Entregue',
    value: orders.filter(o => o.status === status).length,
  }));

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
        {stats.map((stat, i) => (
          <Card key={i}>
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

      {/* Orders Chart */}
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
                <Bar dataKey="value" fill="hsl(340, 52%, 31%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-heading text-xl">Últimas Encomendas</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.slice(0, 5).length === 0 ? (
            <p className="font-body text-sm text-muted-foreground text-center py-6">Sem encomendas ainda</p>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 5).map(order => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-md">
                  <div>
                    <p className="font-body text-sm font-medium">{order.customer_name}</p>
                    <p className="font-body text-xs text-muted-foreground">{order.items?.length || 0} itens</p>
                  </div>
                  <p className="font-body text-sm font-semibold">{order.total?.toFixed(2)} €</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}