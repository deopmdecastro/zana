import React from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/lib/CartContext';
import DeleteIcon from '@/components/ui/delete-icon';

export default function Cart() {
  const { items, updateQuantity, removeItem, subtotal, itemCount } = useCart();

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <ShoppingBag className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h1 className="font-heading text-3xl mb-2">Carrinho Vazio</h1>
        <p className="font-body text-sm text-muted-foreground mb-6">Ainda não adicionou produtos ao carrinho.</p>
        <Link to="/catalogo">
          <Button className="rounded-none font-body text-sm tracking-wider gap-2">
            <ShoppingBag className="w-4 h-4" /> Explorar Catálogo
          </Button>
        </Link>
      </div>
    );
  }

  const shipping = subtotal >= 50 ? 0 : 4.99;
  const total = subtotal + shipping;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <h1 className="font-heading text-3xl md:text-4xl mb-8">Carrinho</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={`${item.product_id}-${item.color}`} className="flex gap-4 bg-card p-4 rounded-lg border border-border">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded overflow-hidden bg-secondary/30 flex-shrink-0">
                {item.product_image ? (
                  <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-heading text-base font-medium truncate">{item.product_name}</h3>
                {item.color && <p className="font-body text-xs text-muted-foreground mt-0.5">{item.color}</p>}
                <p className="font-body text-sm font-semibold mt-1">{item.price.toFixed(2)} €</p>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center border border-border">
                    <button onClick={() => updateQuantity(item.product_id, item.color, item.quantity - 1)} className="px-2 py-1 hover:bg-secondary">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-3 py-1 font-body text-xs">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product_id, item.color, item.quantity + 1)} className="px-2 py-1 hover:bg-secondary">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <button onClick={() => removeItem(item.product_id, item.color)} className="text-muted-foreground hover:text-destructive" title="Remover">
                    <DeleteIcon className="text-current" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="bg-card p-6 rounded-lg border border-border h-fit sticky top-24">
          <h2 className="font-heading text-xl mb-4">Resumo</h2>
          <div className="space-y-3 font-body text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal ({itemCount} itens)</span>
              <span>{subtotal.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Envio</span>
              <span>{shipping === 0 ? 'Grátis' : `${shipping.toFixed(2)} €`}</span>
            </div>
            {shipping > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Envio grátis para encomendas acima de 50€
              </p>
            )}
            <Separator />
            <div className="flex justify-between font-semibold text-base">
              <span>Total</span>
              <span>{total.toFixed(2)} €</span>
            </div>
          </div>
          <Link to="/checkout" className="block mt-6">
            <Button className="w-full rounded-none py-6 font-body text-sm tracking-wider gap-2">
              Finalizar Compra <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link to="/catalogo" className="block text-center mt-3">
            <span className="font-body text-xs text-muted-foreground hover:text-primary">← Continuar a comprar</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
