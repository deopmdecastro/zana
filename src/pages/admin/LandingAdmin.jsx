import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import ImageUpload from '@/components/uploads/ImageUpload';
import { getErrorMessage, toastApiPromise } from '@/lib/toast';

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

const defaultLanding = {
  hero: {
    image_url: 'https://media.base44.com/images/public/69c68e1a7672ae1454387e62/1816d3520_generated_8c5deb5b.png',
    tag: 'Nova Coleção 2025',
    title: 'Elegância\nem cada\ndetalhe',
    subtitle: 'Descubra bijuterias que celebram a essência da mulher moderna. Peças únicas, delicadas e sofisticadas.',
    primary_cta_label: 'Ver Coleção',
    primary_cta_to: '/catalogo',
    secondary_cta_logged_in_label: 'Sobre Nós',
    secondary_cta_logged_in_to: '/sobre',
    secondary_cta_logged_out_label: 'Entrar',
    secondary_cta_logged_out_to: '/conta',
  },
  brand: {
    image_url: 'https://media.base44.com/images/public/69c68e1a7672ae1454387e62/0912c9232_generated_fe47a609.png',
    eyebrow: 'A Nossa Essência',
    title: 'Celebrar a beleza em cada mulher',
    paragraphs: [
      'A Zana nasce com a missão de celebrar o universo feminino, oferecendo às mulheres produtos pensados para o seu dia a dia, com praticidade, estilo e personalidade.',
      'Mais do que uma marca, a Zana é um convite para que cada mulher se sinta única, confiante e inspirada.',
    ],
    link_label: 'Conhecer a história →',
    link_to: '/sobre',
  },
  categories: {
    eyebrow: 'Explore',
    title: 'As Nossas Coleções',
    items: [
      {
        name: 'Colares',
        slug: 'colares',
        image_url: 'https://media.base44.com/images/public/69c68e1a7672ae1454387e62/2d13f0217_generated_69ec28d0.png',
      },
      {
        name: 'Brincos',
        slug: 'brincos',
        image_url: 'https://media.base44.com/images/public/69c68e1a7672ae1454387e62/5e15fdc1b_generated_83c31e3b.png',
      },
      {
        name: 'Pulseiras',
        slug: 'pulseiras',
        image_url: 'https://media.base44.com/images/public/69c68e1a7672ae1454387e62/56b29b25c_generated_ac56f9ac.png',
      },
    ],
  },
  newsletter: {
    enabled: true,
    title: 'Receba as Novidades',
    text: 'Subscreva a nossa newsletter e fique a par das últimas coleções, promoções exclusivas e dicas de estilo.',
    placeholder: 'O seu email',
    button_label: 'Subscrever',
  },
  ads: {
    before_highlights: { enabled: false, image_url: '', link_to: '', alt: 'Publicidade' },
    before_testimonials: { enabled: false, image_url: '', link_to: '', alt: 'Publicidade' },
  },
};

export default function LandingAdmin() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-landing'],
    queryFn: () => base44.admin.content.landing.get(),
  });

  const existing = data?.content ?? null;

  const initial = useMemo(() => {
    const hero = { ...defaultLanding.hero, ...(existing?.hero ?? {}) };
    const brand = { ...defaultLanding.brand, ...(existing?.brand ?? {}) };
    const categories = { ...defaultLanding.categories, ...(existing?.categories ?? {}) };
    const newsletter = { ...defaultLanding.newsletter, ...(existing?.newsletter ?? {}) };
    const ads = { ...defaultLanding.ads, ...(existing?.ads ?? {}) };
    const beforeHighlights = { ...defaultLanding.ads.before_highlights, ...(ads?.before_highlights ?? {}) };
    const beforeTestimonials = { ...defaultLanding.ads.before_testimonials, ...(ads?.before_testimonials ?? {}) };

    const catItems = Array.isArray(categories?.items) ? categories.items : defaultLanding.categories.items;

    return {
      hero: { ...hero, title: String(hero.title ?? ''), subtitle: String(hero.subtitle ?? '') },
      brand: { ...brand, paragraphsText: toLines(brand.paragraphs ?? []) },
      categories: { ...categories, items: catItems.map((it) => ({ ...it })) },
      newsletter: { ...newsletter },
      ads: {
        before_highlights: { ...beforeHighlights },
        before_testimonials: { ...beforeTestimonials },
      },
    };
  }, [existing]);

  const [form, setForm] = useState(initial);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const saveMutation = useMutation({
    mutationFn: (payload) => base44.admin.content.landing.update(payload),
  });

  const addCategory = () => {
    setForm((p) => ({
      ...p,
      categories: {
        ...p.categories,
        items: [...(p.categories?.items ?? []), { name: '', slug: '', image_url: '' }],
      },
    }));
  };

  const updateCategory = (index, patch) => {
    setForm((p) => ({
      ...p,
      categories: {
        ...p.categories,
        items: (p.categories?.items ?? []).map((it, i) => (i === index ? { ...it, ...patch } : it)),
      },
    }));
  };

  const removeCategory = (index) => {
    setForm((p) => ({
      ...p,
      categories: { ...p.categories, items: (p.categories?.items ?? []).filter((_, i) => i !== index) },
    }));
  };

  const handleSave = async () => {
    const payload = {
      hero: {
        image_url: String(form.hero?.image_url ?? '').trim() || null,
        tag: String(form.hero?.tag ?? '').trim() || null,
        title: String(form.hero?.title ?? '').trim() || null,
        subtitle: String(form.hero?.subtitle ?? '').trim() || null,
        primary_cta_label: String(form.hero?.primary_cta_label ?? '').trim() || null,
        primary_cta_to: String(form.hero?.primary_cta_to ?? '').trim() || null,
        secondary_cta_logged_in_label: String(form.hero?.secondary_cta_logged_in_label ?? '').trim() || null,
        secondary_cta_logged_in_to: String(form.hero?.secondary_cta_logged_in_to ?? '').trim() || null,
        secondary_cta_logged_out_label: String(form.hero?.secondary_cta_logged_out_label ?? '').trim() || null,
        secondary_cta_logged_out_to: String(form.hero?.secondary_cta_logged_out_to ?? '').trim() || null,
      },
      brand: {
        image_url: String(form.brand?.image_url ?? '').trim() || null,
        eyebrow: String(form.brand?.eyebrow ?? '').trim() || null,
        title: String(form.brand?.title ?? '').trim() || null,
        paragraphs: fromLines(form.brand?.paragraphsText),
        link_label: String(form.brand?.link_label ?? '').trim() || null,
        link_to: String(form.brand?.link_to ?? '').trim() || null,
      },
      categories: {
        eyebrow: String(form.categories?.eyebrow ?? '').trim() || null,
        title: String(form.categories?.title ?? '').trim() || null,
        items: (form.categories?.items ?? [])
          .map((it) => ({
            name: String(it?.name ?? '').trim(),
            slug: String(it?.slug ?? '').trim(),
            image_url: String(it?.image_url ?? '').trim() || null,
          }))
          .filter((it) => it.name || it.slug || it.image_url),
      },
      newsletter: {
        enabled: Boolean(form.newsletter?.enabled),
        title: String(form.newsletter?.title ?? '').trim() || null,
        text: String(form.newsletter?.text ?? '').trim() || null,
        placeholder: String(form.newsletter?.placeholder ?? '').trim() || null,
        button_label: String(form.newsletter?.button_label ?? '').trim() || null,
      },
      ads: {
        before_highlights: {
          enabled: Boolean(form.ads?.before_highlights?.enabled),
          image_url: String(form.ads?.before_highlights?.image_url ?? '').trim() || null,
          link_to: String(form.ads?.before_highlights?.link_to ?? '').trim() || null,
          alt: String(form.ads?.before_highlights?.alt ?? '').trim() || null,
        },
        before_testimonials: {
          enabled: Boolean(form.ads?.before_testimonials?.enabled),
          image_url: String(form.ads?.before_testimonials?.image_url ?? '').trim() || null,
          link_to: String(form.ads?.before_testimonials?.link_to ?? '').trim() || null,
          alt: String(form.ads?.before_testimonials?.alt ?? '').trim() || null,
        },
      },
    };

    await toastApiPromise(saveMutation.mutateAsync(payload), {
      loading: 'A guardar...',
      success: 'Conteúdo guardado com sucesso.',
      error: (e) => getErrorMessage(e, 'Não foi possível guardar.'),
    });
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="font-heading text-2xl w-full">Landing page</h2>
        <Button onClick={handleSave} className="rounded-none font-body text-sm tracking-wider w-full sm:w-auto" disabled={isLoading}>
          Guardar
        </Button>
      </div>

      {isLoading ? (
        <p className="font-body text-sm text-muted-foreground">A carregar...</p>
      ) : (
        <div className="space-y-8">
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-heading text-xl mb-4">Hero</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="font-body text-xs">Selo (ex: “Nova Coleção”)</Label>
                  <Input
                    value={form.hero?.tag ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, hero: { ...p.hero, tag: e.target.value } }))}
                    className="rounded-none mt-1"
                  />
                </div>
                <div>
                  <Label className="font-body text-xs">Título (use quebras de linha)</Label>
                  <Textarea
                    value={form.hero?.title ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, hero: { ...p.hero, title: e.target.value } }))}
                    className="rounded-none mt-1 min-h-[110px]"
                  />
                </div>
                <div>
                  <Label className="font-body text-xs">Subtítulo</Label>
                  <Textarea
                    value={form.hero?.subtitle ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, hero: { ...p.hero, subtitle: e.target.value } }))}
                    className="rounded-none mt-1 min-h-[110px]"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <ImageUpload
                  value={form.hero?.image_url ?? ''}
                  label="Imagem de fundo"
                  recommended="2000×1200"
                  onChange={(url) => setForm((p) => ({ ...p, hero: { ...p.hero, image_url: url } }))}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-body text-xs">CTA principal (texto)</Label>
                    <Input
                      value={form.hero?.primary_cta_label ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, hero: { ...p.hero, primary_cta_label: e.target.value } }))}
                      className="rounded-none mt-1"
                    />
                  </div>
                  <div>
                    <Label className="font-body text-xs">CTA principal (link)</Label>
                    <Input
                      value={form.hero?.primary_cta_to ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, hero: { ...p.hero, primary_cta_to: e.target.value } }))}
                      className="rounded-none mt-1"
                    />
                  </div>
                </div>

                <div className="bg-secondary/20 border border-border rounded-md p-4">
                  <div className="font-body text-xs text-muted-foreground mb-3">CTA secundário</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="font-body text-xs">Logado (texto)</Label>
                      <Input
                        value={form.hero?.secondary_cta_logged_in_label ?? ''}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, hero: { ...p.hero, secondary_cta_logged_in_label: e.target.value } }))
                        }
                        className="rounded-none mt-1"
                      />
                    </div>
                    <div>
                      <Label className="font-body text-xs">Logado (link)</Label>
                      <Input
                        value={form.hero?.secondary_cta_logged_in_to ?? ''}
                        onChange={(e) => setForm((p) => ({ ...p, hero: { ...p.hero, secondary_cta_logged_in_to: e.target.value } }))}
                        className="rounded-none mt-1"
                      />
                    </div>
                    <div>
                      <Label className="font-body text-xs">Deslogado (texto)</Label>
                      <Input
                        value={form.hero?.secondary_cta_logged_out_label ?? ''}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, hero: { ...p.hero, secondary_cta_logged_out_label: e.target.value } }))
                        }
                        className="rounded-none mt-1"
                      />
                    </div>
                    <div>
                      <Label className="font-body text-xs">Deslogado (link)</Label>
                      <Input
                        value={form.hero?.secondary_cta_logged_out_to ?? ''}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, hero: { ...p.hero, secondary_cta_logged_out_to: e.target.value } }))
                        }
                        className="rounded-none mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-heading text-xl mb-4">Banner “A nossa essência”</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ImageUpload
                value={form.brand?.image_url ?? ''}
                label="Imagem"
                recommended="1600×1200"
                onChange={(url) => setForm((p) => ({ ...p, brand: { ...p.brand, image_url: url } }))}
              />
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-body text-xs">Eyebrow</Label>
                    <Input
                      value={form.brand?.eyebrow ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, brand: { ...p.brand, eyebrow: e.target.value } }))}
                      className="rounded-none mt-1"
                    />
                  </div>
                  <div>
                    <Label className="font-body text-xs">Título</Label>
                    <Input
                      value={form.brand?.title ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, brand: { ...p.brand, title: e.target.value } }))}
                      className="rounded-none mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="font-body text-xs">Parágrafos (1 por linha)</Label>
                  <Textarea
                    value={form.brand?.paragraphsText ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, brand: { ...p.brand, paragraphsText: e.target.value } }))}
                    className="rounded-none mt-1 min-h-[150px]"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-body text-xs">Link (texto)</Label>
                    <Input
                      value={form.brand?.link_label ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, brand: { ...p.brand, link_label: e.target.value } }))}
                      className="rounded-none mt-1"
                    />
                  </div>
                  <div>
                    <Label className="font-body text-xs">Link (destino)</Label>
                    <Input
                      value={form.brand?.link_to ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, brand: { ...p.brand, link_to: e.target.value } }))}
                      className="rounded-none mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <h3 className="font-heading text-xl">Coleções (categorias)</h3>
              <Button type="button" variant="outline" onClick={addCategory} className="rounded-none font-body text-sm">
                + Adicionar
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="font-body text-xs">Eyebrow</Label>
                <Input
                  value={form.categories?.eyebrow ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, categories: { ...p.categories, eyebrow: e.target.value } }))}
                  className="rounded-none mt-1"
                />
              </div>
              <div>
                <Label className="font-body text-xs">Título</Label>
                <Input
                  value={form.categories?.title ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, categories: { ...p.categories, title: e.target.value } }))}
                  className="rounded-none mt-1"
                />
              </div>
            </div>

            {(form.categories?.items ?? []).length === 0 ? (
              <p className="font-body text-sm text-muted-foreground">Sem categorias</p>
            ) : (
              <div className="space-y-4">
                {(form.categories?.items ?? []).map((it, idx) => (
                  <div key={idx} className="border border-border rounded-md p-4 bg-secondary/20">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <ImageUpload
                        value={it.image_url ?? ''}
                        label="Imagem"
                        recommended="1200×1600"
                        onChange={(url) => updateCategory(idx, { image_url: url })}
                      />
                      <div className="lg:col-span-2 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="font-body text-xs">Nome</Label>
                            <Input
                              value={it.name ?? ''}
                              onChange={(e) => updateCategory(idx, { name: e.target.value })}
                              className="rounded-none mt-1"
                            />
                          </div>
                          <div>
                            <Label className="font-body text-xs">Slug (ex: colares)</Label>
                            <Input
                              value={it.slug ?? ''}
                              onChange={(e) => updateCategory(idx, { slug: e.target.value })}
                              className="rounded-none mt-1"
                            />
                          </div>
                        </div>
                        <div className="flex items-end justify-end">
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => removeCategory(idx)}
                            className="rounded-none font-body text-sm"
                          >
                            Remover
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-heading text-xl mb-4">Banners publicitários</h3>
            <p className="font-body text-sm text-muted-foreground mb-4">
              Mostra um banner antes dos “Destaques” e outro antes das “Avaliações” na página inicial.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="border border-border rounded-md p-4 bg-secondary/10">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="font-body text-sm font-medium">Antes dos Destaques</div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!form.ads?.before_highlights?.enabled}
                      onCheckedChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          ads: { ...p.ads, before_highlights: { ...p.ads?.before_highlights, enabled: v } },
                        }))
                      }
                    />
                    <span className="font-body text-xs text-muted-foreground">Ativo</span>
                  </div>
                </div>

                <ImageUpload
                  value={form.ads?.before_highlights?.image_url ?? ''}
                  label="Imagem"
                  recommended="1920×600"
                  onChange={(url) =>
                    setForm((p) => ({
                      ...p,
                      ads: { ...p.ads, before_highlights: { ...p.ads?.before_highlights, image_url: url } },
                    }))
                  }
                />
                <div className="mt-3 space-y-3">
                  <div>
                    <Label className="font-body text-xs">Link (opcional)</Label>
                    <Input
                      value={form.ads?.before_highlights?.link_to ?? ''}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          ads: { ...p.ads, before_highlights: { ...p.ads?.before_highlights, link_to: e.target.value } },
                        }))
                      }
                      className="rounded-none mt-1"
                      placeholder="/catalogo"
                    />
                  </div>
                  <div>
                    <Label className="font-body text-xs">Texto alternativo (alt)</Label>
                    <Input
                      value={form.ads?.before_highlights?.alt ?? ''}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          ads: { ...p.ads, before_highlights: { ...p.ads?.before_highlights, alt: e.target.value } },
                        }))
                      }
                      className="rounded-none mt-1"
                      placeholder="Publicidade"
                    />
                  </div>
                </div>
              </div>

              <div className="border border-border rounded-md p-4 bg-secondary/10">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="font-body text-sm font-medium">Antes das Avaliações</div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!form.ads?.before_testimonials?.enabled}
                      onCheckedChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          ads: { ...p.ads, before_testimonials: { ...p.ads?.before_testimonials, enabled: v } },
                        }))
                      }
                    />
                    <span className="font-body text-xs text-muted-foreground">Ativo</span>
                  </div>
                </div>

                <ImageUpload
                  value={form.ads?.before_testimonials?.image_url ?? ''}
                  label="Imagem"
                  recommended="1920×600"
                  onChange={(url) =>
                    setForm((p) => ({
                      ...p,
                      ads: { ...p.ads, before_testimonials: { ...p.ads?.before_testimonials, image_url: url } },
                    }))
                  }
                />
                <div className="mt-3 space-y-3">
                  <div>
                    <Label className="font-body text-xs">Link (opcional)</Label>
                    <Input
                      value={form.ads?.before_testimonials?.link_to ?? ''}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          ads: { ...p.ads, before_testimonials: { ...p.ads?.before_testimonials, link_to: e.target.value } },
                        }))
                      }
                      className="rounded-none mt-1"
                      placeholder="/catalogo"
                    />
                  </div>
                  <div>
                    <Label className="font-body text-xs">Texto alternativo (alt)</Label>
                    <Input
                      value={form.ads?.before_testimonials?.alt ?? ''}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          ads: { ...p.ads, before_testimonials: { ...p.ads?.before_testimonials, alt: e.target.value } },
                        }))
                      }
                      className="rounded-none mt-1"
                      placeholder="Publicidade"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-heading text-xl mb-4">Newsletter</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <Label className="font-body text-xs">Título</Label>
                <Input
                  value={form.newsletter?.title ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, newsletter: { ...p.newsletter, title: e.target.value } }))}
                  className="rounded-none mt-1"
                />
              </div>
              <div>
                <Label className="font-body text-xs">Botão</Label>
                <Input
                  value={form.newsletter?.button_label ?? ''}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, newsletter: { ...p.newsletter, button_label: e.target.value } }))
                  }
                  className="rounded-none mt-1"
                />
              </div>
              <div className="lg:col-span-2">
                <Label className="font-body text-xs">Texto</Label>
                <Textarea
                  value={form.newsletter?.text ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, newsletter: { ...p.newsletter, text: e.target.value } }))}
                  className="rounded-none mt-1 min-h-[120px]"
                />
              </div>
              <div>
                <Label className="font-body text-xs">Placeholder</Label>
                <Input
                  value={form.newsletter?.placeholder ?? ''}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, newsletter: { ...p.newsletter, placeholder: e.target.value } }))
                  }
                  className="rounded-none mt-1"
                />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <Switch
                  checked={!!form.newsletter?.enabled}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, newsletter: { ...p.newsletter, enabled: v } }))}
                />
                <Label className="font-body text-xs">Ativar secção</Label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
