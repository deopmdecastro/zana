import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, Mail, MessageSquareText, Phone, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { pt } from 'date-fns/locale';

import { base44 } from '@/api/base44Client';
import { getErrorMessage } from '@/lib/toast';
import { useAuth } from '@/lib/AuthContext';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as ThemeCalendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function QuickAppointmentDialog({ open, onOpenChange, service }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const serviceId = service?.id ? String(service.id) : '';
  const durationMinutes = Math.max(1, Number(service?.duration_minutes ?? 30) || 30);

  const [form, setForm] = useState({
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
    if (!open) return;
    setVisibleMonth(selectedDateObj ?? minDate);
  }, [minDate, open, selectedDateObj, serviceId]);

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
    queryKey: ['appointments-dates', serviceId || 'none', visibleYM || 'none', 'quick'],
    queryFn: () => base44.appointments.datesAvailable(serviceId, visibleYM),
    enabled: open && !!serviceId && !!visibleYM,
    staleTime: 30_000,
    retry: false,
  });

  const availableDatesSet = useMemo(() => new Set(Array.isArray(datesRes?.dates) ? datesRes.dates : []), [datesRes?.dates]);

  const { data: timesRes, isLoading: isLoadingTimes } = useQuery({
    queryKey: ['appointments-times', serviceId || 'none', form.date || 'none', 'quick'],
    queryFn: () => base44.appointments.timesAvailable(serviceId, form.date),
    enabled: open && !!serviceId && !!form.date,
    staleTime: 30_000,
    retry: false,
  });

  const times = Array.isArray(timesRes?.times) ? timesRes.times : [];

  const { data: staffRes, isLoading: isLoadingStaff } = useQuery({
    queryKey: ['appointments-staff', serviceId || 'all', startAtInput || 'none', 'quick'],
    queryFn: () =>
      startAtInput ? base44.appointments.staffAvailable(serviceId, startAtInput) : base44.appointments.staff(serviceId || null),
    enabled: open && !!serviceId,
    staleTime: 30_000,
    retry: false,
  });

  const staff = staffRes?.staff ?? [];

  useEffect(() => {
    if (!open) return;
    setForm((p) => {
      const current = String(p.staff_id ?? '');
      const exists = current && staff.some((s) => String(s.id) === current);
      if (exists) return p;
      return { ...p, staff_id: staff[0]?.id ? String(staff[0].id) : '' };
    });
  }, [open, staff]);

  useEffect(() => {
    if (!open) return;
    setForm((p) => ({
      ...p,
      staff_id: '',
      date: '',
      time: '',
      observations: '',
      guest_name: '',
      guest_email: '',
      guest_phone: '',
    }));
  }, [open, serviceId]);

  const guestReady =
    Boolean(user) ||
    (String(form.guest_name ?? '').trim().length > 0 && String(form.guest_email ?? '').trim().length > 0);

  const canSubmit = useMemo(() => {
    if (!guestReady) return false;
    if (!serviceId) return false;
    if (!form.staff_id) return false;
    if (!form.date || !form.time) return false;
    return true;
  }, [form.date, form.staff_id, form.time, guestReady, serviceId]);

  const createMutation = useMutation({
    mutationFn: (payload) => base44.appointments.create(payload),
    onSuccess: async () => {
      if (user) {
        await queryClient.invalidateQueries({ queryKey: ['appointments-my'] });
        await queryClient.invalidateQueries({ queryKey: ['my-notifications-bell'] });
        navigate('/conta/marcacoes');
      }
      toast.success('Marcação enviada.');
      onOpenChange(false);
      setForm({
        staff_id: '',
        date: '',
        time: '',
        observations: '',
        guest_name: '',
        guest_email: '',
        guest_phone: '',
      });
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível criar a marcação.')),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg lg:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Agendar</DialogTitle>
          <DialogDescription className="font-body text-sm">
            {service?.name ? (
              <>
                Serviço: <span className="font-medium text-foreground">{service.name}</span>
              </>
            ) : (
              'Selecione um serviço.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!user ? (
            <div className="rounded-md border border-border bg-secondary/15 p-3 space-y-3">
              <p className="font-body text-xs text-muted-foreground">
                Marque sem conta — precisamos do nome e email para confirmar.{' '}
                <Link to="/conta" className="text-foreground underline underline-offset-4">
                  Entrar
                </Link>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <Label className="font-body text-xs flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" /> Data
                </Label>
                <div className="mt-2 rounded-md border border-border bg-card p-2 min-w-0 overflow-x-auto overflow-y-hidden">
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
                  disabled={!form.date || isLoadingTimes}
                >
                  <SelectTrigger className="rounded-none mt-1 font-body text-sm">
                    <SelectValue
                      placeholder={
                        !form.date
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
                disabled={isLoadingStaff || !form.date || !form.time}
              >
                <SelectTrigger className="rounded-none mt-1 font-body text-sm">
                  <SelectValue
                    placeholder={
                      !form.date || !form.time
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
                {form.date && form.time
                  ? `Disponíveis para ${new Date(startAtInput).toLocaleString('pt-PT')} (${durationMinutes} min).`
                  : 'Selecione a data e hora para ver apenas os atendentes disponíveis.'}
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
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-none font-body text-sm"
            disabled={createMutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            className="rounded-none font-body text-sm tracking-wider"
            disabled={!canSubmit || createMutation.isPending}
            onClick={() => {
              const start_at = `${form.date}T${form.time}:00`;
              const base = {
                service_id: serviceId,
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
