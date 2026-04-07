import React, { useState } from 'react';
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
import { Plus, Pencil, Instagram } from 'lucide-react';
import ImageUpload from '@/components/uploads/ImageUpload';
import DeleteIcon from '@/components/ui/delete-icon';
import LoadMoreControls from '@/components/ui/load-more-controls';
import { useConfirm } from '@/components/ui/confirm-provider';

const emptyPost = { url: '', caption: '', cover_url: '', is_active: true };

export default function InstagramAdmin() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPost);
  const [limit, setLimit] = useState(50);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['admin-instagram', limit],
    queryFn: () => base44.entities.InstagramPost.list(limit),
  });

  const canLoadMore = !isLoading && Array.isArray(posts) && posts.length === limit && limit < 500;

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.InstagramPost.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-instagram'] });
      setDialogOpen(false);
      toast.success('Link adicionado');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível adicionar.')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.InstagramPost.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-instagram'] });
      setDialogOpen(false);
      toast.success('Link atualizado');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível atualizar.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.InstagramPost.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-instagram'] });
      toast.success('Removido');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível remover.')),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyPost);
    setDialogOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ url: p.url ?? '', caption: p.caption ?? '', cover_url: p.cover_url ?? '', is_active: p.is_active !== false });
    setDialogOpen(true);
  };

  const submit = () => {
    if (!form.url.trim()) {
      toast.error('URL é obrigatório');
      return;
    }
    const data = {
      url: form.url.trim(),
      caption: form.caption?.trim() || null,
      cover_url: form.cover_url?.trim() || null,
      is_active: !!form.is_active,
    };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="font-heading text-3xl w-full">Instagram (links)</h1>
        <Button onClick={openCreate} className="rounded-none font-body text-sm gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Adicionar
        </Button>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full min-w-max">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">URL</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Ativo</th>
              <th className="text-right p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Ações</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                <td className="p-3">
                  <a href={p.url} target="_blank" rel="noreferrer" className="font-body text-sm text-primary underline">
                    {p.url}
                  </a>
                  {p.caption ? <p className="font-body text-xs text-muted-foreground mt-1">{p.caption}</p> : null}
                </td>
                <td className="p-3 font-body text-xs">{p.is_active ? 'Sim' : 'Não'}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)} title="Editar">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Remover link?',
                        description: 'Tem certeza que deseja remover este link do Instagram?',
                        confirmText: 'Remover',
                        cancelText: 'Cancelar',
                        destructive: true,
                      });
                      if (!ok) return;
                      deleteMutation.mutate(p.id);
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
        {posts.length === 0 && (
          <div className="text-center py-10">
            <Instagram className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="font-body text-sm text-muted-foreground">Sem links</p>
          </div>
        )}
      </div>

      <LoadMoreControls
        leftText={`A mostrar ${Math.min(limit, Array.isArray(posts) ? posts.length : 0)} links.`}
        onLess={() => setLimit(50)}
        lessDisabled={isLoading || limit <= 50}
        onMore={() => setLimit((p) => Math.min(500, p + 50))}
        moreDisabled={!canLoadMore}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{editing ? 'Editar' : 'Adicionar'} link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <ImageUpload
              value={form.cover_url}
              label="Capa / Thumbnail"
              recommended="1080×1080 (post) ou 1080×1920 (reel)"
              onChange={(url) => setForm({ ...form, cover_url: url })}
            />
            <div>
              <Label className="font-body text-xs">URL</Label>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="rounded-none mt-1" />
            </div>
            <div>
              <Label className="font-body text-xs">Legenda (opcional)</Label>
              <Textarea value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} className="rounded-none mt-1 min-h-[120px]" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label className="font-body text-xs">Ativo</Label>
            </div>
            <Button onClick={submit} className="w-full rounded-none font-body text-sm tracking-wider">
              {editing ? 'Guardar' : 'Adicionar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
