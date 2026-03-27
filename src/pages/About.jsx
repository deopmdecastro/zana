import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Gem, Sparkles } from 'lucide-react';

export default function About() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="bg-primary py-16 md:py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-body text-xs tracking-[0.3em] uppercase text-primary-foreground/60 mb-3">A Nossa História</p>
          <h1 className="font-heading text-4xl md:text-6xl text-primary-foreground font-light mb-4">Sobre a Zana</h1>
          <p className="font-body text-sm text-primary-foreground/70 max-w-lg mx-auto">
            Celebrar a beleza, autenticidade e essência da mulher moderna.
          </p>
        </div>
      </div>

      {/* Story */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-20">
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <img
              src="https://media.base44.com/images/public/69c68e1a7672ae1454387e62/0912c9232_generated_fe47a609.png"
              alt="Zana Acessórios"
              className="rounded-lg w-full aspect-[4/3] object-cover"
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <h2 className="font-heading text-3xl font-light mb-6">A Nossa Essência</h2>
            <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">
              A Zana nasce com a missão de celebrar o universo feminino, oferecendo às mulheres produtos pensados para o seu dia a dia, com praticidade, estilo e personalidade.
            </p>
            <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">
              Mais do que uma marca, a Zana é um convite para que cada mulher se sinta única, confiante e inspirada.
            </p>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              Com o lançamento da Zana Acessórios, apresentamos bijuterias e outros artigos que vão desde opções simples e elegantes até peças exclusivas e personalizadas. O propósito da marca é proporcionar não apenas produtos, mas experiências que traduzam beleza, autenticidade e a essência da mulher moderna.
            </p>
          </motion.div>
        </div>

        {/* Values */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: Heart,
              title: 'Missão',
              text: 'Celebrar a beleza feminina através de acessórios que combinam elegância, qualidade e preço acessível.',
            },
            {
              icon: Sparkles,
              title: 'Visão',
              text: 'Ser a marca de referência em bijuterias para a mulher moderna, reconhecida pela qualidade e design único.',
            },
            {
              icon: Gem,
              title: 'Valores',
              text: 'Autenticidade, sofisticação, acessibilidade e dedicação a cada cliente que nos escolhe.',
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center bg-card p-8 rounded-lg border border-border"
            >
              <item.icon className="w-8 h-8 mx-auto mb-4 text-accent" />
              <h3 className="font-heading text-xl mb-3">{item.title}</h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">{item.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}