import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function BrandBanner() {
  return (
    <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <img
            src="https://media.base44.com/images/public/69c68e1a7672ae1454387e62/0912c9232_generated_fe47a609.png"
            alt="Zana Acessórios - A nossa história"
            className="rounded-lg w-full aspect-[4/3] object-cover"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="font-body text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">A Nossa Essência</p>
          <h2 className="font-heading text-3xl md:text-5xl font-light mb-6 leading-tight">
            Celebrar a <span className="italic">beleza</span> em cada mulher
          </h2>
          <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">
            A Zana nasce com a missão de celebrar o universo feminino, oferecendo às mulheres produtos pensados para o seu dia a dia, com praticidade, estilo e personalidade.
          </p>
          <p className="font-body text-sm text-muted-foreground leading-relaxed mb-8">
            Mais do que uma marca, a Zana é um convite para que cada mulher se sinta única, confiante e inspirada.
          </p>
          <Link
            to="/sobre"
            className="inline-block font-body text-sm tracking-wider border-b border-foreground pb-1 hover:text-primary hover:border-primary transition-colors"
          >
            Conhecer a história →
          </Link>
        </motion.div>
      </div>
    </section>
  );
}