import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HeroBanner() {
  return (
    <section className="relative overflow-hidden bg-primary min-h-[80vh] md:min-h-[90vh] flex items-center">
      <div className="absolute inset-0">
        <img
          src="https://media.base44.com/images/public/69c68e1a7672ae1454387e62/1816d3520_generated_8c5deb5b.png"
          alt="Zana Acessórios - Coleção"
          className="w-full h-full object-cover opacity-30"
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
            Nova Coleção 2025
          </p>
          <h1 className="font-heading text-5xl md:text-7xl lg:text-8xl font-light text-primary-foreground leading-[0.95] mb-6">
            Elegância<br />
            <span className="italic">em cada</span><br />
            detalhe
          </h1>
          <p className="font-body text-sm md:text-base text-primary-foreground/80 max-w-md mb-8 leading-relaxed">
            Descubra bijuterias que celebram a essência da mulher moderna. Peças únicas, delicadas e sofisticadas.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/catalogo">
              <Button className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 rounded-none px-8 py-6 text-sm tracking-wider font-body">
                Ver Coleção
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to="/sobre">
              <Button variant="outline" className="border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 rounded-none px-8 py-6 text-sm tracking-wider font-body">
                Sobre Nós
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}