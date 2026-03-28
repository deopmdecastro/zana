import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ShoppingBag, Heart, Minus, Plus, ChevronLeft, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import StarRating from '@/components/ui/star-rating';
import { useCart } from '@/lib/CartContext';
import { toast } from 'sonner';
import { toastApiPromise } from '@/lib/toast';
import ProductCard from '@/components/products/ProductCard';
import { normalizeImages } from '@/lib/images';

const materialLabels = {
  aco_inox: 'Aço Inoxidável',
  prata: 'Prata',
  dourado: 'Dourado',
  rose_gold: 'Rose Gold',
  perolas: 'Pérolas',
  cristais: 'Cristais',
};

export default function ProductDetail() {
  const productId = window.location.pathname.split('/produto/')[1];
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const { addItem } = useCart();

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => base44.entities.Product.filter({ id: productId }),
    select: (data) => data[0],
    enabled: !!productId,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', productId],
    queryFn: () => base44.entities.Review.filter({ product_id: productId }),
    enabled: !!productId,
  });

  const { data: relatedProducts = [] } = useQuery({
    queryKey: ['related', product?.category],
    queryFn: () => base44.entities.Product.filter({ category: product.category, status: 'active' }, '-created_date', 5),
    enabled: !!product?.category,
  });

  const images = useMemo(() => normalizeImages(product?.images), [product?.images]);
  const related = useMemo(() => relatedProducts.filter((p) => p.id !== product?.id).slice(0, 4), [relatedProducts, product?.id]);

  useEffect(() => {
    setSelectedImage(0);
  }, [productId]);

  const didTrackView = useRef(false);
  useEffect(() => {
    if (!product?.id) return;
    if (didTrackView.current) return;
    didTrackView.current = true;
    base44.analytics.productView({ product_id: product.id }).catch(() => {});
  }, [product?.id]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-pulse">
          <div className="aspect-square bg-secondary/50 rounded-lg" />
          <div className="space-y-4">
            <div className="h-4 bg-secondary/50 w-1/4 rounded" />
            <div className="h-8 bg-secondary/50 w-3/4 rounded" />
            <div className="h-6 bg-secondary/50 w-1/4 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="font-heading text-2xl">Produto não encontrado</p>
        <Link to="/catalogo" className="font-body text-sm text-primary mt-4 inline-block">
          ← Voltar ao catálogo
        </Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    addItem(product, quantity, selectedColor);
    toast.success('Adicionado ao carrinho');
  };

  const submitReview = async () => {
    await toastApiPromise(
      base44.entities.ProductReview.create({
        product_id: product.id,
        rating: Number(reviewForm.rating) || 5,
        comment: reviewForm.comment?.trim() || null,
      }),
      {
        loading: 'A enviar avaliação...',
        success: 'Avaliação enviada (aguarda aprovação).',
        error: 'Não foi possível enviar a avaliação.',
      },
    );
    setReviewForm({ rating: 5, comment: '' });
  };

  const avgRating =
    reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : null;

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link
          to="/catalogo"
          className="inline-flex items-center gap-1 text-sm font-body text-muted-foreground hover:text-primary mb-8"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar ao catálogo
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {/* Images */}
          <div>
            <div className="aspect-square rounded-lg overflow-hidden bg-secondary/30 mb-3">
              {images?.[selectedImage] ? (
                <img src={images[selectedImage]} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag className="w-16 h-16 text-muted-foreground/30" />
                </div>
              )}
            </div>
            {images?.length > 1 && (
              <div className="flex gap-2">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-16 h-16 rounded overflow-hidden border-2 transition-colors ${
                      selectedImage === i ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <div className="flex gap-2 mb-3">
              {product.is_new && <Badge className="bg-primary text-primary-foreground text-[10px]">Novo</Badge>}
              {product.is_bestseller && (
                <Badge className="bg-accent text-accent-foreground text-[10px]">Bestseller</Badge>
              )}
            </div>

            <p className="font-body text-xs tracking-[0.3em] uppercase text-muted-foreground mb-1">
              {product.category?.replace(/_/g, ' ')}
            </p>
            <h1 className="font-heading text-3xl md:text-4xl font-light mb-4">{product.name}</h1>

            {avgRating && (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${
                        i < Math.round(avgRating) ? 'fill-accent text-accent' : 'text-border'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs font-body text-muted-foreground">({reviews.length} avaliações)</span>
              </div>
            )}

            <div className="flex items-center gap-3 mb-6">
              <span className="font-body text-2xl font-semibold">{product.price?.toFixed(2)} €</span>
              {product.original_price && product.original_price > product.price && (
                <span className="text-base text-muted-foreground line-through">{product.original_price.toFixed(2)} €</span>
              )}
            </div>

            <Separator className="my-6" />

            {product.description && (
              <p className="font-body text-sm text-muted-foreground leading-relaxed mb-6">{product.description}</p>
            )}

            {product.material && (
              <p className="font-body text-sm mb-4">
                <span className="text-muted-foreground">Material:</span>{' '}
                <span className="font-medium">{materialLabels[product.material] || product.material}</span>
              </p>
            )}

            {product.colors?.length > 0 && (
              <div className="mb-6">
                <p className="font-body text-sm text-muted-foreground mb-2">Cor</p>
                <div className="flex gap-2 flex-wrap">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-3 py-1.5 text-xs font-body border transition-colors ${
                        selectedColor === color ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6">
              <p className="font-body text-sm text-muted-foreground mb-2">Quantidade</p>
              <div className="flex items-center border border-border w-fit">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-2 hover:bg-secondary transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-4 py-2 font-body text-sm min-w-[40px] text-center">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="px-3 py-2 hover:bg-secondary transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleAddToCart} className="flex-1 rounded-none py-6 font-body text-sm tracking-wider gap-2">
                <ShoppingBag className="w-4 h-4" />
                Adicionar ao Carrinho
              </Button>
              <Button
                variant="outline"
                className="rounded-none py-6 px-4"
                onClick={async () => {
                  await toastApiPromise(
                    base44.entities.Wishlist.create({
                      product_id: product.id,
                      product_name: product.name,
                      product_image: images?.[0] || '',
                      product_price: product.price,
                    }),
                    {
                      loading: 'A adicionar aos favoritos...',
                      success: 'Adicionado aos favoritos.',
                      error: 'Não foi possível adicionar aos favoritos.',
                    },
                  );
                }}
              >
                <Heart className="w-4 h-4" />
              </Button>
            </div>

            {product.stock !== undefined && product.stock <= 5 && product.stock > 0 && (
              <p className="text-xs font-body text-destructive mt-3">Apenas {product.stock} em stock!</p>
            )}
          </div>
        </div>

        {/* Reviews */}
        <div className="mt-16">
          <h2 className="font-heading text-2xl mb-6">Avaliações</h2>

          {reviews.length === 0 ? (
            <p className="font-body text-sm text-muted-foreground">Sem avaliações aprovadas ainda.</p>
          ) : (
            <div className="space-y-4">
              {reviews.slice(0, 12).map((review) => (
                <div key={review.id} className="bg-card p-6 rounded-lg border border-border">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${i < review.rating ? 'fill-accent text-accent' : 'text-border'}`}
                          />
                        ))}
                      </div>
                      <span className="font-body text-xs font-medium">{review.author_name || 'Cliente'}</span>
                    </div>
                    <span className="font-body text-[11px] text-muted-foreground">
                      {new Date(review.created_date).toLocaleDateString('pt-PT')}
                    </span>
                  </div>
                  {review.comment ? <p className="font-body text-sm text-muted-foreground">{review.comment}</p> : null}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 bg-card p-6 rounded-lg border border-border">
            <h3 className="font-heading text-lg mb-4">Deixe a sua avaliação</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
	              <div>
	                <Label className="font-body text-xs">Rating</Label>
	                <div className="mt-2">
	                  <StarRating
	                    value={reviewForm.rating}
	                    onChange={(v) => setReviewForm((p) => ({ ...p, rating: v }))}
	                    aria-label="Escolher rating"
	                  />
	                </div>
	              </div>
              <div className="md:col-span-2">
                <Label className="font-body text-xs">Comentário (opcional)</Label>
                <Textarea
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm((p) => ({ ...p, comment: e.target.value }))}
                  className="rounded-none mt-1 min-h-[90px]"
                />
              </div>
            </div>
            <Button onClick={submitReview} className="mt-4 rounded-none font-body text-sm tracking-wider">
              Enviar
            </Button>
            <p className="font-body text-xs text-muted-foreground mt-2">Obrigado pelo seu feedback.</p>
          </div>
        </div>

        {/* Related Products */}
        {related.length > 0 && (
          <div className="mt-16 mb-8">
            <h2 className="font-heading text-2xl mb-6">Produtos Relacionados</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
