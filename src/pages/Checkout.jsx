import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, ShoppingBag } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import ImageWithFallback from '@/components/ui/image-with-fallback';
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paymentProofUrl, setPaymentProofUrl] = useState(null);
  const [paymentProofName, setPaymentProofName] = useState('');
  const [paymentProofUploading, setPaymentProofUploading] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);

  const { data: paymentsData } = useQuery({
    queryKey: ['content-payments'],
    queryFn: () => base44.content.payments(),
    staleTime: 60_000,
  });

  const { data: loyaltyData } = useQuery({
    queryKey: ['content-loyalty'],
    queryFn: () => base44.content.loyalty(),
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
    shipping_country: 'Portugal',
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

  const { data: addresses = [] } = useQuery({
    queryKey: ['my-addresses'],
    queryFn: () => base44.user.addresses.list(),
    enabled: !!user,
    staleTime: 30_000,
  });

  const defaultAddress = useMemo(() => {
    const list = Array.isArray(addresses) ? addresses : [];
    return list.find((a) => a?.is_default) ?? list[0] ?? null;
  }, [addresses]);

  const [selectedAddressId, setSelectedAddressId] = useState('manual');

  const selectedAddress = useMemo(() => {
    if (!selectedAddressId || selectedAddressId === 'manual') return null;
    return (addresses ?? []).find((a) => a?.id === selectedAddressId) ?? null;
  }, [addresses, selectedAddressId]);

  const formatAddress = (a) => {
    if (!a) return '';
    const parts = [a?.line1, a?.line2, a?.postal_code, a?.city, a?.country].filter(Boolean);
    return parts.join(', ');
  };

  useEffect(() => {
    if (!user) return;
    const list = Array.isArray(addresses) ? addresses : [];
    if (!list.length) {
      setSelectedAddressId('manual');
      return;
    }
    if (selectedAddressId && selectedAddressId !== 'manual' && list.some((a) => a?.id === selectedAddressId)) return;
    setSelectedAddressId(defaultAddress?.id ?? 'manual');
     
  }, [user, addresses, defaultAddress?.id]);

  useEffect(() => {
    if (!user) return;
    if (!selectedAddress || selectedAddressId === 'manual') return;

    const line = [selectedAddress.line1, selectedAddress.line2].filter(Boolean).join(', ');
    setForm((prev) => ({
      ...prev,
      shipping_address: line || prev.shipping_address || '',
      shipping_city: selectedAddress.city ?? prev.shipping_city ?? '',
      shipping_postal_code: selectedAddress.postal_code ?? prev.shipping_postal_code ?? '',
      shipping_country: selectedAddress.country ?? prev.shipping_country ?? 'Portugal',
    }));
  }, [selectedAddress, selectedAddressId, user]);

  useEffect(() => {
    if (!paymentOptions?.length) return;
    const current = form.payment_method;
    if (paymentOptions.some((o) => o.value === current)) return;
    setForm((p) => ({ ...p, payment_method: paymentOptions[0].value }));
     
  }, [paymentOptions.map((o) => o.value).join('|')]);

  useEffect(() => {
    if (!shippingMethods?.length) return;
    const current = form.shipping_method_id;
    if (shippingMethods.some((m) => m.id === current)) return;
    setForm((p) => ({ ...p, shipping_method_id: shippingCfg.defaultId }));
     
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

  const couponDiscount = useMemo(() => {
    if (!coupon) return 0
    const amount = Number(coupon.discount_amount ?? 0) || 0
    return Math.min(amount, subtotal + shipping)
  }, [coupon, subtotal, shipping])

  const totalWithCoupon = Math.max(0, subtotal + shipping - couponDiscount)

  const pointValue = Math.max(0.000001, Number(loyaltyData?.content?.point_value_eur ?? 0.01) || 0.01);
  const pointsAvailable = Number(user?.points_balance ?? 0) || 0;
  const maxPointsByTotal = Math.floor(totalWithCoupon / pointValue);
  const pointsUsed = Math.max(0, Math.min(Number(pointsToUse) || 0, pointsAvailable, maxPointsByTotal));
  const pointsDiscount = pointsUsed * pointValue;
  const totalAfterPoints = Math.max(0, totalWithCoupon - pointsDiscount);

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    if (form.payment_method === 'transferencia') return;
    setPaymentProofUrl(null);
    setPaymentProofName('');
    setPaymentProofUploading(false);
  }, [form.payment_method]);

  const handleProofSelected = async (file) => {
    if (!file) return;
    const maxBytes = 3 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error('O comprovativo deve ter no máximo 3MB.');
      return;
    }

    setPaymentProofUploading(true);
    try {
      const uploaded = await base44.integrations.Core.UploadFile({ file });
      const url = String(uploaded?.file_url ?? '').trim();
      if (!url) throw new Error('upload_failed');
      setPaymentProofUrl(url);
      setPaymentProofName(file.name || 'comprovativo');
      toast.success('Comprovativo anexado.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível anexar o comprovativo.');
    } finally {
      setPaymentProofUploading(false);
    }
  };

  const handleApplyCoupon = async () => {
    const trimmed = couponCode.trim()
    if (!trimmed) {
      setCoupon(null)
      setCouponError('Insira um código de cupom')
      return
    }

    setCouponLoading(true)
    setCouponError('')
    try {
      const result = await base44.coupons.validate(trimmed, subtotal)
      setCoupon(result)
      setCouponError('Cupom aplicado com sucesso')
    } catch (error) {
      setCoupon(null)
      setCouponError(error?.data?.detail ?? error?.message ?? 'Não foi possível validar o cupom')
    } finally {
      setCouponLoading(false)
    }
  }

  const handleRemoveCoupon = () => {
    setCoupon(null)
    setCouponCode('')
    setCouponError('Cupom removido')
  }

  const handleConfirm = (e) => {
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

    if (form.payment_method === 'transferencia' && !paymentProofUrl) {
      toast.error('Anexe o comprovativo de transferência para continuar.');
      return;
    }

    if (form.payment_method === 'transferencia' && paymentProofUploading) {
      toast.error('Aguarde o upload do comprovativo.');
      return;
    }

    setConfirmOpen(true);
  };

  const handleSubmit = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      await toastApiPromise(
        base44.entities.Order.create({
          ...form,
          shipping_method_id: selectedShipping?.id ?? form.shipping_method_id ?? null,
          shipping_method_label: selectedShipping?.label ?? null,
          coupon_code: coupon?.code ?? null,
          points_to_use: pointsUsed || null,
          payment_proof_url: form.payment_method === 'transferencia' ? paymentProofUrl : null,
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
          total: totalAfterPoints,
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

      <form onSubmit={handleConfirm}>
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
                {user ? (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="font-body text-xs text-muted-foreground">Escolha um endereço guardado</div>
                    <Link to="/conta#enderecos" className="font-body text-xs text-primary hover:underline">
                      Gerir endereços
                    </Link>
                  </div>
                ) : null}

                {user && (addresses ?? []).length > 0 ? (
                  <RadioGroup value={selectedAddressId} onValueChange={setSelectedAddressId} className="space-y-2">
                    {(addresses ?? []).map((a) => (
                      <div
                        key={a.id}
                        className="flex items-start gap-3 p-3 border border-border rounded-sm hover:bg-secondary/30"
                      >
                        <RadioGroupItem value={a.id} id={`addr-${a.id}`} className="mt-1" />
                        <Label htmlFor={`addr-${a.id}`} className="font-body text-sm cursor-pointer flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{a.label || 'Endereço'}</span>
                            {a.is_default ? (
                              <span className="text-[10px] font-body tracking-widest uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                Padrão
                              </span>
                            ) : null}
                          </div>
                          <div className="font-body text-[11px] text-muted-foreground mt-1 break-words">{formatAddress(a)}</div>
                        </Label>
                      </div>
                    ))}

                    <div className="flex items-start gap-3 p-3 border border-border rounded-sm hover:bg-secondary/30">
                      <RadioGroupItem value="manual" id="addr-manual" className="mt-1" />
                      <Label htmlFor="addr-manual" className="font-body text-sm cursor-pointer flex-1">
                        Outro endereço
                        <div className="font-body text-[11px] text-muted-foreground mt-1">
                          Introduzir morada diferente apenas para esta encomenda.
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                ) : user ? (
                  <div className="rounded-sm border border-border bg-secondary/10 p-3">
                    <div className="font-body text-sm font-medium">Sem endereços guardados</div>
                    <div className="font-body text-[11px] text-muted-foreground mt-1">
                      Preencha a morada abaixo ou adicione um endereço em{' '}
                      <Link to="/conta#enderecos" className="text-primary hover:underline">
                        Minha Conta
                      </Link>
                      .
                    </div>
                  </div>
                ) : null}

                {!user || selectedAddressId === 'manual' || (addresses ?? []).length === 0 ? (
                  <>
                    <div>
                      <Label className="font-body text-xs">Morada *</Label>
                      <Input
                        value={form.shipping_address}
                        onChange={(e) => handleChange('shipping_address', e.target.value)}
                        className="rounded-none mt-1"
                        placeholder="Rua, número, andar..."
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="font-body text-xs">Cidade *</Label>
                        <Input
                          value={form.shipping_city}
                          onChange={(e) => handleChange('shipping_city', e.target.value)}
                          className="rounded-none mt-1"
                          placeholder="Ex: Lisboa"
                        />
                      </div>
                      <div>
                        <Label className="font-body text-xs">Código Postal *</Label>
                        <Input
                          value={form.shipping_postal_code}
                          onChange={(e) => handleChange('shipping_postal_code', e.target.value)}
                          className="rounded-none mt-1"
                          placeholder="Ex: 1000-000"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="font-body text-xs">País</Label>
                      <Input
                        value={form.shipping_country}
                        onChange={(e) => handleChange('shipping_country', e.target.value)}
                        className="rounded-none mt-1"
                        placeholder="Portugal"
                      />
                    </div>
                  </>
                ) : selectedAddress ? (
                  <div className="rounded-sm border border-border bg-secondary/10 p-3">
                    <div className="font-body text-xs tracking-wider uppercase text-muted-foreground mb-1">Enviar para</div>
                    <div className="font-body text-sm break-words">{formatAddress(selectedAddress)}</div>
                  </div>
                ) : null}

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
              <h2 className="font-heading text-xl mb-4">Cupom de Desconto</h2>
              <div className="space-y-3">
                <div>
              <Label className="font-body text-xs">Código do cupom</Label>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 mt-1">
                <Input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Código do cupom"
                  className="rounded-none"
                />
                <Button type="button" onClick={handleApplyCoupon} disabled={couponLoading} className="rounded-none">
                  {couponLoading ? 'A aplicar...' : 'Aplicar'}
                </Button>
              </div>
            </div>
                {coupon ? (
                  <div className="rounded-sm border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                    Cupom <span className="font-semibold">{coupon.code}</span> aplicado. Desconto de {Number(coupon.discount_amount ?? 0).toFixed(2)} €.
                    <button type="button" className="ml-2 underline" onClick={handleRemoveCoupon}>
                      Remover
                    </button>
                  </div>
                ) : null}
                {couponError ? (
                  <div className="rounded-sm border border-muted-foreground/40 bg-muted/10 p-3 text-sm text-foreground/80">
                    {couponError}
                  </div>
                ) : null}
              </div>
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

              {form.payment_method === 'transferencia' ? (
                <div className="mt-4 rounded-md border border-border bg-secondary/10 p-4">
                  <div className="font-body text-xs tracking-wider uppercase text-muted-foreground mb-2">Comprovativo</div>
                  <Label className="font-body text-xs">Anexar comprovativo de transferência (imagem ou PDF) *</Label>
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    className="rounded-none mt-2"
                    disabled={paymentProofUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      void handleProofSelected(file);
                      e.target.value = '';
                    }}
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="font-body text-[11px] text-muted-foreground min-w-0 truncate">
                      {paymentProofUploading ? 'A anexar...' : paymentProofUrl ? `Anexado: ${paymentProofName || 'comprovativo'}` : 'Nenhum ficheiro anexado.'}
                    </div>
                    {paymentProofUrl ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-none font-body text-xs"
                        onClick={() => {
                          setPaymentProofUrl(null);
                          setPaymentProofName('');
                        }}
                        disabled={paymentProofUploading}
                      >
                        Remover
                      </Button>
                    ) : null}
                  </div>
                  {paymentProofUrl && String(paymentProofUrl).startsWith('data:image') ? (
                    <div className="mt-3 border border-border bg-background p-2">
                      <img src={paymentProofUrl} alt="Comprovativo" className="w-full max-h-56 object-contain" />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="bg-card p-6 rounded-lg border border-border h-fit sticky top-24">
            <h2 className="font-heading text-xl mb-4">Resumo do Pedido</h2>
            <div className="space-y-3 mb-4">
              {items.map((item) => (
                <div key={`${item.product_id}-${item.color}`} className="flex gap-3">
                  <div className="w-12 h-12 rounded bg-secondary/30 overflow-hidden flex-shrink-0">
                    <ImageWithFallback
                      src={item.product_image}
                      alt={item.product_name || ''}
                      className="w-full h-full"
                      iconClassName="w-6 h-6 text-muted-foreground/40"
                    />
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
              {couponDiscount > 0 ? (
                <div className="flex justify-between text-sm text-green-700">
                  <span className="text-muted-foreground">Desconto</span>
                  <span>-{couponDiscount.toFixed(2)} €</span>
                </div>
              ) : null}
              {pointsAvailable > 0 ? (
                <div className="pt-2">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                        <Label className="font-body text-xs">Pontos a Usar</Label>
                        <div className="text-[11px] text-muted-foreground mt-1">
                        Disponíveis: {pointsAvailable} • 1 ponto = {pointValue.toFixed(3)}€
                      </div>
                    </div>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={Math.min(pointsAvailable, maxPointsByTotal)}
                      step={1}
                      value={pointsToUse}
                      onChange={(e) => setPointsToUse(e.target.value)}
                      className="w-28 h-9 rounded-none text-right"
                    />
                  </div>
                </div>
              ) : null}
              {pointsUsed > 0 ? (
                <div className="flex justify-between text-sm text-green-700">
                  <span>Pontos ({pointsUsed})</span>
                  <span>-{pointsDiscount.toFixed(2)} €</span>
                </div>
              ) : null}
              <Separator />
              <div className="flex justify-between font-semibold text-base">
                <span>Total</span>
                <span>{totalAfterPoints.toFixed(2)} €</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Estes valores incluem subtotal, custos de envio, descontos de cupom e descontos por pontos. O total final é o valor a pagar.
              </p>
            </div>
            <Button type="submit" disabled={submitting} className="w-full rounded-none py-6 font-body text-sm tracking-wider mt-6">
              {submitting ? 'A processar...' : 'Confirmar Encomenda'}
            </Button>
          </div>
        </div>
      </form>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Confirmar Encomenda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <div className="font-body text-sm text-muted-foreground mb-2">Verifique os detalhes antes de finalizar a compra.</div>
              <div className="rounded-lg border border-border bg-secondary/10 p-4 space-y-2">
                <div className="text-sm">
                  <span className="font-semibold">Nome:</span> {form.customer_name || '-'}
                </div>
                <div className="text-sm">
                  <span className="font-semibold">Email:</span> {form.customer_email || '-'}
                </div>
                <div className="text-sm">
                  <span className="font-semibold">Telefone:</span> {form.customer_phone || '-'}
                </div>
                <div className="text-sm">
                  <span className="font-semibold">Morada:</span> {form.shipping_address || '-'}
                </div>
                <div className="text-sm">
                  <span className="font-semibold">Cidade:</span> {form.shipping_city || '-'}
                </div>
                <div className="text-sm">
                  <span className="font-semibold">Código Postal:</span> {form.shipping_postal_code || '-'}
                </div>
                <div className="text-sm">
                  <span className="font-semibold">Envio:</span> {shipping === 0 ? 'Grátis' : `${shipping.toFixed(2)} €`}
                </div>
                <div className="text-sm">
                  <span className="font-semibold">Pagamento:</span> {form.payment_method}
                </div>
                {form.payment_method === 'transferencia' ? (
                  <div className="text-sm">
                    <span className="font-semibold">Comprovativo:</span> {paymentProofUrl ? 'Anexado' : 'Não anexado'}
                  </div>
                ) : null}
                <div className="text-sm">
                  <span className="font-semibold">Total:</span> {totalAfterPoints.toFixed(2)} €
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-secondary/10 p-4">
              <div className="font-body text-sm font-semibold mb-3">Itens</div>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={`${item.product_id}-${item.color}`} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded bg-secondary/30 overflow-hidden flex-shrink-0">
                        <ImageWithFallback
                          src={item.product_image}
                          alt={item.product_name || 'Produto'}
                          className="w-full h-full object-cover"
                          iconClassName="w-4 h-4 text-muted-foreground/60"
                        />
                      </div>
                      <span className="min-w-0 truncate">{item.product_name} x{item.quantity}</span>
                    </div>
                    <span>{(item.price * item.quantity).toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)} className="rounded-none">
              Voltar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={submitting} className="rounded-none">
              {submitting ? 'A processar...' : 'Confirmar encomenda'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
