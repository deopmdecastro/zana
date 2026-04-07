import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Check, CheckCheck, Eye } from 'lucide-react';
import { toast } from 'sonner';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import EmptyState from '@/components/ui/empty-state';
import LoadMoreControls from '@/components/ui/load-more-controls';
import { appointmentStatusBadgeClassName, getAppointmentStatusLabel } from '@/lib/appointmentStatus';
import { cn } from '@/lib/utils';

function formatPtDateTime(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('pt-PT');
  } catch {
    return '-';
  }
}

export default function SellerAppointments() {
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(200);
  const [selected, setSelected] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);

  const { data: settingsRes } = useQuery({
    queryKey: ['appointments-settings-public'],
    queryFn: () => base44.appointments.settings(),
    staleTime: 60_000,
  });

  const enabled = Boolean(settingsRes?.content?.enabled);
  const from = useMemo(() => {
    const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  }, []);
  const to = useMemo(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), []);

  const { data: apptRes, isLoading, isError, refetch } = useQuery({
    enabled,
    queryKey: ['seller-appointments', from, to, limit],
    queryFn: () => base44.staff.appointments.list({ from, to, status: 'all', limit }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const appointments = useMemo(() => {
    const list = apptRes?.appointments ?? [];
    return Array.isArray(list) ? list : [];
  }, [apptRes]);

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => base44.staff.appointments.update(id, { status }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['seller-appointments'] });
      const updated = res?.appointment ?? null;
      if (updated?.id && selected?.id === updated.id) setSelected(updated);
      toast.success('Marcação atualizada');
    },
    onError: (err) => {
      console.error(err);
      toast.error('Não foi possível atualizar a marcação');
    },
  });

  const canLoadMore = enabled && !isLoading && appointments.length === limit && limit < 5000;

  const openView = (a) => {
    setSelected(a ?? null);
    setViewOpen(true);
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-heading text-3xl">Marcações</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            {enabled ? 'Lista de marcações (últimos 7 dias e próximos 30 dias).' : 'O serviço de marcações não está ativo.'}
          </p>
        </div>
        {enabled ? (
          <Button variant="outline" className="rounded-none font-body text-sm" onClick={() => refetch()} disabled={isLoading}>
            Atualizar
          </Button>
        ) : null}
      </div>

      {!enabled ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <EmptyState
            icon={CalendarClock}
            description="O admin ainda não ativou o serviço de marcações."
            className="py-10"
          />
        </div>
      ) : isError ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <EmptyState icon={CalendarClock} description="Não foi possível carregar as marcações." className="py-10" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="bg-secondary/30">
              <tr>
                <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Data/hora</th>
                <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Serviço</th>
                <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Atendente</th>
                <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Cliente</th>
                <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Estado</th>
                <th className="text-right p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id} className="border-t border-border hover:bg-secondary/10">
                  <td className="p-3 font-body text-sm whitespace-nowrap">
                    {formatPtDateTime(a?.start_at)}
                  </td>
                  <td className="p-3 font-body text-sm">{a?.service?.name ?? '-'}</td>
                  <td className="p-3 font-body text-sm text-muted-foreground">{a?.staff?.name ?? '-'}</td>
                  <td className="p-3 font-body text-sm">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{a?.customer_name ?? a?.guest_name ?? '-'}</div>
                      {a?.customer_email ? (
                        <div className="text-xs text-muted-foreground truncate">{a.customer_email}</div>
                      ) : null}
                    </div>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <Badge
                      className={cn(
                        'rounded-none font-body text-xs font-semibold',
                        appointmentStatusBadgeClassName[a?.status] ?? 'border-transparent bg-muted text-muted-foreground shadow-none',
                      )}
                    >
                      {getAppointmentStatusLabel(a?.status)}
                    </Badge>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 rounded-none"
                        onClick={() => openView(a)}
                        title="Visualizar"
                        aria-label="Visualizar"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {String(a?.status ?? '') === 'pending' ? (
                        <Button
                          size="icon"
                          className="h-9 w-9 rounded-none"
                          onClick={() => updateMutation.mutate({ id: a.id, status: 'confirmed' })}
                          disabled={updateMutation.isPending}
                          title="Confirmar"
                          aria-label="Confirmar"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      ) : null}
                      {String(a?.status ?? '') === 'confirmed' ? (
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 rounded-none"
                          onClick={() => updateMutation.mutate({ id: a.id, status: 'completed' })}
                          disabled={updateMutation.isPending}
                          title="Concluir"
                          aria-label="Concluir"
                        >
                          <CheckCheck className="w-4 h-4" />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {isLoading && appointments.length === 0 ? (
            <EmptyState icon={CalendarClock} description="A carregar..." className="py-8" />
          ) : appointments.length === 0 ? (
            <EmptyState icon={CalendarClock} description="Sem marcações" className="py-8" />
          ) : null}
        </div>
      )}

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Marcação</DialogTitle>
          </DialogHeader>

          {selected ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="font-body text-xs text-muted-foreground">Data/hora</div>
                  <div className="font-body text-sm font-medium">{formatPtDateTime(selected.start_at)}</div>
                </div>
                <div>
                  <div className="font-body text-xs text-muted-foreground">Estado</div>
                  <div className="mt-1">
                    <Badge
                      className={cn(
                        'rounded-none font-body text-xs font-semibold',
                        appointmentStatusBadgeClassName[selected?.status] ??
                          'border-transparent bg-muted text-muted-foreground shadow-none',
                      )}
                    >
                      {getAppointmentStatusLabel(selected?.status)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="font-body text-xs text-muted-foreground">Serviço</div>
                  <div className="font-body text-sm font-medium">{selected?.service?.name ?? '—'}</div>
                </div>
                <div>
                  <div className="font-body text-xs text-muted-foreground">Atendente</div>
                  <div className="font-body text-sm font-medium">{selected?.staff?.name ?? '—'}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="font-body text-xs text-muted-foreground">Cliente</div>
                  <div className="font-body text-sm font-medium">{selected?.customer_name ?? selected?.guest_name ?? '—'}</div>
                  {selected?.customer_email ? (
                    <div className="font-body text-xs text-muted-foreground">{selected.customer_email}</div>
                  ) : null}
                </div>
                {selected?.observations ? (
                  <div className="sm:col-span-2">
                    <div className="font-body text-xs text-muted-foreground">Observações</div>
                    <div className="font-body text-sm text-muted-foreground whitespace-pre-wrap">{selected.observations}</div>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-2">
                {selected?.status === 'pending' ? (
                  <Button
                    className="rounded-none font-body text-sm gap-2"
                    onClick={() => updateMutation.mutate({ id: selected.id, status: 'confirmed' })}
                    disabled={updateMutation.isPending}
                  >
                    <Check className="w-4 h-4" />
                    Aprovar
                  </Button>
                ) : null}
                {selected?.status === 'confirmed' ? (
                  <Button
                    variant="outline"
                    className="rounded-none font-body text-sm gap-2"
                    onClick={() => updateMutation.mutate({ id: selected.id, status: 'completed' })}
                    disabled={updateMutation.isPending}
                  >
                    <CheckCheck className="w-4 h-4" />
                    Concluir
                  </Button>
                ) : null}
                <Button variant="outline" className="rounded-none font-body text-sm" onClick={() => setViewOpen(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState icon={CalendarClock} description="Sem dados da marcação." className="py-6" />
          )}
        </DialogContent>
      </Dialog>

      {enabled ? (
        <LoadMoreControls
          leftText={`A mostrar ${Math.min(limit, appointments.length)} marcações.`}
          onLess={() => setLimit(200)}
          lessDisabled={isLoading || limit <= 200}
          onMore={() => setLimit((p) => Math.min(5000, p + 200))}
          moreDisabled={!canLoadMore}
        />
      ) : null}
    </div>
  );
}
