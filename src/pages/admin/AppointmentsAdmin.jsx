import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CalendarClock, Check, CheckCheck, Pencil, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import ImageUpload from '@/components/uploads/ImageUpload';
import { toast } from 'sonner';
import {
  appointmentStatusBadgeClassName,
  appointmentStatusLabels,
  getAppointmentStatusLabel,
} from '@/lib/appointmentStatus';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/toast';
import LoadMoreControls from '@/components/ui/load-more-controls';
import EmptyState from '@/components/ui/empty-state';

const WEEKDAYS = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

export default function AppointmentsAdmin() {
  const queryClient = useQueryClient();

  const { data: settingsRes } = useQuery({
    queryKey: ['admin-appointments-settings'],
    queryFn: () => base44.admin.content.appointments.get(),
  });

  const enabled = Boolean(settingsRes?.content?.enabled);
  const [settingsForm, setSettingsForm] = useState({
    enabled: false,
    weekdays: [1, 2, 3, 4, 5, 6],
    start_time: '09:00',
    end_time: '18:00',
    slot_step_minutes: 15,
  });

  React.useEffect(() => {
    const c = settingsRes?.content;
    if (!c || typeof c !== 'object') return;
    setSettingsForm((p) => ({
      ...p,
      enabled: c.enabled === true,
      weekdays: Array.isArray(c.weekdays) && c.weekdays.length ? c.weekdays : p.weekdays,
      start_time: typeof c.start_time === 'string' ? c.start_time : p.start_time,
      end_time: typeof c.end_time === 'string' ? c.end_time : p.end_time,
      slot_step_minutes: Number(c.slot_step_minutes ?? p.slot_step_minutes) || p.slot_step_minutes,
    }));
  }, [settingsRes?.content]);

  const { data: servicesRes } = useQuery({
    queryKey: ['admin-appointment-services'],
    queryFn: () => base44.admin.appointments.services.list(500),
  });

  const { data: staffRes } = useQuery({
    queryKey: ['admin-appointment-staff'],
    queryFn: () => base44.admin.appointments.staff.list(500),
  });

  const [apptLimit, setApptLimit] = useState(5);
  const { data: apptRes, isLoading: isLoadingAppointments } = useQuery({
    queryKey: ['admin-appointments', apptLimit],
    queryFn: () => base44.admin.appointments.list({ limit: apptLimit }),
  });

  const services = servicesRes?.services ?? [];
  const staff = staffRes?.staff ?? [];
  const appointments = apptRes?.appointments ?? [];
  const [selectedServiceId, setSelectedServiceId] = useState('');

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

  const [selectedServiceImageUrl, setSelectedServiceImageUrl] = useState('');
  React.useEffect(() => {
    setSelectedServiceImageUrl(selectedService?.image_url ?? '');
  }, [selectedService?.id]);

  const { data: serviceStaffRes } = useQuery({
    enabled: !!selectedServiceId,
    queryKey: ['admin-appointment-service-staff', selectedServiceId],
    queryFn: () => base44.admin.appointments.services.staff.get(selectedServiceId),
  });

  const [serviceStaffIds, setServiceStaffIds] = useState([]);
  React.useEffect(() => {
    if (!selectedServiceId) return;
    setServiceStaffIds(Array.isArray(serviceStaffRes?.staff_ids) ? serviceStaffRes.staff_ids : []);
  }, [selectedServiceId, serviceStaffRes?.staff_ids]);

  const settingsMutation = useMutation({
    mutationFn: (payload) => base44.admin.content.appointments.update(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-appointments-settings'] });
      toast.success('Definições guardadas');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível guardar.')),
  });

  const createServiceMutation = useMutation({
    mutationFn: (payload) => base44.admin.appointments.services.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-appointment-services'] });
      toast.success('Serviço criado');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível criar o serviço.')),
  });

  const updateServiceMutation = useMutation({
    mutationFn: ({ id, patch }) => base44.admin.appointments.services.update(id, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-appointment-services'] });
      toast.success('Serviço atualizado');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível atualizar o serviço.')),
  });

  const serviceStaffMutation = useMutation({
    mutationFn: ({ id, staff_ids }) => base44.admin.appointments.services.staff.set(id, staff_ids),
    onSuccess: async (_, vars) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-appointment-service-staff', vars.id] });
      toast.success('Atendentes atualizados');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível atualizar atendentes.')),
  });

  const createStaffMutation = useMutation({
    mutationFn: (payload) => base44.admin.appointments.staff.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-appointment-staff'] });
      toast.success('Atendente criado');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível criar.')),
  });

  const updateStaffMutation = useMutation({
    mutationFn: ({ id, patch }) => base44.admin.appointments.staff.update(id, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-appointment-staff'] });
      toast.success('Atendente atualizado');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível atualizar.')),
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: ({ id, patch }) => base44.admin.appointments.update(id, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-appointments'] });
      toast.success('Marcação atualizada');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível atualizar a marcação.')),
  });

  const [serviceForm, setServiceForm] = useState({
    name: '',
    image_url: '',
    duration_minutes: '30',
    price: '',
    is_active: true,
  });

  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    phone: '',
    is_active: true,
    availability_days: [1, 2, 3, 4, 5],
    availability_start_time: '09:00',
    availability_end_time: '18:00',
  });

  const staffAvailabilityText = useMemo(() => {
    const start = String(staffForm.availability_start_time ?? '').trim();
    const end = String(staffForm.availability_end_time ?? '').trim();
    const days = Array.isArray(staffForm.availability_days) ? staffForm.availability_days : [];
    const labels = WEEKDAYS.filter((d) => days.includes(d.value)).map((d) => d.label);
    if (!labels.length || !start || !end) return '';
    return `${labels.join(', ')} • ${start}–${end}`;
  }, [staffForm.availability_days, staffForm.availability_end_time, staffForm.availability_start_time]);

  const formatStaffAvailability = (availability) => {
    if (!availability || typeof availability !== 'object') return '-';
    const days = Array.isArray(availability.days) ? availability.days : [];
    const start = typeof availability.start_time === 'string' ? availability.start_time : '';
    const end = typeof availability.end_time === 'string' ? availability.end_time : '';
    const labels = WEEKDAYS.filter((d) => days.includes(d.value)).map((d) => d.label);
    if (!labels.length || !start || !end) return '-';
    return `${labels.join(', ')} • ${start}–${end}`;
  };

  const upcoming = useMemo(() => {
    return appointments.slice().sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [appointments]);

  const canLoadMoreAppointments =
    !isLoadingAppointments && Array.isArray(appointments) && appointments.length === apptLimit && apptLimit < 500;

  const toLocalDateTimeInput = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  const formatPtDateTime = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return '-';
    return d.toLocaleString('pt-PT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({
    start_at: '',
    service_id: '',
    staff_id: '',
    status: 'pending',
    duration_minutes: '',
    observations: '',
    image_url: '',
  });

  const openEdit = (a) => {
    if (!a) return;
    setEditing(a);
    setEditForm({
      start_at: toLocalDateTimeInput(a.start_at),
      service_id: a.service?.id ? String(a.service.id) : '',
      staff_id: a.staff?.id ? String(a.staff.id) : '',
      status: a.status ?? 'pending',
      duration_minutes: a.duration_minutes ? String(a.duration_minutes) : '',
      observations: a.observations ?? '',
      image_url: a.image_url ?? '',
    });
    setEditOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="font-heading text-3xl">Marcações</h1>
      </div>

      <Tabs defaultValue="marcacoes">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="marcacoes">Marcações</TabsTrigger>
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
          <TabsTrigger value="atendentes">Atendentes</TabsTrigger>
          <TabsTrigger value="definicoes">Definições</TabsTrigger>
        </TabsList>

        <TabsContent value="definicoes" className="pt-4 space-y-4">
          <div className="bg-card p-6 rounded-lg border border-border">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="font-heading text-lg">Disponível para clientes</div>
                <div className="font-body text-sm text-muted-foreground">Mostra/oculta a página de marcações no site.</div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={enabled}
                  onCheckedChange={(v) => {
                    setSettingsForm((p) => ({ ...p, enabled: v }));
                    settingsMutation.mutate({ enabled: v });
                  }}
                />
              </div>
            </div>
          </div>

          <div className="bg-card p-6 rounded-lg border border-border">
            <div className="font-heading text-lg mb-1">Disponibilidade do calendário</div>
            <div className="font-body text-sm text-muted-foreground mb-4">
              Estes valores controlam os dias/horários que podem ser marcados e os dias que aparecem destacados no calendário do cliente.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label className="font-body text-xs">Dias disponíveis</Label>
                <div className="mt-2 flex items-center gap-4 flex-wrap">
                  {WEEKDAYS.map((d) => (
                    <label key={d.value} className="inline-flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={settingsForm.weekdays.includes(d.value)}
                        onCheckedChange={(checked) => {
                          setSettingsForm((p) => {
                            const current = Array.isArray(p.weekdays) ? p.weekdays : [];
                            const has = current.includes(d.value);
                            const nextDays = checked
                              ? (has ? current : [...current, d.value])
                              : current.filter((x) => x !== d.value);
                            return { ...p, weekdays: nextDays };
                          });
                        }}
                      />
                      <span className="font-body text-sm">{d.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="font-body text-xs">Passo de horários (min)</Label>
                <Input
                  type="number"
                  min={5}
                  max={120}
                  step={5}
                  inputMode="numeric"
                  value={settingsForm.slot_step_minutes}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, slot_step_minutes: e.target.value }))}
                  className="rounded-none mt-1"
                />
              </div>

              <div>
                <Label className="font-body text-xs">Hora início</Label>
                <Input
                  type="time"
                  value={settingsForm.start_time}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, start_time: e.target.value }))}
                  className="rounded-none mt-1"
                />
              </div>
              <div>
                <Label className="font-body text-xs">Hora fim</Label>
                <Input
                  type="time"
                  value={settingsForm.end_time}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, end_time: e.target.value }))}
                  className="rounded-none mt-1"
                />
              </div>
              <div className="flex items-end">
                <Button
                  className="rounded-none font-body text-sm tracking-wider w-full"
                  disabled={
                    settingsMutation.isPending ||
                    !Array.isArray(settingsForm.weekdays) ||
                    settingsForm.weekdays.length === 0 ||
                    !settingsForm.start_time ||
                    !settingsForm.end_time ||
                    String(settingsForm.end_time) <= String(settingsForm.start_time)
                  }
                  onClick={() => {
                    settingsMutation.mutate({
                      weekdays: settingsForm.weekdays,
                      start_time: settingsForm.start_time,
                      end_time: settingsForm.end_time,
                      slot_step_minutes: Number(settingsForm.slot_step_minutes) || 15,
                    });
                  }}
                >
                  {settingsMutation.isPending ? 'A guardar...' : 'Guardar'}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="servicos" className="pt-4 space-y-4">
          <div className="bg-card p-6 rounded-lg border border-border">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <h2 className="font-heading text-xl">Serviços</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
              <div className="md:col-span-7 space-y-3">
                <div>
                  <Label className="font-body text-xs">Nome</Label>
                  <Input
                    value={serviceForm.name}
                    onChange={(e) => setServiceForm((p) => ({ ...p, name: e.target.value }))}
                    className="rounded-none mt-1"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="font-body text-xs">Duração (min)</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={serviceForm.duration_minutes}
                      onChange={(e) => setServiceForm((p) => ({ ...p, duration_minutes: e.target.value }))}
                      className="rounded-none mt-1"
                    />
                  </div>
                  <div>
                    <Label className="font-body text-xs">Preço (€) (opcional)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={serviceForm.price}
                      onChange={(e) => setServiceForm((p) => ({ ...p, price: e.target.value }))}
                      className="rounded-none mt-1"
                    />
                  </div>
                </div>

                <Button
                  className="rounded-none font-body text-sm tracking-wider w-full sm:w-auto"
                  disabled={createServiceMutation.isPending || !serviceForm.name.trim()}
                  onClick={() => {
                    createServiceMutation.mutate({
                      name: serviceForm.name.trim(),
                      image_url: serviceForm.image_url?.trim() || null,
                      duration_minutes: Number(serviceForm.duration_minutes) || 30,
                      price: serviceForm.price.trim() ? Number(serviceForm.price) : null,
                      is_active: true,
                    });
                    setServiceForm((p) => ({ ...p, name: '', image_url: '', duration_minutes: '30', price: '' }));
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" /> Adicionar serviço
                </Button>
              </div>

              <div className="md:col-span-5">
                <Label className="font-body text-xs">Imagem do serviço</Label>
                <Input
                  value={serviceForm.image_url}
                  onChange={(e) => setServiceForm((p) => ({ ...p, image_url: e.target.value }))}
                  className="rounded-none mt-1"
                  placeholder="Cole a URL da imagem (opcional)"
                />
                <div className="mt-3">
                  <ImageUpload
                    value={serviceForm.image_url}
                    onChange={(v) => setServiceForm((p) => ({ ...p, image_url: v }))}
                    variant="compact"
                    label="Ou faça upload"
                    recommended="1200×675"
                    helper="Esta imagem será mostrada nos cards do site."
                    buttonLabel="Upload"
                  />
                </div>
              </div>
            </div>

            <Separator className="my-5" />

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left p-3 font-body text-xs text-muted-foreground">Nome</th>
                      <th className="text-left p-3 font-body text-xs text-muted-foreground">Duração</th>
                      <th className="text-left p-3 font-body text-xs text-muted-foreground">Atendentes</th>
                      <th className="text-left p-3 font-body text-xs text-muted-foreground">Ativo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((s) => {
                      const active = s.id === selectedServiceId;
                      return (
                        <tr
                          key={s.id}
                          className={`border-b border-border last:border-0 cursor-pointer ${active ? 'bg-secondary/30' : ''}`}
                          onClick={() => setSelectedServiceId(s.id)}
                          title="Selecionar para gerir atendentes"
                        >
                          <td className="p-3 font-body text-sm">{s.name}</td>
                          <td className="p-3 font-body text-sm text-muted-foreground">{s.duration_minutes} min</td>
                          <td className="p-3 font-body text-sm text-muted-foreground">
                            {active ? (serviceStaffIds.length ? `${serviceStaffIds.length} atend.` : 'Nenhum') : '-'}
                          </td>
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <Switch
                              checked={Boolean(s.is_active)}
                              onCheckedChange={(v) => updateServiceMutation.mutate({ id: s.id, patch: { is_active: v } })}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {services.length === 0 ? <EmptyState icon={CalendarClock} description="Sem serviços" className="py-6" /> : null}
              </div>

              <div className="bg-secondary/10 border border-border rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="font-heading text-base">Detalhes do serviço</div>
                  {selectedServiceId ? (
                    <Button variant="ghost" className="h-8 px-2 rounded-none font-body text-xs" onClick={() => setSelectedServiceId('')}>
                      Limpar
                    </Button>
                  ) : null}
                </div>

                {!selectedService ? (
                  <p className="font-body text-sm text-muted-foreground">Selecione um serviço para associar atendentes.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="font-body text-sm font-medium">{selectedService.name}</div>
                    <div className="font-heading text-base">Atendentes</div>

                    <div>
                      <Label className="font-body text-xs">Imagem do serviço</Label>
                      <Input
                        value={selectedServiceImageUrl}
                        onChange={(e) => setSelectedServiceImageUrl(e.target.value)}
                        onBlur={() => {
                          const next = String(selectedServiceImageUrl ?? '').trim();
                          const current = String(selectedService.image_url ?? '').trim();
                          if (next !== current) {
                            updateServiceMutation.mutate({ id: selectedService.id, patch: { image_url: next ? next : null } });
                          }
                        }}
                        className="rounded-none mt-1"
                        placeholder="Cole a URL da imagem (opcional)"
                      />
                      <div className="mt-3">
                        <ImageUpload
                          value={selectedServiceImageUrl}
                          onChange={(v) => {
                            setSelectedServiceImageUrl(v);
                            updateServiceMutation.mutate({ id: selectedService.id, patch: { image_url: v?.trim() ? v : null } });
                          }}
                          variant="compact"
                          label="Ou faça upload"
                          recommended="1200×675"
                          helper="Atualiza o card no site."
                          buttonLabel="Upload"
                        />
                      </div>
                    </div>

                    <p className="font-body text-xs text-muted-foreground">
                      Se nenhum atendente estiver selecionado, qualquer atendente ativo poderá ser escolhido pelo cliente.
                    </p>

                    <div className="max-h-64 overflow-y-auto pr-1 space-y-2">
                      {staff
                        .filter((s) => s.is_active !== false)
                        .map((s) => {
                          const checked = serviceStaffIds.includes(s.id);
                          return (
                            <label key={s.id} className="flex items-center justify-between gap-3 text-sm font-body">
                              <span className="truncate">{s.name}</span>
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) => {
                                  const isChecked = value === true;
                                  const next = isChecked
                                    ? Array.from(new Set([...serviceStaffIds, s.id]))
                                    : serviceStaffIds.filter((id) => id !== s.id);
                                  setServiceStaffIds(next);
                                }}
                              />
                            </label>
                          );
                        })}
                      {staff.filter((s) => s.is_active !== false).length === 0 ? (
                        <EmptyState icon={CalendarClock} description="Sem atendentes ativos." className="py-6" />
                      ) : null}
                    </div>

                    <Button
                      className="w-full rounded-none font-body text-sm tracking-wider"
                      disabled={serviceStaffMutation.isPending || !selectedServiceId}
                      onClick={() => serviceStaffMutation.mutate({ id: selectedServiceId, staff_ids: serviceStaffIds })}
                    >
                      {serviceStaffMutation.isPending ? 'A guardar...' : 'Guardar atendentes'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="atendentes" className="pt-4 space-y-4">
          <div className="bg-card p-6 rounded-lg border border-border">
            <h2 className="font-heading text-xl mb-4">Atendentes</h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div className="md:col-span-2">
                <Label className="font-body text-xs">Nome</Label>
                <Input
                  value={staffForm.name}
                  onChange={(e) => setStaffForm((p) => ({ ...p, name: e.target.value }))}
                  className="rounded-none mt-1"
                />
              </div>
              <div>
                <Label className="font-body text-xs">Email (opcional)</Label>
                <Input
                  value={staffForm.email}
                  onChange={(e) => setStaffForm((p) => ({ ...p, email: e.target.value }))}
                  className="rounded-none mt-1"
                />
              </div>
              <div>
                <Label className="font-body text-xs">Telefone (opcional)</Label>
                <Input
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm((p) => ({ ...p, phone: e.target.value }))}
                  className="rounded-none mt-1"
                />
              </div>
            </div>

            <div className="bg-secondary/20 border border-border rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-heading text-base">Disponibilidade</div>
                  <div className="font-body text-xs text-muted-foreground">
                    Defina os dias e o horário em que este atendente pode receber marcações.
                  </div>
                </div>
                <div className="font-body text-xs text-muted-foreground">{staffAvailabilityText || '—'}</div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <Label className="font-body text-xs">Dias</Label>
                  <div className="mt-2 flex items-center gap-4 flex-wrap">
                    {WEEKDAYS.map((d) => (
                      <label key={d.value} className="inline-flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={staffForm.availability_days.includes(d.value)}
                          onCheckedChange={(checked) => {
                            setStaffForm((p) => {
                              const current = Array.isArray(p.availability_days) ? p.availability_days : [];
                              const has = current.includes(d.value);
                              const nextDays = checked
                                ? (has ? current : [...current, d.value])
                                : current.filter((x) => x !== d.value);
                              return { ...p, availability_days: nextDays };
                            });
                          }}
                        />
                        <span className="font-body text-xs">{d.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="font-body text-xs">Início</Label>
                    <Input
                      type="time"
                      value={staffForm.availability_start_time}
                      onChange={(e) => setStaffForm((p) => ({ ...p, availability_start_time: e.target.value }))}
                      className="rounded-none mt-1"
                    />
                  </div>
                  <div>
                    <Label className="font-body text-xs">Fim</Label>
                    <Input
                      type="time"
                      value={staffForm.availability_end_time}
                      onChange={(e) => setStaffForm((p) => ({ ...p, availability_end_time: e.target.value }))}
                      className="rounded-none mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Button
              className="rounded-none font-body text-sm tracking-wider"
              disabled={
                createStaffMutation.isPending ||
                !staffForm.name.trim() ||
                staffForm.availability_days.length === 0 ||
                !staffForm.availability_start_time ||
                !staffForm.availability_end_time ||
                String(staffForm.availability_end_time) <= String(staffForm.availability_start_time)
              }
              onClick={() => {
                createStaffMutation.mutate({
                  name: staffForm.name.trim(),
                  email: staffForm.email.trim() || null,
                  phone: staffForm.phone.trim() || null,
                  availability: {
                    days: staffForm.availability_days,
                    start_time: staffForm.availability_start_time,
                    end_time: staffForm.availability_end_time,
                    timezone: 'Europe/Lisbon',
                  },
                  is_active: true,
                });
                setStaffForm({
                  name: '',
                  email: '',
                  phone: '',
                  is_active: true,
                  availability_days: [1, 2, 3, 4, 5],
                  availability_start_time: '09:00',
                  availability_end_time: '18:00',
                });
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Adicionar atendente
            </Button>

            <Separator className="my-5" />

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-3 font-body text-xs text-muted-foreground">Nome</th>
                    <th className="text-left p-3 font-body text-xs text-muted-foreground">Email</th>
                    <th className="text-left p-3 font-body text-xs text-muted-foreground">Telefone</th>
                    <th className="text-left p-3 font-body text-xs text-muted-foreground">Disponibilidade</th>
                    <th className="text-left p-3 font-body text-xs text-muted-foreground">Ativo</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="p-3 font-body text-sm">{s.name}</td>
                      <td className="p-3 font-body text-sm text-muted-foreground">{s.email || '-'}</td>
                      <td className="p-3 font-body text-sm text-muted-foreground">{s.phone || '-'}</td>
                      <td className="p-3 font-body text-sm text-muted-foreground">{formatStaffAvailability(s.availability)}</td>
                      <td className="p-3">
                        <Switch
                          checked={Boolean(s.is_active)}
                          onCheckedChange={(v) => updateStaffMutation.mutate({ id: s.id, patch: { is_active: v } })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {staff.length === 0 ? <EmptyState icon={CalendarClock} description="Sem atendentes" className="py-6" /> : null}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="marcacoes" className="pt-4 space-y-4">
          <div className="bg-card p-6 rounded-lg border border-border">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <h2 className="font-heading text-xl">Marcações</h2>
              <div className="flex items-center gap-2">
                <span className="font-body text-xs text-muted-foreground">Mostrar</span>
                <Select value={String(apptLimit)} onValueChange={(v) => setApptLimit(Math.max(5, Number(v) || 5))}>
                  <SelectTrigger className="rounded-none h-9 w-[110px] font-body text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 20, 50, 100].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-3 font-body text-xs text-muted-foreground">Data/hora</th>
                    <th className="text-left p-3 font-body text-xs text-muted-foreground">Serviço</th>
                    <th className="text-left p-3 font-body text-xs text-muted-foreground">Atendente</th>
                    <th className="text-left p-3 font-body text-xs text-muted-foreground">Cliente</th>
                    <th className="text-left p-3 font-body text-xs text-muted-foreground">Estado</th>
                    <th className="text-right p-3 font-body text-xs text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center font-body text-sm text-muted-foreground">
                        <EmptyState icon={CalendarClock} description="Sem marcações" className="py-2" />
                      </td>
                    </tr>
                  ) : (
                    upcoming.map((a) => {
                      const badgeCls =
                        appointmentStatusBadgeClassName[a.status] ??
                        'border-transparent bg-muted text-muted-foreground shadow-none';
                      return (
                        <tr key={a.id} className="border-b border-border last:border-0 hover:bg-secondary/10">
                          <td className="p-3 font-body text-sm whitespace-nowrap">{formatPtDateTime(a.start_at)}</td>
                          <td className="p-3 font-body text-sm">{a.service?.name ?? '-'}</td>
                          <td className="p-3 font-body text-sm">{a.staff?.name ?? '-'}</td>
                          <td className="p-3 font-body text-sm text-muted-foreground">
                            {[a.guest_name, a.customer_email].filter(Boolean).join(' · ') || '-'}
                          </td>
                          <td className="p-3">
                            <Badge
                              className={cn('rounded-none font-body text-xs font-semibold', badgeCls)}
                            >
                              {getAppointmentStatusLabel(a.status)}
                            </Badge>
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              {a.status === 'pending' ? (
                                <Button
                                  size="icon"
                                  className="h-9 w-9 rounded-none"
                                  disabled={updateAppointmentMutation.isPending}
                                  onClick={() => updateAppointmentMutation.mutate({ id: a.id, patch: { status: 'confirmed' } })}
                                  title="Confirmar"
                                  aria-label="Confirmar"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                              ) : null}
                              {a.status === 'confirmed' ? (
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-9 w-9 rounded-none"
                                  disabled={updateAppointmentMutation.isPending}
                                  onClick={() => updateAppointmentMutation.mutate({ id: a.id, patch: { status: 'completed' } })}
                                  title="Concluir"
                                  aria-label="Concluir"
                                >
                                  <CheckCheck className="w-4 h-4" />
                                </Button>
                              ) : null}
                              {a.status === 'pending' || a.status === 'confirmed' ? (
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-9 w-9 rounded-none"
                                  disabled={updateAppointmentMutation.isPending}
                                  onClick={() => updateAppointmentMutation.mutate({ id: a.id, patch: { status: 'cancelled' } })}
                                  title="Cancelar"
                                  aria-label="Cancelar"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              ) : null}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 rounded-none"
                                onClick={() => openEdit(a)}
                                title="Editar"
                                aria-label="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <LoadMoreControls
              leftText={`A mostrar ${Array.isArray(upcoming) ? upcoming.length : 0} marcações.`}
              onLess={() => setApptLimit(5)}
              lessDisabled={isLoadingAppointments || apptLimit <= 5}
              onMore={() => setApptLimit((p) => Math.min(500, p + 10))}
              moreDisabled={!canLoadMoreAppointments}
            />

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogContent aria-describedby={undefined} className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-heading text-xl">Editar marcação</DialogTitle>
                </DialogHeader>

                {editing ? (
                  <div className="space-y-4">
                    <div>
                      <Label className="font-body text-xs">Cliente</Label>
                      <div className="font-body text-sm text-muted-foreground mt-1">
                        {[editing.guest_name, editing.customer_email].filter(Boolean).join(' · ') || '-'}
                        {editing.guest_phone ? (
                          <span className="block mt-1">Tel.: {editing.guest_phone}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="font-body text-xs">Data e hora</Label>
                        <Input
                          type="datetime-local"
                          value={editForm.start_at}
                          onChange={(e) => setEditForm((p) => ({ ...p, start_at: e.target.value }))}
                          className="rounded-none mt-1"
                        />
                      </div>
                      <div>
                        <Label className="font-body text-xs">Duração (min)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={24 * 60}
                          inputMode="numeric"
                          value={editForm.duration_minutes}
                          onChange={(e) => setEditForm((p) => ({ ...p, duration_minutes: e.target.value }))}
                          className="rounded-none mt-1"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="font-body text-xs">Serviço</Label>
                        <Select value={editForm.service_id} onValueChange={(v) => setEditForm((p) => ({ ...p, service_id: v }))}>
                          <SelectTrigger className="rounded-none mt-1 font-body text-sm">
                            <SelectValue placeholder={services.length ? 'Selecione...' : 'Sem serviços'} />
                          </SelectTrigger>
                          <SelectContent>
                            {services.map((s) => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="font-body text-xs">Atendente</Label>
                        <Select value={editForm.staff_id} onValueChange={(v) => setEditForm((p) => ({ ...p, staff_id: v }))}>
                          <SelectTrigger className="rounded-none mt-1 font-body text-sm">
                            <SelectValue placeholder={staff.length ? 'Selecione...' : 'Sem atendentes'} />
                          </SelectTrigger>
                          <SelectContent>
                            {staff.map((s) => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="font-body text-xs">Estado</Label>
                      <Select value={editForm.status} onValueChange={(v) => setEditForm((p) => ({ ...p, status: v }))}>
                        <SelectTrigger className="rounded-none mt-1 font-body text-sm">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(appointmentStatusLabels).map((s) => (
                            <SelectItem key={s} value={s}>
                              {appointmentStatusLabels[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="font-body text-xs">Observações</Label>
                      <Textarea
                        value={editForm.observations}
                        onChange={(e) => setEditForm((p) => ({ ...p, observations: e.target.value }))}
                        className="rounded-none mt-1 min-h-[90px]"
                      />
                    </div>

                    <div>
                      <Label className="font-body text-xs">Link de imagem (opcional)</Label>
                      <Input
                        value={editForm.image_url}
                        onChange={(e) => setEditForm((p) => ({ ...p, image_url: e.target.value }))}
                        className="rounded-none mt-1"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                ) : null}

                <DialogFooter>
                  <Button variant="outline" className="rounded-none font-body text-sm" onClick={() => setEditOpen(false)}>
                    Fechar
                  </Button>
                  <Button
                    className="rounded-none font-body text-sm tracking-wider"
                    disabled={!editing || updateAppointmentMutation.isPending}
                    onClick={() => {
                      if (!editing) return;
                      const patch = {
                        status: editForm.status || undefined,
                        start_at: editForm.start_at || undefined,
                        service_id: editForm.service_id || undefined,
                        staff_id: editForm.staff_id || undefined,
                        duration_minutes: editForm.duration_minutes ? Number(editForm.duration_minutes) || undefined : undefined,
                        observations: String(editForm.observations ?? '').trim() ? String(editForm.observations).trim() : null,
                        image_url: String(editForm.image_url ?? '').trim() ? String(editForm.image_url).trim() : null,
                      };
                      updateAppointmentMutation.mutate({ id: editing.id, patch }, { onSuccess: () => setEditOpen(false) });
                    }}
                  >
                    {updateAppointmentMutation.isPending ? 'A guardar...' : 'Guardar'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
