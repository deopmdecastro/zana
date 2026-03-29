import React from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import ImageWithFallback from '@/components/ui/image-with-fallback';

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
  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <Card className="border-border">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-body text-xs text-muted-foreground">Encomenda #{String(order.id).slice(0, 8).toUpperCase()}</p>
            <CardTitle className="text-lg">{format(new Date(order.created_at), 'd MMM yyyy', { locale: pt })}</CardTitle>
            <CardDescription>
              {totalItems} {pluralize(totalItems, 'item', 'itens')} • {items.length} {pluralize(items.length, 'Produto', 'Produtos')}
            </CardDescription>
          </div>
          <Badge className={statusColors[order.status] || 'bg-secondary'}>
            {statusLabels[order.status] || order.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {items.length ? (
          <div className="mb-5">
            <div className="font-body text-xs text-muted-foreground mb-2">Produtos</div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {items.map((it) => {
                const quantity = Number(it.quantity) || 0;
                return (
                  <div key={it.id ?? `${it.product_id ?? ''}:${it.product_name ?? ''}`} className="w-[104px] shrink-0">
                    <div className="relative w-full aspect-square rounded-md overflow-hidden border border-border bg-secondary/30">
                      <ImageWithFallback
                        src={it.product_image ?? ''}
                        alt={it.product_name ?? 'Produto'}
                        iconClassName="w-8 h-8 opacity-30 text-muted-foreground"
                      />
                      {quantity > 1 ? (
                        <div className="absolute bottom-1 right-1 bg-card/90 border border-border rounded px-1.5 py-0.5">
                          <span className="font-body text-[10px] text-foreground">x{quantity}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-1 font-body text-xs truncate" title={it.product_name ?? ''}>
                      {it.product_name ?? 'Produto'}
                    </div>
                    {it.color ? (
                      <div className="font-body text-[10px] text-muted-foreground truncate" title={it.color ?? ''}>
                        {it.color}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

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
