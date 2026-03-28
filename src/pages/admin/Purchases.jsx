import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';
import { Plus, Pencil, CheckCircle } from 'lucide-react';

const statusColors = {
  draft: 'bg-secondary text-foreground',
  received: 'bg-green-100 text-green-800',
  cancelled: 'bg-destructive/10 text-destructive',
};

const emptyPurchase = {
  supplier_id: null,
  reference: '',
  status: 'draft',
  purchased_at: new Date().toISOString(),
  notes: '',
  items: [{ product_id: null, product_name: '', unit_cost: '', quantity: 1 }],
};

export default function AdminPurchases() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPurchase);

  const { data: purchases = [] } = useQuery({
    queryKey: ['admin-purchases'],
    queryFn: () => base44.entities.Purchase.list('-purchased_at', 200),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['admin-suppliers'],
    queryFn: () => base44.entities.Supplier.list('-created_date', 500),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => base44.entities.Product.list('-created_date', 500),
  });

  const productOptions = useMemo(() => {
    return [...products].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }, [products]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Purchase.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      setDialogOpen(false);
      toast.success('Compra criada');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível criar a compra.')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Purchase.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      setDialogOpen(false);
      toast.success('Compra atualizada');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível atualizar a compra.')),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyPurchase, purchased_at: new Date().toISOString() });
    setDialogOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      supplier_id: p.supplier_id ?? null,
      reference: p.reference ?? '',
      status: p.status ?? 'draft',
      purchased_at: new Date(p.purchased_at ?? new Date()).toISOString(),
      notes: p.notes ?? '',
      items: (p.items ?? []).map((it) => ({
        product_id: it.product_id ?? null,
        product_name: it.product_name ?? '',
        unit_cost: String(it.unit_cost ?? ''),
        quantity: it.quantity ?? 1,
      })),
    });
    setDialogOpen(true);
  };

  const updateItem = (idx, patch) => {
    setForm((p) => ({
      ...p,
      items: p.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  };

  const addItem = () => {
    setForm((p) => ({
      ...p,
      items: [...p.items, { product_id: null, product_name: '', unit_cost: '', quantity: 1 }],
    }));
  };

  const removeItem = (idx) => {
    setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  };

  const total = useMemo(() => {
    return (form.items ?? []).reduce((sum, it) => sum + (Number(it.unit_cost) || 0) * (Number(it.quantity) || 0), 0);
  }, [form.items]);

  const submit = () => {
    if (!form.items?.length) {
      toast.error('Adicione pelo menos 1 item');
      return;
    }

    const items = form.items
      .map((it) => ({
        product_id: it.product_id || null,
        product_name: String(it.product_name ?? '').trim(),
        unit_cost: Number(it.unit_cost) || 0,
        quantity: Number(it.quantity) || 0,
      }))
      .filter((it) => it.product_name && it.quantity > 0);

    if (items.length === 0) {
      toast.error('Itens inválidos');
      return;
    }

    const payload = {
      supplier_id: form.supplier_id || null,
      reference: form.reference?.trim() || null,
      status: form.status,
      purchased_at: form.purchased_at,
      notes: form.notes?.trim() || null,
      items,
    };

    if (editing) updateMutation.mutate({ id: editing.id, data: payload });
    else createMutation.mutate(payload);
  };

  const markReceived = () => {
    if (!editing) return;
    updateMutation.mutate({ id: editing.id, data: { status: 'received' } });
  };

  const isLocked = editing?.status === 'received';

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="font-heading text-3xl">Compras</h1>
        <Button onClick={openCreate} className="rounded-none font-body text-sm gap-2">
          <Plus className="w-4 h-4" /> Nova
        </Button>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Data</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Fornecedor</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Status</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Total</th>
              <th className="text-right p-3 font-body text-xs text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                <td className="p-3 font-body text-xs text-muted-foreground">{new Date(p.purchased_at).toLocaleDateString('pt-PT')}</td>
                <td className="p-3 font-body text-sm">
                  <div className="font-medium">{p.supplier?.name ?? '-'}</div>
                  {p.reference ? <div className="text-xs text-muted-foreground">{p.reference}</div> : null}
                </td>
                <td className="p-3">
                  <Badge className={`${statusColors[p.status] ?? 'bg-secondary text-foreground'} text-[10px]`}>{p.status}</Badge>
                </td>
                <td className="p-3 font-body text-sm font-semibold">{(p.total ?? 0).toFixed(2)} €</td>
                <td className="p-3 text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)} title="Editar">
                    <Pencil className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {purchases.length === 0 && <p className="text-center py-8 font-body text-sm text-muted-foreground">Sem compras</p>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{editing ? 'Editar' : 'Nova'} compra</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="font-body text-xs">Fornecedor</Label>
                <Select
                  value={form.supplier_id ?? 'none'}
                  onValueChange={(v) => setForm((p) => ({ ...p, supplier_id: v === 'none' ? null : v }))}
                  disabled={isLocked}
                >
                  <SelectTrigger className="rounded-none mt-1">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-body text-xs">Referência</Label>
                <Input value={form.reference} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} className="rounded-none mt-1" disabled={isLocked} />
              </div>
              <div>
                <Label className="font-body text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))} disabled={isLocked}>
                  <SelectTrigger className="rounded-none mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">draft</SelectItem>
                    <SelectItem value="received">received</SelectItem>
                    <SelectItem value="cancelled">cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="font-body text-xs">Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="rounded-none mt-1 min-h-[90px]" disabled={isLocked} />
            </div>

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h3 className="font-heading text-lg">Itens</h3>
              {!isLocked && (
                <Button type="button" variant="outline" onClick={addItem} className="rounded-none font-body text-sm">
                  + Item
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {(form.items ?? []).map((it, idx) => (
                <div key={idx} className="border border-border rounded-md p-4 bg-secondary/20">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div className="md:col-span-2">
                      <Label className="font-body text-xs">Produto (opcional)</Label>
                      <Select
                        value={it.product_id ?? 'none'}
                        onValueChange={(v) => {
                          const productId = v === 'none' ? null : v;
                          const product = productOptions.find((p) => p.id === productId) ?? null;
                          updateItem(idx, {
                            product_id: productId,
                            product_name: product?.name ?? it.product_name,
                          });
                        }}
                        disabled={isLocked}
                      >
                        <SelectTrigger className="rounded-none mt-1">
                          <SelectValue placeholder="-" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-</SelectItem>
                          {productOptions.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="font-body text-xs">Nome do item</Label>
                      <Input
                        value={it.product_name}
                        onChange={(e) => updateItem(idx, { product_name: e.target.value })}
                        className="rounded-none mt-1"
                        disabled={isLocked}
                      />
                    </div>
                    <div>
                      <Label className="font-body text-xs">Custo</Label>
                      <Input type="number" value={it.unit_cost} onChange={(e) => updateItem(idx, { unit_cost: e.target.value })} className="rounded-none mt-1" disabled={isLocked} />
                    </div>
                    <div>
                      <Label className="font-body text-xs">Qtd</Label>
                      <Input type="number" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: e.target.value })} className="rounded-none mt-1" disabled={isLocked} />
                    </div>
                  </div>
                  {!isLocked && (
                    <div className="mt-3 flex justify-end">
                      <Button type="button" variant="destructive" onClick={() => removeItem(idx)} className="rounded-none font-body text-sm">
                        Remover
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="font-body text-sm text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{total.toFixed(2)} €</span>
              </div>
              {editing && editing.status !== 'received' ? (
                <Button type="button" variant="outline" onClick={markReceived} className="rounded-none font-body text-sm gap-2">
                  <CheckCircle className="w-4 h-4" /> Marcar como received
                </Button>
              ) : null}
            </div>

            <Button onClick={submit} className="w-full rounded-none font-body text-sm tracking-wider" disabled={isLocked && !editing}>
              {editing ? 'Guardar' : 'Criar'}
            </Button>

            {isLocked ? (
              <p className="font-body text-xs text-muted-foreground">
                Compra recebida: itens bloqueados para evitar inconsistências de stock.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
