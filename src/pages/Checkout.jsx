import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, ShoppingBag } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useCart } from '@/lib/CartContext';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { toastApiPromise } from '@/lib/toast';
import { useAuth } from '@/lib/AuthContext';

const DEFAULT_SHIPPING_METHODS = [
  { id: 'standard', label: 'Standard', price: 4.99, free_over: 50, enabled: true, description: 'Entrega em 2–4 dias úteis.' },
  { id: 'express', label: 'Expresso', price: 7.99, free_over: null, enabled: false, description: 'Entrega em 1–2 dias úteis.' },
  { id: 'pickup', label: 'Levantamento', price: 0, free_over: null, enabled: false, description: 'Levante a encomenda num ponto combinado.' },
];

const METHOD_META = [
  { value: 'mbway', label: 'MB WAY' },
  { value: 'transferencia', label: 'Transferência Bancária' },
  { value: 'multibanco', label: 'Multibanco' },
  { value: 'paypal', label: 'PayPal' },
];

function getEnabledMethods(payments) {
  const methods = payments?.methods && typeof payments.methods === 'object' ? payments.methods : {};
  const enabled = METHOD_META.filter((m) => methods?.[m.value]?.enabled !== false);
  return enabled.length ? enabled : METHOD_META;
}

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

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const [step, setStep] = useState('form');
  const [submitting, setSubmitting] = useState(false);

  const { data: paymentsData } = useQuery({
    queryKey: ['content-payments'],
    queryFn: () => base44.content.payments(),
    staleTime: 60_000,
  });

  const { data: shippingData } = useQuery({
    queryKey: ['content-shipping'],
    queryFn: () => base44.content.shipping(),
    staleTime: 60_000,
  });

  const payments = paymentsData?.content ?? null;
  const shippingContent = shippingData?.content ?? null;

  const paymentOptions = useMemo(() => getEnabledMethods(payments), [payments]);
  const shippingCfg = useMemo(() => normalizeShippingMethods(shippingContent), [shippingContent]);
  const shippingMethods = shippingCfg.methods;

  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    shipping_address: '',
    shipping_city: '',
    shipping_postal_code: '',
    shipping_method_id: 'standard',
    payment_method: 'mbway',
    notes: '',
  });

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      customer_email: prev.customer_email || user.email || '',
      customer_name: prev.customer_name || user.full_name || '',
      customer_phone: prev.customer_phone || user.phone || '',
    }));
  }, [user]);

  useEffect(() => {
    if (!paymentOptions?.length) return;
    const current = form.payment_method;
    if (paymentOptions.some((o) => o.value === current)) return;
    setForm((p) => ({ ...p, payment_method: paymentOptions[0].value }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentOptions.map((o) => o.value).join('|')]);

  useEffect(() => {
    if (!shippingMethods?.length) return;
    const current = form.shipping_method_id;
    if (shippingMethods.some((m) => m.id === current)) return;
    setForm((p) => ({ ...p, shipping_method_id: shippingCfg.defaultId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingMethods.map((m) => m.id).join('|')]);

  const selectedPaymentCfg =
    payments?.methods && typeof payments.methods === 'object' ? payments.methods?.[form.payment_method] ?? null : null;

  const selectedShipping = useMemo(() => {
    return shippingMethods.find((m) => m.id === form.shipping_method_id) ?? shippingMethods[0] ?? null;
  }, [shippingMethods, form.shipping_method_id]);

  const shipping = useMemo(() => {
    const allFree = (items ?? []).length > 0 && (items ?? []).every((i) => !!i.free_shipping);
    if (allFree) return 0;
    const price = Number(selectedShipping?.price ?? 0) || 0;
    const freeOver = selectedShipping?.free_over === null || selectedShipping?.free_over === undefined ? null : Number(selectedShipping.free_over);
    if (freeOver && subtotal >= freeOver) return 0;
    return price;
  }, [items, selectedShipping, subtotal]);

  const total = subtotal + shipping;

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !form.customer_name ||
      !form.customer_email ||
      !form.shipping_address ||
      !form.shipping_city ||
      !form.shipping_postal_code
    ) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSubmitting(true);
    try {
      await toastApiPromise(
        base44.entities.Order.create({
          ...form,
          shipping_method_id: selectedShipping?.id ?? form.shipping_method_id ?? null,
          shipping_method_label: selectedShipping?.label ?? null,
          items: items.map((i) => ({
            product_id: i.product_id,
            product_name: i.product_name,
            product_image: i.product_image,
            price: i.price,
            quantity: i.quantity,
            color: i.color,
          })),
          subtotal,
          shipping_cost: shipping,
          total,
          status: 'pending',
        }),
        {
          loading: 'A confirmar encomenda...',
          success: 'Encomenda confirmada com sucesso!',
          error: 'Não foi possível confirmar a encomenda.',
        },
      );
      clearCart();
      setStep('success');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0 && step !== 'success') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <ShoppingBag className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h1 className="font-heading text-3xl mb-2">Carrinho Vazio</h1>
        <Link to="/catalogo">
          <Button className="rounded-none font-body text-sm mt-4">Explorar Catálogo</Button>
        </Link>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
        <h1 className="font-heading text-3xl mb-2">Encomenda Confirmada!</h1>
        <p className="font-body text-sm text-muted-foreground mb-6 max-w-md">
          Obrigada pela sua compra! Receberá um email com os detalhes da encomenda e instruções de pagamento.
        </p>
        <Link to="/catalogo">
          <Button className="rounded-none font-body text-sm tracking-wider">Continuar a Comprar</Button>
        </Link>
      </div>
    );
  }

  const renderPaymentDetails = () => {
    const cfg = selectedPaymentCfg;
    const notes = String(payments?.general_notes ?? '').trim();
    const instructions = String(cfg?.instructions ?? '').trim();

    const pairs = [];
    if (form.payment_method === 'mbway' && cfg?.phone) pairs.push(['Número', cfg.phone]);
    if (form.payment_method === 'transferencia') {
      if (cfg?.iban) pairs.push(['IBAN', cfg.iban]);
      if (cfg?.holder) pairs.push(['Titular', cfg.holder]);
      if (cfg?.bank) pairs.push(['Banco', cfg.bank]);
    }
    if (form.payment_method === 'multibanco') {
      if (cfg?.entity) pairs.push(['Entidade', cfg.entity]);
      if (cfg?.reference) pairs.push(['Referência', cfg.reference]);
    }
    if (form.payment_method === 'paypal' && cfg?.email) pairs.push(['Email', cfg.email]);

    if (!notes && !instructions && pairs.length === 0) return null;

    return (
      <div className="mt-4 border border-border rounded-md p-4 bg-secondary/20">
        <div className="font-body text-xs tracking-wider uppercase text-muted-foreground mb-2">Informação de pagamento</div>
        {notes ? <p className="font-body text-sm text-muted-foreground whitespace-pre-line mb-3">{notes}</p> : null}
        {pairs.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            {pairs.map(([k, v]) => (
              <div key={k} className="text-sm">
                <span className="font-body text-xs text-muted-foreground">{k}:</span>{' '}
                <span className="font-body text-sm">{String(v)}</span>
              </div>
            ))}
          </div>
        ) : null}
        {instructions ? (
          <p className="font-body text-sm whitespace-pre-line">{instructions}</p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <h1 className="font-heading text-3xl md:text-4xl mb-8">Checkout</h1>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card p-6 rounded-lg border border-border">
              <h2 className="font-heading text-xl mb-4">Dados Pessoais</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-body text-xs">Nome Completo *</Label>
                  <Input value={form.customer_name} onChange={(e) => handleChange('customer_name', e.target.value)} className="rounded-none mt-1" />
                </div>
                <div>
                  <Label className="font-body text-xs">Email *</Label>
                  <Input type="email" value={form.customer_email} onChange={(e) => handleChange('customer_email', e.target.value)} className="rounded-none mt-1" />
                </div>
                <div>
                  <Label className="font-body text-xs">Telefone</Label>
                  <Input value={form.customer_phone} onChange={(e) => handleChange('customer_phone', e.target.value)} className="rounded-none mt-1" />
                </div>
              </div>
            </div>

	            <div className="bg-card p-6 rounded-lg border border-border">
	              <h2 className="font-heading text-xl mb-4">Morada de Envio</h2>
	              <div className="space-y-4">
                <div>
                  <Label className="font-body text-xs">Morada *</Label>
                  <Input value={form.shipping_address} onChange={(e) => handleChange('shipping_address', e.target.value)} className="rounded-none mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="font-body text-xs">Cidade *</Label>
                    <Input value={form.shipping_city} onChange={(e) => handleChange('shipping_city', e.target.value)} className="rounded-none mt-1" />
                  </div>
                  <div>
                    <Label className="font-body text-xs">Código Postal *</Label>
                    <Input value={form.shipping_postal_code} onChange={(e) => handleChange('shipping_postal_code', e.target.value)} className="rounded-none mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="font-body text-xs">Notas</Label>
                  <Textarea value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} className="rounded-none mt-1" rows={3} />
                </div>
	              </div>
	            </div>

	            <div className="bg-card p-6 rounded-lg border border-border">
	              <h2 className="font-heading text-xl mb-4">Método de envio</h2>
	              <RadioGroup
	                value={form.shipping_method_id}
	                onValueChange={(v) => handleChange('shipping_method_id', v)}
	                className="space-y-3"
	              >
	                {shippingMethods.map((m) => {
	                  const price = Number(m.price ?? 0) || 0;
	                  const freeOver = m.free_over === null || m.free_over === undefined ? null : Number(m.free_over);
	                  return (
	                    <div key={m.id} className="flex items-start gap-3 p-3 border border-border rounded-sm hover:bg-secondary/30">
	                      <RadioGroupItem value={m.id} id={`ship-${m.id}`} className="mt-1" />
	                      <div className="flex-1 min-w-0">
	                        <Label htmlFor={`ship-${m.id}`} className="font-body text-sm cursor-pointer flex items-center justify-between gap-3">
	                          <span className="font-medium">{m.label}</span>
	                          <span className="text-muted-foreground text-xs">
	                            {shipping === 0 && selectedShipping?.id === m.id
	                              ? 'Grátis'
	                              : price === 0
	                                ? 'Grátis'
	                                : `${price.toFixed(2)} €`}
	                          </span>
	                        </Label>
	                        {m.description ? (
	                          <div className="font-body text-[11px] text-muted-foreground mt-1">{m.description}</div>
	                        ) : null}
	                        {freeOver ? (
	                          <div className="font-body text-[11px] text-muted-foreground mt-1">
	                            Grátis a partir de {freeOver.toFixed(2)} €
	                          </div>
	                        ) : null}
	                      </div>
	                    </div>
	                  );
	                })}
	              </RadioGroup>
	            </div>
	
	            <div className="bg-card p-6 rounded-lg border border-border">
	              <h2 className="font-heading text-xl mb-4">Pagamento</h2>
              <RadioGroup value={form.payment_method} onValueChange={(v) => handleChange('payment_method', v)} className="space-y-3">
                {paymentOptions.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-3 p-3 border border-border rounded-sm hover:bg-secondary/30">
                    <RadioGroupItem value={opt.value} id={opt.value} />
                    <Label htmlFor={opt.value} className="font-body text-sm cursor-pointer flex-1">
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              {renderPaymentDetails()}
            </div>
          </div>

          <div className="bg-card p-6 rounded-lg border border-border h-fit sticky top-24">
            <h2 className="font-heading text-xl mb-4">Resumo do Pedido</h2>
            <div className="space-y-3 mb-4">
              {items.map((item) => (
                <div key={`${item.product_id}-${item.color}`} className="flex gap-3">
                  <div className="w-12 h-12 rounded bg-secondary/30 overflow-hidden flex-shrink-0">
                    {item.product_image ? <img src={item.product_image} alt="" className="w-full h-full object-cover" /> : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-xs font-medium truncate">{item.product_name}</p>
                    <p className="font-body text-[11px] text-muted-foreground">x{item.quantity}</p>
                  </div>
                  <p className="font-body text-xs font-medium">{(item.price * item.quantity).toFixed(2)} €</p>
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="space-y-2 font-body text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{subtotal.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Envio</span>
                <span>{shipping === 0 ? 'Grátis' : `${shipping.toFixed(2)} €`}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold text-base">
                <span>Total</span>
                <span>{total.toFixed(2)} €</span>
              </div>
            </div>
            <Button type="submit" disabled={submitting} className="w-full rounded-none py-6 font-body text-sm tracking-wider mt-6">
              {submitting ? 'A processar...' : 'Confirmar Encomenda'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
