import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, MessageSquareText, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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

  const toYMD = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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
    setForm((p) => ({ ...p, staff_id: '', date: '', time: '', observations: '' }));
  }, [open, serviceId]);

  const canSubmit = useMemo(() => {
    if (!user) return false;
    if (!serviceId) return false;
    if (!form.staff_id) return false;
    if (!form.date || !form.time) return false;
    return true;
  }, [form.date, form.staff_id, form.time, serviceId, user]);

  const createMutation = useMutation({
    mutationFn: (payload) => base44.appointments.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appointments-my'] });
      toast.success('Marcação enviada.');
      onOpenChange(false);
      setForm({ staff_id: '', date: '', time: '', observations: '' });
      navigate('/conta/marcacoes');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível criar a marcação.')),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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

        {!user ? (
          <div className="space-y-3">
            <p className="font-body text-sm text-muted-foreground">Faça login para escolher data e hora e concluir a marcação.</p>
            <Button asChild className="w-full rounded-none font-body text-sm">
              <Link to="/conta">Entrar</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="font-body text-xs flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" /> Data
                </Label>
                <div className="mt-2 rounded-md border border-border bg-card">
                  <ThemeCalendar
                    mode="single"
                    selected={selectedDateObj ?? undefined}
                    onSelect={(d) => {
                      const next = d ? toYMD(d) : '';
                      setForm((p) => ({ ...p, date: next, staff_id: '' }));
                    }}
                    disabled={(d) => d < minDate}
                  />
                </div>
              </div>
              <div>
                <Label className="font-body text-xs flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Hora
                </Label>
                <Input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm((p) => ({ ...p, time: e.target.value, staff_id: '' }))}
                  className="rounded-none mt-1"
                />
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
        )}

        {user ? (
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
                createMutation.mutate({
                  service_id: serviceId,
                  staff_id: form.staff_id,
                  start_at,
                  observations: form.observations?.trim() || null,
                });
              }}
            >
              {createMutation.isPending ? 'A enviar...' : 'Confirmar marcação'}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
