import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import ImageWithFallback from '@/components/ui/image-with-fallback';

const fallbackBrand = {
  image_url: 'https://media.base44.com/images/public/69c68e1a7672ae1454387e62/0912c9232_generated_fe47a609.png',
  eyebrow: 'A Nossa Essência',
  title: 'Celebrar a beleza em cada mulher',
  paragraphs: [
    'A Zana nasce com a missão de celebrar o universo feminino, oferecendo às mulheres produtos pensados para o seu dia a dia, com praticidade, estilo e personalidade.',
    'Mais do que uma marca, a Zana é um convite para que cada mulher se sinta única, confiante e inspirada.',
  ],
  link_label: 'Conhecer a história →',
  link_to: '/sobre',
};

export default function BrandBanner({ content } = {}) {
  const brand = { ...fallbackBrand, ...(content?.brand ?? {}) };

  const paragraphs = useMemo(() => {
    if (!Array.isArray(brand.paragraphs)) return fallbackBrand.paragraphs;
    const cleaned = brand.paragraphs.map((p) => String(p ?? '').trim()).filter(Boolean);
    return cleaned.length ? cleaned : fallbackBrand.paragraphs;
  }, [brand.paragraphs]);

  return (
    <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <ImageWithFallback
            src={brand.image_url}
            alt="Zana Acessórios - A nossa história"
            className="rounded-lg w-full aspect-[4/3] object-cover"
            iconClassName="w-12 h-12 text-muted-foreground/40"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="font-body text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">
            {brand.eyebrow}
          </p>
          <h2 className="font-heading text-3xl md:text-5xl font-light mb-6 leading-tight">
            {brand.title}
          </h2>
          {paragraphs.map((p, idx) => (
            <p key={idx} className="font-body text-sm text-muted-foreground leading-relaxed mb-4">
              {p}
            </p>
          ))}
          <Link
            to={brand.link_to}
            className="inline-block font-body text-sm tracking-wider border-b border-foreground pb-1 hover:text-primary hover:border-primary transition-colors"
          >
            {brand.link_label}
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

