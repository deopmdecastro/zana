import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
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

  const titleLines = React.useMemo(() => {
    return String(hero.title ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }, [hero.title]);

  const secondaryCta = user
    ? { to: hero.secondary_cta_logged_in_to, label: hero.secondary_cta_logged_in_label }
    : { to: hero.secondary_cta_logged_out_to, label: hero.secondary_cta_logged_out_label };

  const sectionRef = useRef(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const container = document.querySelector('.canvas-scroll');
    if (!container) return;
    let rafId;
    const handler = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = sectionRef.current?.getBoundingClientRect();
        if (rect && rect.bottom > 0) {
          setScrollY(Math.max(0, -rect.top));
        }
      });
    };
    container.addEventListener('scroll', handler, { passive: true });
    return () => {
      container.removeEventListener('scroll', handler);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-primary min-h-[80vh] md:min-h-[90vh] flex items-center"
    >
      <div className="absolute inset-0">
        <div
          style={{ transform: `translateY(${scrollY * 0.3}px) scale(1.1)` }}
          className="absolute inset-0 will-change-transform"
        >
          <ImageWithFallback
            src={hero.image_url}
            alt="Zana Acessórios - Coleção"
            className="w-full h-full object-cover opacity-30"
            iconClassName="w-16 h-16 text-white/20"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/70 to-primary/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-transparent to-primary/20" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl"
        >
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="font-body text-xs tracking-[0.4em] uppercase text-primary-foreground/70 mb-4"
          >
            {hero.tag}
          </motion.p>

          <h1 className="font-heading text-5xl md:text-7xl lg:text-8xl font-light text-primary-foreground leading-[0.95] mb-6">
            {titleLines.length ? (
              titleLines.map((line, idx) => (
                <motion.span
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 + idx * 0.15 }}
                  className="block"
                >
                  {line}
                </motion.span>
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

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="font-body text-sm md:text-base text-primary-foreground/80 max-w-md mb-8 leading-relaxed"
          >
            {hero.subtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="flex flex-wrap gap-4"
          >
            <Link to={hero.primary_cta_to}>
              <Button className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 rounded-none px-8 py-6 text-sm tracking-wider font-body group">
                {hero.primary_cta_label}
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link to={secondaryCta.to}>
              <Button
                variant="outline"
                className="bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:border-primary-foreground/60 rounded-none px-8 py-6 text-sm tracking-wider font-body transition-all"
              >
                {secondaryCta.label}
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden md:flex"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="text-primary-foreground/50"
        >
          <ChevronDown className="w-6 h-6" />
        </motion.div>
      </motion.div>
    </section>
  );
}
