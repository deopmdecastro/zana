import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';
import { Code, Eye, Plus, Pencil, Truck } from 'lucide-react';
import DeleteIcon from '@/components/ui/delete-icon';
import LoadMoreControls from '@/components/ui/load-more-controls';
import EmptyState from '@/components/ui/empty-state';

const emptySupplier = { name: '', email: '', phone: '', link: '', address: '', notes: '' };

function safeJson(value) {
  if (value === null || value === undefined) return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

export default function AdminSuppliers() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false);
  const [jsonSaving, setJsonSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState(emptySupplier);
  const [jsonText, setJsonText] = useState('');
  const [limit, setLimit] = useState(50);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['admin-suppliers', limit],
    queryFn: () => base44.entities.Supplier.list('-created_date', limit),
  });

  const canLoadMore = !isLoading && Array.isArray(suppliers) && suppliers.length === limit && limit < 500;

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Supplier.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-suppliers'] });
      setDialogOpen(false);
      toast.success('Fornecedor criado');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível criar.')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Supplier.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-suppliers'] });
      setDialogOpen(false);
      toast.success('Fornecedor atualizado');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível atualizar.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Supplier.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-suppliers'] });
      toast.success('Fornecedor removido');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível remover.')),
  });

  const openCreate = () => {
    setEditing(null);
    setViewing(null);
    setForm(emptySupplier);
    setJsonText('');
    setDialogOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setViewing(null);
    setForm({
      name: s.name ?? '',
      email: s.email ?? '',
      phone: s.phone ?? '',
      link: s.link ?? '',
      address: s.address ?? '',
      notes: s.notes ?? '',
    });
    setJsonText('');
    setDialogOpen(true);
  };

  const openView = (s) => {
    setViewing(s);
    setEditing(null);
    setForm({
      name: s.name ?? '',
      email: s.email ?? '',
      phone: s.phone ?? '',
      link: s.link ?? '',
      address: s.address ?? '',
      notes: s.notes ?? '',
    });
    setJsonText('');
    setDialogOpen(true);
  };

  const openJson = () => {
    setJsonText('');
    setJsonDialogOpen(true);
  };

  const submit = () => {
    if (!form.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
	    const data = {
	      name: form.name.trim(),
	      email: form.email?.trim() || null,
	      phone: form.phone?.trim() || null,
	      link: form.link?.trim() || null,
	      address: form.address?.trim() || null,
	      notes: form.notes?.trim() || null,
	    };
	    if (editing) updateMutation.mutate({ id: editing.id, data });
	    else createMutation.mutate(data);
	  };

  const applyJson = () => {
    if (jsonSaving) return;

    const trimmed = String(jsonText ?? '').trim();
    if (!trimmed) return;

    const parsed = safeJson(trimmed);
    let objects = [];

    if (Array.isArray(parsed)) objects = parsed;
    else if (parsed && typeof parsed === 'object') objects = [parsed];
    else {
      const lines = trimmed
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !/^-+$/.test(l));

      objects = lines.map((line) => safeJson(line)).filter(Boolean);
      if (objects.length !== lines.length) {
        toast.error('JSON inválido');
        return;
      }
    }

    if (objects.length === 0) {
      toast.error('JSON inválido');
      return;
    }

    (async () => {
      setJsonSaving(true);
      let created = 0;
      let failed = 0;
      let firstError = null;

      for (const obj of objects) {
        try {
          const link = obj.link ?? obj.url ?? obj.website ?? obj.site ?? '';
          const data = {
            name: String(obj.name ?? '').trim(),
            email: String(obj.email ?? '').trim() || null,
            phone: String(obj.phone ?? '').trim() || null,
            link: String(link ?? '').trim() || null,
            address: String(obj.address ?? '').trim() || null,
            notes: String(obj.notes ?? '').trim() || null,
          };

          if (!data.name) {
            if (!firstError) firstError = new Error('Nome é obrigatório.');
            failed += 1;
            continue;
          }

          await base44.entities.Supplier.create(data);
          created += 1;
        } catch (err) {
          if (!firstError) firstError = err;
          failed += 1;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['admin-suppliers'] });
      setJsonSaving(false);

      if (created > 0) {
        setJsonDialogOpen(false);
        setJsonText('');
      }

      if (failed > 0) {
        const human = firstError ? getErrorMessage(firstError, 'Não foi possível criar.') : 'Não foi possível criar.';
        toast.error(`${human} (Criados: ${created} · Falhas: ${failed})`);
      } else if (objects.length === 1) {
        toast.success('Fornecedor criado');
      } else {
        toast.success(`Criados: ${created}`);
      }
    })();
  };

  const isView = Boolean(viewing);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
        <h1 className="font-heading text-3xl">Fornecedores</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto sm:justify-end">
          <Button onClick={openCreate} className="rounded-none font-body text-sm gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4" /> Novo
          </Button>
          <Button onClick={openJson} variant="outline" className="rounded-none font-body text-sm gap-2 w-full sm:w-auto">
            <Code className="w-4 h-4" /> JSON
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Nome</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Contacto</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Link</th>
              <th className="text-right p-3 font-body text-xs text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                <td className="p-3">
                  <p className="font-body text-sm font-medium">{s.name}</p>
                  {s.address ? <p className="font-body text-xs text-muted-foreground mt-1">{s.address}</p> : null}
                </td>
		                <td className="p-3 font-body text-sm text-muted-foreground">
		                  {s.email || s.phone ? (
		                    <div className="space-y-1">
		                      {s.email ? <div>{s.email}</div> : null}
		                      {s.phone ? <div>{s.phone}</div> : null}
		                    </div>
		                  ) : (
		                    '-'
		                  )}
		                </td>
		                <td className="p-3 font-body text-sm text-muted-foreground max-w-[320px]">
		                  {s.link ? (
		                    <a
		                      href={s.link}
		                      target="_blank"
		                      rel="noreferrer"
		                      className="underline underline-offset-2 truncate block"
		                      title={s.link}
		                    >
		                      {s.link}
		                    </a>
		                  ) : (
		                    '-'
		                  )}
		                </td>
	                <td className="p-3 text-right whitespace-nowrap">
	                  <Button variant="ghost" size="icon" onClick={() => openView(s)} title="Ver">
	                    <Eye className="w-4 h-4" />
	                  </Button>
		                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)} title="Editar">
		                    <Pencil className="w-4 h-4" />
		                  </Button>
		                  <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (!window.confirm('Tem certeza que deseja remover?')) return;
                          deleteMutation.mutate(s.id);
                        }}
                        title="Remover"
                      >
		                    <DeleteIcon className="text-destructive" />
		                  </Button>
		                </td>
	              </tr>
	            ))}
          </tbody>
        </table>
        {isLoading && (Array.isArray(suppliers) ? suppliers.length : 0) === 0 ? (
          <EmptyState icon={Truck} description="A carregar..." />
        ) : suppliers.length === 0 ? (
          <EmptyState icon={Truck} description="Sem fornecedores" />
        ) : null}
      </div>

      <LoadMoreControls
        leftText={`A mostrar ${Array.isArray(suppliers) ? suppliers.length : 0} fornecedores.`}
        onLess={() => setLimit(50)}
        lessDisabled={isLoading || limit <= 50}
        onMore={() => setLimit((p) => Math.min(500, p + 50))}
        moreDisabled={!canLoadMore}
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            setViewing(null);
            setJsonText('');
          }
        }}
      >
	        <DialogContent className="max-w-lg">
	          <DialogHeader>
	            <DialogTitle className="font-heading text-xl">
	              {viewing ? 'Fornecedor' : editing ? 'Editar' : 'Novo'} fornecedor
	            </DialogTitle>
	          </DialogHeader>
	          <div className="space-y-3">
	            <div>
	              <Label className="font-body text-xs">Nome *</Label>
	              <Input
	                value={form.name}
	                onChange={(e) => setForm({ ...form, name: e.target.value })}
	                className="rounded-none mt-1"
	                disabled={isView}
	              />
	            </div>
	            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
	              <div>
	                <Label className="font-body text-xs">Email</Label>
	                <Input
	                  value={form.email}
	                  onChange={(e) => setForm({ ...form, email: e.target.value })}
	                  className="rounded-none mt-1"
	                  disabled={isView}
	                />
	              </div>
	              <div>
	                <Label className="font-body text-xs">Telefone</Label>
	                <Input
	                  value={form.phone}
	                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
	                  className="rounded-none mt-1"
	                  disabled={isView}
	                />
	              </div>
	            </div>
	            <div>
	              <Label className="font-body text-xs">Link</Label>
	              <Input
	                value={form.link}
	                onChange={(e) => setForm({ ...form, link: e.target.value })}
	                className="rounded-none mt-1"
	                disabled={isView}
	              />
	              {isView && form.link ? (
	                <a href={form.link} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-2 mt-2 inline-block">
	                  Abrir link
	                </a>
	              ) : null}
	            </div>
	            <div>
	              <Label className="font-body text-xs">Morada</Label>
	              <Input
	                value={form.address}
	                onChange={(e) => setForm({ ...form, address: e.target.value })}
	                className="rounded-none mt-1"
	                disabled={isView}
	              />
	            </div>
	            <div>
	              <Label className="font-body text-xs">Notas</Label>
	              <Textarea
	                value={form.notes}
	                onChange={(e) => setForm({ ...form, notes: e.target.value })}
	                className="rounded-none mt-1 min-h-[120px]"
	                disabled={isView}
	              />
	            </div>
	            {isView ? (
	              <Button
	                variant="outline"
	                className="w-full rounded-none font-body text-sm tracking-wider"
	                onClick={() => openEdit(viewing)}
	              >
	                Editar
	              </Button>
	            ) : (
	              <Button onClick={submit} className="w-full rounded-none font-body text-sm tracking-wider">
	                {editing ? 'Guardar' : 'Criar'}
	              </Button>
	            )}
	          </div>
	        </DialogContent>
	      </Dialog>

      <Dialog
        open={jsonDialogOpen}
        onOpenChange={(open) => {
          setJsonDialogOpen(open);
          if (!open) setJsonText('');
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Importar fornecedor (JSON)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="font-body text-xs">JSON</Label>
	                <Textarea
	                  value={jsonText}
	                  onChange={(e) => setJsonText(e.target.value)}
	                  className="rounded-none mt-1 min-h-[160px] font-mono text-xs"
	                placeholder={'1 JSON, array ou 1 por linha.\nEx (1): {"name":"Fornecedor X","email":"x@ex.com","link":"https://..."}\nEx (varios): {"name":"A"}\n{"name":"B"}\nEx (array): [{"name":"A"},{"name":"B"}]'}
	                />
	              </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" className="rounded-none font-body text-sm" onClick={() => setJsonDialogOpen(false)}>
                Cancelar
              </Button>
              <Button className="rounded-none font-body text-sm" onClick={applyJson} disabled={!jsonText.trim() || jsonSaving}>
                {jsonSaving ? 'A criar...' : 'Aplicar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
