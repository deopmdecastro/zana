import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchableSelect from '@/components/ui/searchable-select';
import { getErrorMessage, toastApiPromise } from '@/lib/toast';
import { Plus } from 'lucide-react';
import DeleteIcon from '@/components/ui/delete-icon';

const defaults = {
  default_method_id: 'standard',
  methods: [
    { id: 'standard', label: 'Standard', enabled: true, price: 4.99, free_over: 50, description: 'Entrega em 2–4 dias úteis.' },
    { id: 'express', label: 'Expresso', enabled: false, price: 7.99, free_over: null, description: 'Entrega em 1–2 dias úteis.' },
    { id: 'pickup', label: 'Levantamento', enabled: false, price: 0, free_over: null, description: 'Levante a encomenda num ponto combinado.' },
  ],
};

function mergeDefaults(existing) {
  const value = existing && typeof existing === 'object' ? existing : {};
  const methods = Array.isArray(value.methods) ? value.methods : [];

  const merged = methods.length
    ? methods.map((m) => ({
        id: String(m?.id ?? '').trim(),
        label: String(m?.label ?? '').trim(),
        enabled: m?.enabled !== false,
        price: m?.price === null || m?.price === undefined ? null : Number(m.price),
        free_over: m?.free_over === null || m?.free_over === undefined ? null : Number(m.free_over),
        description: m?.description ? String(m.description) : '',
      }))
    : defaults.methods;

  return {
    ...defaults,
    ...value,
    default_method_id: String(value.default_method_id ?? defaults.default_method_id),
    methods: merged,
  };
}

export default function ShippingSettingsAdmin() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-shipping'],
    queryFn: () => base44.admin.content.shipping.get(),
  });

  const initial = useMemo(() => mergeDefaults(data?.content), [data?.content]);
  const [form, setForm] = useState(initial);

  useEffect(() => setForm(initial), [initial]);

  const defaultMethodOptions = useMemo(() => {
    return (form.methods ?? [])
      .filter((m) => m.id && m.label)
      .map((m) => ({ value: m.id, label: m.label }));
  }, [form.methods]);

  const saveMutation = useMutation({
    mutationFn: (payload) => base44.admin.content.shipping.update(payload),
  });

  const save = async () => {
    const cleanedMethods = (form.methods ?? [])
      .map((m) => ({
        id: String(m?.id ?? '').trim(),
        label: String(m?.label ?? '').trim(),
        enabled: !!m?.enabled,
        price: m?.price === null || m?.price === undefined || m?.price === '' ? null : Number(m.price),
        free_over: m?.free_over === null || m?.free_over === undefined || m?.free_over === '' ? null : Number(m.free_over),
        description: String(m?.description ?? '').trim() || null,
      }))
      .filter((m) => m.id && m.label);

    const payload = {
      default_method_id: String(form.default_method_id ?? '').trim() || null,
      methods: cleanedMethods,
    };

    await toastApiPromise(saveMutation.mutateAsync(payload), {
      loading: 'A guardar...',
      success: 'Definições guardadas com sucesso.',
      error: (e) => getErrorMessage(e, 'Não foi possível guardar.'),
    });
  };

  const addMethod = () => {
    const baseId = `metodo-${Date.now()}`;
    setForm((p) => ({
      ...p,
      methods: [
        ...(p.methods ?? []),
        { id: baseId, label: 'Novo método', enabled: true, price: 0, free_over: null, description: '' },
      ],
    }));
  };

  const removeMethod = (id) => {
    setForm((p) => {
      const nextMethods = (p.methods ?? []).filter((m) => m.id !== id);
      const nextDefault = p.default_method_id === id ? (nextMethods[0]?.id ?? null) : p.default_method_id;
      return { ...p, methods: nextMethods, default_method_id: nextDefault };
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h2 className="font-heading text-2xl">Métodos de envio</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={addMethod} className="rounded-none font-body text-sm gap-2" disabled={isLoading}>
            <Plus className="w-4 h-4" />
            Adicionar
          </Button>
          <Button onClick={save} className="rounded-none font-body text-sm tracking-wider" disabled={isLoading}>
            Guardar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="font-body text-sm text-muted-foreground">A carregar...</p>
      ) : (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="font-heading text-xl">Método padrão</div>
                <div className="font-body text-xs text-muted-foreground mt-1">Este método aparece selecionado no checkout.</div>
              </div>
              <div className="w-full sm:w-72">
                {defaultMethodOptions.length > 10 ? (
                  <SearchableSelect
                    value={form.default_method_id ?? ''}
                    onChange={(v) => setForm((p) => ({ ...p, default_method_id: v }))}
                    options={defaultMethodOptions}
                    placeholder="Escolher..."
                    searchPlaceholder="Pesquisar método..."
                    className="rounded-none"
                  />
                ) : (
                  <Select value={form.default_method_id ?? ''} onValueChange={(v) => setForm((p) => ({ ...p, default_method_id: v }))}>
                    <SelectTrigger className="rounded-none">
                      <SelectValue placeholder="Escolher..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(form.methods ?? [])
                        .filter((m) => m.id && m.label)
                        .map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(form.methods ?? []).map((m, idx) => (
              <div key={m.id ?? idx} className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <div className="font-heading text-xl truncate">{m.label || 'Método'}</div>
                    <div className="font-body text-xs text-muted-foreground mt-1">ID: {m.id}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!m.enabled} onCheckedChange={(v) => setForm((p) => ({
                      ...p,
                      methods: (p.methods ?? []).map((x) => (x.id === m.id ? { ...x, enabled: v } : x)),
                    }))} />
                    <Button variant="ghost" size="icon" onClick={() => removeMethod(m.id)} title="Remover">
                      <DeleteIcon className="text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-body text-xs">Título</Label>
                    <Input
                      value={m.label ?? ''}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          methods: (p.methods ?? []).map((x) => (x.id === m.id ? { ...x, label: e.target.value } : x)),
                        }))
                      }
                      className="rounded-none mt-1"
                    />
                  </div>
                  <div>
                    <Label className="font-body text-xs">Preço (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={m.price ?? ''}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          methods: (p.methods ?? []).map((x) => (x.id === m.id ? { ...x, price: e.target.value } : x)),
                        }))
                      }
                      className="rounded-none mt-1"
                    />
                  </div>
                  <div>
                    <Label className="font-body text-xs">Grátis a partir de (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={m.free_over ?? ''}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          methods: (p.methods ?? []).map((x) => (x.id === m.id ? { ...x, free_over: e.target.value } : x)),
                        }))
                      }
                      className="rounded-none mt-1"
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <Label className="font-body text-xs">Descrição</Label>
                  <Textarea
                    value={m.description ?? ''}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        methods: (p.methods ?? []).map((x) => (x.id === m.id ? { ...x, description: e.target.value } : x)),
                      }))
                    }
                    className="rounded-none mt-1 min-h-[90px]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
