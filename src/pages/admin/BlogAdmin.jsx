import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, Pencil } from 'lucide-react';
import DeleteIcon from '@/components/ui/delete-icon';
import ImageWithFallback from '@/components/ui/image-with-fallback';
import ImageUpload from '@/components/uploads/ImageUpload';
import EmptyState from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';
import { useConfirm } from '@/components/ui/confirm-provider';

const emptyPost = { title: '', content: '', excerpt: '', image_url: '', category: 'novidades', status: 'draft' };

export default function BlogAdmin() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPost);

  const { data: posts = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-blog'],
    queryFn: () => base44.entities.BlogPost.list('-created_date', 100),
  });

  useEffect(() => {
    if (!isError) return;
    toast.error(getErrorMessage(error, 'Não foi possível carregar os artigos.'));
  }, [error, isError]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.BlogPost.create(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-blog'] });
      void queryClient.refetchQueries({ queryKey: ['admin-blog'] });
      setDialogOpen(false);
      toast.success('Artigo criado');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível criar o artigo.')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BlogPost.update(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-blog'] });
      void queryClient.refetchQueries({ queryKey: ['admin-blog'] });
      setDialogOpen(false);
      toast.success('Artigo atualizado');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível atualizar o artigo.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BlogPost.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-blog'] });
      void queryClient.refetchQueries({ queryKey: ['admin-blog'] });
      toast.success('Artigo removido');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível remover o artigo.')),
  });

  const openCreate = () => { setEditing(null); setForm(emptyPost); setDialogOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm(p); setDialogOpen(true); };

  const handleSubmit = () => {
    if (createMutation.isPending || updateMutation.isPending) return;
    if (!form.title) { toast.error('Título é obrigatório'); return; }
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="font-heading text-3xl w-full">Blog</h1>
        <Button onClick={openCreate} className="rounded-none font-body text-sm gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Novo Artigo
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-card p-6 rounded-lg border border-border text-center font-body text-sm text-muted-foreground">
            A carregar...
          </div>
        ) : null}

        {isError ? (
          <div className="bg-card p-6 rounded-lg border border-border text-center">
            <p className="font-body text-sm text-muted-foreground">Não foi possível carregar os artigos.</p>
            <Button variant="outline" className="rounded-none font-body text-sm mt-3" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : null}

        {posts.map(post => (
          <div key={post.id} className="bg-card p-4 rounded-lg border border-border flex items-center justify-between">
            <div className="flex items-center gap-4">
              {post.image_url && (
                <div className="w-16 h-10 rounded overflow-hidden">
                  <ImageWithFallback
                    src={post.image_url}
                    alt=""
                    className="w-full h-full object-cover"
                    iconClassName="w-6 h-6 text-muted-foreground/40"
                  />
                </div>
              )}
              <div>
                <p className="font-body text-sm font-medium">{post.title}</p>
                <div className="flex gap-2 mt-1">
                  <Badge variant="secondary" className="text-[10px]">{post.category}</Badge>
                  <Badge className={post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-secondary'} >{post.status === 'published' ? 'Publicado' : 'Rascunho'}</Badge>
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => openEdit(post)}><Pencil className="w-3.5 h-3.5" /></Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Remover artigo?',
                    description: 'Tem certeza que deseja remover este artigo?',
                    confirmText: 'Remover',
                    cancelText: 'Cancelar',
                    destructive: true,
                  });
                  if (!ok) return;
                  if (deleteMutation.isPending) return;
                  deleteMutation.mutate(post.id);
                }}
                title="Remover"
              >
                <DeleteIcon className="text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {!isLoading && !isError && posts.length === 0 && (
          <EmptyState icon={FileText} description="Sem artigos" className="py-10" />
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined} className="w-[calc(100vw-24px)] sm:w-full max-w-4xl h-[85vh] overflow-hidden rounded-2xl p-0">
          <div className="flex flex-col h-full">
            <div className="px-6 pt-6 pb-4">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl">{editing ? 'Editar Artigo' : 'Novo Artigo'}</DialogTitle>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="font-body text-xs">Título *</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="rounded-none mt-1"
                    />
                  </div>
                  <div>
                    <Label className="font-body text-xs">Excerto</Label>
                    <Input
                      value={form.excerpt}
                      onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                      className="rounded-none mt-1"
                    />
                  </div>
                  <div>
                    <Label className="font-body text-xs">Conteúdo (Markdown)</Label>
                    <Textarea
                      value={form.content}
                      onChange={(e) => setForm({ ...form, content: e.target.value })}
                      className="rounded-none mt-1 min-h-[320px]"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="font-body text-xs">Imagem do artigo</Label>
                    <Input
                      value={form.image_url}
                      onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                      className="rounded-none mt-1"
                      placeholder="Cole a URL da imagem (opcional)"
                    />
                    <div className="mt-3">
                      <ImageUpload
                        value={form.image_url}
                        onChange={(v) => setForm({ ...form, image_url: v })}
                        variant="compact"
                        label="Ou faça upload"
                        recommended="1200x630"
                        helper="JPG/PNG, ideal para capa/preview do artigo."
                        buttonLabel="Upload"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="font-body text-xs">Categoria</Label>
                      <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                        <SelectTrigger className="rounded-none mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tendencias">Tendências</SelectItem>
                          <SelectItem value="dicas">Dicas</SelectItem>
                          <SelectItem value="novidades">Novidades</SelectItem>
                          <SelectItem value="inspiracao">Inspiração</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="font-body text-xs">Estado</Label>
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                        <SelectTrigger className="rounded-none mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Rascunho</SelectItem>
                          <SelectItem value="published">Publicado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    onClick={handleSubmit}
                    className="w-full rounded-none font-body text-sm tracking-wider"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'A guardar...' : editing ? 'Guardar' : 'Criar Artigo'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
