import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import StarRating from '@/components/ui/star-rating';
import SearchableSelect from '@/components/ui/searchable-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getErrorMessage } from '@/lib/toast';

const fallbackTestimonials = [
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
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ product_id: '', rating: 5, comment: '' });

  const { data: reviews = [] } = useQuery({
    queryKey: ['public-reviews-testimonials'],
    queryFn: () => base44.entities.Review.filter({}, '-created_date', 200),
    staleTime: 60_000,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-review-picker'],
    queryFn: () => base44.entities.Product.filter({}, '-created_date', 200),
    staleTime: 60_000,
  });

  const productOptions = useMemo(() => {
    return (Array.isArray(products) ? products : []).map((p) => ({ value: p.id, label: p.name }));
  }, [products]);

  const testimonials = useMemo(() => {
    const source = (Array.isArray(reviews) ? reviews : [])
      .filter((r) => (r?.comment ?? '').trim())
      .map((r) => ({
        name: r.author_name || 'Cliente',
        text: String(r.comment ?? ''),
        rating: Math.max(1, Math.min(5, Number(r.rating ?? 5) || 5)),
      }));

    if (source.length >= 3) return source.slice(0, 3);
    return fallbackTestimonials;
  }, [reviews]);

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
              key={`${t.name}-${i}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="bg-card p-8 rounded-lg relative"
            >
              <Quote className="w-8 h-8 text-accent/40 absolute top-6 right-6" />
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className={`w-3.5 h-3.5 ${j < t.rating ? 'fill-accent text-accent' : 'text-border'}`} />
                ))}
              </div>
              <p className="font-body text-sm text-foreground/80 leading-relaxed mb-6 italic">"{t.text}"</p>
              <p className="font-body text-xs font-semibold tracking-wider uppercase">{t.name}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Button
            className="rounded-none font-body text-sm tracking-wider"
            onClick={() => {
              if (!user) {
                toast.error('Inicie sessão para avaliar.');
                return;
              }
              setOpen(true);
            }}
          >
            Avaliar
          </Button>
          <p className="font-body text-xs text-muted-foreground mt-2">Obrigado pelo seu feedback.</p>
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setForm({ product_id: '', rating: 5, comment: '' });
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Avaliar</DialogTitle>
          </DialogHeader>

          {!user ? (
            <div className="space-y-3">
              <p className="font-body text-sm text-muted-foreground">Para deixar uma avaliação, inicie sessão.</p>
              <Link to="/conta" className="inline-flex">
                <Button className="rounded-none font-body text-sm tracking-wider">Entrar</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="font-body text-xs">Produto</Label>
                <div className="mt-1">
                  {productOptions.length > 10 ? (
                    <SearchableSelect
                      value={form.product_id}
                      onChange={(v) => setForm((p) => ({ ...p, product_id: v }))}
                      options={productOptions}
                      placeholder="Selecionar..."
                      searchPlaceholder="Pesquisar produto..."
                    />
                  ) : (
                    <Select
                      value={form.product_id}
                      onValueChange={(value) => setForm((p) => ({ ...p, product_id: value }))}
                      disabled={productOptions.length === 0}
                    >
                      <SelectTrigger className="w-full rounded-none mt-1">
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {productOptions.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div>
                <Label className="font-body text-xs">Rating</Label>
                <div className="mt-2">
                  <StarRating value={form.rating} onChange={(v) => setForm((p) => ({ ...p, rating: v }))} aria-label="Escolher rating" />
                </div>
              </div>

              <div>
                <Label className="font-body text-xs">Comentário (opcional)</Label>
                <Textarea
                  value={form.comment}
                  onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))}
                  className="rounded-none mt-1 min-h-[120px]"
                  placeholder="Conte-nos a sua experiência…"
                />
              </div>

              <Button
                className="w-full rounded-none font-body text-sm tracking-wider"
                onClick={async () => {
                  if (!form.product_id) return toast.error('Selecione um produto.');
                  try {
                    await base44.entities.ProductReview.create({
                      product_id: form.product_id,
                      rating: Number(form.rating) || 5,
                      comment: form.comment?.trim() || null,
                    });
                    toast.success('Avaliação enviada.');
                    setOpen(false);
                  } catch (err) {
                    toast.error(getErrorMessage(err, 'Não foi possível enviar.'));
                  }
                }}
              >
                Enviar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
