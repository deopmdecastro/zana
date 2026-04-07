import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage, toastApiPromise } from '@/lib/toast';

const CATEGORY_DEFAULTS = [
  { value: 'colares', label: 'Colares', enabled: true },
  { value: 'brincos', label: 'Brincos', enabled: true },
  { value: 'pulseiras', label: 'Pulseiras', enabled: true },
  { value: 'aneis', label: 'Anéis', enabled: true },
  { value: 'conjuntos', label: 'Conjuntos', enabled: true },
];

const MATERIAL_DEFAULTS = [
  { value: 'aco_inox', label: 'Aço Inox', enabled: true },
  { value: 'prata', label: 'Prata', enabled: true },
  { value: 'dourado', label: 'Dourado', enabled: true },
  { value: 'rose_gold', label: 'Rose Gold', enabled: true },
  { value: 'perolas', label: 'Pérolas', enabled: true },
  { value: 'cristais', label: 'Cristais', enabled: true },
];

function normalizeLines(value) {
  const raw = String(value ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(raw));
}

export default function ProductOptionsAdmin() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-product-options'],
    queryFn: () => base44.admin.content.productOptions.get(),
  });

  const initial = useMemo(() => {
    const content = data?.content && typeof data.content === 'object' ? data.content : {};
    const categories = Array.isArray(content.categories) ? content.categories : [];
    const materials = Array.isArray(content.materials) ? content.materials : [];
    return {
      categories: CATEGORY_DEFAULTS.map((d) => {
        const found = categories.find((c) => c?.value === d.value);
        return {
          value: d.value,
          label: String(found?.label ?? d.label),
          enabled: found?.enabled !== false,
        };
      }),
      materials: MATERIAL_DEFAULTS.map((d) => {
        const found = materials.find((m) => m?.value === d.value);
        return {
          value: d.value,
          label: String(found?.label ?? d.label),
          enabled: found?.enabled !== false,
        };
      }),
      colors: Array.isArray(content.colors) ? content.colors : [],
      sizes: Array.isArray(content.sizes) ? content.sizes : [],
      attributes: Array.isArray(content.attributes) ? content.attributes : [],
    };
  }, [data]);

  const [form, setForm] = useState(initial);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const saveMutation = useMutation({
    mutationFn: (payload) => base44.admin.content.productOptions.update(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-product-options'] });
      toastApiPromise(Promise.resolve(), { loading: '', success: 'Guardado.', error: '' });
    },
  });

  const save = async () => {
    const payload = {
      categories: (form.categories ?? []).map((c) => ({
        value: c.value,
        label: String(c.label ?? '').trim() || c.value,
        enabled: c.enabled !== false,
      })),
      materials: (form.materials ?? []).map((m) => ({
        value: m.value,
        label: String(m.label ?? '').trim() || m.value,
        enabled: m.enabled !== false,
      })),
      colors: normalizeLines(form.colors),
      sizes: normalizeLines(form.sizes),
      attributes: normalizeLines(form.attributes),
    };

    await toastApiPromise(saveMutation.mutateAsync(payload), {
      loading: 'A guardar...',
      success: 'Opções do catálogo atualizadas.',
      error: (e) => getErrorMessage(e, 'Não foi possível guardar.'),
    });
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="font-heading text-2xl flex items-center gap-2 w-full">
          <Boxes className="w-5 h-5" /> Catálogo
        </h2>
        <Button
          onClick={save}
          className="rounded-none font-body text-sm tracking-wider w-full sm:w-auto"
          disabled={isLoading || saveMutation.isPending}
        >
          Guardar
        </Button>
      </div>

      {isLoading ? (
        <p className="font-body text-sm text-muted-foreground">A carregar...</p>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-xl">Categorias</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(form.categories ?? []).map((c) => (
                <div key={c.value} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-3">
                    <Label className="font-body text-xs">Chave</Label>
                    <Input value={c.value} disabled className="rounded-none mt-1" />
                  </div>
                  <div className="md:col-span-7">
                    <Label className="font-body text-xs">Nome</Label>
                    <Input
                      value={c.label}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          categories: (p.categories ?? []).map((x) => (x.value === c.value ? { ...x, label: e.target.value } : x)),
                        }))
                      }
                      className="rounded-none mt-1"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2 mt-2 md:mt-6">
                    <Switch
                      checked={c.enabled !== false}
                      onCheckedChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          categories: (p.categories ?? []).map((x) => (x.value === c.value ? { ...x, enabled: v } : x)),
                        }))
                      }
                    />
                    <span className="font-body text-xs text-muted-foreground">Ativa</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-xl">Materiais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(form.materials ?? []).map((m) => (
                <div key={m.value} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-3">
                    <Label className="font-body text-xs">Chave</Label>
                    <Input value={m.value} disabled className="rounded-none mt-1" />
                  </div>
                  <div className="md:col-span-7">
                    <Label className="font-body text-xs">Nome</Label>
                    <Input
                      value={m.label}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          materials: (p.materials ?? []).map((x) => (x.value === m.value ? { ...x, label: e.target.value } : x)),
                        }))
                      }
                      className="rounded-none mt-1"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2 mt-2 md:mt-6">
                    <Switch
                      checked={m.enabled !== false}
                      onCheckedChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          materials: (p.materials ?? []).map((x) => (x.value === m.value ? { ...x, enabled: v } : x)),
                        }))
                      }
                    />
                    <span className="font-body text-xs text-muted-foreground">Ativo</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-xl">Cores</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-body text-xs text-muted-foreground mb-3">Uma cor por linha. Estas opções aparecem no criar/editar produto.</p>
                <Textarea
                  value={(Array.isArray(form.colors) ? form.colors : []).join('\n')}
                  onChange={(e) => setForm((p) => ({ ...p, colors: e.target.value }))}
                  className="rounded-none min-h-[220px]"
                  placeholder="Dourado\nPrata\nPreto\n..."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-xl">Tamanhos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-body text-xs text-muted-foreground mb-3">Um tamanho por linha (ex.: Único, P, M, G).</p>
                <Textarea
                  value={(Array.isArray(form.sizes) ? form.sizes : []).join('\n')}
                  onChange={(e) => setForm((p) => ({ ...p, sizes: e.target.value }))}
                  className="rounded-none min-h-[220px]"
                  placeholder="Único\nPP\nP\nM\nG"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-xl">Outras informações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-body text-xs text-muted-foreground mb-3">
                  Campos que queres padronizar (apenas lista, para uso no futuro). Um por linha.
                </p>
                <Textarea
                  value={(Array.isArray(form.attributes) ? form.attributes : []).join('\n')}
                  onChange={(e) => setForm((p) => ({ ...p, attributes: e.target.value }))}
                  className="rounded-none min-h-[220px]"
                  placeholder="Pedra\nBanho\nColeção\n..."
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

