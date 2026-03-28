import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { base44 } from '@/api/base44Client';
import { getErrorMessage } from '@/lib/toast';
import HeroBanner from '@/components/home/HeroBanner';
import CategoryGrid from '@/components/home/CategoryGrid';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import BrandBanner from '@/components/home/BrandBanner';
import Testimonials from '@/components/home/Testimonials';
import InstagramSection from '@/components/home/InstagramSection';

export default function Home() {
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const { data } = useQuery({
    queryKey: ['content-landing'],
    queryFn: () => base44.content.landing(),
    staleTime: 60_000,
  });

  const landing = data?.content ?? null;

  const subscribeMutation = useMutation({
    mutationFn: (email) => base44.newsletter.subscribe({ email }),
    onSuccess: () => {
      toast.success('Subscrição confirmada. Obrigado!');
      setNewsletterEmail('');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível subscrever.')),
  });

  return (
    <div>
      <HeroBanner content={landing} />
      <CategoryGrid content={landing} />
      <FeaturedProducts title="Destaques" filterKey="is_featured" />
      <FeaturedProducts title="Novidades" filterKey="is_new" />
      <BrandBanner content={landing} />
      <Testimonials />
      <InstagramSection />

	      {landing?.newsletter?.enabled !== false ? (
	        <section className="py-16 md:py-20 bg-primary">
	          <div className="max-w-2xl mx-auto px-4 text-center">
            <h2 className="font-heading text-3xl md:text-4xl text-primary-foreground mb-3">
              {landing?.newsletter?.title ?? 'Receba as Novidades'}
            </h2>
            <p className="font-body text-sm text-primary-foreground/70 mb-8">
              {landing?.newsletter?.text ??
                'Subscreva a nossa newsletter e fique a par das últimas coleções, promoções exclusivas e dicas de estilo.'}
            </p>
	            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
	              <input
	                type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
	                placeholder={landing?.newsletter?.placeholder ?? 'O seu email'}
	                className="flex-1 px-4 py-3 bg-primary-foreground/10 border border-primary-foreground/20 rounded-none text-primary-foreground placeholder:text-primary-foreground/50 text-sm font-body focus:outline-none focus:border-primary-foreground/50"
	              />
	              <button
                  className="px-6 py-3 bg-primary-foreground text-primary text-sm font-body tracking-wider hover:bg-primary-foreground/90 transition-colors disabled:opacity-60"
                  disabled={subscribeMutation.isPending}
                  onClick={() => {
                    const email = String(newsletterEmail ?? '').trim();
                    if (!email) return toast.error('Escreva o seu email.');
                    subscribeMutation.mutate(email);
                  }}
                >
	                {landing?.newsletter?.button_label ?? 'Subscrever'}
	              </button>
	            </div>
	          </div>
	        </section>
      ) : null}
    </div>
  );
}
