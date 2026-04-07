import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage, toastApiPromise } from '@/lib/toast';

const defaults = {
  methods: {
    mbway: { enabled: true, phone: '', instructions: '' },
    transferencia: { enabled: false, iban: '', holder: '', bank: '', instructions: '' },
    multibanco: { enabled: false, entity: '', reference: '', instructions: '' },
    paypal: { enabled: false, email: '', instructions: '' },
  },
  general_notes: '',
};

function mergeDefaults(existing) {
  const value = existing && typeof existing === 'object' ? existing : {};
  const methods = value.methods && typeof value.methods === 'object' ? value.methods : {};
  return {
    ...defaults,
    ...value,
    methods: {
      ...defaults.methods,
      ...methods,
      mbway: { ...defaults.methods.mbway, ...(methods.mbway ?? {}) },
      transferencia: { ...defaults.methods.transferencia, ...(methods.transferencia ?? {}) },
      multibanco: { ...defaults.methods.multibanco, ...(methods.multibanco ?? {}) },
      paypal: { ...defaults.methods.paypal, ...(methods.paypal ?? {}) },
    },
  };
}

export default function PaymentSettingsAdmin() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: () => base44.admin.content.payments.get(),
  });

  const initial = useMemo(() => mergeDefaults(data?.content), [data?.content]);
  const [form, setForm] = useState(initial);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const saveMutation = useMutation({
    mutationFn: (payload) => base44.admin.content.payments.update(payload),
  });

  const save = async () => {
    const payload = {
      general_notes: String(form.general_notes ?? '').trim() || null,
      methods: {
        mbway: {
          enabled: !!form.methods?.mbway?.enabled,
          phone: String(form.methods?.mbway?.phone ?? '').trim() || null,
          instructions: String(form.methods?.mbway?.instructions ?? '').trim() || null,
        },
        transferencia: {
          enabled: !!form.methods?.transferencia?.enabled,
          iban: String(form.methods?.transferencia?.iban ?? '').trim() || null,
          holder: String(form.methods?.transferencia?.holder ?? '').trim() || null,
          bank: String(form.methods?.transferencia?.bank ?? '').trim() || null,
          instructions: String(form.methods?.transferencia?.instructions ?? '').trim() || null,
        },
        multibanco: {
          enabled: !!form.methods?.multibanco?.enabled,
          entity: String(form.methods?.multibanco?.entity ?? '').trim() || null,
          reference: String(form.methods?.multibanco?.reference ?? '').trim() || null,
          instructions: String(form.methods?.multibanco?.instructions ?? '').trim() || null,
        },
        paypal: {
          enabled: !!form.methods?.paypal?.enabled,
          email: String(form.methods?.paypal?.email ?? '').trim() || null,
          instructions: String(form.methods?.paypal?.instructions ?? '').trim() || null,
        },
      },
    };

    await toastApiPromise(saveMutation.mutateAsync(payload), {
      loading: 'A guardar...',
      success: 'Definições guardadas com sucesso.',
      error: (e) => getErrorMessage(e, 'Não foi possível guardar.'),
    });
  };

  const MethodCard = ({ title, enabled, onEnabledChange, children }) => (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div className="font-heading text-xl">{title}</div>
        <div className="flex items-center gap-2">
          <Switch checked={!!enabled} onCheckedChange={onEnabledChange} />
          <span className="font-body text-xs text-muted-foreground">{enabled ? 'Ativo' : 'Inativo'}</span>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="font-heading text-2xl w-full">Métodos de pagamento</h2>
        <Button onClick={save} className="rounded-none font-body text-sm tracking-wider w-full sm:w-auto" disabled={isLoading}>
          Guardar
        </Button>
      </div>

      {isLoading ? (
        <p className="font-body text-sm text-muted-foreground">A carregar...</p>
      ) : (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-heading text-xl mb-4">Notas gerais</h3>
            <Label className="font-body text-xs">Texto mostrado no checkout (opcional)</Label>
            <Textarea
              value={form.general_notes ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, general_notes: e.target.value }))}
              className="rounded-none mt-1 min-h-[120px]"
            />
          </div>

          <MethodCard
            title="MB WAY"
            enabled={form.methods?.mbway?.enabled}
            onEnabledChange={(v) => setForm((p) => ({ ...p, methods: { ...p.methods, mbway: { ...p.methods.mbway, enabled: v } } }))}
          >
            <div>
              <Label className="font-body text-xs">Número (telefone)</Label>
              <Input
                value={form.methods?.mbway?.phone ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, methods: { ...p.methods, mbway: { ...p.methods.mbway, phone: e.target.value } } }))}
                className="rounded-none mt-1"
              />
            </div>
            <div>
              <Label className="font-body text-xs">Instruções</Label>
              <Textarea
                value={form.methods?.mbway?.instructions ?? ''}
                onChange={(e) =>
                  setForm((p) => ({ ...p, methods: { ...p.methods, mbway: { ...p.methods.mbway, instructions: e.target.value } } }))
                }
                className="rounded-none mt-1 min-h-[120px]"
              />
            </div>
          </MethodCard>

          <MethodCard
            title="Transferência Bancária"
            enabled={form.methods?.transferencia?.enabled}
            onEnabledChange={(v) =>
              setForm((p) => ({ ...p, methods: { ...p.methods, transferencia: { ...p.methods.transferencia, enabled: v } } }))
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="font-body text-xs">IBAN</Label>
                <Input
                  value={form.methods?.transferencia?.iban ?? ''}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, methods: { ...p.methods, transferencia: { ...p.methods.transferencia, iban: e.target.value } } }))
                  }
                  className="rounded-none mt-1"
                />
              </div>
              <div>
                <Label className="font-body text-xs">Titular</Label>
                <Input
                  value={form.methods?.transferencia?.holder ?? ''}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, methods: { ...p.methods, transferencia: { ...p.methods.transferencia, holder: e.target.value } } }))
                  }
                  className="rounded-none mt-1"
                />
              </div>
              <div>
                <Label className="font-body text-xs">Banco</Label>
                <Input
                  value={form.methods?.transferencia?.bank ?? ''}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, methods: { ...p.methods, transferencia: { ...p.methods.transferencia, bank: e.target.value } } }))
                  }
                  className="rounded-none mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="font-body text-xs">Instruções</Label>
              <Textarea
                value={form.methods?.transferencia?.instructions ?? ''}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    methods: { ...p.methods, transferencia: { ...p.methods.transferencia, instructions: e.target.value } },
                  }))
                }
                className="rounded-none mt-1 min-h-[120px]"
              />
            </div>
          </MethodCard>

          <MethodCard
            title="Multibanco"
            enabled={form.methods?.multibanco?.enabled}
            onEnabledChange={(v) =>
              setForm((p) => ({ ...p, methods: { ...p.methods, multibanco: { ...p.methods.multibanco, enabled: v } } }))
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="font-body text-xs">Entidade</Label>
                <Input
                  value={form.methods?.multibanco?.entity ?? ''}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, methods: { ...p.methods, multibanco: { ...p.methods.multibanco, entity: e.target.value } } }))
                  }
                  className="rounded-none mt-1"
                />
              </div>
              <div>
                <Label className="font-body text-xs">Referência</Label>
                <Input
                  value={form.methods?.multibanco?.reference ?? ''}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      methods: { ...p.methods, multibanco: { ...p.methods.multibanco, reference: e.target.value } },
                    }))
                  }
                  className="rounded-none mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="font-body text-xs">Instruções</Label>
              <Textarea
                value={form.methods?.multibanco?.instructions ?? ''}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    methods: { ...p.methods, multibanco: { ...p.methods.multibanco, instructions: e.target.value } },
                  }))
                }
                className="rounded-none mt-1 min-h-[120px]"
              />
            </div>
          </MethodCard>

          <MethodCard
            title="PayPal"
            enabled={form.methods?.paypal?.enabled}
            onEnabledChange={(v) => setForm((p) => ({ ...p, methods: { ...p.methods, paypal: { ...p.methods.paypal, enabled: v } } }))}
          >
            <div>
              <Label className="font-body text-xs">Email PayPal</Label>
              <Input
                value={form.methods?.paypal?.email ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, methods: { ...p.methods, paypal: { ...p.methods.paypal, email: e.target.value } } }))}
                className="rounded-none mt-1"
              />
            </div>
            <div>
              <Label className="font-body text-xs">Instruções</Label>
              <Textarea
                value={form.methods?.paypal?.instructions ?? ''}
                onChange={(e) =>
                  setForm((p) => ({ ...p, methods: { ...p.methods, paypal: { ...p.methods.paypal, instructions: e.target.value } } }))
                }
                className="rounded-none mt-1 min-h-[120px]"
              />
            </div>
          </MethodCard>
        </div>
      )}
    </div>
  );
}
