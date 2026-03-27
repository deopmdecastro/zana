import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useCart } from '@/lib/CartContext';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { CheckCircle, ShoppingBag } from 'lucide-react';

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const [step, setStep] = useState('form');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    shipping_address: '',
    shipping_city: '',
    shipping_postal_code: '',
    payment_method: 'mbway',
    notes: '',
  });

  const shipping = subtotal >= 50 ? 0 : 4.99;
  const total = subtotal + shipping;

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_name || !form.customer_email || !form.shipping_address || !form.shipping_city || !form.shipping_postal_code) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSubmitting(true);
    await base44.entities.Order.create({
      ...form,
      items: items.map(i => ({
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
    });
    clearCart();
    setSubmitting(false);
    setStep('success');
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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <h1 className="font-heading text-3xl md:text-4xl mb-8">Checkout</h1>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Info */}
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
                <div className="md:col-span-2">
                  <Label className="font-body text-xs">Telefone</Label>
                  <Input value={form.customer_phone} onChange={(e) => handleChange('customer_phone', e.target.value)} className="rounded-none mt-1" />
                </div>
              </div>
            </div>

            {/* Shipping */}
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

            {/* Payment */}
            <div className="bg-card p-6 rounded-lg border border-border">
              <h2 className="font-heading text-xl mb-4">Pagamento</h2>
              <RadioGroup value={form.payment_method} onValueChange={(v) => handleChange('payment_method', v)} className="space-y-3">
                {[
                  { value: 'mbway', label: 'MB WAY' },
                  { value: 'transferencia', label: 'Transferência Bancária' },
                  { value: 'multibanco', label: 'Multibanco' },
                  { value: 'paypal', label: 'PayPal' },
                ].map(opt => (
                  <div key={opt.value} className="flex items-center gap-3 p-3 border border-border rounded-sm hover:bg-secondary/30">
                    <RadioGroupItem value={opt.value} id={opt.value} />
                    <Label htmlFor={opt.value} className="font-body text-sm cursor-pointer flex-1">{opt.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-card p-6 rounded-lg border border-border h-fit sticky top-24">
            <h2 className="font-heading text-xl mb-4">Resumo do Pedido</h2>
            <div className="space-y-3 mb-4">
              {items.map(item => (
                <div key={`${item.product_id}-${item.color}`} className="flex gap-3">
                  <div className="w-12 h-12 rounded bg-secondary/30 overflow-hidden flex-shrink-0">
                    {item.product_image && <img src={item.product_image} alt="" className="w-full h-full object-cover" />}
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
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{subtotal.toFixed(2)} €</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Envio</span><span>{shipping === 0 ? 'Grátis' : `${shipping.toFixed(2)} €`}</span></div>
              <Separator />
              <div className="flex justify-between font-semibold text-base"><span>Total</span><span>{total.toFixed(2)} €</span></div>
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