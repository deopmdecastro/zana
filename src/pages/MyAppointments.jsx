import React, { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';
import Auth from './Auth';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';

export default function MyAppointments() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: settingsRes } = useQuery({
    queryKey: ['appointments-settings'],
    queryFn: () => base44.appointments.settings(),
    staleTime: 30_000,
  });

  const enabled = Boolean(settingsRes?.content?.enabled);

  const { data: myRes, isLoading } = useQuery({
    queryKey: ['appointments-my'],
    queryFn: () => base44.appointments.my(),
    enabled: enabled && !!user,
    retry: false,
  });

  const appointments = myRes?.appointments ?? [];

  const upcoming = useMemo(() => {
    const now = Date.now();
    return appointments
      .filter((a) => (a?.status === 'pending' || a?.status === 'confirmed') && new Date(a.start_at).getTime() >= now - 60_000)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [appointments]);

  const past = useMemo(() => {
    const now = Date.now();
    return appointments
      .filter((a) => new Date(a.start_at).getTime() < now - 60_000 || (a?.status !== 'pending' && a?.status !== 'confirmed'))
      .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());
  }, [appointments]);

  const cancelMutation = useMutation({
    mutationFn: (id) => base44.appointments.cancel(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appointments-my'] });
      await queryClient.invalidateQueries({ queryKey: ['my-notifications-bell'] });
      toast.success('Marcação cancelada.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível cancelar.')),
  });

  const remindMutation = useMutation({
    mutationFn: (id) => base44.appointments.remind(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appointments-my'] });
      await queryClient.invalidateQueries({ queryKey: ['my-notifications-bell'] });
      toast.success('Lembrete enviado.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'NÃ£o foi possÃ­vel enviar o lembrete.')),
  });

  if (!user) return <Auth />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <CalendarClock className="w-6 h-6 text-primary" />
          <h1 className="font-heading text-3xl">As minhas marcações</h1>
        </div>
        <Link to="/marcacoes">
          <Button className="rounded-none font-body text-sm tracking-wider">Nova marcação</Button>
        </Link>
      </div>

      {!enabled ? (
        <div className="bg-card p-6 rounded-lg border border-border">
          <p className="font-body text-sm text-muted-foreground">De momento, as marcações não estão disponíveis.</p>
        </div>
      ) : isLoading ? (
        <div className="bg-card p-8 rounded-lg border border-border text-center">
          <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="font-body text-sm text-muted-foreground">A carregar...</p>
        </div>
      ) : appointments.length === 0 ? (
        <div className="bg-card p-8 rounded-lg border border-border text-center">
          <p className="font-body text-sm text-muted-foreground">Ainda não tem marcações.</p>
          <Link to="/marcacoes">
            <Button className="rounded-none font-body text-sm mt-4">Agendar agora</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card p-6 rounded-lg border border-border">
            <h2 className="font-heading text-xl mb-4">Próximas</h2>
            {upcoming.length === 0 ? (
              <p className="font-body text-sm text-muted-foreground">Sem marcações futuras.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.slice(0, 20).map((a) => (
                  <div key={a.id} className="p-4 rounded-md border border-border bg-secondary/20">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-body text-sm font-medium">{a.service?.name ?? 'Serviço'}</div>
                        <div className="font-body text-xs text-muted-foreground">
                          {new Date(a.start_at).toLocaleString('pt-PT')} • {a.duration_minutes} min • {a.staff?.name ?? '-'}
                        </div>
                        {a.observations ? (
                          <div className="font-body text-xs text-muted-foreground mt-1">{a.observations}</div>
                        ) : null}
                      </div>
                      {(a.status === 'pending' || a.status === 'confirmed') ? (
                        <div className="flex items-center gap-2">
                          {!a.reminder_sent_at ? (
                            <Button
                              variant="outline"
                              className="rounded-none h-9 font-body text-xs"
                              disabled={remindMutation.isPending || cancelMutation.isPending}
                              onClick={() => remindMutation.mutate(a.id)}
                            >
                              Lembrete
                            </Button>
                          ) : null}
                          <Button
                            variant="outline"
                            className="rounded-none h-9 font-body text-xs"
                            disabled={cancelMutation.isPending || remindMutation.isPending}
                            onClick={() => cancelMutation.mutate(a.id)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    <Separator className="my-3" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card p-6 rounded-lg border border-border">
            <h2 className="font-heading text-xl mb-4">Histórico</h2>
            {past.length === 0 ? (
              <p className="font-body text-sm text-muted-foreground">Sem histórico.</p>
            ) : (
              <div className="space-y-3">
                {past.slice(0, 20).map((a) => (
                  <div key={a.id} className="p-4 rounded-md border border-border bg-secondary/10">
                    <div className="font-body text-sm font-medium">{a.service?.name ?? 'Serviço'}</div>
                    <div className="font-body text-xs text-muted-foreground">
                      {new Date(a.start_at).toLocaleString('pt-PT')} • {a.duration_minutes} min • {a.staff?.name ?? '-'} • {a.status}
                    </div>
                    {a.observations ? (
                      <div className="font-body text-xs text-muted-foreground mt-1">{a.observations}</div>
                    ) : null}
                    <Separator className="my-3" />
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
