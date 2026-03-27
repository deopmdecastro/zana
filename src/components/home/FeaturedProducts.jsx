import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowRight } from 'lucide-react';
import ProductCard from '@/components/products/ProductCard';

export default function FeaturedProducts({ title = "Destaques", filterKey = "is_featured" }) {
  const { data: products = [] } = useQuery({
    queryKey: ['products', filterKey],
    queryFn: () => base44.entities.Product.filter({ [filterKey]: true, status: 'active' }, '-created_date', 8),
  });

  if (products.length === 0) return null;

  return (
    <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="font-body text-xs tracking-[0.3em] uppercase text-muted-foreground mb-2">Seleção Especial</p>
          <h2 className="font-heading text-3xl md:text-5xl font-light">{title}</h2>
        </div>
        <Link to="/catalogo" className="hidden md:flex items-center gap-2 text-sm font-body text-muted-foreground hover:text-primary transition-colors">
          Ver todos <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {products.slice(0, 4).map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <div className="md:hidden text-center mt-8">
        <Link to="/catalogo" className="inline-flex items-center gap-2 text-sm font-body text-muted-foreground hover:text-primary transition-colors">
          Ver todos os produtos <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}