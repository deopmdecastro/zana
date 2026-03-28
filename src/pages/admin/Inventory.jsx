import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';
import { PackageSearch } from 'lucide-react';

export default function AdminInventory() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['admin-inventory'],
    queryFn: () => base44.admin.inventory.list(500),
  });

  const adjustMutation = useMutation({
    mutationFn: (data) => base44.admin.inventory.adjust(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      toast.success('Stock atualizado');
      setSelected(null);
      setDelta(0);
      setReason('');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível ajustar o stock.')),
  });

  const lowStock = useMemo(() => products.filter((p) => (p.stock ?? 0) <= 2), [products]);

  const openAdjust = (p) => {
    setSelected(p);
    setDelta(0);
    setReason('');
  };

  const submit = () => {
    if (!selected) return;
    const d = Number(delta) || 0;
    if (d === 0) {
      toast.error('Delta inválido');
      return;
    }
    adjustMutation.mutate({ product_id: selected.id, delta: d, reason: reason?.trim() || null });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="font-heading text-3xl">Inventário</h1>
        <div className="font-body text-xs text-muted-foreground">
          Baixo stock: <span className="font-semibold text-foreground">{lowStock.length}</span>
        </div>
      </div>

      {isLoading ? (
        <p className="font-body text-sm text-muted-foreground">A carregar...</p>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left p-3 font-body text-xs text-muted-foreground">Produto</th>
                <th className="text-left p-3 font-body text-xs text-muted-foreground">Stock</th>
                <th className="text-left p-3 font-body text-xs text-muted-foreground">Último movimento</th>
                <th className="text-right p-3 font-body text-xs text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                  <td className="p-3 font-body text-sm font-medium">{p.name}</td>
                  <td className="p-3 font-body text-sm">
                    <Badge className={`${(p.stock ?? 0) <= 2 ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-foreground'} text-[10px]`}>
                      {p.stock ?? 0}
                    </Badge>
                  </td>
                  <td className="p-3 font-body text-xs text-muted-foreground">
                    {p.last_movement
                      ? `${p.last_movement.type} ${p.last_movement.delta > 0 ? '+' : ''}${p.last_movement.delta} (${new Date(p.last_movement.created_date).toLocaleDateString('pt-PT')})`
                      : '-'}
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="outline" onClick={() => openAdjust(p)} className="rounded-none font-body text-xs">
                      Ajustar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && (
            <div className="text-center py-10">
              <PackageSearch className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="font-body text-sm text-muted-foreground">Sem produtos</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Ajustar stock</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="font-body text-sm">
                <div className="font-medium">{selected.name}</div>
                <div className="text-xs text-muted-foreground">Stock atual: {selected.stock ?? 0}</div>
              </div>
              <div>
                <Label className="font-body text-xs">Delta (ex: 5 ou -2)</Label>
                <Input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} className="rounded-none mt-1" />
              </div>
              <div>
                <Label className="font-body text-xs">Motivo (opcional)</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-none mt-1" />
              </div>
              <Button onClick={submit} className="w-full rounded-none font-body text-sm tracking-wider">
                Guardar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
