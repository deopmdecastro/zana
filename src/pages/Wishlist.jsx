import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ImageWithFallback from '@/components/ui/image-with-fallback';
import { toastApiPromise } from '@/lib/toast';
import DeleteIcon from '@/components/ui/delete-icon';
import { confirmDestructive } from '@/lib/confirm';

export default function WishlistPage() {
  const queryClient = useQueryClient();

  const { data: wishlistItems = [], isLoading } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => base44.entities.Wishlist.list('-created_date', 50),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Wishlist.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
  });

  const handleDelete = async (e, id) => {
    e.preventDefault();
    if (!confirmDestructive('Tem certeza que deseja remover dos favoritos?')) return;
    await toastApiPromise(deleteMutation.mutateAsync(id), {
      loading: 'A remover dos favoritos...',
      success: 'Removido dos favoritos.',
      error: 'Não foi possível remover dos favoritos.',
    });
  };

  if (isLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" /></div>;
  }

  if (wishlistItems.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <Heart className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h1 className="font-heading text-3xl mb-2">Lista de Favoritos Vazia</h1>
        <p className="font-body text-sm text-muted-foreground mb-6">Adicione produtos à sua lista de desejos.</p>
        <Link to="/catalogo"><Button className="rounded-none font-body text-sm tracking-wider">Explorar Catálogo</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <h1 className="font-heading text-3xl md:text-4xl mb-8">Favoritos</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {wishlistItems.map(item => (
          <div key={item.id} className="group">
            <Link to={`/produto/${item.product_id}`}>
              <div className="relative aspect-square rounded-lg overflow-hidden bg-secondary/30 mb-3">
                <ImageWithFallback
                  src={item.product_image}
                  alt={item.product_name}
                  className="group-hover:scale-105 transition-transform duration-500"
                  iconClassName="w-12 h-12 opacity-30 text-muted-foreground"
                />
                <div className="absolute top-2 right-2 flex flex-col gap-1">
                  <button
                    onClick={(e) => handleDelete(e, item.id)}
                    className="w-7 h-7 bg-card/90 rounded-full flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    title="Remover"
                  >
                    <DeleteIcon className="text-current" />
                  </button>
                </div>
              </div>
              <h3 className="font-heading text-sm font-medium">{item.product_name}</h3>
              <p className="font-body text-sm font-semibold">{item.product_price?.toFixed(2)} €</p>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
