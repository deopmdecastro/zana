import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/toast';

const defaultForm = {
  enabled: true,
  days_allowed: 14,
  conditions_text: '',
};

function normalize(content) {
  const v = content && typeof content === 'object' ? content : {};
  return {
    enabled: v.enabled !== false,
    days_allowed: Math.max(0, Math.min(Number(v.days_allowed ?? 14) || 14, 60)),
    conditions_text: String(v.conditions_text ?? '').trim(),
  };
}

export default function ReturnsSettingsAdmin() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-returns-content'],
    queryFn: () => base44.admin.content.returns.get(),
  });

  const initial = useMemo(() => normalize(data?.content ?? null), [data?.content]);
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    setForm({ ...defaultForm, ...initial });
  }, [initial]);

  const saveMutation = useMutation({
    mutationFn: (payload) => base44.admin.content.returns.update(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-returns-content'] });
      await queryClient.invalidateQueries({ queryKey: ['content-returns'] });
      toast.success('Definições guardadas');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível guardar.')),
  });

  const save = () => {
    const days = Math.max(0, Math.min(Number(form.days_allowed ?? 14) || 14, 60));
    const payload = {
      enabled: form.enabled === true,
      days_allowed: days,
      conditions_text: String(form.conditions_text ?? '').trim(),
    };
    saveMutation.mutate(payload);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-heading text-2xl">Devoluções e Reembolsos</h2>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Configure as condições de devolução mostradas ao cliente.
          </p>
        </div>
        <Button className="rounded-none font-body text-sm" onClick={save} disabled={saveMutation.isPending || isLoading}>
          {saveMutation.isPending ? 'A guardar…' : 'Guardar'}
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <Label className="font-body text-xs">Texto / Condições</Label>
          <Textarea
            value={form.conditions_text}
            onChange={(e) => setForm((p) => ({ ...p, conditions_text: e.target.value }))}
            className="rounded-none mt-1 min-h-[180px]"
            placeholder="Escreva as condições de devolução e reembolso..."
          />
          <div className="font-body text-xs text-muted-foreground mt-2">
            Dica: use parágrafos curtos e indique prazos, estado do produto e forma de reembolso.
          </div>
        </div>

        <div className="space-y-4">
          <div className="border border-border rounded-md p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-heading text-sm">Ativar devoluções</div>
                <div className="font-body text-xs text-muted-foreground mt-1">Mostra a opção “Pedir devolução”.</div>
              </div>
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm((p) => ({ ...p, enabled: v }))} />
            </div>
          </div>

          <div className="border border-border rounded-md p-4">
            <Label className="font-body text-xs">Prazo (dias)</Label>
            <Input
              type="number"
              min={0}
              max={60}
              inputMode="numeric"
              value={form.days_allowed}
              onChange={(e) => setForm((p) => ({ ...p, days_allowed: e.target.value }))}
              className="rounded-none mt-1"
            />
            <div className="font-body text-xs text-muted-foreground mt-2">
              Ex.: 14 dias após a entrega para iniciar o pedido.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

