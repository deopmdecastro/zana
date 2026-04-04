import React, { useMemo, useState } from 'react';
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
import { Code, Plus, Pencil, Search, Package } from 'lucide-react';
import ImageWithFallback from '@/components/ui/image-with-fallback';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';
import { getPrimaryImage, normalizeImages } from '@/lib/images';
import ImageUpload from '@/components/uploads/ImageUpload';
import { getProductStatusLabel, productStatusBadgeClassName } from '@/lib/productBadges';
import { cn } from '@/lib/utils';
import { entityCode } from '@/utils/entityCode';
import DeleteIcon from '@/components/ui/delete-icon';
import SearchableSelect from '@/components/ui/searchable-select';
import LoadMoreControls from '@/components/ui/load-more-controls';
import EmptyState from '@/components/ui/empty-state';

const emptyProduct = {
  name: '', description: '', price: '', acquisition_cost: '', original_price: '', category: 'colares',
  material: 'dourado', colors: [], sizes: [], images: [], stock: 0, is_featured: false,
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
  const [nameChoice, setNameChoice] = useState('');
  const [search, setSearch] = useState('');
  const [imageInput, setImageInput] = useState('');
  const [videoInput, setVideoInput] = useState('');
  const [colorInput, setColorInput] = useState('');
  const [sizeInput, setSizeInput] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [limit, setLimit] = useState(50);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['admin-products', limit],
    queryFn: () => base44.entities.Product.list('-created_date', limit),
  });

  const { data: adminLogs = [] } = useQuery({
    queryKey: ['admin-logs-products-flags'],
    queryFn: () => base44.admin.logs.list(500),
  });

  const { data: productOptionsRes } = useQuery({
    queryKey: ['product-options'],
    queryFn: () => base44.content.productOptions(),
  });

  const productOptions = useMemo(() => {
    const content = productOptionsRes?.content && typeof productOptionsRes.content === 'object' ? productOptionsRes.content : {};
    const categories = Array.isArray(content.categories) ? content.categories : [];
    const materials = Array.isArray(content.materials) ? content.materials : [];
    const colors = Array.isArray(content.colors) ? content.colors : [];
    const sizes = Array.isArray(content.sizes) ? content.sizes : [];

    const categoryLabel = new Map();
    const materialLabel = new Map();
    const enabledCategories = [];
    const enabledMaterials = [];

    for (const c of categories) {
      const value = String(c?.value ?? '').trim();
      if (!value) continue;
      const label = String(c?.label ?? value).trim() || value;
      categoryLabel.set(value, label);
      if (c?.enabled !== false) enabledCategories.push({ value, label });
    }

    for (const m of materials) {
      const value = String(m?.value ?? '').trim();
      if (!value) continue;
      const label = String(m?.label ?? value).trim() || value;
      materialLabel.set(value, label);
      if (m?.enabled !== false) enabledMaterials.push({ value, label });
    }

    return {
      categoryLabel,
      materialLabel,
      categories: enabledCategories.length
        ? enabledCategories
        : [
            { value: 'colares', label: 'Colares' },
            { value: 'brincos', label: 'Brincos' },
            { value: 'pulseiras', label: 'Pulseiras' },
            { value: 'aneis', label: 'Anéis' },
            { value: 'conjuntos', label: 'Conjuntos' },
          ],
      materials: enabledMaterials.length
        ? enabledMaterials
        : [
            { value: 'aco_inox', label: 'Aço Inox' },
            { value: 'prata', label: 'Prata' },
            { value: 'dourado', label: 'Dourado' },
            { value: 'rose_gold', label: 'Rose Gold' },
            { value: 'perolas', label: 'Pérolas' },
            { value: 'cristais', label: 'Cristais' },
          ],
      colors: colors.map((c) => String(c ?? '').trim()).filter(Boolean),
      sizes: sizes.map((s) => String(s ?? '').trim()).filter(Boolean),
    };
  }, [productOptionsRes]);

  const categorySelectOptions = useMemo(() => {
    const opts = Array.isArray(productOptions?.categories) ? productOptions.categories : [];
    const current = String(form?.category ?? '').trim();
    if (!current) return opts;
    if (opts.some((o) => String(o?.value) === current)) return opts;
    const label = productOptions?.categoryLabel?.get(current) ?? `${current} (inativa)`;
    return [{ value: current, label }, ...opts];
  }, [form?.category, productOptions]);

  const materialSelectOptions = useMemo(() => {
    const opts = Array.isArray(productOptions?.materials) ? productOptions.materials : [];
    const current = String(form?.material ?? '').trim();
    if (!current || current === '__none__') return opts;
    if (opts.some((o) => String(o?.value) === current)) return opts;
    const label = productOptions?.materialLabel?.get(current) ?? `${current} (inativo)`;
    return [{ value: current, label }, ...opts];
  }, [form?.material, productOptions]);

  const purchaseAdjustmentByProductId = useMemo(() => {
    const map = new Map();
    for (const l of adminLogs ?? []) {
      if (l?.entity_type !== 'Purchase') continue;
      if (l?.action !== 'return' && l?.action !== 'writeoff') continue;
      const items = Array.isArray(l?.meta?.items) ? l.meta.items : [];
      for (const it of items) {
        const productId = it?.product_id ? String(it.product_id) : '';
        if (!productId) continue;
        const qty = Number(it?.quantity ?? 0) || 0;
        const existing = map.get(productId) ?? { returned: 0, writeoff: 0 };
        if (l.action === 'return') existing.returned += qty;
        else existing.writeoff += qty;
        map.set(productId, existing);
      }
    }
    return map;
  }, [adminLogs]);

  const { data: purchases = [] } = useQuery({
    queryKey: ['admin-purchases'],
    queryFn: () => base44.entities.Purchase.list('-purchased_at', 500),
  });

  const purchaseSuggestionByName = useMemo(() => {
    const map = new Map();
    for (const p of purchases ?? []) {
      const purchaseKind = String(p?.kind ?? '').trim();
      if (purchaseKind === 'logistics') continue;
      const items = Array.isArray(p?.items) ? p.items : [];
      for (const it of items) {
        const hasLinkedProduct = Boolean(it?.product_id ?? it?.productId);
        if (purchaseKind === 'mixed' && !hasLinkedProduct) continue;
        const name = String(it?.product_name ?? it?.productName ?? '').trim();
        if (!name) continue;

        const unitCost = Number(it?.unit_cost ?? it?.unitCost ?? it?.cost ?? 0) || 0;
        const image = String(it?.product_image ?? it?.productImage ?? it?.image ?? '').trim();

        const existing = map.get(name) ?? { unitCost: 0, image: '', receivedQtyUnlinked: 0 };
        if (!existing.unitCost && unitCost) existing.unitCost = unitCost;
        if (!existing.image && image) existing.image = image;

        const qty = Number(it?.quantity ?? 0) || 0;
        const isReceived = String(p?.status ?? '') === 'received';
        const isUnlinked = !it?.product_id && !it?.productId;
        if (isReceived && isUnlinked && qty > 0) existing.receivedQtyUnlinked += qty;

        map.set(name, existing);
      }
    }
    return map;
  }, [purchases]);

  const purchaseSuggestion = useMemo(() => {
    if (editing) return null;
    const key = String(form?.name ?? '').trim();
    if (!key) return null;
    return purchaseSuggestionByName.get(key) ?? null;
  }, [editing, form?.name, purchaseSuggestionByName]);

  const isPurchaseInherited = Boolean(purchaseSuggestion) && nameChoice !== '__manual__' && !editing;

  const purchasedProductNameOptions = useMemo(() => {
    const set = new Set();
    for (const p of purchases ?? []) {
      const purchaseKind = String(p?.kind ?? '').trim();
      if (purchaseKind === 'logistics') continue;
      for (const it of p?.items ?? []) {
        const hasLinkedProduct = Boolean(it?.product_id ?? it?.productId);
        if (purchaseKind === 'mixed' && !hasLinkedProduct) continue;
        const name = String(it?.product_name ?? '').trim();
        if (name) set.add(name);
      }
    }

    const currentName = String(form?.name ?? '').trim();
    const hasCurrentName = Boolean(currentName);
    const currentInList = hasCurrentName && set.has(currentName);

    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-PT'));
    const opts = sorted.map((name) => ({ value: name, label: name }));

    return [
      ...(hasCurrentName && !currentInList ? [{ value: currentName, label: `${currentName} (atual)` }] : []),
      { value: '__manual__', label: 'Outro (escrever manualmente)' },
      ...opts,
    ];
  }, [purchases, form?.name]);

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-products'] }); queryClient.invalidateQueries({ queryKey: ['products-catalog'] }); queryClient.invalidateQueries({ queryKey: ['product'] }); toast.success('Produto arquivado'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível remover o produto.')),
  });

  const openCreate = () => { setEditing(null); setForm(emptyProduct); setNameChoice(''); setImageInput(''); setVideoInput(''); setColorInput(''); setSizeInput(''); setJsonText(''); setDialogOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      ...emptyProduct,
      ...p,
      material: p.material ?? '__none__',
      price: p.price || '',
      acquisition_cost: p.acquisition_cost ?? '',
      original_price: p.original_price || '',
      stock: p.stock || 0,
      colors: p.colors ?? [],
      sizes: p.sizes ?? [],
      images: p.images ?? [],
      videos: p.videos ?? [],
    });
    setNameChoice(String(p?.name ?? ''));
    setImageInput('');
    setVideoInput('');
    setColorInput('');
    setSizeInput('');
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
          const sizes = pick('sizes', undefined);

          const name = String(pick('name', '') ?? '').trim();
          if (!name) {
            if (!firstError) firstError = new Error('Nome é obrigatório.');
            failed += 1;
            continue;
          }

          const rawPrice = pick('price', pick('unit_price', ''));
          const rawOriginalPrice = pick('original_price', pick('originalPrice', ''));
          const rawStock = pick('stock', 0);
          const rawMaterial = pick('material', emptyProduct.material);

          const data = {
            ...emptyProduct,
            name,
            description: String(pick('description', emptyProduct.description) ?? ''),
            price: parseFloat(rawPrice) || 0,
            acquisition_cost: pick('acquisition_cost', pick('acquisitionCost', undefined)),
            original_price: rawOriginalPrice ? parseFloat(rawOriginalPrice) : undefined,
            category: String(pick('category', emptyProduct.category) ?? emptyProduct.category),
            material: rawMaterial === null || rawMaterial === undefined ? null : String(rawMaterial),
            colors: Array.isArray(colors) ? colors : emptyProduct.colors,
            sizes: Array.isArray(sizes) ? sizes : emptyProduct.sizes,
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
    const cleanList = (arr) =>
      Array.from(new Set((Array.isArray(arr) ? arr : []).map((v) => String(v ?? '').trim()).filter(Boolean)));

    const data = {
      ...form,
      images: normalizeImages(form.images),
      videos: normalizeVideos(form.videos),
      colors: cleanList(form.colors),
      sizes: cleanList(form.sizes),
      material: form.material === '__none__' || form.material === '' ? null : form.material,
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
        toast.error('Caminho local não funciona no browser. Use uma URL.');
        return;
      }
      setForm((prev) => ({ ...prev, videos: [...(prev.videos || []), value] }));
      setVideoInput('');
    }
  };

  const canLoadMore = !isLoading && Array.isArray(products) && products.length === limit && limit < 500;
  const filtered = products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));
  const toggleValue = (list, value) => {
    const current = Array.isArray(list) ? list : [];
    return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
        <h1 className="font-heading text-3xl">Produtos</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto sm:justify-end">
          <Button onClick={openCreate} className="rounded-none font-body text-sm gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4" /> Novo Produto
          </Button>
          <Button onClick={openJson} variant="outline" className="rounded-none font-body text-sm gap-2 w-full sm:w-auto">
            <Code className="w-4 h-4" /> JSON
          </Button>
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
                <td className="p-3 font-body text-xs">{productOptions.categoryLabel.get(String(p.category ?? '')) ?? p.category}</td>
                <td className="p-3 font-body text-sm">{p.price?.toFixed(2)} €</td>
                <td className="p-3 font-body text-sm">{p.stock || 0}</td>
                <td className="p-3">
                  {(() => {
                    const adj = purchaseAdjustmentByProductId.get(String(p.id)) ?? null;
                    const hasReturned = Number(adj?.returned ?? 0) > 0;
                    const hasWriteoff = Number(adj?.writeoff ?? 0) > 0;
                    return (
                      <div className="flex flex-wrap gap-2 items-center">
                        <Badge
                          className={cn(
                            'rounded-none font-body text-[10px] font-semibold',
                            productStatusBadgeClassName[p.status] ??
                              'border-transparent bg-muted text-muted-foreground shadow-none',
                          )}
                        >
                          {getProductStatusLabel(p.status)}
                        </Badge>
                        {hasReturned ? (
                          <Badge className="rounded-none font-body text-[10px] bg-primary/10 text-primary">
                            Devolvido
                          </Badge>
                        ) : null}
                        {hasWriteoff ? (
                          <Badge className="rounded-none font-body text-[10px] bg-destructive/10 text-destructive">
                            Removido
                          </Badge>
                        ) : null}
                      </div>
                    );
                  })()}
                </td>
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
        {isLoading && (Array.isArray(products) ? products.length : 0) === 0 ? (
          <EmptyState icon={Package} description="A carregar..." className="py-8" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Package} description="Sem produtos" className="py-8" />
        ) : null}
      </div>

      <LoadMoreControls
        leftText={`A mostrar ${Array.isArray(products) ? products.length : 0} produtos.`}
        onLess={() => setLimit(50)}
        lessDisabled={isLoading || limit <= 50}
        onMore={() => setLimit((p) => Math.min(500, p + 50))}
        moreDisabled={!canLoadMore}
      />

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{editing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-body text-xs">Nome *</Label>
              <div className="mt-1 space-y-2">
                <SearchableSelect
                  value={nameChoice || ''}
                  onChange={(v) => {
                    if (v === '__manual__') {
                      setNameChoice('__manual__');
                      return;
                    }
                    const nextName = String(v ?? '').trim();
                    setNameChoice(nextName);
                    setForm((prev) => {
                      const next = { ...prev, name: nextName };
                      if (!editing && nextName) {
                        const suggestion = purchaseSuggestionByName.get(nextName);
                        if (suggestion) {
                          if (suggestion.unitCost) next.acquisition_cost = String(suggestion.unitCost);
                          if (suggestion.image) {
                            const current = Array.isArray(next.images) ? next.images : [];
                            next.images = current.includes(suggestion.image) ? current : [suggestion.image, ...current];
                          }
                          if ((Number(next.stock) || 0) === 0 && (Number(suggestion.receivedQtyUnlinked) || 0) > 0) {
                            next.stock = Number(suggestion.receivedQtyUnlinked) || 0;
                          }
                        }
                      }
                      return next;
                    });
                  }}
                  options={purchasedProductNameOptions}
                  placeholder="Selecionar (baseado em compras)..."
                  searchPlaceholder="Pesquisar produto comprado..."
                />
                {nameChoice === '__manual__' ? (
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="rounded-none"
                    placeholder="Escreva o nome do produto..."
                  />
                ) : null}
                <p className="font-body text-xs text-muted-foreground">
                  Sugestões geradas a partir dos nomes usados nas compras.
                </p>
              </div>
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
                  disabled={isPurchaseInherited}
                />
                {isPurchaseInherited ? (
                  <p className="font-body text-[11px] text-muted-foreground mt-1">
                    Herdado das compras (bloqueado).
                  </p>
                ) : null}
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
                    {(categorySelectOptions ?? []).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-body text-xs">Material</Label>
                <Select value={form.material ?? ''} onValueChange={(v) => setForm({ ...form, material: v })}>
                  <SelectTrigger className="rounded-none mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem material</SelectItem>
                    {(materialSelectOptions ?? []).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-xs">Cores</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(productOptions.colors ?? []).map((c) => {
                    const selected = (form.colors ?? []).includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, colors: toggleValue(p.colors, c) }))}
                        className="focus:outline-none"
                      >
                        <Badge
                          className={cn(
                            'rounded-none font-body text-[10px]',
                            selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
                          )}
                        >
                          {c}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={colorInput}
                    onChange={(e) => setColorInput(e.target.value)}
                    placeholder="Adicionar cor (manual)"
                    className="rounded-none"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-none"
                    onClick={() => {
                      const v = String(colorInput ?? '').trim();
                      if (!v) return;
                      setForm((p) => ({ ...p, colors: Array.from(new Set([...(p.colors ?? []), v])) }));
                      setColorInput('');
                    }}
                  >
                    +
                  </Button>
                </div>
              </div>

              <div>
                <Label className="font-body text-xs">Tamanhos</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(productOptions.sizes ?? []).map((s) => {
                    const selected = (form.sizes ?? []).includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, sizes: toggleValue(p.sizes, s) }))}
                        className="focus:outline-none"
                      >
                        <Badge
                          className={cn(
                            'rounded-none font-body text-[10px]',
                            selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
                          )}
                        >
                          {s}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={sizeInput}
                    onChange={(e) => setSizeInput(e.target.value)}
                    placeholder="Adicionar tamanho (manual)"
                    className="rounded-none"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-none"
                    onClick={() => {
                      const v = String(sizeInput ?? '').trim();
                      if (!v) return;
                      setForm((p) => ({ ...p, sizes: Array.from(new Set([...(p.sizes ?? []), v])) }));
                      setSizeInput('');
                    }}
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>
            <div>
              <Label className="font-body text-xs">Stock</Label>
              <Input
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="rounded-none mt-1"
                disabled={isPurchaseInherited}
              />
              {isPurchaseInherited ? (
                <p className="font-body text-[11px] text-muted-foreground mt-1">
                  Herdado das compras recebidas (bloqueado).
                </p>
              ) : null}
            </div>
	            <div>
	              <Label className="font-body text-xs">Imagens</Label>
              {isPurchaseInherited ? (
                <p className="font-body text-[11px] text-muted-foreground mt-1">
                  Imagens herdadas das compras (pode editar).
                </p>
              ) : null}
              <div className="flex gap-2 mt-1 flex-wrap">
                {form.images?.map((img, i) => (
                  <div key={i} className="relative w-16 h-16 rounded overflow-hidden">
                    <ImageWithFallback
                      src={img}
                      alt=""
                      className="w-full h-full object-cover"
                      iconClassName="w-6 h-6 text-muted-foreground/40"
                    />
                    <button
                      onClick={() => setForm({ ...form, images: form.images.filter((_, j) => j !== i) })}
                      className="absolute top-0 right-0 bg-destructive text-destructive-foreground w-4 h-4 text-[10px] flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="URL da imagem"
                  value={imageInput}
                  onChange={(e) => setImageInput(e.target.value)}
                  className="rounded-none flex-1"
                />
                <Button type="button" variant="outline" onClick={addImageUrl} className="rounded-none">
                  +
                </Button>
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
        <DialogContent aria-describedby={undefined} className="max-w-lg">
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
