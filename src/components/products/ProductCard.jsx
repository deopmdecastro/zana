import React from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/lib/CartContext';
import { base44 } from '@/api/base44Client';
import ImageWithFallback from '@/components/ui/image-with-fallback';
import { toast } from 'sonner';
import { toastApiPromise } from '@/lib/toast';
import { getPrimaryImage } from '@/lib/images';

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const primaryImage = getPrimaryImage(product?.images);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product);
    toast.success('Adicionado ao carrinho');
  };

  const handleWishlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();
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
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Link to={`/produto/${product.id}`} className="group block">
        <div className="relative overflow-hidden rounded-lg bg-secondary/50 aspect-square mb-3">
          <ImageWithFallback
            src={primaryImage}
            alt={product.name}
            className="group-hover:scale-105 transition-transform duration-500"
            iconClassName="w-12 h-12 opacity-30 text-muted-foreground"
          />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {product.is_new && (
              <Badge className="bg-primary text-primary-foreground text-[10px] px-2">Novo</Badge>
            )}
            {product.is_bestseller && (
              <Badge className="bg-accent text-accent-foreground text-[10px] px-2">Top</Badge>
            )}
            {product.original_price && product.original_price > product.price && (
              <Badge className="bg-destructive text-destructive-foreground text-[10px] px-2">
                -{Math.round((1 - product.price / product.original_price) * 100)}%
              </Badge>
            )}
          </div>

          {/* Hover Actions */}
          <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleWishlist}
              className="w-8 h-8 bg-card/90 rounded-full flex items-center justify-center hover:bg-card transition-colors shadow-sm"
            >
              <Heart className="w-3.5 h-3.5 text-foreground" />
            </button>
          </div>

          {/* Quick Add */}
          <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleAddToCart}
              className="w-full bg-primary/90 text-primary-foreground text-xs py-2.5 rounded-md hover:bg-primary transition-colors font-body tracking-wide"
            >
              Adicionar ao Carrinho
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
