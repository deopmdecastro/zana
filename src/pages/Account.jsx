import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Package, Heart, User, LogOut, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import Auth from './Auth';

const statusLabels = {
  pending: 'Pendente',
  confirmed: 'Confirmada',
  processing: 'Em preparação',
  shipped: 'Enviada',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
};

const statusColors = {
  pending: 'bg-secondary text-secondary-foreground',
  confirmed: 'bg-accent/20 text-accent-foreground',
  processing: 'bg-accent/30 text-accent-foreground',
  shipped: 'bg-primary/10 text-primary',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-destructive/10 text-destructive',
};

export default function Account() {
  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['my-orders'],
    queryFn: async () => {
      return base44.entities.Order.filter({ customer_email: user.email }, '-created_date', 50);
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-heading text-3xl md:text-4xl">Minha Conta</h1>
        <Button
          variant="ghost"
          className="gap-2 font-body text-sm"
          onClick={() => base44.auth.logout()}
        >
          <LogOut className="w-4 h-4" /> Sair
        </Button>
      </div>

      {/* Profile */}
      <div className="bg-card p-6 rounded-lg border border-border mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-body text-sm font-semibold">{user?.full_name || 'Cliente'}</p>
            <p className="font-body text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <Link to="/favoritos" className="bg-card p-5 rounded-lg border border-border hover:border-primary/30 transition-colors flex items-center gap-3">
          <Heart className="w-5 h-5 text-accent" />
          <span className="font-body text-sm">Favoritos</span>
        </Link>
        <Link to="/catalogo" className="bg-card p-5 rounded-lg border border-border hover:border-primary/30 transition-colors flex items-center gap-3">
          <Package className="w-5 h-5 text-accent" />
          <span className="font-body text-sm">Catálogo</span>
        </Link>
      </div>

      {/* Orders */}
      <h2 className="font-heading text-2xl mb-6">Histórico de Encomendas</h2>
      {orders.length === 0 ? (
        <div className="bg-card p-8 rounded-lg border border-border text-center">
          <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-body text-sm text-muted-foreground">Ainda não tem encomendas.</p>
          <Link to="/catalogo"><Button className="rounded-none font-body text-sm mt-4">Explorar Catálogo</Button></Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <div key={order.id} className="bg-card p-5 rounded-lg border border-border">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <p className="font-body text-xs text-muted-foreground">
                    {format(new Date(order.created_date), 'd MMM yyyy', { locale: pt })}
                  </p>
                  <p className="font-body text-sm font-semibold">{order.total?.toFixed(2)} €</p>
                </div>
                <Badge className={statusColors[order.status] || 'bg-secondary'}>
                  {statusLabels[order.status] || order.status}
                </Badge>
              </div>
              <Separator className="my-3" />
              <div className="flex flex-wrap gap-2">
                {order.items?.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {item.product_image && (
                      <div className="w-10 h-10 rounded bg-secondary/30 overflow-hidden">
                        <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <span className="font-body text-xs text-muted-foreground">{item.product_name} x{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}