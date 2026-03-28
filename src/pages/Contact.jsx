import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Mail, Instagram, MapPin, Send } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

import { contactFaqs } from '@/lib/contactFaqs';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSending(true);
    await new Promise((r) => setTimeout(r, 1000));
    toast.success('Mensagem enviada com sucesso!');
    setForm({ name: '', email: '', subject: '', message: '' });
    setSending(false);
  };

  return (
    <div className="min-h-screen">
      <div className="bg-primary py-12 md:py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="font-body text-xs tracking-[0.3em] uppercase text-primary-foreground/60 mb-2">Fale Connosco</p>
          <h1 className="font-heading text-4xl md:text-6xl text-primary-foreground font-light">Contacto</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h2 className="font-heading text-2xl mb-6">Envie-nos uma Mensagem</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="font-body text-xs">Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-none mt-1" />
              </div>
              <div>
                <Label className="font-body text-xs">Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-none mt-1" />
              </div>
              <div>
                <Label className="font-body text-xs">Assunto</Label>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="rounded-none mt-1" />
              </div>
              <div>
                <Label className="font-body text-xs">Mensagem *</Label>
                <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="rounded-none mt-1" rows={5} />
              </div>
              <Button type="submit" disabled={sending} className="rounded-none font-body text-sm tracking-wider gap-2 w-full py-5">
                <Send className="w-4 h-4" /> {sending ? 'A enviar...' : 'Enviar Mensagem'}
              </Button>
            </form>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <h2 className="font-heading text-2xl mb-6">Informações</h2>
            <div className="space-y-4 mb-10">
              <a href="mailto:info@zanaacessorios.com" className="flex items-center gap-3 font-body text-sm text-muted-foreground hover:text-primary">
                <Mail className="w-5 h-5" /> info@zanaacessorios.com
              </a>
              <a
                href="https://instagram.com/zanaacessorios"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 font-body text-sm text-muted-foreground hover:text-primary"
              >
                <Instagram className="w-5 h-5" /> @zanaacessorios
              </a>
              <div className="flex items-center gap-3 font-body text-sm text-muted-foreground">
                <MapPin className="w-5 h-5" /> Portugal
              </div>
            </div>

            <h2 className="font-heading text-2xl mb-4">Perguntas Frequentes</h2>
            <Accordion type="single" collapsible className="w-full">
              {contactFaqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="font-body text-sm text-left">{faq.q}</AccordionTrigger>
                  <AccordionContent className="font-body text-sm text-muted-foreground">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

