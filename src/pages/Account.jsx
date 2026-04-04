import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, CalendarClock, Clock, Heart, LogOut, Package, Save, Sparkles, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import Auth from './Auth';
import { useAuth } from '@/lib/AuthContext';
import { useCart } from '@/lib/CartContext';
import { appointmentStatusBadgeClassName, getAppointmentStatusLabel } from '@/lib/appointmentStatus';
import { cn } from '@/lib/utils';
import OrderStatusCard from '@/components/orders/OrderStatusCard';


function normalizeFormValue(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

export default function Account() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logout } = useAuth();

  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: orders = [], isLoading: isLoadingOrders, isError: isOrdersError, refetch: refetchOrders } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => base44.orders.my(),
    enabled: !!user,
    retry: false,
  });

  const { data: loyaltyData } = useQuery({
    queryKey: ['content-loyalty'],
    queryFn: () => base44.content.loyalty(),
    staleTime: 60_000,
  });

  const { addItem, clearCart } = useCart();

  const handleRepeatOrder = async (order) => {
    if (!order?.items?.length) {
      toast.error('Não é possível repetir esta encomenda.');
      return;
    }

    const productsById = {};
    const productIds = Array.from(
      new Set(order.items.map((item) => String(item.product_id || '')).filter(Boolean))
    );

    await Promise.all(
      productIds.map(async (productId) => {
        try {
          const products = await base44.entities.Product.filter({ id: productId, limit: 1 });
          if (Array.isArray(products) && products.length > 0) {
            productsById[productId] = products[0];
          }
        } catch {
          // fallback to item price if current product lookup fails
        }
      })
    );

    clearCart();

    order.items.forEach((item) => {
      const currentProduct = item.product_id ? productsById[String(item.product_id)] : null;
      const product = {
        id: item.product_id || item.id || item.product_name,
        name: item.product_name,
        images: item.product_image ? [item.product_image] : [],
        price: Number(currentProduct?.price ?? item.price) || 0,
      };

      addItem(product, item.quantity || 1, item.color || '');
    });

    toast.success('Itens da encomenda adicionados ao carrinho. Complete o checkout para finalizar.');
    navigate('/checkout');
  };

  const { data: apptSettingsRes } = useQuery({
    queryKey: ['appointments-settings'],
    queryFn: () => base44.appointments.settings(),
    staleTime: 60_000,
  });

  const apptEnabled = Boolean(apptSettingsRes?.content?.enabled);

  const { data: myAppointmentsRes, isLoading: isLoadingAppointments } = useQuery({
    queryKey: ['appointments-my'],
    queryFn: () => base44.appointments.my(),
    enabled: apptEnabled && !!user,
    retry: false,
    staleTime: 15_000,
  });

  const nextAppointment = useMemo(() => {
    const appts = myAppointmentsRes?.appointments ?? [];
    const now = Date.now();
    return (
      appts
        .filter((a) => (a?.status === 'pending' || a?.status === 'confirmed') && new Date(a.start_at).getTime() >= now - 60_000)
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0] ?? null
    );
  }, [myAppointmentsRes?.appointments]);

  const pointValue = Math.max(0.000001, Number(loyaltyData?.content?.point_value_eur ?? 0.01) || 0.01);

  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    postal_code: '',
    country: 'Portugal',
    newsletter_opt_in: false,
    order_updates_email: true,
  });
  const [initialForm, setInitialForm] = useState(null);

  const { data: addresses = [] } = useQuery({
    queryKey: ['my-addresses'],
    queryFn: () => base44.user.addresses.list(),
    enabled: !!user,
    staleTime: 30_000,
  });

  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [addressForm, setAddressForm] = useState({
    label: '',
    line1: '',
    line2: '',
    city: '',
    postal_code: '',
    country: 'Portugal',
    is_default: false,
  });

  const openNewAddress = () => {
    setEditingAddress(null);
    setAddressForm({
      label: '',
      line1: '',
      line2: '',
      city: '',
      postal_code: '',
      country: 'Portugal',
      is_default: addresses.length === 0,
    });
    setAddressDialogOpen(true);
  };

  const openEditAddress = (addr) => {
    setEditingAddress(addr);
    setAddressForm({
      label: addr?.label ?? '',
      line1: addr?.line1 ?? '',
      line2: addr?.line2 ?? '',
      city: addr?.city ?? '',
      postal_code: addr?.postal_code ?? '',
      country: addr?.country ?? 'Portugal',
      is_default: Boolean(addr?.is_default),
    });
    setAddressDialogOpen(true);
  };

  const createAddressMutation = useMutation({
    mutationFn: (payload) => base44.user.addresses.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-addresses'] });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      void queryClient.refetchQueries({ queryKey: ['me'] });
      toast.success('Endereço adicionado.');
      setAddressDialogOpen(false);
      setEditingAddress(null);
    },
    onError: () => toast.error('Não foi possível adicionar o endereço.'),
  });

  const updateAddressMutation = useMutation({
    mutationFn: ({ id, patch }) => base44.user.addresses.update(id, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-addresses'] });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      void queryClient.refetchQueries({ queryKey: ['me'] });
      toast.success('Endereço atualizado.');
      setAddressDialogOpen(false);
      setEditingAddress(null);
    },
    onError: () => toast.error('Não foi possível atualizar o endereço.'),
  });

  const deleteAddressMutation = useMutation({
    mutationFn: (id) => base44.user.addresses.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-addresses'] });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      void queryClient.refetchQueries({ queryKey: ['me'] });
      toast.success('Endereço removido.');
    },
    onError: () => toast.error('Não foi possível remover o endereço.'),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id) => base44.user.addresses.update(id, { is_default: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-addresses'] });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      void queryClient.refetchQueries({ queryKey: ['me'] });
      toast.success('Endereço padrão atualizado.');
    },
    onError: () => toast.error('Não foi possível definir como padrão.'),
  });

  const saveAddress = () => {
    const payload = {
      label: String(addressForm.label ?? '').trim() || null,
      line1: String(addressForm.line1 ?? '').trim(),
      line2: String(addressForm.line2 ?? '').trim() || null,
      city: String(addressForm.city ?? '').trim(),
      postal_code: String(addressForm.postal_code ?? '').trim() || null,
      country: String(addressForm.country ?? '').trim() || null,
      is_default: Boolean(addressForm.is_default),
    };

    if (!payload.line1 || !payload.city) {
      toast.error('Preencha pelo menos Morada e Cidade.');
      return;
    }

    if (editingAddress?.id) updateAddressMutation.mutate({ id: editingAddress.id, patch: payload });
    else createAddressMutation.mutate(payload);
  };

  const formatAddress = (a) => {
    const parts = [a?.line1, a?.line2, a?.postal_code, a?.city, a?.country].filter(Boolean);
    return parts.join(', ');
  };

  useEffect(() => {
    if (!user) return;
    const nextForm = {
      full_name: normalizeFormValue(user.full_name),
      phone: normalizeFormValue(user.phone),
      address_line1: normalizeFormValue(user.address?.line1),
      address_line2: normalizeFormValue(user.address?.line2),
      city: normalizeFormValue(user.address?.city),
      postal_code: normalizeFormValue(user.address?.postal_code),
      country: normalizeFormValue(user.address?.country || 'Portugal'),
      newsletter_opt_in: Boolean(user.settings?.newsletter_opt_in),
      order_updates_email: user.settings?.order_updates_email !== false,
    };
    setProfileForm(nextForm);
    setInitialForm(nextForm);
  }, [user]);

  const isDirty = useMemo(() => {
    if (!initialForm) return false;
    return JSON.stringify(profileForm) !== JSON.stringify(initialForm);
  }, [profileForm, initialForm]);

  const updateMeMutation = useMutation({
    mutationFn: (patch) => base44.user.updateMe(patch),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['me'], updatedUser);
      toast.success('Alterações guardadas.');
      setInitialForm(profileForm);
    },
    onError: (err) => {
      const code = err?.data?.error ?? err?.message;
      if (code === 'unauthorized') {
        toast.error('A sua sessão expirou. Inicie sessão novamente.');
        queryClient.setQueryData(['me'], null);
        navigate('/conta', { replace: true });
        return;
      }
      toast.error('Não foi possível guardar as alterações.');
    },
  });

  const handleSave = () => {
    updateMeMutation.mutate(profileForm);
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-heading text-3xl md:text-4xl">Minha Conta</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2 font-body text-sm rounded-none"
            disabled={!isDirty || updateMeMutation.isPending}
            onClick={handleSave}
          >
            <Save className="w-4 h-4" />
            {updateMeMutation.isPending ? 'A guardar...' : 'Guardar'}
          </Button>
          <Button
            variant="ghost"
            className="gap-2 font-body text-sm"
            onClick={() => {
              logout();
              queryClient.setQueryData(['me'], null);
              queryClient.removeQueries({ queryKey: ['my-orders'] });
              navigate('/conta', { replace: true });
            }}
          >
            <LogOut className="w-4 h-4" /> Sair
          </Button>
        </div>
      </div>

      {/* Header Card */}
      <div className="bg-card p-6 rounded-lg border border-border mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-body text-sm font-semibold truncate">{user?.full_name || 'Cliente'}</p>
            <p className="font-body text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-10">
        <Link
          to="/favoritos"
          className="bg-card p-5 rounded-lg border border-border hover:border-primary/30 transition-colors flex items-center gap-3"
        >
          <Heart className="w-5 h-5 text-accent" />
          <span className="font-body text-sm">Favoritos</span>
        </Link>
        <Link
          to="/catalogo"
          className="bg-card p-5 rounded-lg border border-border hover:border-primary/30 transition-colors flex items-center gap-3"
        >
          <Package className="w-5 h-5 text-accent" />
          <span className="font-body text-sm">Catálogo</span>
        </Link>
        <Link
          to="/marcacoes"
          className="bg-card p-5 rounded-lg border border-border hover:border-primary/30 transition-colors flex items-center gap-3"
        >
          <Calendar className="w-5 h-5 text-accent" />
          <span className="font-body text-sm">Marcações</span>
        </Link>
        <div className="bg-card p-5 rounded-lg border border-border flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-accent" />
          <div className="min-w-0">
            <div className="font-body text-xs text-muted-foreground">Pontos disponíveis</div>
            <div className="font-heading text-xl leading-tight">{Number(user?.points_balance ?? 0) || 0}</div>
            <div className="font-body text-[11px] text-muted-foreground">1 ponto = {pointValue.toFixed(3)}€</div>
          </div>
        </div>
      </div>

      {/* Profile + Address */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        <div className="bg-card p-6 rounded-lg border border-border">
          <h2 className="font-heading text-xl mb-4">Dados Pessoais</h2>
          <div className="space-y-3">
            <div>
              <Label className="font-body text-xs">Nome</Label>
              <Input
                value={profileForm.full_name}
                onChange={(e) => setProfileForm((p) => ({ ...p, full_name: e.target.value }))}
                className="rounded-none mt-1"
                placeholder="Ex: Maria Silva"
              />
            </div>
            <div>
              <Label className="font-body text-xs">Telefone</Label>
              <Input
                value={profileForm.phone}
                onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))}
                className="rounded-none mt-1"
                placeholder="Ex: +351 9xx xxx xxx"
              />
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border">
          <h2 id="definicoes" className="font-heading text-xl mb-4">Definições</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-body text-sm font-medium">Newsletter</p>
                <p className="font-body text-xs text-muted-foreground">Receber novidades e promoções</p>
              </div>
              <Switch
                checked={profileForm.newsletter_opt_in}
                onCheckedChange={(v) => setProfileForm((p) => ({ ...p, newsletter_opt_in: v }))}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-body text-sm font-medium">Atualizações por email</p>
                <p className="font-body text-xs text-muted-foreground">Estado das encomendas e avisos</p>
              </div>
              <Switch
                checked={profileForm.order_updates_email}
                onCheckedChange={(v) => setProfileForm((p) => ({ ...p, order_updates_email: v }))}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-lg border border-border mb-10">
        <h2 className="font-heading text-xl mb-4">Endereço de Entrega</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label className="font-body text-xs">Morada</Label>
            <Input
              value={profileForm.address_line1}
              onChange={(e) => setProfileForm((p) => ({ ...p, address_line1: e.target.value }))}
              className="rounded-none mt-1"
              placeholder="Rua, número, andar..."
            />
          </div>
          <div className="md:col-span-2">
            <Label className="font-body text-xs">Complemento</Label>
            <Input
              value={profileForm.address_line2}
              onChange={(e) => setProfileForm((p) => ({ ...p, address_line2: e.target.value }))}
              className="rounded-none mt-1"
              placeholder="Ex: Bloco A, porta 3"
            />
          </div>
          <div>
            <Label className="font-body text-xs">Cidade</Label>
            <Input
              value={profileForm.city}
              onChange={(e) => setProfileForm((p) => ({ ...p, city: e.target.value }))}
              className="rounded-none mt-1"
              placeholder="Ex: Lisboa"
            />
          </div>
          <div>
            <Label className="font-body text-xs">Código Postal</Label>
            <Input
              value={profileForm.postal_code}
              onChange={(e) => setProfileForm((p) => ({ ...p, postal_code: e.target.value }))}
              className="rounded-none mt-1"
              placeholder="Ex: 1000-000"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="font-body text-xs">País</Label>
            <Input
              value={profileForm.country}
              onChange={(e) => setProfileForm((p) => ({ ...p, country: e.target.value }))}
              className="rounded-none mt-1"
              placeholder="Portugal"
            />
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-lg border border-border mb-10">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <h2 id="enderecos" className="font-heading text-xl">Endereços</h2>
          <Button className="rounded-none font-body text-sm" onClick={openNewAddress}>
            Adicionar endereço
          </Button>
        </div>

        {(addresses ?? []).length === 0 ? (
          <p className="font-body text-sm text-muted-foreground">Ainda não tem endereços guardados.</p>
        ) : (
          <div className="space-y-3">
            {(addresses ?? []).map((a) => (
              <div key={a.id} className="border border-border rounded-md p-4 flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-body text-sm font-semibold truncate">{a.label || 'Endereço'}</div>
                    {a.is_default ? (
                      <Badge className="rounded-none font-body text-[10px] bg-primary/10 text-primary">Padrão</Badge>
                    ) : null}
                  </div>
                  <div className="font-body text-xs text-muted-foreground mt-1">{formatAddress(a)}</div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!a.is_default ? (
                    <Button
                      variant="outline"
                      className="rounded-none font-body text-xs"
                      onClick={() => setDefaultMutation.mutate(a.id)}
                      disabled={setDefaultMutation.isPending}
                    >
                      Definir padrão
                    </Button>
                  ) : null}
                  <Button variant="outline" className="rounded-none font-body text-xs" onClick={() => openEditAddress(a)}>
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    className="rounded-none font-body text-xs"
                    onClick={() => {
                      if (!window.confirm('Remover este endereço?')) return;
                      deleteAddressMutation.mutate(a.id);
                    }}
                    disabled={deleteAddressMutation.isPending}
                  >
                    Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={addressDialogOpen}
        onOpenChange={(open) => {
          setAddressDialogOpen(open);
          if (!open) setEditingAddress(null);
        }}
      >
        <DialogContent aria-describedby={undefined} className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{editingAddress ? 'Editar endereço' : 'Novo endereço'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="font-body text-xs">Etiqueta (opcional)</Label>
              <Input
                value={addressForm.label}
                onChange={(e) => setAddressForm((p) => ({ ...p, label: e.target.value }))}
                className="rounded-none mt-1"
                placeholder="Ex: Casa, Trabalho..."
              />
            </div>

            <div>
              <Label className="font-body text-xs">Morada *</Label>
              <Input
                value={addressForm.line1}
                onChange={(e) => setAddressForm((p) => ({ ...p, line1: e.target.value }))}
                className="rounded-none mt-1"
                placeholder="Rua, número, andar..."
              />
            </div>

            <div>
              <Label className="font-body text-xs">Complemento</Label>
              <Input
                value={addressForm.line2}
                onChange={(e) => setAddressForm((p) => ({ ...p, line2: e.target.value }))}
                className="rounded-none mt-1"
                placeholder="Ex: Bloco A, porta 3"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-xs">Cidade *</Label>
                <Input
                  value={addressForm.city}
                  onChange={(e) => setAddressForm((p) => ({ ...p, city: e.target.value }))}
                  className="rounded-none mt-1"
                  placeholder="Ex: Lisboa"
                />
              </div>
              <div>
                <Label className="font-body text-xs">Código Postal</Label>
                <Input
                  value={addressForm.postal_code}
                  onChange={(e) => setAddressForm((p) => ({ ...p, postal_code: e.target.value }))}
                  className="rounded-none mt-1"
                  placeholder="Ex: 1000-000"
                />
              </div>
            </div>

            <div>
              <Label className="font-body text-xs">País</Label>
              <Input
                value={addressForm.country}
                onChange={(e) => setAddressForm((p) => ({ ...p, country: e.target.value }))}
                className="rounded-none mt-1"
                placeholder="Portugal"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-body text-sm font-medium">Endereço padrão</p>
                <p className="font-body text-xs text-muted-foreground">Usado por defeito no checkout.</p>
              </div>
              <Switch checked={addressForm.is_default} onCheckedChange={(v) => setAddressForm((p) => ({ ...p, is_default: v }))} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="rounded-none font-body text-sm" onClick={() => setAddressDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-none font-body text-sm"
              onClick={saveAddress}
              disabled={createAddressMutation.isPending || updateAddressMutation.isPending}
            >
              {(createAddressMutation.isPending || updateAddressMutation.isPending) ? 'A guardar...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="bg-card p-6 rounded-lg border border-border mb-10">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <div className="flex items-center gap-3">
            <CalendarClock className="w-5 h-5 text-primary" />
            <h2 className="font-heading text-xl">Marcações</h2>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/conta/marcacoes">
              <Button variant="outline" className="rounded-none font-body text-sm">
                Ver todas
              </Button>
            </Link>
            <Link to="/marcacoes">
              <Button className="rounded-none font-body text-sm">Nova</Button>
            </Link>
          </div>
        </div>

        {!apptEnabled ? (
          <p className="font-body text-sm text-muted-foreground">De momento, as marcações não estão disponíveis.</p>
        ) : isLoadingAppointments ? (
          <div className="py-4 text-center">
            <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="font-body text-sm text-muted-foreground">A carregar marcações...</p>
          </div>
        ) : nextAppointment ? (
          <div className="bg-secondary/20 border border-border rounded-md p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-body text-sm font-semibold">{nextAppointment.service?.name ?? 'Serviço'}</div>
              <Badge
                className={cn(
                  'rounded-none font-body text-[10px] font-semibold',
                  appointmentStatusBadgeClassName[nextAppointment.status] ??
                    'border-transparent bg-muted text-muted-foreground shadow-none',
                )}
              >
                {getAppointmentStatusLabel(nextAppointment.status)}
              </Badge>
            </div>
            <div className="font-body text-xs text-muted-foreground mt-1">
              {new Date(nextAppointment.start_at).toLocaleString('pt-PT')} • {nextAppointment.duration_minutes} min •{' '}
              {nextAppointment.staff?.name ?? '-'}
            </div>
          </div>
        ) : (
          <p className="font-body text-sm text-muted-foreground">Ainda não tem marcações.</p>
        )}
      </div>

      {/* Orders */}
      <h2 className="font-heading text-2xl mb-6">Histórico de Encomendas</h2>
      {isLoadingOrders ? (
        <div className="bg-card p-8 rounded-lg border border-border text-center">
          <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="font-body text-sm text-muted-foreground">A carregar encomendas...</p>
        </div>
      ) : isOrdersError ? (
        <div className="bg-card p-8 rounded-lg border border-border text-center">
          <p className="font-body text-sm text-muted-foreground">Não foi possível carregar as encomendas.</p>
          <Button className="rounded-none font-body text-sm mt-4" onClick={() => refetchOrders()}>
            Tentar novamente
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-card p-8 rounded-lg border border-border text-center">
          <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-body text-sm text-muted-foreground">Ainda não tem encomendas.</p>
          <Link to="/catalogo">
            <Button className="rounded-none font-body text-sm mt-4">Explorar Catálogo</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <OrderStatusCard key={order.id} order={order} onRepeat={handleRepeatOrder} />
          ))}
        </div>
      )}

    </div>
  );
}
