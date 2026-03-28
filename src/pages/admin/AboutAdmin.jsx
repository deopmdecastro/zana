import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ImageUpload from '@/components/uploads/ImageUpload';
import { toast } from 'sonner';
import { getErrorMessage, toastApiPromise } from '@/lib/toast';

const defaultAbout = {
  hero_title: 'Sobre a Zana',
  hero_subtitle: 'Celebrar a beleza, autenticidade e essência da mulher moderna.',
  story_title: 'A Nossa Essência',
  story_image_url: 'https://media.base44.com/images/public/69c68e1a7672ae1454387e62/0912c9232_generated_fe47a609.png',
  story_paragraphs: [
    'A Zana nasce com a missão de celebrar o universo feminino, oferecendo às mulheres produtos pensados para o seu dia a dia, com praticidade, estilo e personalidade.',
    'Mais do que uma marca, a Zana é um convite para que cada mulher se sinta única, confiante e inspirada.',
    'Com o lançamento da Zana Acessórios, apresentamos bijuterias e outros artigos que vão desde opções simples e elegantes até peças exclusivas e personalizadas. O propósito da marca é proporcionar não apenas produtos, mas experiências que traduzam beleza, autenticidade e a essência da mulher moderna.',
  ],
  values: [
    {
      title: 'Missão',
      text: 'Celebrar a beleza feminina através de acessórios que combinam elegância, qualidade e preço acessível.',
    },
    {
      title: 'Visão',
      text: 'Ser a marca de referência em bijuterias para a mulher moderna, reconhecida pela qualidade e design único.',
    },
    {
      title: 'Valores',
      text: 'Autenticidade, sofisticação, acessibilidade e dedicação a cada cliente que nos escolhe.',
    },
  ],
};

function toLines(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join('\n');
  if (typeof value === 'string') return value;
  return '';
}

function fromLines(value) {
  return String(value ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export default function AboutAdmin() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-about'],
    queryFn: () => base44.admin.content.about.get(),
  });

  const existing = data?.content ?? null;

  const initial = useMemo(() => {
    return {
      hero_title: existing?.hero_title ?? defaultAbout.hero_title,
      hero_subtitle: existing?.hero_subtitle ?? defaultAbout.hero_subtitle,
      story_image_url: existing?.story_image_url ?? defaultAbout.story_image_url,
      story_title: existing?.story_title ?? defaultAbout.story_title,
      story_paragraphs: toLines(existing?.story_paragraphs ?? defaultAbout.story_paragraphs),
      values: Array.isArray(existing?.values) && existing.values.length ? existing.values : defaultAbout.values,
    };
  }, [existing]);

  const [form, setForm] = useState(initial);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const saveMutation = useMutation({
    mutationFn: (payload) => base44.admin.content.about.update(payload),
    onSuccess: () => toast.success('Conteúdo atualizado'),
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível guardar.')),
  });

  const addValue = () => {
    setForm((p) => ({
      ...p,
      values: [...(p.values ?? []), { title: '', text: '' }],
    }));
  };

  const updateValue = (index, patch) => {
    setForm((p) => ({
      ...p,
      values: (p.values ?? []).map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }));
  };

  const removeValue = (index) => {
    setForm((p) => ({
      ...p,
      values: (p.values ?? []).filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    const payload = {
      hero_title: form.hero_title?.trim(),
      hero_subtitle: form.hero_subtitle?.trim(),
      story_image_url: form.story_image_url?.trim(),
      story_title: form.story_title?.trim(),
      story_paragraphs: fromLines(form.story_paragraphs),
      values: (form.values ?? [])
        .map((v) => ({ title: String(v.title ?? '').trim(), text: String(v.text ?? '').trim() }))
        .filter((v) => v.title || v.text),
    };

    await toastApiPromise(saveMutation.mutateAsync(payload), {
      loading: 'A guardar...',
      success: 'Guardado com sucesso.',
      error: (e) => getErrorMessage(e, 'Não foi possível guardar.'),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="font-heading text-3xl">Sobre Nós</h1>
        <Button onClick={handleSave} className="rounded-none font-body text-sm tracking-wider" disabled={isLoading}>
          Guardar
        </Button>
      </div>

      {isLoading ? (
        <p className="font-body text-sm text-muted-foreground">A carregar...</p>
      ) : (
        <div className="space-y-8">
          <div className="bg-card border border-border rounded-lg p-5">
            <h2 className="font-heading text-xl mb-4">Hero</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="font-body text-xs">Título</Label>
                <Input
                  value={form.hero_title}
                  onChange={(e) => setForm((p) => ({ ...p, hero_title: e.target.value }))}
                  className="rounded-none mt-1"
                />
              </div>
              <div>
                <Label className="font-body text-xs">Subtítulo</Label>
                <Input
                  value={form.hero_subtitle}
                  onChange={(e) => setForm((p) => ({ ...p, hero_subtitle: e.target.value }))}
                  className="rounded-none mt-1"
                />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <h2 className="font-heading text-xl mb-4">História</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <ImageUpload
                value={form.story_image_url}
                label="Foto"
                recommended="1200×900"
                onChange={(url) => setForm((p) => ({ ...p, story_image_url: url }))}
              />
              <div className="space-y-4">
                <div>
                  <Label className="font-body text-xs">Título</Label>
                  <Input
                    value={form.story_title}
                    onChange={(e) => setForm((p) => ({ ...p, story_title: e.target.value }))}
                    className="rounded-none mt-1"
                  />
                </div>
                <div>
                  <Label className="font-body text-xs">URL (opcional)</Label>
                  <Input
                    value={form.story_image_url}
                    onChange={(e) => setForm((p) => ({ ...p, story_image_url: e.target.value }))}
                    className="rounded-none mt-1"
                  />
                </div>
              </div>
            </div>
            <div className="mt-4">
              <Label className="font-body text-xs">Parágrafos (1 por linha)</Label>
              <Textarea
                value={form.story_paragraphs}
                onChange={(e) => setForm((p) => ({ ...p, story_paragraphs: e.target.value }))}
                className="rounded-none mt-1 min-h-[160px]"
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <h2 className="font-heading text-xl">Missão, Visão e Valores</h2>
              <Button type="button" variant="outline" onClick={addValue} className="rounded-none font-body text-sm">
                + Adicionar
              </Button>
            </div>

            {(form.values ?? []).length === 0 ? (
              <p className="font-body text-sm text-muted-foreground">Sem itens</p>
            ) : (
              <div className="space-y-4">
                {(form.values ?? []).map((v, idx) => (
                  <div key={idx} className="border border-border rounded-md p-4 bg-secondary/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="font-body text-xs">Título</Label>
                        <Input
                          value={v.title ?? ''}
                          onChange={(e) => updateValue(idx, { title: e.target.value })}
                          className="rounded-none mt-1"
                        />
                      </div>
                      <div className="flex items-end justify-end">
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => removeValue(idx)}
                          className="rounded-none font-body text-sm"
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Label className="font-body text-xs">Texto</Label>
                      <Textarea
                        value={v.text ?? ''}
                        onChange={(e) => updateValue(idx, { text: e.target.value })}
                        className="rounded-none mt-1 min-h-[90px]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

