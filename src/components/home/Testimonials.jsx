import React from 'react';
import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Maria S.',
    text: 'Peças lindíssimas e de qualidade! Já comprei várias vezes e nunca me decepcionei. A embalagem também é um encanto.',
    rating: 5,
  },
  {
    name: 'Ana P.',
    text: 'Encontrei o colar perfeito para o meu casamento. Delicado, elegante e a um preço incrível. Super recomendo!',
    rating: 5,
  },
  {
    name: 'Sofia L.',
    text: 'Adoro as novidades que a Zana traz sempre. As peças são modernas e versáteis, uso no dia a dia e em eventos.',
    rating: 5,
  },
];

export default function Testimonials() {
  return (
    <section className="py-16 md:py-24 bg-secondary/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="font-body text-xs tracking-[0.3em] uppercase text-muted-foreground mb-2">O que dizem</p>
          <h2 className="font-heading text-3xl md:text-5xl font-light">As Nossas Clientes</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="bg-card p-8 rounded-lg relative"
            >
              <Quote className="w-8 h-8 text-accent/40 absolute top-6 right-6" />
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-3.5 h-3.5 fill-accent text-accent" />
                ))}
              </div>
              <p className="font-body text-sm text-foreground/80 leading-relaxed mb-6 italic">
                "{t.text}"
              </p>
              <p className="font-body text-xs font-semibold tracking-wider uppercase">{t.name}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}