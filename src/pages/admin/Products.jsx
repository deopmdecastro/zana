import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Code, Plus, Pencil, Search } from 'lucide-react';
import ImageWithFallback from '@/components/ui/image-with-fallback';
import { toast } from 'sonner';
import { getErrorMessage, toastApiPromise } from '@/lib/toast';
import { getPrimaryImage, normalizeImages } from '@/lib/images';
import ImageUpload from '@/components/uploads/ImageUpload';
import { entityCode } from '@/utils/entityCode';
import DeleteIcon from '@/components/ui/delete-icon';

const emptyProduct = {
  name: '', description: '', price: '', acquisition_cost: '', original_price: '', category: 'colares',
  material: 'dourado', colors: [], images: [], stock: 0, is_featured: false,
  videos: [], free_shipping: false, is_new: false, is_bestseller: false, status: 'active'
};

function safeJson(value) {
  if (value === null || value === undefined) return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

export default function AdminProducts() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false);
  const [jsonSaving, setJsonSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [search, setSearch] = useState('');
  const [imageInput, setImageInput] = useState('');
  const [videoInput, setVideoInput] = useState('');
  const [jsonText, setJsonText] = useState('');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => base44.entities.Product.list('-created_date', 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-products'] }); queryClient.invalidateQueries({ queryKey: ['products-catalog'] }); queryClient.invalidateQueries({ queryKey: ['product'] }); setDialogOpen(false); toast.success('Produto criado'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível criar o produto.')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-products'] }); queryClient.invalidateQueries({ queryKey: ['products-catalog'] }); queryClient.invalidateQueries({ queryKey: ['product'] }); setDialogOpen(false); toast.success('Produto atualizado'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível atualizar o produto.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-products'] }); queryClient.invalidateQueries({ queryKey: ['products-catalog'] }); queryClient.invalidateQueries({ queryKey: ['product'] }); toast.success('Produto removido'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível remover o produto.')),
  });

  const openCreate = () => { setEditing(null); setForm(emptyProduct); setImageInput(''); setVideoInput(''); setJsonText(''); setDialogOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      ...emptyProduct,
      ...p,
      price: p.price || '',
      acquisition_cost: p.acquisition_cost ?? '',
      original_price: p.original_price || '',
      stock: p.stock || 0,
      images: p.images ?? [],
      videos: p.videos ?? [],
    });
    setImageInput('');
    setVideoInput('');
    setJsonText('');
    setDialogOpen(true);
  };
  const openJson = () => { setJsonText(''); setJsonDialogOpen(true); };

  const normalizeVideos = (value) => (Array.isArray(value) ? value.map((v) => String(v ?? '').trim()).filter(Boolean) : []);

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
          const pick = (key, fallback) => (obj?.[key] === undefined ? fallback : obj[key]);
          const images = pick('images', pick('image_urls', pick('imageUrls', undefined)));
          const videos = pick('videos', pick('video_urls', pick('videoUrls', undefined)));
          const colors = pick('colors', undefined);

          const name = String(pick('name', '') ?? '').trim();
          if (!name) {
            if (!firstError) firstError = new Error('Nome é obrigatório.');
            failed += 1;
            continue;
          }

          const rawPrice = pick('price', pick('unit_price', ''));
          const rawOriginalPrice = pick('original_price', pick('originalPrice', ''));
          const rawStock = pick('stock', 0);

          const data = {
            ...emptyProduct,
            name,
            description: String(pick('description', emptyProduct.description) ?? ''),
            price: parseFloat(rawPrice) || 0,
            acquisition_cost: pick('acquisition_cost', pick('acquisitionCost', undefined)),
            original_price: rawOriginalPrice ? parseFloat(rawOriginalPrice) : undefined,
            category: String(pick('category', emptyProduct.category) ?? emptyProduct.category),
            material: String(pick('material', emptyProduct.material) ?? emptyProduct.material),
            colors: Array.isArray(colors) ? colors : emptyProduct.colors,
            images: Array.isArray(images) ? normalizeImages(images) : emptyProduct.images,
            videos: Array.isArray(videos) ? normalizeVideos(videos) : emptyProduct.videos,
            stock: parseInt(rawStock) || 0,
            free_shipping: Boolean(pick('free_shipping', pick('freeShipping', emptyProduct.free_shipping))),
            is_featured: Boolean(pick('is_featured', pick('isFeatured', emptyProduct.is_featured))),
            is_new: Boolean(pick('is_new', pick('isNew', emptyProduct.is_new))),
            is_bestseller: Boolean(pick('is_bestseller', pick('isBestseller', emptyProduct.is_bestseller))),
            status: String(pick('status', emptyProduct.status) ?? emptyProduct.status),
          };

          await base44.entities.Product.create(data);
          created += 1;
        } catch (err) {
          if (!firstError) firstError = err;
          failed += 1;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      setJsonSaving(false);

      if (created > 0) {
        setJsonDialogOpen(false);
        setJsonText('');
      }

      if (failed > 0) {
        const human = firstError ? getErrorMessage(firstError, 'Não foi possível criar o produto.') : 'Não foi possível criar o produto.';
        toast.error(`${human} (Criados: ${created} · Falhas: ${failed})`);
      } else if (objects.length === 1) {
        toast.success('Produto criado');
      } else {
        toast.success(`Criados: ${created}`);
      }
    })();
  };

  const handleSubmit = () => {
    const data = {
      ...form,
      images: normalizeImages(form.images),
      videos: normalizeVideos(form.videos),
      price: parseFloat(form.price) || 0,
      acquisition_cost:
        form.acquisition_cost === '' || form.acquisition_cost === null || form.acquisition_cost === undefined
          ? undefined
          : parseFloat(form.acquisition_cost) || 0,
      original_price: form.original_price ? parseFloat(form.original_price) : undefined,
      stock: parseInt(form.stock) || 0,
    };
    if (!data.name) { toast.error('Nome é obrigatório'); return; }
    if (editing) { updateMutation.mutate({ id: editing.id, data }); }
    else { createMutation.mutate(data); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await toastApiPromise(base44.integrations.Core.UploadFile({ file }), {
      loading: 'A enviar imagem...',
      success: 'Imagem adicionada.',
      error: 'Não foi possível enviar a imagem.',
    });
    const fileUrl = res?.file_url;
    if (fileUrl) setForm(prev => ({ ...prev, images: [...(prev.images || []), fileUrl] }));
  };

  const addImageUrl = () => {
    const value = imageInput.trim();
    if (value) {
      if (/^[a-zA-Z]:\\/.test(value) || value.startsWith('file:') || value.startsWith('\\\\')) {
        toast.error('Caminho local não funciona no browser. Use "Escolher ficheiro" para enviar a imagem.');
        return;
      }
      setForm(prev => ({ ...prev, images: [...(prev.images || []), value] }));
      setImageInput('');
    }
  };

  const addVideoUrl = () => {
    const value = videoInput.trim();
    if (value) {
      if (/^[a-zA-Z]:\\/.test(value) || value.startsWith('file:') || value.startsWith('\\\\')) {
        toast.error('Caminho local nÃ£o funciona no browser. Use uma URL.');
        return;
      }
      setForm((prev) => ({ ...prev, videos: [...(prev.videos || []), value] }));
      setVideoInput('');
    }
  };

  const filtered = products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl">Produtos</h1>
        <div className="flex items-center gap-2">
          <Button onClick={openCreate} className="rounded-none font-body text-sm gap-2"><Plus className="w-4 h-4" /> Novo Produto</Button>
          <Button onClick={openJson} variant="outline" className="rounded-none font-body text-sm gap-2"><Code className="w-4 h-4" /> JSON</Button>
        </div>
      </div>

      <div className="relative max-w-sm mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-none" />
      </div>

      {/* Products Table */}
      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Produto</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Categoria</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Preço</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Stock</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Estado</th>
              <th className="text-right p-3 font-body text-xs text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                <td className="p-3">
	                  <div className="flex items-center gap-3">
	                    <div className="w-10 h-10 rounded bg-secondary/30 overflow-hidden flex-shrink-0">
                        <ImageWithFallback
                          src={getPrimaryImage(p.images)}
                          alt={p.name || ''}
                          className="w-full h-full"
                          iconClassName="w-5 h-5 text-muted-foreground/30"
                        />
	                    </div>
	                    <div className="min-w-0">
	                      <div className="font-body text-sm font-medium truncate">{p.name}</div>
	                      <div className="font-body text-[11px] text-muted-foreground truncate" title={String(p.id)}>
	                        {entityCode({ entityType: 'Product', entityId: p.id, createdDate: p.created_date })}
	                      </div>
	                    </div>
	                  </div>
                </td>
                <td className="p-3 font-body text-xs capitalize">{p.category}</td>
                <td className="p-3 font-body text-sm">{p.price?.toFixed(2)} €</td>
                <td className="p-3 font-body text-sm">{p.stock || 0}</td>
                <td className="p-3"><Badge variant="secondary" className="text-[10px]">{p.status}</Badge></td>
                <td className="p-3 text-right">
	                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
	                  <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (!window.confirm('Tem certeza que deseja remover?')) return;
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
        {filtered.length === 0 && <p className="text-center py-8 font-body text-sm text-muted-foreground">Sem produtos</p>}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{editing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-body text-xs">Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-none mt-1" />
            </div>
            <div>
              <Label className="font-body text-xs">Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-none mt-1" rows={3} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="font-body text-xs">Preço (€) *</Label>
                <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="rounded-none mt-1" />
              </div>
              <div>
                <Label className="font-body text-xs">Preço de Aquisição (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.acquisition_cost}
                  onChange={(e) => setForm({ ...form, acquisition_cost: e.target.value })}
                  className="rounded-none mt-1"
                />
              </div>
              <div>
                <Label className="font-body text-xs">Preço Original (€)</Label>
                <Input type="number" step="0.01" value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} className="rounded-none mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-xs">Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="rounded-none mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="colares">Colares</SelectItem>
                    <SelectItem value="brincos">Brincos</SelectItem>
                    <SelectItem value="pulseiras">Pulseiras</SelectItem>
                    <SelectItem value="aneis">Anéis</SelectItem>
                    <SelectItem value="conjuntos">Conjuntos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-body text-xs">Material</Label>
                <Select value={form.material} onValueChange={(v) => setForm({ ...form, material: v })}>
                  <SelectTrigger className="rounded-none mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aco_inox">Aço Inox</SelectItem>
                    <SelectItem value="prata">Prata</SelectItem>
                    <SelectItem value="dourado">Dourado</SelectItem>
                    <SelectItem value="rose_gold">Rose Gold</SelectItem>
                    <SelectItem value="perolas">Pérolas</SelectItem>
                    <SelectItem value="cristais">Cristais</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="font-body text-xs">Stock</Label>
              <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="rounded-none mt-1" />
            </div>
	            <div>
	              <Label className="font-body text-xs">Imagens</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {form.images?.map((img, i) => (
                  <div key={i} className="relative w-16 h-16 rounded overflow-hidden">
                    <ImageWithFallback
                      src={img}
                      alt=""
                      className="w-full h-full object-cover"
                      iconClassName="w-6 h-6 text-muted-foreground/40"
                    />
                    <button onClick={() => setForm({ ...form, images: form.images.filter((_, j) => j !== i) })} className="absolute top-0 right-0 bg-destructive text-destructive-foreground w-4 h-4 text-[10px] flex items-center justify-center">×</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input placeholder="URL da imagem" value={imageInput} onChange={(e) => setImageInput(e.target.value)} className="rounded-none flex-1" />
                <Button type="button" variant="outline" onClick={addImageUrl} className="rounded-none">+</Button>
              </div>
              <div className="mt-3">
                <ImageUpload
                  value={null}
                  label="Upload (adiciona ao array)"
                  helper="Pode enviar várias imagens."
                  recommended="1000×1000"
                  onChange={(url) => {
                    if (!url) return;
                    setForm((prev) => ({ ...prev, images: [...(prev.images || []), url] }));
                  }}
                />
	              </div>
	            </div>
	            <div>
	              <Label className="font-body text-xs">Vídeos</Label>
	              <div className="space-y-1 mt-1">
	                {(form.videos || []).map((v, i) => (
	                  <div key={i} className="flex items-center gap-2">
	                    <a href={v} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-2 truncate flex-1" title={v}>
	                      {v}
	                    </a>
	                    <Button
	                      type="button"
	                      variant="destructive"
	                      size="sm"
	                      className="rounded-none h-7 px-2 text-xs"
	                      onClick={() => setForm({ ...form, videos: (form.videos || []).filter((_, j) => j !== i) })}
	                    >
	                      Remover
	                    </Button>
	                  </div>
	                ))}
	              </div>
	              <div className="flex gap-2 mt-2">
	                <Input placeholder="URL do vídeo (YouTube/MP4)" value={videoInput} onChange={(e) => setVideoInput(e.target.value)} className="rounded-none flex-1" />
	                <Button type="button" variant="outline" onClick={addVideoUrl} className="rounded-none">+</Button>
	              </div>
	            </div>
	            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.free_shipping} onCheckedChange={(v) => setForm({ ...form, free_shipping: v })} />
                <Label className="font-body text-xs">Entrega grátis</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} />
                <Label className="font-body text-xs">Destaque</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_new} onCheckedChange={(v) => setForm({ ...form, is_new: v })} />
                <Label className="font-body text-xs">Novidade</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_bestseller} onCheckedChange={(v) => setForm({ ...form, is_bestseller: v })} />
                <Label className="font-body text-xs">Bestseller</Label>
              </div>
            </div>
            <div>
              <Label className="font-body text-xs">Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="rounded-none mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="out_of_stock">Sem Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSubmit} className="w-full rounded-none font-body text-sm tracking-wider">
              {editing ? 'Guardar Alterações' : 'Criar Produto'}
            </Button>
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
            <DialogTitle className="font-heading text-xl">Importar produto (JSON)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="font-body text-xs">JSON</Label>
		              <Textarea
		                value={jsonText}
		                onChange={(e) => setJsonText(e.target.value)}
		                className="rounded-none mt-1 min-h-[160px] font-mono text-xs"
		                placeholder={'1 JSON, array ou 1 por linha.\nEx (1): {"name":"Produto X","price":12.5,"stock":10,"images":["https://..."]}\nEx (varios): {"name":"A","price":1}\n{"name":"B","price":2}\nEx (array): [{"name":"A","price":1},{"name":"B","price":2}]'}
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
