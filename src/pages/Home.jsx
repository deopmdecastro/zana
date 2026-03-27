import React from 'react';
import HeroBanner from '@/components/home/HeroBanner';
import CategoryGrid from '@/components/home/CategoryGrid';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import BrandBanner from '@/components/home/BrandBanner';
import Testimonials from '@/components/home/Testimonials';

export default function Home() {
  return (
    <div>
      <HeroBanner />
      <CategoryGrid />
      <FeaturedProducts title="Destaques" filterKey="is_featured" />
      <FeaturedProducts title="Novidades" filterKey="is_new" />
      <BrandBanner />
      <Testimonials />

      {/* Newsletter */}
      <section className="py-16 md:py-20 bg-primary">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="font-heading text-3xl md:text-4xl text-primary-foreground mb-3">Receba as Novidades</h2>
          <p className="font-body text-sm text-primary-foreground/70 mb-8">
            Subscreva a nossa newsletter e fique a par das últimas coleções, promoções exclusivas e dicas de estilo.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="O seu email"
              className="flex-1 px-4 py-3 bg-primary-foreground/10 border border-primary-foreground/20 rounded-none text-primary-foreground placeholder:text-primary-foreground/50 text-sm font-body focus:outline-none focus:border-primary-foreground/50"
            />
            <button className="px-6 py-3 bg-primary-foreground text-primary text-sm font-body tracking-wider hover:bg-primary-foreground/90 transition-colors">
              Subscrever
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}