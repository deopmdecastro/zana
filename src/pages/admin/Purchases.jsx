import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchableSelect from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';
import { Plus, Pencil, CheckCircle, Code } from 'lucide-react';
import { getPrimaryImage } from '@/lib/images';

function safeJson(value) {
  if (value === null || value === undefined) return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

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
  items: [{ product_id: null, product_name: '', product_image: '', unit_cost: '', quantity: 1 }],
};

export default function AdminPurchases() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false);
  const [jsonSaving, setJsonSaving] = useState(false);
  // Legacy modal (kept for now; no longer triggered by JSON flow)
  const [supplierPromptOpen, setSupplierPromptOpen] = useState(false);
  const [supplierPromptSupplierId, setSupplierPromptSupplierId] = useState('none');
  const [pendingJsonObjects, setPendingJsonObjects] = useState(null);
  const [fixupOpen, setFixupOpen] = useState(false);
  const [fixupItems, setFixupItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPurchase);
  const [jsonText, setJsonText] = useState('');

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

  const supplierSelectOptions = useMemo(() => {
    return (Array.isArray(suppliers) ? suppliers : [])
      .slice()
      .sort((a, b) => String(a?.name ?? '').localeCompare(String(b?.name ?? '')))
      .map((s) => ({ value: s.id, label: s.name }));
  }, [suppliers]);

  const supplierPickerOptions = useMemo(() => {
    return [{ value: 'none', label: 'Selecionar...' }, ...supplierSelectOptions];
  }, [supplierSelectOptions]);

  const productPickerOptions = useMemo(() => {
    const opts = (Array.isArray(productOptions) ? productOptions : []).map((p) => ({ value: p.id, label: p.name }));
    return [{ value: 'none', label: '-' }, ...opts];
  }, [productOptions]);

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
    setJsonText('');
    setDialogOpen(true);
  };

  const openJson = () => {
    setEditing(null);
    setForm({ ...emptyPurchase, purchased_at: new Date().toISOString() });
    setJsonText('');
    setJsonDialogOpen(true);
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
	        product_image: it.product_image ?? '',
	        unit_cost: String(it.unit_cost ?? ''),
	        quantity: it.quantity ?? 1,
	      })),
	    });
    setJsonText('');
    setDialogOpen(true);
  };

  const runJsonImport = (objects, fallbackSupplierId = null) => {
    (async () => {
      setJsonSaving(true);
      let created = 0;
      let failed = 0;
      let firstError = null;

      for (const obj of objects) {
        try {
          const supplierIdRaw = obj.supplier_id ?? obj.supplierId ?? obj.supplier?.id ?? null;
          const supplierId = supplierIdRaw || fallbackSupplierId || null;
          const purchasedAt = obj.purchased_at ?? obj.purchasedAt ?? null;
          const items = Array.isArray(obj.items) ? obj.items : null;

          if (!items || items.length === 0) {
            if (!firstError) firstError = new Error('Itens inválidos.');
            failed += 1;
            continue;
          }

          const normalizedItems = items
            .map((it) => {
              const productId = it.product_id ?? it.productId ?? it.product?.id ?? null;
              const productFromList = productId ? productOptions.find((p) => p.id === productId) : null;
              const productName = String(it.product_name ?? it.productName ?? it.product?.name ?? productFromList?.name ?? '').trim();
              const productImage =
                String(it.product_image ?? it.productImage ?? it.image ?? '').trim() ||
                (productFromList ? getPrimaryImage(productFromList.images) : '') ||
                null;

              return {
                product_id: productId,
                product_name: productName,
                product_image: productImage,
                unit_cost: Number(it.unit_cost ?? it.unitCost ?? it.cost ?? 0) || 0,
                quantity: Number(it.quantity ?? 0) || 0,
              };
            })
            .filter((it) => it.product_name && it.quantity > 0);

          if (normalizedItems.length === 0) {
            if (!firstError) firstError = new Error('Itens inválidos.');
            failed += 1;
            continue;
          }

          const payload = {
            supplier_id: supplierId,
            reference: String(obj.reference ?? '').trim() || null,
            status: String(obj.status ?? 'draft'),
            purchased_at: purchasedAt ? new Date(purchasedAt).toISOString() : new Date().toISOString(),
            notes: String(obj.notes ?? '').trim() || null,
            items: normalizedItems,
          };

          await base44.entities.Purchase.create(payload);
          created += 1;
        } catch (err) {
          if (!firstError) firstError = err;
          failed += 1;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['admin-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      setJsonSaving(false);

      if (created > 0) {
        setJsonDialogOpen(false);
        setJsonText('');
      }

      if (failed > 0) {
        const human = firstError ? getErrorMessage(firstError, 'Não foi possível criar a compra.') : 'Não foi possível criar a compra.';
        toast.error(`${human} (Criadas: ${created} · Falhas: ${failed})`);
      } else if (objects.length === 1) {
        toast.success('Compra criada');
      } else {
        toast.success(`Criadas: ${created}`);
      }
    })();
  };

  const extractItemName = (obj) => {
    return String(obj?.product_name ?? obj?.productName ?? obj?.nome ?? obj?.name ?? '').trim();
  };

  const extractItemCost = (obj) => {
    const raw = obj?.unit_cost ?? obj?.unitCost ?? obj?.cost ?? obj?.preco ?? obj?.price ?? obj?.valor ?? null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  };

  const extractItemQty = (obj) => {
    const raw = obj?.quantity ?? obj?.qty ?? obj?.qtd ?? obj?.quantidade ?? 1;
    const n = Number.parseInt(String(raw ?? 1), 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  };

  const extractItemImage = (obj) => {
    return String(obj?.product_image ?? obj?.productImage ?? obj?.image ?? obj?.imagem ?? '').trim();
  };

  const normalizeProductCategory = (value) => {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return 'colares';
    const normalized = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z_ ]/g, '')
      .replace(/\s+/g, '_');

    const direct = new Set(['colares', 'brincos', 'pulseiras', 'aneis', 'conjuntos']);
    if (direct.has(normalized)) return normalized;

    if (/(tornozeleir)/i.test(normalized)) return 'pulseiras';
    if (/(anel)/i.test(normalized)) return 'aneis';
    if (/(brinco)/i.test(normalized)) return 'brincos';
    if (/(pulseir)/i.test(normalized)) return 'pulseiras';
    if (/(conjunto)/i.test(normalized)) return 'conjuntos';

    return 'colares';
  };

  const normalizeProductMaterial = (value) => {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return 'dourado';
    const normalized = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z_ ]/g, '')
      .replace(/\s+/g, '_');

    const direct = new Set(['aco_inox', 'prata', 'dourado', 'rose_gold', 'perolas', 'cristais']);
    if (direct.has(normalized)) return normalized;

    if (/(aco|inox)/i.test(normalized)) return 'aco_inox';
    if (/(prata)/i.test(normalized)) return 'prata';
    if (/(rose|rosa)/i.test(normalized)) return 'rose_gold';
    if (/(perola)/i.test(normalized)) return 'perolas';
    if (/(cristal)/i.test(normalized)) return 'cristais';

    return 'dourado';
  };

  const findProductByName = (name) => {
    const normalized = String(name ?? '').trim().toLowerCase();
    if (!normalized) return null;
    return productOptions.find((p) => String(p?.name ?? '').trim().toLowerCase() === normalized) ?? null;
  };

  const extractProductPayloadFromItem = ({ obj, name, image, unitCost }) => {
    const pick = (key, fallback) => (obj?.[key] === undefined ? fallback : obj[key]);

    const rawCategory = pick('category', pick('categoria', null));
    const rawMaterial = pick('material', pick('materiais', null));

    const rawPrice = pick('price', pick('preco', pick('valor', pick('unit_price', pick('unitCost', null)))));
    const n = rawPrice === null || rawPrice === undefined ? NaN : Number(rawPrice);
    const price = Number.isFinite(n) ? n : Number(unitCost ?? 0) || 0;

    const rawImages = pick('images', pick('image_urls', pick('imageUrls', pick('imagens', pick('imagem', undefined)))));
    const images = Array.isArray(rawImages)
      ? rawImages.map((v) => String(v ?? '').trim()).filter(Boolean)
      : image
        ? [image]
        : [];

    const rawVideos = pick('videos', pick('video_urls', pick('videoUrls', undefined)));
    const videos = Array.isArray(rawVideos) ? rawVideos.map((v) => String(v ?? '').trim()).filter(Boolean) : [];

    return {
      name: String(pick('name', pick('nome', name)) ?? '').trim(),
      description: String(pick('description', pick('descricao', '')) ?? ''),
      price,
      acquisition_cost: Number(unitCost ?? 0) || 0,
      category: normalizeProductCategory(rawCategory),
      material: rawMaterial ? normalizeProductMaterial(rawMaterial) : null,
      images,
      videos,
      stock: 0,
      status: 'active',
    };
  };

  const openFixupFromItems = (objects, { supplierId = null, status = 'draft' } = {}) => {
    const drafts = (objects ?? [])
      .map((obj) => {
        const name = extractItemName(obj);
        const productId = String(obj?.product_id ?? obj?.productId ?? obj?.product?.id ?? obj?.id ?? '').trim() || null;
        const productFromList =
          (productId ? productOptions.find((p) => p.id === productId) : null) ?? (name ? findProductByName(name) : null);
        const image = extractItemImage(obj) || (productFromList ? getPrimaryImage(productFromList.images) : '') || '';
        const unitCost = extractItemCost(obj);
        return {
          source_name: name || 'Item',
          raw: obj,
          product_id: productFromList ? productFromList.id : null,
          product_payload: productFromList ? null : extractProductPayloadFromItem({ obj, name, image, unitCost }),
          supplier_id: supplierId ? String(supplierId) : null,
          status: String(status ?? 'draft'),
          quantity: extractItemQty(obj),
          unit_cost: unitCost,
          product_image: image,
        };
      })
      .filter((x) => x.source_name);

    setFixupItems(
      drafts.length
        ? drafts
        : [
            {
              source_name: 'Item',
              raw: {},
              product_id: null,
              product_payload: extractProductPayloadFromItem({ obj: {}, name: 'Item', image: '', unitCost: 0 }),
              supplier_id: supplierId ? String(supplierId) : null,
              status: String(status ?? 'draft'),
              quantity: 1,
              unit_cost: 0,
              product_image: '',
            },
          ],
    );
    setFixupOpen(true);
  };

  const saveFixupPurchase = async () => {
    if (jsonSaving) return;

    setJsonSaving(true);
    try {
      const rows = (fixupItems ?? []).map((it) => {
        const supplierId = String(it.supplier_id ?? '').trim() || null;
        const status = String(it.status ?? 'draft');
        const productId = String(it.product_id ?? '').trim() || null;
        const quantity = Number.parseInt(String(it.quantity ?? 0), 10) || 0;
        const unitCost = Number(it.unit_cost ?? 0) || 0;
        const productImage = String(it.product_image ?? '').trim() || null;
        const product = productId ? productOptions.find((p) => p.id === productId) : null;
        const productName = String(product?.name ?? it.product_payload?.name ?? it.source_name ?? '').trim();
        const productPayload = it.product_payload ? { ...it.product_payload } : null;

        if (productPayload) {
          const nextImages = Array.isArray(productPayload.images) ? productPayload.images : [];
          if (productImage && !nextImages.includes(productImage)) productPayload.images = [productImage, ...nextImages];
          if ((Number(productPayload.price) || 0) === 0 && unitCost > 0) productPayload.price = unitCost;
        }

        return {
          supplierId,
          status,
          productId,
          productName,
          productPayload,
          item: {
            product_id: productId,
            product_name: productName,
            product_image: productImage,
            unit_cost: unitCost,
            quantity,
          },
        };
      });

      const validRows = rows.filter((r) => r.supplierId && r.productName && r.item.quantity > 0);
      if (!validRows.length) return;

      // Create missing products first so received purchases update inventory.
      for (const r of validRows) {
        if (r.productId) continue;
        if (!r.productPayload?.name) continue;

        const createdProduct = await base44.entities.Product.create(r.productPayload);
        const createdId = createdProduct?.id ? String(createdProduct.id) : null;
        if (!createdId) continue;

        r.productId = createdId;
        r.item.product_id = createdId;
        r.item.product_name = String(createdProduct?.name ?? r.productPayload.name ?? r.productName).trim();
      }

      const finalRows = validRows.filter((r) => r.supplierId && r.item.product_name && r.item.quantity > 0);
      const groups = new Map();
      for (const r of finalRows) {
        const key = `${r.supplierId}||${r.status}`;
        const existing = groups.get(key);
        if (existing) existing.items.push(r.item);
        else groups.set(key, { supplier_id: r.supplierId, status: r.status, items: [r.item] });
      }

      let created = 0;
      let failed = 0;
      let firstError = null;

      for (const group of groups.values()) {
        try {
          await base44.entities.Purchase.create({
            supplier_id: group.supplier_id,
            status: group.status,
            purchased_at: new Date().toISOString(),
            items: group.items,
          });
          created += 1;
        } catch (err) {
          if (!firstError) firstError = err;
          failed += 1;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['admin-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });

      if (failed > 0) {
        toast.error(`${getErrorMessage(firstError, 'Não foi possível criar a compra.')} (Criadas: ${created} · Falhas: ${failed})`);
        return;
      }

      toast.success(created === 1 ? 'Compra criada' : `Compras criadas: ${created}`);
      setFixupOpen(false);
      setFixupItems([]);
      setJsonDialogOpen(false);
      setJsonText('');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Não foi possível criar a compra.'));
    } finally {
      setJsonSaving(false);
    }
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

    const isPurchaseObjects = objects.every((o) => o && typeof o === 'object' && Array.isArray(o.items));

    if (isPurchaseObjects) {
      const missingSupplier = objects.some((o) => !(o?.supplier_id ?? o?.supplierId ?? o?.supplier?.id));
      if (missingSupplier) {
        if (!suppliers.length) {
          toast.error('Sem fornecedores. Crie um fornecedor primeiro.');
          return;
        }
        const flattened = objects.flatMap((o) => (Array.isArray(o.items) ? o.items : []));
        openFixupFromItems(flattened, { status: String(objects[0]?.status ?? 'draft') });
        return;
      }
      runJsonImport(objects);
      return;
    }

    // Treat JSON as a list of items (e.g. catálogo do fornecedor) and ask to completar dados.
    if (!suppliers.length) {
      toast.error('Sem fornecedores. Crie um fornecedor primeiro.');
      return;
    }
    openFixupFromItems(objects);
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
      items: [...p.items, { product_id: null, product_name: '', product_image: '', unit_cost: '', quantity: 1 }],
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
	        product_image: String(it.product_image ?? '').trim() || null,
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
	        <div className="flex items-center gap-2">
	          <Button onClick={openCreate} className="rounded-none font-body text-sm gap-2">
	            <Plus className="w-4 h-4" /> Nova
	          </Button>
	          <Button onClick={openJson} variant="outline" className="rounded-none font-body text-sm gap-2">
	            <Code className="w-4 h-4" /> JSON
	          </Button>
	        </div>
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
                  {suppliers.length > 10 ? (
                    <SearchableSelect
                      value={form.supplier_id ?? 'none'}
                      onChange={(v) => setForm((p) => ({ ...p, supplier_id: v === 'none' ? null : v }))}
                      options={supplierPickerOptions}
                      placeholder="Selecionar..."
                      searchPlaceholder="Pesquisar fornecedor..."
                      className="mt-1"
                      disabled={isLocked}
                    />
                  ) : (
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
                  )}
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
                      {productOptions.length > 10 ? (
                        <SearchableSelect
                          value={it.product_id ?? 'none'}
                          onChange={(v) => {
                            const productId = v === 'none' ? null : v;
                            const product = productOptions.find((p) => p.id === productId) ?? null;
                            const nextImage = product ? getPrimaryImage(product.images) : '';
                            updateItem(idx, {
                              product_id: productId,
                              product_name: product?.name ?? it.product_name,
                              product_image: nextImage ?? it.product_image,
                            });
                          }}
                          options={productPickerOptions}
                          placeholder="-"
                          searchPlaceholder="Pesquisar produto..."
                          className="mt-1"
                          disabled={isLocked}
                        />
                      ) : (
                        <Select
                          value={it.product_id ?? 'none'}
                          onValueChange={(v) => {
                            const productId = v === 'none' ? null : v;
                            const product = productOptions.find((p) => p.id === productId) ?? null;
                            const nextImage = product ? getPrimaryImage(product.images) : '';
                            updateItem(idx, {
                              product_id: productId,
                              product_name: product?.name ?? it.product_name,
                              product_image: nextImage ?? it.product_image,
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
                      )}
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
	                    <div className="md:col-span-2">
	                      <Label className="font-body text-xs">Imagem (URL)</Label>
	                      <Input
	                        value={it.product_image}
	                        onChange={(e) => updateItem(idx, { product_image: e.target.value })}
	                        className="rounded-none mt-1"
	                        placeholder="https://..."
	                        disabled={isLocked}
	                      />
	                      {it.product_image ? (
	                        <img
	                          src={it.product_image}
	                          alt=""
	                          className="mt-2 w-12 h-12 rounded object-cover border border-border"
	                          onError={(e) => {
	                            e.currentTarget.style.display = 'none';
	                          }}
	                        />
	                      ) : null}
	                    </div>
	                    <div className="md:col-span-1">
	                      <Label className="font-body text-xs">Custo</Label>
	                      <Input type="number" value={it.unit_cost} onChange={(e) => updateItem(idx, { unit_cost: e.target.value })} className="rounded-none mt-1" disabled={isLocked} />
	                    </div>
	                    <div className="md:col-span-1">
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

			      <Dialog
			        open={fixupOpen}
			        onOpenChange={(open) => {
			          setFixupOpen(open);
			          if (!open) {
			            setFixupItems([]);
			          }
			        }}
			      >
			        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
			          <DialogHeader>
			            <DialogTitle className="font-heading text-xl">Completar compra (JSON)</DialogTitle>
			          </DialogHeader>
			          <div className="space-y-4">
			            <div className="space-y-3">
			              {fixupItems.map((it, idx) => {
			                const hasProduct = Boolean(it.product_id) || Boolean(it.product_payload?.name);
			                const missingProduct = !hasProduct;
                      const missingSupplier = !it.supplier_id;
			                const qty = Number.parseInt(String(it.quantity ?? 0), 10) || 0;
			                const missingQty = qty <= 0;
			                return (
			                  <div
			                    key={idx}
			                    className={`border rounded-md p-4 ${missingProduct || missingSupplier || missingQty ? 'border-destructive/50' : 'border-border'} bg-secondary/10`}
			                  >
			                    <div className="font-body text-sm font-medium break-words">{it.source_name || `Item ${idx + 1}`}</div>
                          {it.product_id ? (
                            <div className="font-body text-xs text-muted-foreground break-all mt-1">ID: {it.product_id}</div>
                          ) : it.product_payload?.name ? (
                            <div className="font-body text-xs text-muted-foreground mt-1 whitespace-normal break-words">
                              Produto serÃ¡ criado a partir do JSON
                            </div>
                          ) : (
                            <div className="font-body text-xs text-destructive mt-1 whitespace-normal break-words">
                              Nome do produto em falta no JSON
                            </div>
                          )}
			                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mt-3">
			                      <div className="md:col-span-3">
			                        <Label className="font-body text-xs">Fornecedor *</Label>
                              {suppliers.length > 10 ? (
                                <SearchableSelect
                                  value={it.supplier_id ?? 'none'}
                                  onChange={(v) =>
                                    setFixupItems((p) =>
                                      p.map((x, i) => (i === idx ? { ...x, supplier_id: v === 'none' ? null : v } : x)),
                                    )
                                  }
                                  options={supplierPickerOptions}
                                  placeholder="Selecionar..."
                                  searchPlaceholder="Pesquisar fornecedor..."
                                  className="mt-1"
                                />
                              ) : (
                                <Select
                                  value={it.supplier_id ?? 'none'}
                                  onValueChange={(v) =>
                                    setFixupItems((p) =>
                                      p.map((x, i) => (i === idx ? { ...x, supplier_id: v === 'none' ? null : v } : x)),
                                    )
                                  }
                                >
                                  <SelectTrigger className="rounded-none mt-1">
                                    <SelectValue placeholder="Selecionar" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Selecionar...</SelectItem>
                                    {suppliers.map((s) => (
                                      <SelectItem key={s.id} value={s.id}>
                                        {s.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
			                      </div>
                        <div className="md:col-span-3">
                          <Label className="font-body text-xs">Estado</Label>
                          <Select
                            value={it.status ?? 'draft'}
                            onValueChange={(v) =>
                              setFixupItems((p) => p.map((x, i) => (i === idx ? { ...x, status: v } : x)))
                            }
                          >
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
			                      <div className="md:col-span-1">
			                        <Label className="font-body text-xs">Qtd. *</Label>
			                        <Input
			                          type="number"
			                          min="1"
			                          value={it.quantity}
			                          onChange={(e) =>
			                            setFixupItems((p) => p.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))
			                          }
			                          className="rounded-none mt-1"
			                        />
			                      </div>
			                      <div className="md:col-span-3">
			                        <Label className="font-body text-xs">Imagem (URL)</Label>
			                        <Input
			                          value={it.product_image}
			                          onChange={(e) =>
			                            setFixupItems((p) => p.map((x, i) => (i === idx ? { ...x, product_image: e.target.value } : x)))
			                          }
			                          className="rounded-none mt-1"
			                          placeholder="https://..."
			                        />
			                      </div>
			                      <div className="md:col-span-2">
			                        <Label className="font-body text-xs">Custo</Label>
			                        <Input
			                          type="number"
                                    step="0.01"
			                          value={it.unit_cost}
			                          onChange={(e) =>
			                            setFixupItems((p) => p.map((x, i) => (i === idx ? { ...x, unit_cost: e.target.value } : x)))
			                          }
			                          className="rounded-none mt-1"
			                        />
			                      </div>
			                    </div>
			                  </div>
			                );
			              })}
			            </div>

			            <div className="flex items-center justify-end gap-2">
			              <Button type="button" variant="outline" className="rounded-none font-body text-sm" onClick={() => setFixupOpen(false)}>
			                Cancelar
			              </Button>
			              <Button
			                type="button"
			                className="rounded-none font-body text-sm"
			                onClick={saveFixupPurchase}
			                disabled={
			                  jsonSaving ||
			                  !fixupItems.length ||
			                  fixupItems.some((it) => {
			                    const qty = Number.parseInt(String(it.quantity ?? 0), 10) || 0;
			                    const hasProduct = Boolean(it.product_id) || Boolean(it.product_payload?.name);
			                    return !it.supplier_id || !hasProduct || qty <= 0;
			                  })
			                }
			              >
			                {jsonSaving ? 'A guardar...' : 'Guardar'}
			              </Button>
			            </div>
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
	            <DialogTitle className="font-heading text-xl">Importar compra (JSON)</DialogTitle>
	          </DialogHeader>
	          <div className="space-y-3">
	            <div>
	              <Label className="font-body text-xs">JSON</Label>
		                <Textarea
		                  value={jsonText}
		                  onChange={(e) => setJsonText(e.target.value)}
		                  className="rounded-none mt-1 min-h-[160px] font-mono text-xs"
		                  placeholder={
		                    '1 JSON, array ou 1 por linha.\nEx (1): {"supplier_id":"...","status":"draft","items":[{"product_id":"...","unit_cost":5,"quantity":2}]}\nEx (varios): {"supplier_id":"...","items":[{"product_name":"A","unit_cost":1,"quantity":1}]}\n{"supplier_id":"...","items":[{"product_name":"B","unit_cost":2,"quantity":1}]}\nEx (array): [{"supplier_id":"...","items":[{"product_name":"A","unit_cost":1,"quantity":1}]}]'
		                  }
		                />
	            </div>
	            <div className="flex items-center justify-end gap-2">
	              <Button
	                type="button"
	                variant="outline"
	                className="rounded-none font-body text-sm"
	                onClick={() => setJsonDialogOpen(false)}
	              >
	                Cancelar
	              </Button>
	              <Button
	                type="button"
	                className="rounded-none font-body text-sm"
	                onClick={applyJson}
	                disabled={!jsonText.trim() || jsonSaving}
	              >
	                {jsonSaving ? 'A criar...' : 'Aplicar'}
	              </Button>
	            </div>
	          </div>
	        </DialogContent>
		      </Dialog>

		      <Dialog open={supplierPromptOpen} onOpenChange={setSupplierPromptOpen}>
		        <DialogContent className="max-w-md">
		          <DialogHeader>
		            <DialogTitle className="font-heading text-xl">Fornecedor em falta</DialogTitle>
		          </DialogHeader>
		          <div className="space-y-3">
		            <div className="font-body text-sm text-muted-foreground whitespace-normal">
		              Esta compra (JSON) não tem fornecedor. Selecione um fornecedor para continuar.
		            </div>
		            <div>
		              <Label className="font-body text-xs">Fornecedor *</Label>
                  {suppliers.length > 10 ? (
                    <SearchableSelect
                      value={supplierPromptSupplierId}
                      onChange={setSupplierPromptSupplierId}
                      options={supplierPickerOptions}
                      placeholder="Selecionar..."
                      searchPlaceholder="Pesquisar fornecedor..."
                      className="mt-1"
                    />
                  ) : (
                    <Select value={supplierPromptSupplierId} onValueChange={setSupplierPromptSupplierId}>
                      <SelectTrigger className="rounded-none mt-1">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecionar...</SelectItem>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
		            </div>
		            <div className="flex items-center justify-end gap-2">
		              <Button
		                type="button"
		                variant="outline"
		                className="rounded-none font-body text-sm"
		                onClick={() => {
		                  setSupplierPromptOpen(false);
		                  setPendingJsonObjects(null);
		                }}
		              >
		                Cancelar
		              </Button>
		              <Button
		                type="button"
		                className="rounded-none font-body text-sm"
		                disabled={supplierPromptSupplierId === 'none' || jsonSaving || !pendingJsonObjects}
		                onClick={() => {
		                  const objects = pendingJsonObjects;
		                  const chosen = supplierPromptSupplierId === 'none' ? null : supplierPromptSupplierId;
		                  if (!chosen || !objects) return;
		                  setSupplierPromptOpen(false);
		                  setPendingJsonObjects(null);
		                  runJsonImport(objects, chosen);
		                }}
		              >
		                {jsonSaving ? 'A criar...' : 'Guardar'}
		              </Button>
		            </div>
		          </div>
		        </DialogContent>
		      </Dialog>
		    </div>
		  );
	}
