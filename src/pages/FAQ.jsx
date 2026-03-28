import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HelpCircle } from 'lucide-react';

export default function FAQPage() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['faq'],
    queryFn: () => base44.faq.list(),
  });

  return (
    <div className="min-h-screen">
      <div className="bg-primary py-12 md:py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-body text-xs tracking-[0.3em] uppercase text-primary-foreground/60 mb-2">Ajuda</p>
          <h1 className="font-heading text-4xl md:text-6xl text-primary-foreground font-light">Perguntas Frequentes</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
        {isLoading ? (
          <p className="font-body text-sm text-muted-foreground">A carregar...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <HelpCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-heading text-2xl text-muted-foreground">Sem perguntas</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {items.map((it) => (
              <AccordionItem key={it.id} value={it.id}>
                <AccordionTrigger className="font-heading text-left">{it.question}</AccordionTrigger>
                <AccordionContent className="font-body text-sm text-muted-foreground leading-relaxed">
                  {it.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </div>
  );
}

