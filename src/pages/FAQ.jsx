import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HelpCircle } from 'lucide-react';
import { contactFaqs } from '@/lib/contactFaqs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';
import { useAuth } from '@/lib/AuthContext';

export default function FAQPage() {
  const { user } = useAuth();
  const [questionForm, setQuestionForm] = useState({
    author_name: user?.full_name || '',
    author_email: user?.email || '',
    question: '',
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['faq'],
    queryFn: () => base44.faq.list(),
  });

  const list = useMemo(() => {
    const base = contactFaqs.map((f, idx) => ({ id: `contact-${idx}`, question: f.q, answer: f.a }));
    const byQuestion = new Set(base.map((x) => String(x.question).trim().toLowerCase()));
    const extra = (Array.isArray(items) ? items : [])
      .filter((it) => it?.question && it?.answer)
      .filter((it) => {
        const key = String(it.question).trim().toLowerCase();
        if (!key) return false;
        if (byQuestion.has(key)) return false;
        byQuestion.add(key);
        return true;
      });
    return [...base, ...extra];
  }, [items]);

  return (
    <div className="min-h-screen">
      <div className="bg-primary py-12 md:py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-body text-xs tracking-[0.3em] uppercase text-primary-foreground/60 mb-2">Ajuda</p>
          <h1 className="font-heading text-4xl md:text-6xl text-primary-foreground font-light">Perguntas Frequentes</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 space-y-12">
        {isLoading ? (
          <p className="font-body text-sm text-muted-foreground">A carregar...</p>
        ) : list.length === 0 ? (
          <div className="text-center py-16">
            <HelpCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-heading text-2xl text-muted-foreground">Sem perguntas</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {list.map((it) => (
              <AccordionItem key={it.id} value={it.id}>
                <AccordionTrigger className="font-heading text-left">{it.question}</AccordionTrigger>
                <AccordionContent className="font-body text-sm text-muted-foreground leading-relaxed">
                  {it.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="font-heading text-2xl">Fazer uma questão</h2>
          <p className="font-body text-sm text-muted-foreground mt-2">
            Não encontrou a resposta? Envie a sua pergunta — a equipa responde e, se fizer sentido, publicamos no FAQ.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            <div>
              <Label className="font-body text-xs">Nome (opcional)</Label>
              <Input
                value={questionForm.author_name}
                onChange={(e) => setQuestionForm((p) => ({ ...p, author_name: e.target.value }))}
                className="rounded-none mt-1"
                placeholder="O seu nome"
              />
            </div>
            <div>
              <Label className="font-body text-xs">Email (opcional)</Label>
              <Input
                type="email"
                value={questionForm.author_email}
                onChange={(e) => setQuestionForm((p) => ({ ...p, author_email: e.target.value }))}
                className="rounded-none mt-1"
                placeholder="email@exemplo.com"
              />
            </div>
          </div>

          <div className="mt-4">
            <Label className="font-body text-xs">Pergunta *</Label>
            <Textarea
              value={questionForm.question}
              onChange={(e) => setQuestionForm((p) => ({ ...p, question: e.target.value }))}
              className="rounded-none mt-1 min-h-[120px]"
              placeholder="Escreva a sua dúvida…"
            />
          </div>

          <Button
            className="mt-4 w-full rounded-none font-body text-sm tracking-wider"
            onClick={async () => {
              const q = String(questionForm.question ?? '').trim();
              if (q.length < 5) return toast.error('Escreva uma pergunta (mín. 5 caracteres).');
              try {
                await base44.faq.questions.create({
                  question: q,
                  author_name: String(questionForm.author_name ?? '').trim() || null,
                  author_email: String(questionForm.author_email ?? '').trim() || null,
                });
                toast.success('Questão enviada.');
                setQuestionForm((p) => ({ ...p, question: '' }));
              } catch (err) {
                toast.error(getErrorMessage(err, 'Não foi possível enviar.'));
              }
            }}
          >
            Enviar questão
          </Button>
        </div>
      </div>
    </div>
  );
}
