import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CalendarClock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ImageUpload from '@/components/uploads/ImageUpload';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';

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

  const { data: servicesRes } = useQuery({
    queryKey: ['admin-appointment-services'],
    queryFn: () => base44.admin.appointments.services.list(500),
  });

  const { data: staffRes } = useQuery({
    queryKey: ['admin-appointment-staff'],
    queryFn: () => base44.admin.appointments.staff.list(500),
  });

  const [apptLimit, setApptLimit] = useState(5);
  const { data: apptRes } = useQuery({
    queryKey: ['admin-appointments', apptLimit],
    queryFn: () => base44.admin.appointments.list({ limit: apptLimit }),
  });

  const services = servicesRes?.services ?? [];
  const staff = staffRes?.staff ?? [];
  const activeStaff = useMemo(() => staff.filter((s) => s.is_active !== false), [staff]);
  const appointments = apptRes?.appointments ?? [];
  const [selectedServiceId, setSelectedServiceId] = useState('');

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

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
    staff_id: '',
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
    return appointments.slice().sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());
  }, [appointments]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <CalendarClock className="w-6 h-6 text-primary" />
          <h1 className="font-heading text-3xl">Marcações</h1>
        </div>
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
                <Switch checked={enabled} onCheckedChange={(v) => settingsMutation.mutate({ enabled: v })} />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="servicos" className="pt-4 space-y-4">
          <div className="bg-card p-6 rounded-lg border border-border">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <h2 className="font-heading text-xl">Serviços</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4"> 
              <div className="md:col-span-2"> 
                <Label className="font-body text-xs">Nome</Label> 
                <Input 
                  value={serviceForm.name} 
                  onChange={(e) => setServiceForm((p) => ({ ...p, name: e.target.value }))} 
                  className="rounded-none mt-1" 
                /> 
              </div> 
              <div className="md:col-span-2"> 
                <ImageUpload 
                  value={serviceForm.image_url} 
                  onChange={(v) => setServiceForm((p) => ({ ...p, image_url: v }))} 
                  label="Imagem do serviço" 
                  helper="Esta imagem será mostrada nos cards do site." 
                  recommended="1200×675"
                /> 
              </div> 
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
              <div className="md:col-span-2">
                <Label className="font-body text-xs">Atendente Principal (opcional)</Label>
                <Select value={serviceForm.staff_id} onValueChange={(v) => setServiceForm((p) => ({ ...p, staff_id: v }))}>
                  <SelectTrigger className="rounded-none mt-1">
                    <SelectValue placeholder={activeStaff.length ? "Selecione um atendente..." : "Sem atendentes ativos - vá à aba Atendentes"} />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.filter((s) => s.is_active !== false).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              className="rounded-none font-body text-sm tracking-wider" 
              disabled={createServiceMutation.isPending || !serviceForm.name.trim()} 
              onClick={() => { 
                createServiceMutation.mutate({ 
                  name: serviceForm.name.trim(), 
                  image_url: serviceForm.image_url?.trim() || null,
                  duration_minutes: Number(serviceForm.duration_minutes) || 30, 
                  price: serviceForm.price.trim() ? Number(serviceForm.price) : null, 
                  is_active: true, 
                }); 
                setServiceForm((p) => ({ ...p, name: '', image_url: '', staff_id: '' })); 
              }} 
            > 
              <Plus className="w-4 h-4 mr-2" /> Adicionar serviço 
            </Button> 

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
                {services.length === 0 ? (
                  <p className="font-body text-sm text-muted-foreground py-4">Sem serviços</p>
                ) : null}
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

                    <ImageUpload
                      value={selectedService.image_url || ''}
                      onChange={(v) => updateServiceMutation.mutate({ id: selectedService.id, patch: { image_url: v || null } })}
                      label="Imagem do serviço"
                      helper="Atualiza o card no site."
                      recommended="1200×675"
                    />

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
                        <p className="font-body text-sm text-muted-foreground">Sem atendentes ativos.</p>
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
              {staff.length === 0 ? <p className="font-body text-sm text-muted-foreground py-4">Sem atendentes</p> : null}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="marcacoes" className="pt-4 space-y-4">
          <div className="bg-card p-6 rounded-lg border border-border">
            <h2 className="font-heading text-xl mb-4">Marcações</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-3 font-body text-xs text-muted-foreground">Data</th>
                    <th className="text-left p-3 font-body text-xs text-muted-foreground">Serviço</th>
                    <th className="text-left p-3 font-body text-xs text-muted-foreground">Atendente</th>
                    <th className="text-left p-3 font-body text-xs text-muted-foreground">Cliente</th>
                    <th className="text-left p-3 font-body text-xs text-muted-foreground">Status</th>
                    <th className="text-right p-3 font-body text-xs text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="p-3 font-body text-sm">{new Date(a.start_at).toLocaleString('pt-PT')}</td>
                      <td className="p-3 font-body text-sm">{a.service?.name ?? '-'}</td>
                      <td className="p-3 font-body text-sm">{a.staff?.name ?? '-'}</td>
                      <td className="p-3 font-body text-sm text-muted-foreground">{a.customer_email ?? '-'}</td>
                      <td className="p-3 font-body text-sm text-muted-foreground">{a.status}</td>
                      <td className="p-3 text-right space-x-2">
                        {a.status === 'pending' ? (
                          <Button
                            className="rounded-none h-9 font-body text-xs"
                            disabled={updateAppointmentMutation.isPending}
                            onClick={() => updateAppointmentMutation.mutate({ id: a.id, patch: { status: 'confirmed' } })}
                          >
                            Confirmar
                          </Button>
                        ) : null}
                        {(a.status === 'pending' || a.status === 'confirmed') ? (
                          <Button
                            variant="outline"
                            className="rounded-none h-9 font-body text-xs"
                            disabled={updateAppointmentMutation.isPending}
                            onClick={() => updateAppointmentMutation.mutate({ id: a.id, patch: { status: 'cancelled' } })}
                          >
                            Cancelar
                          </Button>
                        ) : null}
                        {a.status === 'confirmed' ? (
                          <Button
                            variant="outline"
                            className="rounded-none h-9 font-body text-xs"
                            disabled={updateAppointmentMutation.isPending}
                            onClick={() => updateAppointmentMutation.mutate({ id: a.id, patch: { status: 'completed' } })}
                          >
                            Concluir
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {upcoming.length === 0 ? (
                <p className="font-body text-sm text-muted-foreground py-4">Sem marcações</p>
              ) : (
                <>
                  {upcoming.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="p-3 font-body text-sm">{new Date(a.start_at).toLocaleString('pt-PT')}</td>
                      <td className="p-3 font-body text-sm">{a.service?.name ?? '-'}</td>
                      <td className="p-3 font-body text-sm">{a.staff?.name ?? '-'}</td>
                      <td className="p-3 font-body text-sm text-muted-foreground">{a.customer_email ?? '-'}</td>
                      <td className="p-3 font-body text-sm text-muted-foreground">{a.status}</td>
                      <td className="p-3 text-right space-x-2">
                        {a.status === 'pending' ? (
                          <Button
                            className="rounded-none h-9 font-body text-xs"
                            disabled={updateAppointmentMutation.isPending}
                            onClick={() => updateAppointmentMutation.mutate({ id: a.id, patch: { status: 'confirmed' } })}
                          >
                            Confirmar
                          </Button>
                        ) : null}
                        {(a.status === 'pending' || a.status === 'confirmed') ? (
                          <Button
                            variant="outline"
                            className="rounded-none h-9 font-body text-xs"
                            disabled={updateAppointmentMutation.isPending}
                            onClick={() => updateAppointmentMutation.mutate({ id: a.id, patch: { status: 'cancelled' } })}
                          >
                            Cancelar
                          </Button>
                        ) : null}
                        {a.status === 'confirmed' ? (
                          <Button
                            variant="outline"
                            className="rounded-none h-9 font-body text-xs"
                            disabled={updateAppointmentMutation.isPending}
                            onClick={() => updateAppointmentMutation.mutate({ id: a.id, patch: { status: 'completed' } })}
                          >
                            Concluir
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {apptRes.appointments?.length >= apptLimit && (
                    <div className="p-4 text-center border-t border-border">
                      <Button
                        variant="outline"
                        className="rounded-none font-body text-sm"
                        onClick={() => setApptLimit((l) => l * 2)}
                      >
                        Ver mais marcações ({apptLimit} mostradas)
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
