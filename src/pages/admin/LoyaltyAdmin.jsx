import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';

export default function LoyaltyAdmin() {
  const queryClient = useQueryClient();
  const { data: cfgRes, isLoading: isLoadingCfg } = useQuery({
    queryKey: ['admin-loyalty-config'],
    queryFn: () => base44.admin.content.loyalty.get(),
  });

  const { data: statsRes, isLoading: isLoadingStats } = useQuery({
    queryKey: ['admin-loyalty-stats'],
    queryFn: () => base44.admin.loyalty.stats(),
  });

  const initialForm = useMemo(() => {
    const c = cfgRes?.content ?? {};
    return {
      point_value_eur: String(c.point_value_eur ?? 0.01),
      reward_text_points: String(c.reward_text_points ?? 10),
      reward_image_points: String(c.reward_image_points ?? 10),
      reward_video_points: String(c.reward_video_points ?? 20),
    };
  }, [cfgRes?.content]);

  const [form, setForm] = useState(initialForm);
  useEffect(() => setForm(initialForm), [initialForm]);

  const saveMutation = useMutation({
    mutationFn: (payload) => base44.admin.content.loyalty.update(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-loyalty-config'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-loyalty-stats'] });
      toast.success('Configuração de pontos atualizada');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível guardar a configuração.')),
  });

  const stats = statsRes ?? {};
  const pointValue = Number(stats.point_value_eur ?? form.point_value_eur ?? 0.01) || 0.01;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-primary" />
          <h1 className="font-heading text-3xl">Pontos</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card p-6 rounded-lg border border-border">
          <h2 className="font-heading text-xl mb-2">Configuração</h2>
          <p className="font-body text-sm text-muted-foreground mb-4">
            Define o valor do ponto e as recompensas por avaliação aprovada.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="font-body text-xs">Valor do ponto (€)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                value={form.point_value_eur}
                onChange={(e) => setForm((p) => ({ ...p, point_value_eur: e.target.value }))}
                className="rounded-none mt-1"
              />
              <p className="font-body text-xs text-muted-foreground mt-1">Ex: 0.01 = 1 ponto vale 0,01€</p>
            </div>
          </div>

          <Separator className="my-5" />

          <h3 className="font-heading text-base mb-3">Recompensas (por avaliação aprovada)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="font-body text-xs">Texto</Label>
              <Input
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                value={form.reward_text_points}
                onChange={(e) => setForm((p) => ({ ...p, reward_text_points: e.target.value }))}
                className="rounded-none mt-1"
              />
            </div>
            <div>
              <Label className="font-body text-xs">Imagem</Label>
              <Input
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                value={form.reward_image_points}
                onChange={(e) => setForm((p) => ({ ...p, reward_image_points: e.target.value }))}
                className="rounded-none mt-1"
              />
            </div>
            <div>
              <Label className="font-body text-xs">Vídeo</Label>
              <Input
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                value={form.reward_video_points}
                onChange={(e) => setForm((p) => ({ ...p, reward_video_points: e.target.value }))}
                className="rounded-none mt-1"
              />
            </div>
          </div>

          <Button
            onClick={() =>
              saveMutation.mutate({
                point_value_eur: Number(form.point_value_eur) || 0,
                reward_text_points: Number(form.reward_text_points) || 0,
                reward_image_points: Number(form.reward_image_points) || 0,
                reward_video_points: Number(form.reward_video_points) || 0,
              })
            }
            disabled={saveMutation.isPending}
            className="w-full rounded-none font-body text-sm tracking-wider mt-5"
          >
            {saveMutation.isPending ? 'A guardar...' : 'Guardar'}
          </Button>

          {isLoadingCfg ? <p className="font-body text-xs text-muted-foreground mt-3">A carregar...</p> : null}
        </div>

        <div className="bg-card p-6 rounded-lg border border-border">
          <h2 className="font-heading text-xl mb-2">Estatísticas</h2>
          <p className="font-body text-sm text-muted-foreground mb-4">Totais do sistema de pontos.</p>

          {isLoadingStats ? (
            <p className="font-body text-sm text-muted-foreground">A carregar...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-border rounded-lg p-4 bg-secondary/20">
                <div className="font-body text-xs text-muted-foreground">Pontos gerados</div>
                <div className="font-heading text-2xl">{Number(stats.total_points_generated ?? 0) || 0}</div>
              </div>
              <div className="border border-border rounded-lg p-4 bg-secondary/20">
                <div className="font-body text-xs text-muted-foreground">Pontos usados</div>
                <div className="font-heading text-2xl">{Number(stats.total_points_used ?? 0) || 0}</div>
                <div className="font-body text-xs text-muted-foreground">Desconto: {(Number(stats.total_discount_eur ?? 0) || 0).toFixed(2)} €</div>
              </div>
              <div className="border border-border rounded-lg p-4 bg-secondary/20">
                <div className="font-body text-xs text-muted-foreground">Pessoas com saldo</div>
                <div className="font-heading text-2xl">{Number(stats.users_with_points_balance ?? 0) || 0}</div>
              </div>
              <div className="border border-border rounded-lg p-4 bg-secondary/20">
                <div className="font-body text-xs text-muted-foreground">Pessoas que usaram</div>
                <div className="font-heading text-2xl">{Number(stats.users_who_used_points ?? 0) || 0}</div>
                <div className="font-body text-xs text-muted-foreground">Encomendas: {Number(stats.orders_with_points ?? 0) || 0}</div>
              </div>
              <div className="border border-border rounded-lg p-4 bg-secondary/20 sm:col-span-2">
                <div className="font-body text-xs text-muted-foreground">Valor atual do ponto</div>
                <div className="font-heading text-2xl">1 ponto = {pointValue.toFixed(3)} €</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

