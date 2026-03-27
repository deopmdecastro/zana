import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

const statusLabels = {
  pending: 'Pendente', confirmed: 'Confirmada', processing: 'Em preparação',
  shipped: 'Enviada', delivered: 'Entregue', cancelled: 'Cancelada',
};
const statusColors = {
  pending: 'bg-secondary', confirmed: 'bg-accent/20', processing: 'bg-accent/30',
  shipped: 'bg-primary/10', delivered: 'bg-green-100 text-green-700', cancelled: 'bg-destructive/10 text-destructive',
};

export default function AdminOrders() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: orders = [] } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 500),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-orders'] }); toast.success('Estado atualizado'); },
  });

  const filtered = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl">Encomendas</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 rounded-none"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Cliente</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Data</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Total</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Estado</th>
              <th className="text-right p-3 font-body text-xs text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(order => (
              <tr key={order.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                <td className="p-3">
                  <p className="font-body text-sm font-medium">{order.customer_name}</p>
                  <p className="font-body text-xs text-muted-foreground">{order.customer_email}</p>
                </td>
                <td className="p-3 font-body text-xs">{format(new Date(order.created_date), 'd MMM yyyy', { locale: pt })}</td>
                <td className="p-3 font-body text-sm font-medium">{order.total?.toFixed(2)} €</td>
                <td className="p-3">
                  <Select
                    value={order.status}
                    onValueChange={(v) => updateMutation.mutate({ id: order.id, data: { status: v } })}
                  >
                    <SelectTrigger className="w-32 h-8 rounded-none text-xs">
                      <Badge className={`${statusColors[order.status]} text-[10px]`}>{statusLabels[order.status]}</Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3 text-right">
                  <Button variant="ghost" size="icon" onClick={() => setSelected(order)}><Eye className="w-4 h-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center py-8 font-body text-sm text-muted-foreground">Sem encomendas</p>}
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Detalhes da Encomenda</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 font-body text-sm">
                <div><span className="text-muted-foreground">Cliente:</span><p className="font-medium">{selected.customer_name}</p></div>
                <div><span className="text-muted-foreground">Email:</span><p className="font-medium">{selected.customer_email}</p></div>
                <div><span className="text-muted-foreground">Telefone:</span><p className="font-medium">{selected.customer_phone || '-'}</p></div>
                <div><span className="text-muted-foreground">Pagamento:</span><p className="font-medium">{selected.payment_method}</p></div>
              </div>
              <div className="font-body text-sm">
                <span className="text-muted-foreground">Morada:</span>
                <p className="font-medium">{selected.shipping_address}, {selected.shipping_city} {selected.shipping_postal_code}</p>
              </div>
              <Separator />
              <div className="space-y-2">
                {selected.items?.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {item.product_image && <div className="w-10 h-10 rounded overflow-hidden"><img src={item.product_image} alt="" className="w-full h-full object-cover" /></div>}
                      <div>
                        <p className="font-body text-sm">{item.product_name}</p>
                        <p className="font-body text-xs text-muted-foreground">x{item.quantity}</p>
                      </div>
                    </div>
                    <p className="font-body text-sm">{(item.price * item.quantity).toFixed(2)} €</p>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="font-body text-sm space-y-1">
                <div className="flex justify-between"><span>Subtotal</span><span>{selected.subtotal?.toFixed(2)} €</span></div>
                <div className="flex justify-between"><span>Envio</span><span>{selected.shipping_cost?.toFixed(2)} €</span></div>
                <div className="flex justify-between font-semibold text-base"><span>Total</span><span>{selected.total?.toFixed(2)} €</span></div>
              </div>
              {selected.notes && <div className="font-body text-sm"><span className="text-muted-foreground">Notas:</span><p>{selected.notes}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}