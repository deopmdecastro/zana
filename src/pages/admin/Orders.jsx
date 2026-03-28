import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchableSelect from '@/components/ui/searchable-select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import { Check, ChevronDown, Eye, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage, toastApiPromise } from '@/lib/toast';
import { getPrimaryImage } from '@/lib/images';
import DeleteIcon from '@/components/ui/delete-icon';

const statusLabels = {
  pending: 'Pendente',
  confirmed: 'Confirmada',
  processing: 'Em preparação',
  shipped: 'Enviada',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
};

const statusSelectClasses = {
  pending: 'bg-secondary/60 text-foreground border-border',
  confirmed: 'bg-[hsl(var(--chart-1)/0.14)] text-[hsl(var(--chart-1))] border-[hsl(var(--chart-1)/0.25)]',
  processing: 'bg-[hsl(var(--chart-2)/0.14)] text-[hsl(var(--chart-2))] border-[hsl(var(--chart-2)/0.25)]',
  shipped: 'bg-[hsl(var(--chart-4)/0.14)] text-[hsl(var(--chart-4))] border-[hsl(var(--chart-4)/0.25)]',
  delivered: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
};

const DEFAULT_SHIPPING_METHODS = [
  { id: 'standard', label: 'Standard', price: 4.99, free_over: 50, enabled: true, description: 'Entrega em 2–4 dias úteis.' },
  { id: 'express', label: 'Expresso', price: 7.99, free_over: null, enabled: false, description: 'Entrega em 1–2 dias úteis.' },
  { id: 'pickup', label: 'Levantamento', price: 0, free_over: null, enabled: true, description: 'Levantamento em loja / ponto combinado.' },
];

function normalizeShippingMethods(shipping) {
  const content = shipping && typeof shipping === 'object' ? shipping : {};
  const methods = Array.isArray(content.methods) ? content.methods : [];

  const mapped = methods.map((m) => ({
    id: String(m?.id ?? '').trim(),
    label: String(m?.label ?? '').trim(),
    enabled: m?.enabled !== false,
    price: m?.price === null || m?.price === undefined ? null : Number(m.price),
    free_over: m?.free_over === null || m?.free_over === undefined ? null : Number(m.free_over),
    description: m?.description ? String(m.description) : '',
  }));

  const effective = mapped.length ? mapped : DEFAULT_SHIPPING_METHODS;
  const enabled = effective.filter((m) => m.id && m.label && m.enabled !== false);
  const defaultId = content.default_method_id ? String(content.default_method_id) : null;
  const fallbackId = enabled[0]?.id ?? 'standard';

  return {
    methods: enabled.length ? enabled : DEFAULT_SHIPPING_METHODS.filter((m) => m.enabled !== false),
    defaultId: defaultId || fallbackId,
  };
}

function clampQty(value) {
  const parsed = Number.parseInt(String(value ?? 1), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
}

function productSearchValue(p) {
  return [p?.name, p?.sku, p?.id].filter(Boolean).join(' ');
}

export default function AdminOrders() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [trackingForm, setTrackingForm] = useState({ tracking_carrier: '', tracking_code: '', tracking_url: '' });

  const [saleOpen, setSaleOpen] = useState(false);
  const [saleForm, setSaleForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    shipping_address: '',
    shipping_city: '',
    shipping_postal_code: '',
    shipping_country: 'Portugal',
    shipping_method_id: '',
    payment_method: 'mbway',
    status: 'confirmed',
    notes: '',
	  });
	  const [saleLines, setSaleLines] = useState([{ product_id: '', quantity: 1 }]);
	  const [productPickerOpenIndex, setProductPickerOpenIndex] = useState(null);

  const { data: orders = [] } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 500),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => base44.entities.Product.list('-created_date', 500),
    staleTime: 60_000,
  });

  const { data: shippingData } = useQuery({
    queryKey: ['content-shipping'],
    queryFn: () => base44.content.shipping(),
    staleTime: 60_000,
  });

  const shippingCfg = useMemo(() => normalizeShippingMethods(shippingData?.content ?? null), [shippingData?.content]);
  const shippingMethods = shippingCfg.methods;

  const shippingMethodOptions = useMemo(() => {
    return (shippingMethods ?? []).map((m) => ({ value: m.id, label: m.label }));
  }, [shippingMethods]);

  const byProductId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const filtered = useMemo(() => {
    return statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Atualizado.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível atualizar.')),
  });

  const createSaleMutation = useMutation({
    mutationFn: (payload) => base44.admin.orders.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setSaleOpen(false);
    },
  });

  useEffect(() => {
    if (!selected) return;
    setTrackingForm({
      tracking_carrier: selected.tracking_carrier || '',
      tracking_code: selected.tracking_code || '',
      tracking_url: selected.tracking_url || '',
    });
  }, [selected]);

  useEffect(() => {
    if (!saleOpen) return;
    setSaleForm((p) => ({
      ...p,
      shipping_method_id: p.shipping_method_id || shippingCfg.defaultId || '',
    }));
  }, [saleOpen, shippingCfg.defaultId]);

  const computedSale = useMemo(() => {
    const lines = (saleLines ?? []).map((l) => ({
      product_id: l?.product_id ? String(l.product_id) : '',
      quantity: clampQty(l?.quantity),
    }));

    const items = lines
      .map((l) => {
        if (!l.product_id) return null;
        const p = byProductId.get(l.product_id);
        if (!p) return null;
        const price = Number(p.price ?? 0) || 0;
        return {
          product_id: p.id,
          product_name: p.name,
          product_image: getPrimaryImage(p.images),
          price,
          quantity: l.quantity,
          color: null,
          free_shipping: Boolean(p.free_shipping),
        };
      })
      .filter(Boolean);

    const subtotal = items.reduce((sum, it) => sum + (Number(it.price ?? 0) || 0) * it.quantity, 0);
    const selectedMethod = shippingMethods.find((m) => m.id === saleForm.shipping_method_id) ?? null;
    const allFree = items.length > 0 && items.every((it) => it.free_shipping);
    const methodPrice = Number(selectedMethod?.price ?? 0) || 0;
    const freeOver = selectedMethod?.free_over === null || selectedMethod?.free_over === undefined ? null : Number(selectedMethod.free_over);

    let shippingCost = 0;
    if (!allFree) {
      if (freeOver && subtotal >= freeOver) shippingCost = 0;
      else shippingCost = methodPrice;
    }

    const total = subtotal + shippingCost;

    return {
      items,
      subtotal,
      shippingCost,
      total,
      shipping_method_label: selectedMethod?.label ?? null,
    };
  }, [byProductId, saleForm.shipping_method_id, saleLines, shippingMethods]);

  const resetSale = () => {
    setSaleForm({
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      shipping_address: '',
      shipping_city: '',
      shipping_postal_code: '',
      shipping_country: 'Portugal',
      shipping_method_id: shippingCfg.defaultId || '',
      payment_method: 'mbway',
      status: 'confirmed',
      notes: '',
    });
    setSaleLines([{ product_id: '', quantity: 1 }]);
  };

  const openSale = () => {
    resetSale();
    setSaleOpen(true);
  };

  const submitSale = async () => {
    if (!saleForm.customer_name.trim() || !saleForm.customer_email.trim()) {
      toast.error('Preencha nome e email.');
      return;
    }
    if (computedSale.items.length === 0) {
      toast.error('Adicione pelo menos um produto.');
      return;
    }

    const payload = {
      customer_name: saleForm.customer_name.trim(),
      customer_email: saleForm.customer_email.trim(),
      customer_phone: saleForm.customer_phone.trim() || null,
      shipping_address: saleForm.shipping_address.trim() || null,
      shipping_city: saleForm.shipping_city.trim() || null,
      shipping_postal_code: saleForm.shipping_postal_code.trim() || null,
      shipping_country: saleForm.shipping_country.trim() || null,
      shipping_method_id: saleForm.shipping_method_id || null,
      shipping_method_label: computedSale.shipping_method_label,
      payment_method: saleForm.payment_method || null,
      notes: saleForm.notes.trim() || null,
      status: saleForm.status,
      items: computedSale.items.map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        product_image: it.product_image,
        price: it.price,
        quantity: it.quantity,
        color: it.color,
      })),
      subtotal: computedSale.subtotal,
      shipping_cost: computedSale.shippingCost,
      total: computedSale.total,
    };

    await toastApiPromise(createSaleMutation.mutateAsync(payload), {
      loading: 'A criar venda...',
      success: 'Venda criada.',
      error: (e) => getErrorMessage(e, 'Não foi possível criar a venda.'),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="font-heading text-3xl">Encomendas</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={openSale} className="rounded-none font-body text-sm gap-2">
            <Plus className="w-4 h-4" />
            Nova venda
          </Button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 rounded-none">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(statusLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Cliente</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Data</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Total</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Estado</th>
              <th className="text-right p-3 font-body text-xs text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                <td className="p-3">
                  <p className="font-body text-sm font-medium">{order.customer_name}</p>
                  <p className="font-body text-xs text-muted-foreground">{order.customer_email}</p>
                </td>
                <td className="p-3 font-body text-xs whitespace-nowrap">
                  {format(new Date(order.created_date), 'd MMM yyyy', { locale: pt })}
                </td>
                <td className="p-3 font-body text-sm font-medium whitespace-nowrap">{order.total?.toFixed(2)} €</td>
                <td className="p-3">
                  <Select
                    value={order.status}
                    onValueChange={(v) => updateMutation.mutate({ id: order.id, data: { status: v } })}
                  >
                    <SelectTrigger
                      className={`w-36 h-8 rounded-none px-2 font-body text-[11px] font-semibold ${statusSelectClasses[order.status] || ''}`}
                    >
                      <span className="truncate">{statusLabels[order.status] || order.status}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3 text-right">
                  <Button variant="ghost" size="icon" onClick={() => setSelected(order)} title="Ver detalhes">
                    <Eye className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center py-8 font-body text-sm text-muted-foreground">Sem encomendas</p>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Detalhes da Encomenda</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 font-body text-sm">
                <div>
                  <span className="text-muted-foreground">Cliente:</span>
                  <p className="font-medium">{selected.customer_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <p className="font-medium">{selected.customer_email}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Telefone:</span>
                  <p className="font-medium">{selected.customer_phone || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Pagamento:</span>
                  <p className="font-medium">{selected.payment_method || '-'}</p>
                </div>
              </div>

              <div className="font-body text-sm">
                <span className="text-muted-foreground">Morada:</span>
                <p className="font-medium">
                  {selected.shipping_address || '-'} {selected.shipping_city || ''} {selected.shipping_postal_code || ''}
                </p>
              </div>

              {selected.shipping_method_label ? (
                <div className="font-body text-sm">
                  <span className="text-muted-foreground">Envio:</span>
                  <p className="font-medium">{selected.shipping_method_label}</p>
                </div>
              ) : null}

              <div className="bg-secondary/20 border border-border rounded-md p-4">
                <div className="font-heading text-base mb-3">Rastreamento</div>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="font-body text-xs">Transportadora</Label>
                      <Input
                        value={trackingForm.tracking_carrier}
                        onChange={(e) => setTrackingForm((p) => ({ ...p, tracking_carrier: e.target.value }))}
                        className="rounded-none mt-1"
                        placeholder="Ex: CTT"
                      />
                    </div>
                    <div>
                      <Label className="font-body text-xs">Código</Label>
                      <Input
                        value={trackingForm.tracking_code}
                        onChange={(e) => setTrackingForm((p) => ({ ...p, tracking_code: e.target.value }))}
                        className="rounded-none mt-1"
                        placeholder="Ex: AB123..."
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="font-body text-xs">Link</Label>
                    <Input
                      value={trackingForm.tracking_url}
                      onChange={(e) => setTrackingForm((p) => ({ ...p, tracking_url: e.target.value }))}
                      className="rounded-none mt-1"
                      placeholder="https://..."
                    />
                  </div>
                  <Button
                    className="rounded-none font-body text-sm w-full"
                    onClick={() => updateMutation.mutate({ id: selected.id, data: { ...trackingForm } })}
                    disabled={updateMutation.isPending}
                  >
                    Guardar rastreamento
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                {selected.items?.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {item.product_image ? (
                        <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                          <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : null}
                      <div className="min-w-0">
                        <p className="font-body text-sm truncate">{item.product_name}</p>
                        <p className="font-body text-xs text-muted-foreground">x{item.quantity}</p>
                      </div>
                    </div>
                    <p className="font-body text-sm whitespace-nowrap">{(item.price * item.quantity).toFixed(2)} €</p>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="font-body text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{selected.subtotal?.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span>Envio</span>
                  <span>{selected.shipping_cost?.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between font-semibold text-base">
                  <span>Total</span>
                  <span>{selected.total?.toFixed(2)} €</span>
                </div>
              </div>

              {selected.notes ? (
                <div className="font-body text-sm">
                  <span className="text-muted-foreground">Notas:</span>
                  <p>{selected.notes}</p>
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={saleOpen} onOpenChange={(v) => setSaleOpen(v)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Nova venda</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label className="font-body text-xs">Nome *</Label>
                <Input
                  value={saleForm.customer_name}
                  onChange={(e) => setSaleForm((p) => ({ ...p, customer_name: e.target.value }))}
                  className="rounded-none mt-1"
                />
              </div>
              <div>
                <Label className="font-body text-xs">Telefone</Label>
                <Input
                  value={saleForm.customer_phone}
                  onChange={(e) => setSaleForm((p) => ({ ...p, customer_phone: e.target.value }))}
                  className="rounded-none mt-1"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="font-body text-xs">Email *</Label>
                <Input
                  type="email"
                  value={saleForm.customer_email}
                  onChange={(e) => setSaleForm((p) => ({ ...p, customer_email: e.target.value }))}
                  className="rounded-none mt-1"
                />
              </div>
              <div>
                <Label className="font-body text-xs">Estado</Label>
                <Select value={saleForm.status} onValueChange={(v) => setSaleForm((p) => ({ ...p, status: v }))}>
                  <SelectTrigger className="rounded-none mt-1">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

	            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
	              <div>
	                <Label className="font-body text-xs">Método de envio</Label>
                  {shippingMethods.length > 10 ? (
                    <SearchableSelect
                      value={saleForm.shipping_method_id || shippingCfg.defaultId || ''}
                      onChange={(v) => setSaleForm((p) => ({ ...p, shipping_method_id: v }))}
                      options={shippingMethodOptions}
                      placeholder="Selecionar..."
                      searchPlaceholder="Pesquisar método..."
                      className="mt-1"
                    />
                  ) : (
                    <Select
                      value={saleForm.shipping_method_id || shippingCfg.defaultId || ''}
                      onValueChange={(v) => setSaleForm((p) => ({ ...p, shipping_method_id: v }))}
                    >
                      <SelectTrigger className="rounded-none mt-1">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {shippingMethods.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
	              </div>
              <div>
                <Label className="font-body text-xs">Pagamento</Label>
                <Select value={saleForm.payment_method} onValueChange={(v) => setSaleForm((p) => ({ ...p, payment_method: v }))}>
                  <SelectTrigger className="rounded-none mt-1">
                    <SelectValue placeholder="Pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mbway">MB WAY</SelectItem>
                    <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                    <SelectItem value="multibanco">Multibanco</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label className="font-body text-xs">Morada</Label>
                <Input
                  value={saleForm.shipping_address}
                  onChange={(e) => setSaleForm((p) => ({ ...p, shipping_address: e.target.value }))}
                  className="rounded-none mt-1"
                />
              </div>
              <div>
                <Label className="font-body text-xs">Cidade</Label>
                <Input
                  value={saleForm.shipping_city}
                  onChange={(e) => setSaleForm((p) => ({ ...p, shipping_city: e.target.value }))}
                  className="rounded-none mt-1"
                />
              </div>
              <div>
                <Label className="font-body text-xs">Código postal</Label>
                <Input
                  value={saleForm.shipping_postal_code}
                  onChange={(e) => setSaleForm((p) => ({ ...p, shipping_postal_code: e.target.value }))}
                  className="rounded-none mt-1"
                />
              </div>
              <div>
                <Label className="font-body text-xs">País</Label>
                <Input
                  value={saleForm.shipping_country}
                  onChange={(e) => setSaleForm((p) => ({ ...p, shipping_country: e.target.value }))}
                  className="rounded-none mt-1"
                />
              </div>
            </div>

            <div className="bg-secondary/15 border border-border rounded-lg p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div className="font-heading text-lg">Produtos</div>
                <Button
                  variant="outline"
                  className="rounded-none font-body text-sm gap-2"
                  onClick={() => setSaleLines((p) => [...p, { product_id: '', quantity: 1 }])}
                >
                  <Plus className="w-4 h-4" />
                  Adicionar produto
                </Button>
              </div>

              <div className="space-y-3">
                {saleLines.map((line, idx) => {
                  const product = line.product_id ? byProductId.get(line.product_id) : null;
                  const unitPrice = Number(product?.price ?? 0) || 0;
                  const lineTotal = unitPrice * clampQty(line.quantity);
                  return (
                    <div key={`${idx}`} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
	                      <div className="md:col-span-7">
	                        <Label className="font-body text-xs">Produto</Label>
	                        <Popover
	                          open={productPickerOpenIndex === idx}
	                          onOpenChange={(open) => setProductPickerOpenIndex(open ? idx : null)}
	                        >
	                          <PopoverTrigger asChild>
	                            <Button
	                              variant="outline"
	                              className="w-full justify-between rounded-none mt-1 font-body text-sm font-normal"
	                              title={product?.id ? String(product.id) : undefined}
	                            >
	                              <span className="truncate">{product?.name ?? 'Selecionar...'}</span>
	                              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
	                            </Button>
	                          </PopoverTrigger>
	                          <PopoverContent align="start" className="p-0 w-[var(--radix-popover-trigger-width)]">
	                            <Command>
	                              <CommandInput placeholder="Pesquisar por nome, ID ou SKU..." />
	                              <CommandList>
	                                <CommandEmpty>Sem resultados.</CommandEmpty>
	                                <CommandGroup>
	                                  {products.map((p) => {
	                                    const sku = p?.sku ? String(p.sku) : '';
	                                    return (
	                                      <CommandItem
	                                        key={p.id}
	                                        value={productSearchValue(p)}
	                                        onSelect={() => {
	                                          setSaleLines((prev) =>
	                                            prev.map((x, i) => (i === idx ? { ...x, product_id: p.id } : x)),
	                                          );
	                                          setProductPickerOpenIndex(null);
	                                        }}
	                                      >
	                                        <div className="min-w-0 flex-1">
	                                          <div className="font-body text-sm truncate">{p.name}</div>
	                                          <div className="font-body text-[11px] text-muted-foreground truncate">
	                                            {sku ? `SKU: ${sku} · ` : ''}
	                                            {String(p.id)}
	                                          </div>
	                                        </div>
	                                        {line.product_id === p.id ? <Check className="h-4 w-4 text-primary" /> : null}
	                                      </CommandItem>
	                                    );
	                                  })}
	                                </CommandGroup>
	                              </CommandList>
	                            </Command>
	                          </PopoverContent>
	                        </Popover>
	                      </div>

                      <div className="md:col-span-2">
                        <Label className="font-body text-xs">Qtd.</Label>
                        <Input
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(e) =>
                            setSaleLines((p) => p.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))
                          }
                          className="rounded-none mt-1"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <div className="font-body text-xs text-muted-foreground">Total</div>
                        <div className="font-body text-sm font-semibold whitespace-nowrap">{lineTotal.toFixed(2)} €</div>
                      </div>

	                      <div className="md:col-span-1 flex md:justify-end">
	                        <Button
	                          variant="ghost"
	                          size="icon"
	                          title="Remover"
	                          onClick={() => {
	                            setProductPickerOpenIndex(null);
	                            setSaleLines((p) => p.filter((_, i) => i !== idx));
	                          }}
	                          disabled={saleLines.length <= 1}
	                        >
                          <DeleteIcon className="text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label className="font-body text-xs">Notas</Label>
                <Textarea
                  value={saleForm.notes}
                  onChange={(e) => setSaleForm((p) => ({ ...p, notes: e.target.value }))}
                  className="rounded-none mt-1 min-h-[90px]"
                />
              </div>
              <div className="bg-card border border-border rounded-lg p-4 h-fit">
                <div className="font-heading text-lg mb-3">Resumo</div>
                <div className="font-body text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{computedSale.subtotal.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Envio</span>
                    <span>{computedSale.shippingCost === 0 ? 'Grátis' : `${computedSale.shippingCost.toFixed(2)} €`}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold text-base">
                    <span>Total</span>
                    <span>{computedSale.total.toFixed(2)} €</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end flex-wrap">
              <Button
                variant="outline"
                className="rounded-none font-body text-sm"
                onClick={() => setSaleOpen(false)}
                disabled={createSaleMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                className="rounded-none font-body text-sm tracking-wider"
                onClick={submitSale}
                disabled={createSaleMutation.isPending}
              >
                {createSaleMutation.isPending ? 'A criar...' : 'Criar venda'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
