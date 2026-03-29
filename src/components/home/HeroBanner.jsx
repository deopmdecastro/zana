import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import ImageWithFallback from '@/components/ui/image-with-fallback';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

const fallbackHero = {
  image_url: 'https://media.base44.com/images/public/69c68e1a7672ae1454387e62/1816d3520_generated_8c5deb5b.png',
  tag: 'Nova Coleção 2025',
  title: 'Elegância\nem cada\ndetalhe',
  subtitle: 'Descubra bijuterias que celebram a essência da mulher moderna. Peças únicas, delicadas e sofisticadas.',
  primary_cta_label: 'Ver Coleção',
  primary_cta_to: '/catalogo',
  secondary_cta_logged_in_label: 'Sobre Nós',
  secondary_cta_logged_in_to: '/sobre',
  secondary_cta_logged_out_label: 'Entrar',
  secondary_cta_logged_out_to: '/conta',
};

export default function HeroBanner({ content } = {}) {
  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const hero = { ...fallbackHero, ...(content?.hero ?? {}) };

  const titleLines = useMemo(() => {
    return String(hero.title ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }, [hero.title]);

  const secondaryCta = user
    ? { to: hero.secondary_cta_logged_in_to, label: hero.secondary_cta_logged_in_label }
    : { to: hero.secondary_cta_logged_out_to, label: hero.secondary_cta_logged_out_label };

  return (
    <section className="relative overflow-hidden bg-primary min-h-[80vh] md:min-h-[90vh] flex items-center">
      <div className="absolute inset-0">
        <ImageWithFallback
          src={hero.image_url}
          alt="Zana Acessórios - Coleção"
          className="w-full h-full object-cover opacity-30"
          iconClassName="w-16 h-16 text-white/20"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/70 to-primary/40" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl"
        >
          <p className="font-body text-xs tracking-[0.4em] uppercase text-primary-foreground/70 mb-4">
            {hero.tag}
          </p>

          <h1 className="font-heading text-5xl md:text-7xl lg:text-8xl font-light text-primary-foreground leading-[0.95] mb-6">
            {titleLines.length ? (
              titleLines.map((line, idx) => (
                <React.Fragment key={idx}>
                  {line}
                  {idx < titleLines.length - 1 ? <br /> : null}
                </React.Fragment>
              ))
            ) : (
              <>
                Elegância
                <br />
                em cada
                <br />
                detalhe
              </>
            )}
          </h1>

          <p className="font-body text-sm md:text-base text-primary-foreground/80 max-w-md mb-8 leading-relaxed">
            {hero.subtitle}
          </p>

          <div className="flex flex-wrap gap-4">
            <Link to={hero.primary_cta_to}>
              <Button className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 rounded-none px-8 py-6 text-sm tracking-wider font-body">
                {hero.primary_cta_label}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to={secondaryCta.to}>
              <Button
                variant="outline"
                className="bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 rounded-none px-8 py-6 text-sm tracking-wider font-body"
              >
                {secondaryCta.label}
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

