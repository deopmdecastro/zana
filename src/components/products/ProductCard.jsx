import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/lib/CartContext';
import { base44 } from '@/api/base44Client';
import ImageWithFallback from '@/components/ui/image-with-fallback';
import { toast } from 'sonner';
import { toastApiPromise } from '@/lib/toast';
import { productPromoBadgeClassName } from '@/lib/productBadges';
import { cn } from '@/lib/utils';
import { getPrimaryImage } from '@/lib/images';

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const [wished, setWished] = useState(false);
  const primaryImage = getPrimaryImage(product?.images);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product);
    toast.success('Adicionado ao carrinho');
    setAdded(true);
    setTimeout(() => setAdded(false), 1000);
  };

  const handleWishlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setWished(true);
    await toastApiPromise(
      base44.entities.Wishlist.create({
        product_id: product.id,
        product_name: product.name,
        product_image: product.images?.[0] || '',
        product_price: product.price,
      }),
      {
        loading: 'A adicionar aos favoritos...',
        success: 'Adicionado aos favoritos.',
        error: 'Não foi possível adicionar aos favoritos.',
      },
    );
  };

  const categoryLabels = {
    colares: 'Colares',
    brincos: 'Brincos',
    pulseiras: 'Pulseiras',
    aneis: 'Anéis',
    conjuntos: 'Conjuntos',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4 }}
    >
      <Link to={`/produto/${product.id}`} className="group block">
        <div className="relative overflow-hidden rounded-lg bg-secondary/50 aspect-square mb-3 ring-1 ring-border/50 group-hover:ring-primary/30 transition-all duration-300">
          <ImageWithFallback
            src={primaryImage}
            alt={product.name}
            className="group-hover:scale-110 transition-transform duration-700 ease-out"
            iconClassName="w-12 h-12 opacity-30 text-muted-foreground"
          />

          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {product.is_new && (
              <Badge
                className={cn(
                  'text-[10px] px-2 rounded-none font-body font-semibold',
                  productPromoBadgeClassName.new,
                )}
              >
                Novo
              </Badge>
            )}
            {product.is_bestseller && (
              <Badge
                className={cn(
                  'text-[10px] px-2 rounded-none font-body font-semibold',
                  productPromoBadgeClassName.bestseller,
                )}
              >
                Top
              </Badge>
            )}
            {product.original_price && product.original_price > product.price && (
              <Badge
                className={cn(
                  'text-[10px] px-2 rounded-none font-body font-semibold',
                  productPromoBadgeClassName.discount,
                )}
              >
                -{Math.round((1 - product.price / product.original_price) * 100)}%
              </Badge>
            )}
          </div>

          {/* Hover Actions */}
          <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
            <button
              onClick={handleWishlist}
              className="w-8 h-8 bg-card/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-card transition-colors shadow-sm"
              aria-label="Adicionar aos favoritos"
            >
              <Heart className={cn('w-3.5 h-3.5 transition-colors', wished ? 'fill-primary text-primary' : 'text-foreground')} />
            </button>
          </div>

          {/* Quick Add */}
          <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
            <button
              onClick={handleAddToCart}
              className={cn(
                'w-full text-xs py-2.5 rounded-md font-body tracking-wide flex items-center justify-center gap-2 transition-all',
                added
                  ? 'bg-green-600 text-white'
                  : 'bg-primary/95 backdrop-blur-sm text-primary-foreground hover:bg-primary',
              )}
            >
              {added ? (
                'Adicionado!'
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Adicionar ao Carrinho
                </>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">
            {categoryLabels[product.category] || product.category}
          </p>
          <h3 className="font-heading text-base font-medium text-foreground group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          <div className="flex items-center gap-2">
            <span className="font-body text-sm font-semibold">
              {product.price?.toFixed(2)} €
            </span>
            {product.original_price && product.original_price > product.price && (
              <span className="text-xs text-muted-foreground line-through">
                {product.original_price.toFixed(2)} €
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
