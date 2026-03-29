import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, Clock, Mail, MessageSquareText, Phone, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { pt } from 'date-fns/locale';

import { base44 } from '@/api/base44Client';
import { appointmentStatusBadgeClassName, getAppointmentStatusLabel } from '@/lib/appointmentStatus';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/toast';
import { useAuth } from '@/lib/AuthContext';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as ThemeCalendar } from '@/components/ui/calendar';

export default function Appointments() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const location = useLocation();

  const { data: settingsRes } = useQuery({
    queryKey: ['appointments-settings'],
    queryFn: () => base44.appointments.settings(),
    staleTime: 30_000,
  });

  const enabled = Boolean(settingsRes?.content?.enabled);

  const { data: servicesRes } = useQuery({
    queryKey: ['appointments-services'],
    queryFn: () => base44.appointments.services(),
    enabled,
  });

  const { data: myRes } = useQuery({
    queryKey: ['appointments-my'],
    queryFn: () => base44.appointments.my(),
    enabled: enabled && !!user,
  });

  const services = servicesRes?.services ?? [];
  const appointments = myRes?.appointments ?? [];

  const [form, setForm] = useState({
    service_id: '',
    staff_id: '',
    date: '',
    time: '',
    observations: '',
    guest_name: '',
    guest_email: '',
    guest_phone: '',
  });

  const startAtInput = useMemo(() => {
    if (!form.date || !form.time) return '';
    return `${form.date}T${form.time}:00`;
  }, [form.date, form.time]);

  const selectedDateObj = useMemo(() => {
    if (!form.date) return null;
    const d = new Date(`${form.date}T00:00:00`);
    return Number.isFinite(d.getTime()) ? d : null;
  }, [form.date]);

  const minDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const [visibleMonth, setVisibleMonth] = useState(minDate);
  useEffect(() => {
    setVisibleMonth(selectedDateObj ?? minDate);
  }, [minDate, selectedDateObj]);

  const toYMD = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const toYM = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const visibleYM = useMemo(() => toYM(visibleMonth), [visibleMonth]);

  const { data: datesRes, isSuccess: isDatesLoaded } = useQuery({
    queryKey: ['appointments-dates', form.service_id || 'none', visibleYM || 'none'],
    queryFn: () => base44.appointments.datesAvailable(form.service_id, visibleYM),
    enabled: enabled && !!form.service_id && !!visibleYM,
    staleTime: 30_000,
    retry: false,
  });

  const availableDatesSet = useMemo(() => new Set(Array.isArray(datesRes?.dates) ? datesRes.dates : []), [datesRes?.dates]);

  useEffect(() => {
    const pre = location?.state?.preselectService;
    if (!pre) return;
    setForm((p) => (p.service_id ? p : { ...p, service_id: String(pre), staff_id: '' }));
  }, [location?.state?.preselectService]);

  const selectedService = useMemo(() => services.find((s) => String(s.id) === String(form.service_id)) ?? null, [services, form.service_id]);
  const durationMinutes = Math.max(1, Number(selectedService?.duration_minutes ?? 30) || 30);

  const { data: timesRes, isLoading: isLoadingTimes } = useQuery({
    queryKey: ['appointments-times', form.service_id || 'none', form.date || 'none'],
    queryFn: () => base44.appointments.timesAvailable(form.service_id, form.date),
    enabled: enabled && !!form.service_id && !!form.date,
    staleTime: 30_000,
    retry: false,
  });

  const times = Array.isArray(timesRes?.times) ? timesRes.times : [];

  const { data: staffRes, isLoading: isLoadingStaff } = useQuery({
    queryKey: ['appointments-staff', form.service_id || 'none', startAtInput || 'none'],
    queryFn: () =>
      startAtInput
        ? base44.appointments.staffAvailable(form.service_id, startAtInput)
        : base44.appointments.staff(form.service_id || null),
    enabled: enabled && !!form.service_id,
    staleTime: 30_000,
    retry: false,
  });

  const staff = staffRes?.staff ?? [];

  const createMutation = useMutation({
    mutationFn: (payload) => base44.appointments.create(payload),
    onSuccess: async () => {
      if (user) {
        await queryClient.invalidateQueries({ queryKey: ['appointments-my'] });
        await queryClient.invalidateQueries({ queryKey: ['my-notifications-bell'] });
      }
      toast.success('Marcação enviada.');
      setForm((p) => ({
        ...p,
        observations: '',
        ...(user ? {} : { guest_name: '', guest_email: '', guest_phone: '' }),
      }));
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível criar a marcação.')),
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => base44.appointments.cancel(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appointments-my'] });
      await queryClient.invalidateQueries({ queryKey: ['my-notifications-bell'] });
      toast.success('Marcação cancelada.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível cancelar.')),
  });

  const guestReady =
    Boolean(user) ||
    (String(form.guest_name ?? '').trim().length > 0 && String(form.guest_email ?? '').trim().length > 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-primary" />
          <h1 className="font-heading text-3xl">Marcações</h1>
        </div>
        {user ? (
          <Link to="/conta/marcacoes">
            <Button variant="outline" className="rounded-none font-body text-sm">
              Ver as minhas marcações
            </Button>
          </Link>
        ) : (
          <p className="font-body text-sm text-muted-foreground">
            Já tem conta?{' '}
            <Link to="/conta" className="text-foreground underline underline-offset-4">
              Entrar
            </Link>
          </p>
        )}
      </div>

      {!enabled ? (
        <div className="bg-card p-6 rounded-lg border border-border">
          <p className="font-body text-sm text-muted-foreground">De momento, as marcações não estão disponíveis.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card p-6 rounded-lg border border-border">
            <h2 className="font-heading text-xl mb-4">Nova marcação</h2>

            <div className="space-y-4">
              {!user ? (
                <div className="rounded-md border border-border bg-secondary/15 p-4 space-y-3">
                  <p className="font-body text-sm text-muted-foreground">
                    Pode marcar sem criar conta. Indique os seus dados para confirmarmos a marcação por email.
                  </p>
                  <div>
                    <Label className="font-body text-xs flex items-center gap-2">
                      <UserRound className="w-3.5 h-3.5" /> Nome
                    </Label>
                    <Input
                      value={form.guest_name}
                      onChange={(e) => setForm((p) => ({ ...p, guest_name: e.target.value }))}
                      className="rounded-none mt-1 font-body text-sm"
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <Label className="font-body text-xs flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" /> Email
                    </Label>
                    <Input
                      type="email"
                      value={form.guest_email}
                      onChange={(e) => setForm((p) => ({ ...p, guest_email: e.target.value }))}
                      className="rounded-none mt-1 font-body text-sm"
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <Label className="font-body text-xs flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5" /> Telefone (opcional)
                    </Label>
                    <Input
                      type="tel"
                      value={form.guest_phone}
                      onChange={(e) => setForm((p) => ({ ...p, guest_phone: e.target.value }))}
                      className="rounded-none mt-1 font-body text-sm"
                      autoComplete="tel"
                    />
                  </div>
                </div>
              ) : null}

              <div>
                <Label className="font-body text-xs flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" /> Serviço
                </Label>
                <Select
                  value={form.service_id}
                  onValueChange={(v) => setForm((p) => ({ ...p, service_id: v, staff_id: '' }))}
                >
                  <SelectTrigger className="rounded-none mt-1 font-body text-sm">
                    <SelectValue placeholder={services.length ? 'Selecione...' : 'Sem serviços disponíveis'} />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name} ({s.duration_minutes ?? 30} min)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label className="font-body text-xs flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" /> Data
                  </Label>
                  <div className="mt-2 rounded-md border border-border bg-card p-2 min-w-0 overflow-hidden">
                    <ThemeCalendar
                      className="w-full p-0"
                      mode="single"
                      selected={selectedDateObj ?? undefined}
                      onSelect={(d) => {
                        const next = d ? toYMD(d) : '';
                        setForm((p) => ({ ...p, date: next, time: '', staff_id: '' }));
                      }}
                      month={visibleMonth}
                      onMonthChange={setVisibleMonth}
                      disabled={(d) =>
                        d < minDate ||
                        (isDatesLoaded && toYM(d) === visibleYM && !availableDatesSet.has(toYMD(d)))
                      }
                      locale={pt}
                      weekStartsOn={1}
                      modifiers={{
                        available: (d) => isDatesLoaded && toYM(d) === visibleYM && availableDatesSet.has(toYMD(d)),
                      }}
                      modifiersClassNames={{
                        available:
                          "bg-primary/10 ring-1 ring-primary/25 hover:bg-primary/15 after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <Label className="font-body text-xs flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" /> Hora
                  </Label>
                  <Select
                    value={form.time}
                    onValueChange={(v) => setForm((p) => ({ ...p, time: v, staff_id: '' }))}
                    disabled={!form.service_id || !form.date || isLoadingTimes}
                  >
                    <SelectTrigger className="rounded-none mt-1 font-body text-sm">
                      <SelectValue
                        placeholder={
                          !form.service_id
                            ? 'Escolha um serviço...'
                            : !form.date
                              ? 'Escolha uma data...'
                              : isLoadingTimes
                                ? 'A carregar...'
                                : times.length
                                  ? 'Selecione...'
                                  : 'Sem horários disponíveis'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {times.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="font-body text-xs flex items-center gap-2">
                  <UserRound className="w-3.5 h-3.5" /> Atendente
                </Label>
                <Select
                  value={form.staff_id}
                  onValueChange={(v) => setForm((p) => ({ ...p, staff_id: v }))}
                  disabled={isLoadingStaff || !form.service_id || !form.date || !form.time}
                >
                  <SelectTrigger className="rounded-none mt-1 font-body text-sm">
                    <SelectValue
                      placeholder={
                        !form.service_id
                          ? 'Escolha um serviço...'
                          : !form.date || !form.time
                            ? 'Escolha data e hora...'
                            : isLoadingStaff
                              ? 'A carregar...'
                              : staff.length
                                ? 'Selecione...'
                                : 'Sem atendentes disponíveis'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="font-body text-xs text-muted-foreground mt-2">
                  {form.service_id && form.date && form.time
                    ? `Disponíveis para ${new Date(startAtInput).toLocaleString('pt-PT')} (${durationMinutes} min).`
                    : 'Selecione serviço, data e hora para ver apenas os atendentes disponíveis.'}
                </p>
              </div>

              <div>
                <Label className="font-body text-xs flex items-center gap-2">
                  <MessageSquareText className="w-3.5 h-3.5" /> Observação (opcional)
                </Label>
                <Textarea
                  value={form.observations}
                  onChange={(e) => setForm((p) => ({ ...p, observations: e.target.value }))}
                  className="rounded-none mt-1 min-h-[90px]"
                />
              </div>

              <Button
                className="w-full rounded-none font-body text-sm tracking-wider"
                disabled={
                  createMutation.isPending ||
                  !guestReady ||
                  !form.service_id ||
                  !form.staff_id ||
                  !form.date ||
                  !form.time
                }
                onClick={() => {
                  const start_at = `${form.date}T${form.time}:00`;
                  const base = {
                    service_id: form.service_id,
                    staff_id: form.staff_id,
                    start_at,
                    observations: form.observations?.trim() || null,
                  };
                  if (!user) {
                    createMutation.mutate({
                      ...base,
                      guest_name: String(form.guest_name ?? '').trim(),
                      guest_email: String(form.guest_email ?? '').trim(),
                      guest_phone: String(form.guest_phone ?? '').trim() || null,
                    });
                  } else {
                    createMutation.mutate(base);
                  }
                }}
              >
                {createMutation.isPending ? 'A enviar...' : 'Confirmar marcação'}
              </Button>

              {selectedService ? (
                <p className="font-body text-xs text-muted-foreground flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Duração: {selectedService.duration_minutes} min
                </p>
              ) : null}
            </div>
          </div>

          <div className="bg-card p-6 rounded-lg border border-border">
            <h2 className="font-heading text-xl mb-4">Últimas marcações</h2>

            {!user ? (
              <p className="font-body text-sm text-muted-foreground">
                Inicie sessão para ver aqui o histórico das suas marcações.{' '}
                <Link to="/conta" className="text-foreground underline underline-offset-4">
                  Entrar
                </Link>
              </p>
            ) : appointments.length === 0 ? (
              <p className="font-body text-sm text-muted-foreground">Ainda não tem marcações.</p>
            ) : (
              <div className="space-y-3">
                {appointments.slice(0, 20).map((a) => (
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
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <Badge
                          className={cn(
                            'rounded-none font-body text-xs font-semibold',
                            appointmentStatusBadgeClassName[a.status] ??
                              'border-transparent bg-muted text-muted-foreground shadow-none',
                          )}
                        >
                          {getAppointmentStatusLabel(a.status)}
                        </Badge>
                        {(a.status === 'pending' || a.status === 'confirmed') ? (
                          <Button
                            variant="outline"
                            className="rounded-none h-9 font-body text-xs"
                            disabled={cancelMutation.isPending}
                            onClick={() => cancelMutation.mutate(a.id)}
                          >
                            Cancelar
                          </Button>
                        ) : null}
                      </div>
                    </div>
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
