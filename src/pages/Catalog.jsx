import React, { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { PackageSearch, Search, SlidersHorizontal, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ProductCard from '@/components/products/ProductCard';
import { trackSearch } from '@/lib/analytics';
import EmptyState from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

const categories = [
  { value: 'all', label: 'Todas' },
  { value: 'colares', label: 'Colares' },
  { value: 'brincos', label: 'Brincos' },
  { value: 'pulseiras', label: 'Pulseiras' },
  { value: 'aneis', label: 'Anéis' },
  { value: 'conjuntos', label: 'Conjuntos' },
];

const materials = [
  { value: 'all', label: 'Todos' },
  { value: 'aco_inox', label: 'Aço Inox' },
  { value: 'prata', label: 'Prata' },
  { value: 'dourado', label: 'Dourado' },
  { value: 'rose_gold', label: 'Rose Gold' },
  { value: 'perolas', label: 'Pérolas' },
  { value: 'cristais', label: 'Cristais' },
];

const sortOptions = [
  { value: 'newest', label: 'Mais recentes' },
  { value: 'price_asc', label: 'Preço: menor' },
  { value: 'price_desc', label: 'Preço: maior' },
  { value: 'bestseller', label: 'Mais vendidos' },
];

export default function Catalog() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialCategory = urlParams.get('category') || 'all';

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [material, setMaterial] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products-catalog'],
    queryFn: () => base44.entities.Product.filter({ status: 'active' }, '-created_date', 100),
  });

  const filtered = useMemo(() => {
    let result = [...products];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    if (category !== 'all') result = result.filter(p => p.category === category);
    if (material !== 'all') result = result.filter(p => p.material === material);

    switch (sortBy) {
      case 'price_asc': result.sort((a, b) => (a.price || 0) - (b.price || 0)); break;
      case 'price_desc': result.sort((a, b) => (b.price || 0) - (a.price || 0)); break;
      case 'bestseller': result.sort((a, b) => (b.is_bestseller ? 1 : 0) - (a.is_bestseller ? 1 : 0)); break;
      default: break;
    }

    return result;
  }, [products, search, category, material, sortBy]);

  const activeFilterCount = [category !== 'all', material !== 'all', search].filter(Boolean).length;

  useEffect(() => {
    const handle = setTimeout(() => {
      if (search) trackSearch(search);
    }, 600);
    return () => clearTimeout(handle);
  }, [search]);

  const clearFilters = () => {
    setSearch('');
    setCategory('all');
    setMaterial('all');
    setSortBy('newest');
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-primary py-12 md:py-16 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
        <div className="relative max-w-7xl mx-auto text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-body text-xs tracking-[0.3em] uppercase text-primary-foreground/60 mb-2"
          >
            Explore
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-heading text-4xl md:text-6xl text-primary-foreground font-light"
          >
            Catálogo
          </motion.h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sticky Filter Bar */}
        <div className="sticky top-16 md:top-20 z-30 -mx-4 px-4 py-3 mb-6 bg-card/80 backdrop-blur-md border-b border-border">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-none border-border font-body text-sm"
              />
            </div>

            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="rounded-none font-body text-sm gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtros
              {activeFilterCount > 0 && (
                <Badge className="bg-primary text-primary-foreground text-[10px] ml-1 h-4 w-4 p-0 flex items-center justify-center rounded-full">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px] rounded-none font-body text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Expandable Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-3 mb-8 pb-6 border-b border-border">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-[140px] rounded-none font-body text-sm">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={material} onValueChange={setMaterial}>
                  <SelectTrigger className="w-[140px] rounded-none font-body text-sm">
                    <SelectValue placeholder="Material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {activeFilterCount > 0 && (
                  <Button variant="ghost" onClick={clearFilters} className="text-sm font-body gap-1">
                    <X className="w-3 h-3" /> Limpar
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map(c => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={cn(
                'px-4 py-2 text-xs font-body tracking-wider uppercase transition-all rounded-full',
                category === c.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary text-foreground/70 hover:bg-secondary/80 hover:text-foreground',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm font-body text-muted-foreground">
            {filtered.length} produto{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-secondary/50 aspect-square rounded-lg mb-3" />
                <div className="h-3 bg-secondary/50 rounded w-1/3 mb-2" />
                <div className="h-4 bg-secondary/50 rounded w-2/3 mb-2" />
                <div className="h-3 bg-secondary/50 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="Nenhum produto encontrado"
            description="Tente ajustar os filtros de pesquisa"
            className="py-20"
          />
        ) : (
          <motion.div
            layout
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6"
          >
            <AnimatePresence mode="popLayout">
              {filtered.map(product => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
