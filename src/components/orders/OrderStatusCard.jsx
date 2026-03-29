import React from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

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

function pluralize(value, singular, plural) {
  return value === 1 ? singular : plural;
}

export default function OrderStatusCard({ order, onRepeat }) {
  const totalNumber = Number.parseFloat(order.total);
  const totalItems = (order.items ?? []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  return (
    <Card className="border-border">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-body text-xs text-muted-foreground">Encomenda #{String(order.id).slice(0, 8).toUpperCase()}</p>
            <CardTitle className="text-lg">{format(new Date(order.created_at), 'd MMM yyyy', { locale: pt })}</CardTitle>
            <CardDescription>
              {totalItems} {pluralize(totalItems, 'item', 'itens')} • {(order.items ?? []).length} {pluralize((order.items ?? []).length, 'Produto', 'Produtos')}
            </CardDescription>
          </div>
          <Badge className={statusColors[order.status] || 'bg-secondary'}>
            {statusLabels[order.status] || order.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <p className="font-body text-sm font-semibold">{Number.isFinite(totalNumber) ? totalNumber.toFixed(2) : order.total} €</p>
            {order.shipping_method_label ? (
              <p className="font-body text-xs text-muted-foreground mt-1">Envio: {order.shipping_method_label}</p>
            ) : null}
          </div>
          <Button type="button" variant="outline" className="rounded-none font-body text-sm" onClick={() => onRepeat?.(order)}>
            Repetir encomenda
          </Button>
        </div>

        {order.tracking_url || order.tracking_code ? (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-secondary/20 border border-border rounded-md p-3">
            <div className="min-w-0">
              <div className="font-body text-xs text-muted-foreground">Rastreamento</div>
              <div className="font-body text-sm font-medium truncate">
                {order.tracking_carrier ? `${order.tracking_carrier} · ` : ''}
                {order.tracking_code ? order.tracking_code : 'Link disponível'}
              </div>
            </div>
            {order.tracking_url ? (
              <a href={order.tracking_url} target="_blank" rel="noreferrer" className="font-body text-xs text-primary hover:underline">
                Ver rastreamento
              </a>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
