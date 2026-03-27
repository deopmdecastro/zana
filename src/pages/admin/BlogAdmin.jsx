import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const emptyPost = { title: '', content: '', excerpt: '', image_url: '', category: 'novidades', status: 'draft' };

export default function BlogAdmin() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPost);

  const { data: posts = [] } = useQuery({
    queryKey: ['admin-blog'],
    queryFn: () => base44.entities.BlogPost.list('-created_date', 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.BlogPost.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-blog'] }); setDialogOpen(false); toast.success('Artigo criado'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BlogPost.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-blog'] }); setDialogOpen(false); toast.success('Artigo atualizado'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BlogPost.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-blog'] }); toast.success('Artigo removido'); },
  });

  const openCreate = () => { setEditing(null); setForm(emptyPost); setDialogOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm(p); setDialogOpen(true); };

  const handleSubmit = () => {
    if (!form.title) { toast.error('Título é obrigatório'); return; }
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl">Blog</h1>
        <Button onClick={openCreate} className="rounded-none font-body text-sm gap-2"><Plus className="w-4 h-4" /> Novo Artigo</Button>
      </div>

      <div className="space-y-3">
        {posts.map(post => (
          <div key={post.id} className="bg-card p-4 rounded-lg border border-border flex items-center justify-between">
            <div className="flex items-center gap-4">
              {post.image_url && <div className="w-16 h-10 rounded overflow-hidden"><img src={post.image_url} alt="" className="w-full h-full object-cover" /></div>}
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
              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(post.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {posts.length === 0 && <p className="text-center py-8 font-body text-sm text-muted-foreground">Sem artigos</p>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{editing ? 'Editar Artigo' : 'Novo Artigo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label className="font-body text-xs">Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-none mt-1" /></div>
            <div><Label className="font-body text-xs">Excerto</Label><Input value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} className="rounded-none mt-1" /></div>
            <div><Label className="font-body text-xs">Conteúdo (Markdown)</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="rounded-none mt-1" rows={8} /></div>
            <div><Label className="font-body text-xs">URL da Imagem</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="rounded-none mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-xs">Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="rounded-none mt-1"><SelectValue /></SelectTrigger>
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
                  <SelectTrigger className="rounded-none mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleSubmit} className="w-full rounded-none font-body text-sm tracking-wider">
              {editing ? 'Guardar' : 'Criar Artigo'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}