import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CreditCard, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';

import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LoadMoreControls from '@/components/ui/load-more-controls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/toast';
import EmptyState from '@/components/ui/empty-state';

const statusLabel = {
  return_request: 'Pedido',
  return_approved: 'Aprovada',
  return_rejected: 'Rejeitada',
  return_received: 'Recebida',
  refund_recorded: 'Reembolso registado',
};

const statusBadge = {
  return_request: 'bg-secondary text-foreground',
  return_approved: 'bg-green-100 text-green-800',
  return_rejected: 'bg-destructive/10 text-destructive',
  return_received: 'bg-primary/10 text-primary',
  refund_recorded: 'bg-accent/20 text-accent-foreground',
};

function formatWhen(value) {
  try {
    return new Date(value).toLocaleString('pt-PT');
  } catch {
    return '';
  }
}

export default function ReturnsAdmin() {
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(50);
  const [selected, setSelected] = useState(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin-returns-requests', limit],
    queryFn: () => base44.admin.returns.requests.list(limit),
  });

  const sorted = useMemo(() => {
    const list = Array.isArray(requests) ? requests : [];
    return list
      .slice()
      .sort((a, b) => new Date(b?.created_date ?? 0).getTime() - new Date(a?.created_date ?? 0).getTime());
  }, [requests]);

  const canLoadMore = !isLoading && Array.isArray(requests) && requests.length === limit && limit < 500;

  const approveMutation = useMutation({
    mutationFn: (returnId) => base44.admin.returns.approve(returnId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-returns-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-logs-bell'] });
      toast.success('Devolução aprovada');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível aprovar.')),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ returnId, reason }) => base44.admin.returns.reject(returnId, { reason }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-returns-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-logs-bell'] });
      toast.success('Devolução rejeitada');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível rejeitar.')),
  });

  const receiveMutation = useMutation({
    mutationFn: ({ returnId, items }) => base44.admin.returns.receive(returnId, { items }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-returns-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      await queryClient.invalidateQueries({ queryKey: ['products-catalog'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-logs-bell'] });
      toast.success('Stock atualizado (devolução recebida)');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível marcar como recebida.')),
  });

  const refundMutation = useMutation({
    mutationFn: ({ returnId, refund_amount, refund_method, notes }) =>
      base44.admin.returns.refund(returnId, { refund_amount, refund_method, notes }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-returns-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-logs-bell'] });
      toast.success('Reembolso registado');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível registar o reembolso.')),
  });

  const selectedItems = Array.isArray(selected?.items) ? selected.items : [];
  const [rejectReason, setRejectReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState('mbway');
  const [refundNotes, setRefundNotes] = useState('');
  const [receiveLines, setReceiveLines] = useState([]);

  const openDetail = (row) => {
    setSelected(row);
    setRejectReason('');
    setRefundAmount(String(row?.refund_amount ?? ''));
    setRefundMethod(String(row?.refund_method ?? 'mbway') || 'mbway');
    setRefundNotes('');
    setReceiveLines(
      (Array.isArray(row?.items) ? row.items : []).map((it) => ({
        order_item_id: it?.order_item_id ? String(it.order_item_id) : '',
        product_name: it?.product_name ?? 'Produto',
        max_quantity: Number(it?.quantity ?? 0) || 0,
        quantity: Number(it?.quantity ?? 0) || 0,
      })),
    );
  };

  const submitReceive = () => {
    const returnId = selected?.return_id;
    if (!returnId) return;
    const items = (receiveLines ?? [])
      .map((l) => ({
        order_item_id: l.order_item_id,
        quantity: Math.max(0, Math.min(Number(l.quantity ?? 0) || 0, Number(l.max_quantity ?? 0) || 0)),
      }))
      .filter((l) => l.order_item_id && l.quantity > 0);
    if (!items.length) return toast.error('Selecione pelo menos 1 item.');
    receiveMutation.mutate({ returnId, items });
  };

  const submitRefund = () => {
    const returnId = selected?.return_id;
    if (!returnId) return;
    const amount = refundAmount === '' ? null : Number(refundAmount) || 0;
    if (amount !== null && amount <= 0) return toast.error('Valor do reembolso inválido.');
    refundMutation.mutate({
      returnId,
      refund_amount: amount,
      refund_method: refundMethod || null,
      notes: String(refundNotes ?? '').trim() || null,
    });
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="font-heading text-3xl w-full">Devoluções</h1>
        <div className="font-body text-xs text-muted-foreground w-full sm:w-auto">
          {Array.isArray(sorted) ? sorted.length : 0} pedidos
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Data</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Encomenda</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Cliente</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Estado</th>
              <th className="text-right p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(isLoading ? [] : sorted).map((r) => {
              const st = String(r.status ?? 'return_request');
              return (
                <tr key={r.return_id ?? r.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                  <td className="p-3 font-body text-xs text-muted-foreground whitespace-nowrap">
                    {formatWhen(r.created_date)}
                  </td>
                  <td className="p-3 font-body text-sm">
                    <div className="font-medium">{r.order_id ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{r.return_id ? String(r.return_id).slice(0, 8) : '—'}</div>
                  </td>
                  <td className="p-3 font-body text-sm text-muted-foreground">{r.customer_email ?? '—'}</td>
                  <td className="p-3">
                    <Badge className={`${statusBadge[st] ?? 'bg-secondary text-foreground'} text-[10px]`}>
                      {statusLabel[st] ?? st}
                    </Badge>
                    {r.refund_amount ? (
                      <div className="font-body text-[11px] text-muted-foreground mt-1">
                        Reembolso: {Number(r.refund_amount).toFixed(2)} €{r.refund_method ? ` (${r.refund_method})` : ''}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button variant="outline" className="rounded-none font-body text-xs" onClick={() => openDetail(r)}>
                      Ver
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!isLoading && sorted.length === 0 ? (
          <EmptyState icon={RotateCcw} description="Sem pedidos de devolução." className="py-8" />
        ) : null}
      </div>

      <LoadMoreControls
        leftText={`A mostrar os últimos ${Math.min(limit, Array.isArray(requests) ? requests.length : 0)} pedidos.`}
        onLess={() => setLimit(50)}
        lessDisabled={isLoading || limit <= 50}
        onMore={() => setLimit((p) => Math.min(500, p + 50))}
        moreDisabled={!canLoadMore}
      />

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent aria-describedby={undefined} className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Detalhes da devolução</DialogTitle>
          </DialogHeader>

          {selected ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="font-body text-xs text-muted-foreground">Encomenda</div>
                  <div className="font-body text-sm font-medium break-words">{selected.order_id ?? '—'}</div>
                </div>
                <div>
                  <div className="font-body text-xs text-muted-foreground">Cliente</div>
                  <div className="font-body text-sm break-words">{selected.customer_email ?? '—'}</div>
                </div>
                <div>
                  <div className="font-body text-xs text-muted-foreground">Estado</div>
                  <div className="font-body text-sm font-medium">{statusLabel[String(selected.status ?? '')] ?? selected.status}</div>
                  <div className="font-body text-xs text-muted-foreground mt-1">{formatWhen(selected.status_date)}</div>
                </div>
              </div>

              {selected.reason ? (
                <div>
                  <div className="font-body text-xs text-muted-foreground mb-1">Motivo</div>
                  <div className="font-body text-sm whitespace-pre-line">{selected.reason}</div>
                </div>
              ) : null}

              <div>
                <div className="font-body text-xs text-muted-foreground mb-2">Itens</div>
                <div className="space-y-2">
                  {selectedItems.map((it) => (
                    <div key={it.order_item_id ?? it.product_name} className="border border-border rounded-md p-3">
                      <div className="font-body text-sm font-medium">{it.product_name ?? 'Produto'}</div>
                      <div className="font-body text-xs text-muted-foreground mt-1">
                        Qtd: {it.quantity ?? 0} {it.unit_price !== null && it.unit_price !== undefined ? `• Preço: ${Number(it.unit_price).toFixed(2)} €` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  className="rounded-none font-body text-sm gap-2"
                  disabled={!selected.return_id || approveMutation.isPending}
                  onClick={() => {
                    if (!selected.return_id) return;
                    approveMutation.mutate(selected.return_id);
                  }}
                >
                  <Check className="w-4 h-4" />
                  Aprovar
                </Button>

                <Button
                  variant="outline"
                  className="rounded-none font-body text-sm gap-2"
                  disabled={!selected.return_id || rejectMutation.isPending}
                  onClick={() => {
                    if (!selected.return_id) return;
                    const reason = String(rejectReason ?? '').trim() || null;
                    rejectMutation.mutate({ returnId: selected.return_id, reason });
                  }}
                >
                  <X className="w-4 h-4" />
                  Rejeitar
                </Button>

                <div className="flex-1 min-w-[240px]" />

                <Button
                  variant="outline"
                  className="rounded-none font-body text-sm gap-2"
                  disabled={!selected.return_id || receiveMutation.isPending}
                  onClick={submitReceive}
                >
                  <RotateCcw className="w-4 h-4" />
                  Marcar recebida (stock)
                </Button>

                <Button
                  className="rounded-none font-body text-sm gap-2"
                  disabled={!selected.return_id || refundMutation.isPending}
                  onClick={submitRefund}
                >
                  <CreditCard className="w-4 h-4" />
                  Registar reembolso
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="font-heading text-base">Receção (quantidades)</div>
                  {(receiveLines ?? []).map((l) => (
                    <div key={l.order_item_id} className="border border-border rounded-md p-3">
                      <div className="font-body text-sm font-medium">{l.product_name}</div>
                      <div className="grid grid-cols-2 gap-3 mt-2 items-end">
                        <div className="font-body text-xs text-muted-foreground">Máx: {l.max_quantity}</div>
                        <div>
                          <Label className="font-body text-xs">Qtd. recebida</Label>
                          <Input
                            type="number"
                            min={0}
                            max={l.max_quantity}
                            value={l.quantity}
                            onChange={(e) => {
                              const next = Math.max(0, Math.min(Number(e.target.value ?? 0) || 0, l.max_quantity));
                              setReceiveLines((p) =>
                                (p ?? []).map((x) => (x.order_item_id === l.order_item_id ? { ...x, quantity: next } : x)),
                              );
                            }}
                            className="rounded-none mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="font-heading text-base">Reembolso</div>
                  <div>
                    <Label className="font-body text-xs">Valor (€)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      className="rounded-none mt-1"
                      placeholder="Ex.: 24.99"
                    />
                  </div>
                  <div>
                    <Label className="font-body text-xs">Método</Label>
                    <Select value={refundMethod} onValueChange={setRefundMethod}>
                      <SelectTrigger className="rounded-none mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mbway">MB WAY</SelectItem>
                        <SelectItem value="transferencia">Transferência</SelectItem>
                        <SelectItem value="multibanco">Multibanco</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="font-body text-xs">Notas (opcional)</Label>
                    <Textarea
                      value={refundNotes}
                      onChange={(e) => setRefundNotes(e.target.value)}
                      className="rounded-none mt-1 min-h-[110px]"
                      placeholder="Ex.: reembolso parcial, taxa de envio, etc."
                    />
                  </div>

                  <div>
                    <Label className="font-body text-xs">Motivo de rejeição (opcional)</Label>
                    <Textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="rounded-none mt-1 min-h-[90px]"
                      placeholder="Se rejeitar, explique ao cliente..."
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
