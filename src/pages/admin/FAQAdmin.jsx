import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';
import { Plus, Pencil, Trash2, HelpCircle } from 'lucide-react';

const emptyItem = { question: '', answer: '', order: 0, is_active: true };

export default function FAQAdmin() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyItem);

  const { data: items = [] } = useQuery({
    queryKey: ['admin-faq'],
    queryFn: () => base44.entities.FaqItem.list(500),
  });

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [items]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.FaqItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-faq'] });
      setDialogOpen(false);
      toast.success('Pergunta criada');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível criar.')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FaqItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-faq'] });
      setDialogOpen(false);
      toast.success('Pergunta atualizada');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível atualizar.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FaqItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-faq'] });
      toast.success('Removida');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível remover.')),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyItem);
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      question: item.question ?? '',
      answer: item.answer ?? '',
      order: item.order ?? 0,
      is_active: item.is_active !== false,
    });
    setDialogOpen(true);
  };

  const submit = () => {
    if (!form.question.trim() || !form.answer.trim()) {
      toast.error('Preencha pergunta e resposta');
      return;
    }
    const data = { ...form, order: Number(form.order) || 0 };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="font-heading text-3xl">Perguntas & Respostas</h1>
        <Button onClick={openCreate} className="rounded-none font-body text-sm gap-2">
          <Plus className="w-4 h-4" /> Nova
        </Button>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Ordem</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Pergunta</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Ativo</th>
              <th className="text-right p-3 font-body text-xs text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                <td className="p-3 font-body text-xs text-muted-foreground">{item.order ?? 0}</td>
                <td className="p-3 font-body text-sm font-medium">{item.question}</td>
                <td className="p-3 font-body text-xs">{item.is_active ? 'Sim' : 'Não'}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Editar">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(item.id)}
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="text-center py-10">
            <HelpCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="font-body text-sm text-muted-foreground">Sem perguntas</p>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{editing ? 'Editar' : 'Nova'} pergunta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="font-body text-xs">Pergunta</Label>
              <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} className="rounded-none mt-1" />
            </div>
            <div>
              <Label className="font-body text-xs">Resposta</Label>
              <Textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} className="rounded-none mt-1 min-h-[140px]" />
            </div>
            <div className="grid grid-cols-2 gap-4 items-center">
              <div>
                <Label className="font-body text-xs">Ordem</Label>
                <Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} className="rounded-none mt-1" />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label className="font-body text-xs">Ativo</Label>
              </div>
            </div>
            <Button onClick={submit} className="w-full rounded-none font-body text-sm tracking-wider">
              {editing ? 'Guardar' : 'Criar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

