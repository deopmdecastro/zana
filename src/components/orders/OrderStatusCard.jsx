import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import ImageWithFallback from '@/components/ui/image-with-fallback';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';
import { base44 } from '@/api/base44Client';

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
  const queryClient = useQueryClient();
  const totalNumber = Number.parseFloat(order.total);
  const totalItems = (order.items ?? []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const items = Array.isArray(order.items) ? order.items : [];

  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');

  const { data: returnsData } = useQuery({
    queryKey: ['content-returns'],
    queryFn: () => base44.content.returns(),
    staleTime: 60_000,
  });

  const returnsCfg = returnsData?.content && typeof returnsData.content === 'object' ? returnsData.content : {};
  const returnsEnabled = returnsCfg.enabled !== false;
  const daysAllowed = Math.max(0, Math.min(Number(returnsCfg.days_allowed ?? 14) || 14, 60));
  const conditionsText = String(returnsCfg.conditions_text ?? '').trim();

  const deliveredAt = useMemo(() => {
    const raw = order?.updated_date ?? order?.updated_at ?? order?.created_at ?? order?.created_date ?? null;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d : null;
  }, [order?.updated_date, order?.updated_at, order?.created_at, order?.created_date]);

  const withinWindow = useMemo(() => {
    if (!deliveredAt) return false;
    if (daysAllowed <= 0) return false;
    const ms = Date.now() - deliveredAt.getTime();
    if (!Number.isFinite(ms) || ms < 0) return true;
    return ms <= daysAllowed * 24 * 60 * 60 * 1000;
  }, [deliveredAt, daysAllowed]);

  const canRequestReturn = returnsEnabled && String(order?.status ?? '') === 'delivered' && withinWindow;

  const returnRequestMutation = useMutation({
    mutationFn: (payload) => base44.returns.request(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['my-notifications-bell'] });
      toast.success('Pedido de devolução enviado.');
      setReturnOpen(false);
      setReturnReason('');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível enviar o pedido.')),
  });

  const submitReturnRequest = () => {
    const reason = String(returnReason ?? '').trim();
    if (!reason) return toast.error('Explique o motivo da devolução.');
    const orderId = String(order?.id ?? '').trim();
    if (!orderId) return toast.error('Encomenda inválida.');

    const payloadItems = (items ?? [])
      .map((it) => {
        const id = it?.id ?? it?.order_item_id ?? null;
        const qty = Number(it?.quantity ?? 0) || 0;
        return id && qty > 0 ? { order_item_id: String(id), quantity: qty } : null;
      })
      .filter(Boolean);

    if (!payloadItems.length) return toast.error('Sem itens elegíveis para devolução.');

    returnRequestMutation.mutate({
      order_id: orderId,
      reason,
      refund_requested: true,
      items: payloadItems,
    });
  };

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
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {returnsEnabled && String(order?.status ?? '') === 'delivered' ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-none font-body text-sm"
                onClick={() => setReturnOpen(true)}
                disabled={!canRequestReturn}
                title={canRequestReturn ? 'Pedir devolução' : `Devoluções disponíveis até ${daysAllowed} dias após a entrega.`}
              >
                Pedir devolução
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="rounded-none font-body text-sm" onClick={() => onRepeat?.(order)}>
              Repetir encomenda
            </Button>
          </div>
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

      <Dialog
        open={returnOpen}
        onOpenChange={(open) => {
          setReturnOpen(open);
          if (!open) setReturnReason('');
        }}
      >
        <DialogContent className="max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Pedir devolução</DialogTitle>
            <DialogDescription className="font-body text-xs">
              {canRequestReturn
                ? 'Envie o pedido e iremos responder com os próximos passos.'
                : daysAllowed > 0
                  ? `Este pedido está fora do prazo (${daysAllowed} dias após a entrega) ou a devolução está desativada.`
                  : 'As devoluções estão desativadas.'}
            </DialogDescription>
          </DialogHeader>

          {conditionsText ? (
            <div className="border border-border rounded-md p-3 bg-secondary/10">
              <div className="font-body text-xs text-muted-foreground whitespace-pre-line">{conditionsText}</div>
            </div>
          ) : null}

          <div>
            <div className="font-body text-xs text-muted-foreground mb-2">Motivo da devolução</div>
            <Textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="rounded-none min-h-[140px]"
              placeholder="Descreva o motivo e, se possível, inclua detalhes/medidas/fotos (pode enviar depois no suporte)."
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="rounded-none font-body text-sm" onClick={() => setReturnOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-none font-body text-sm"
              onClick={submitReturnRequest}
              disabled={!canRequestReturn || returnRequestMutation.isPending}
            >
              {returnRequestMutation.isPending ? 'A enviar…' : 'Enviar pedido'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
