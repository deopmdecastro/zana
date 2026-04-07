import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { base44 } from '@/api/base44Client';
import EmptyState from '@/components/ui/empty-state';
import LoadMoreControls from '@/components/ui/load-more-controls';
import SearchableSelect from '@/components/ui/searchable-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/toast';

function moneyPt(value) {
  const n = Number(value ?? 0) || 0;
  return n.toFixed(2).replace('.', ',');
}

function formatDate(value) {
  try {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toLocaleDateString('pt-PT');
  } catch {
    return '';
  }
}

function toInputDate(value) {
  try {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

const DEFAULT_CATEGORIES = [
  'Patrocínio (Facebook)',
  'Publicidade',
  'Renda',
  'Domínio',
  'Servidor',
  'Transporte',
  'Outros',
];

export default function ExpensesAdmin() {
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(50);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['admin-expenses', limit],
    queryFn: () => base44.admin.expenses.list(limit).then((r) => (Array.isArray(r) ? r : [])),
  });

  const sorted = useMemo(() => {
    const list = Array.isArray(expenses) ? expenses : [];
    return list
      .slice()
      .sort((a, b) => new Date(b?.expense_date ?? 0).getTime() - new Date(a?.expense_date ?? 0).getTime());
  }, [expenses]);

  const canLoadMore = !isLoading && Array.isArray(expenses) && expenses.length === limit && limit < 500;

  const [form, setForm] = useState({
    expense_date: '',
    category: DEFAULT_CATEGORIES[0],
    vendor: '',
    description: '',
    amount: '',
    notes: '',
  });

  const categoryOptions = useMemo(() => {
    const seen = new Map();
    const add = (raw) => {
      const v = String(raw ?? '').trim();
      if (!v) return;
      const key = v.toLowerCase();
      if (seen.has(key)) return;
      seen.set(key, v);
    };

    DEFAULT_CATEGORIES.forEach(add);
    (expenses ?? []).forEach((e) => add(e?.category));
    add(form.category);

    return Array.from(seen.values()).map((c) => ({ value: c, label: c }));
  }, [expenses, form.category]);

  const resetForm = () =>
    setForm({
      expense_date: '',
      category: DEFAULT_CATEGORIES[0],
      vendor: '',
      description: '',
      amount: '',
      notes: '',
    });

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      expense_date: toInputDate(row?.expense_date),
      category: row?.category ?? DEFAULT_CATEGORIES[0],
      vendor: row?.vendor ?? '',
      description: row?.description ?? '',
      amount: row?.amount === null || row?.amount === undefined ? '' : String(row.amount),
      notes: row?.notes ?? '',
    });
    setOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (payload) => base44.admin.expenses.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-expenses'] });
      toast.success('Despesa criada');
      setOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível criar.')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }) => base44.admin.expenses.update(id, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-expenses'] });
      toast.success('Despesa atualizada');
      setOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível atualizar.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.admin.expenses.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-expenses'] });
      toast.success('Despesa removida');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível remover.')),
  });

  const submit = (e) => {
    e.preventDefault();

    const amountRaw = String(form.amount ?? '').trim();
    const amount = Number(amountRaw.replace(',', '.'));

    const payload = {
      expense_date: form.expense_date ? new Date(form.expense_date).toISOString() : undefined,
      category: String(form.category ?? '').trim(),
      vendor: String(form.vendor ?? '').trim() || null,
      description: String(form.description ?? '').trim() || null,
      amount: Number.isFinite(amount) ? amount : form.amount,
      notes: String(form.notes ?? '').trim() || null,
    };

    if (!payload.category) {
      toast.error('Categoria obrigatória');
      return;
    }

    if (!amountRaw) {
      toast.error('Valor obrigatório');
      return;
    }

    if (editing?.id) updateMutation.mutate({ id: editing.id, patch: payload });
    else createMutation.mutate(payload);
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <h1 className="font-heading text-3xl">Despesas</h1>
        <Button className="rounded-none font-body text-sm gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Nova despesa
        </Button>
      </div>

      <Card className="rounded-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Data</th>
                  <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Categoria</th>
                  <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Fornecedor</th>
                  <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Descrição</th>
                  <th className="text-right p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Valor</th>
                  <th className="text-right p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(isLoading ? [] : sorted).map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                    <td className="p-3 font-body text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(r.expense_date)}
                    </td>
                    <td className="p-3 font-body text-sm">{r.category ?? '—'}</td>
                    <td className="p-3 font-body text-sm text-muted-foreground">{r.vendor ?? '—'}</td>
                    <td className="p-3 font-body text-sm text-muted-foreground">{r.description ?? '—'}</td>
                    <td className="p-3 font-body text-sm text-right tabular-nums">
                      {moneyPt(r.amount)} €
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-none"
                        onClick={() => openEdit(r)}
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-none text-destructive"
                        onClick={() => deleteMutation.mutate(r.id)}
                        disabled={deleteMutation.isPending}
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isLoading && sorted.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Receipt} description="Sem despesas registadas." className="py-8" />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <LoadMoreControls
        leftText={`A mostrar as últimas ${Math.min(limit, Array.isArray(expenses) ? expenses.length : 0)} despesas.`}
        onLess={() => setLimit(50)}
        lessDisabled={isLoading || limit <= 50}
        onMore={() => setLimit((p) => Math.min(500, p + 50))}
        moreDisabled={!canLoadMore}
      />

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setEditing(null);
        }}
      >
        <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{editing ? 'Editar despesa' : 'Nova despesa'}</DialogTitle>
          </DialogHeader>

          <form className="space-y-5" onSubmit={submit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="font-body text-sm">Data</Label>
                <Input
                  type="date"
                  className="rounded-none mt-1"
                  value={form.expense_date}
                  onChange={(e) => setForm((p) => ({ ...p, expense_date: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Label className="font-body text-sm">Categoria *</Label>
                <div className="mt-1">
                  <SearchableSelect
                    value={form.category}
                    onChange={(v) => setForm((p) => ({ ...p, category: String(v ?? '') }))}
                    options={categoryOptions}
                    placeholder="Selecionar categoria…"
                    searchPlaceholder="Pesquisar ou criar categoria…"
                    creatable
                    createLabel="Criar categoria"
                    onCreate={(label) => String(label ?? '').trim()}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="font-body text-sm">Fornecedor</Label>
                <Input
                  className="rounded-none mt-1"
                  value={form.vendor}
                  onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))}
                  placeholder="Ex: Facebook"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="font-body text-sm">Descrição</Label>
                <Input
                  className="rounded-none mt-1"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Ex: campanha abril"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="font-body text-sm">Valor (€) *</Label>
                <Input
                  className="rounded-none mt-1"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="Ex: 35,50"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="font-body text-sm">Notas</Label>
                <Textarea
                  className="rounded-none mt-1 min-h-[110px]"
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="(opcional)"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-none font-body text-sm"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="rounded-none font-body text-sm"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editing ? 'Guardar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
