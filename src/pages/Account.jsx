import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, CalendarClock, Clock, Heart, LogOut, Package, Save, Sparkles, Trash2, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import Auth from './Auth';
import { useAuth } from '@/lib/AuthContext';
import { useCart } from '@/lib/CartContext';
import { appointmentStatusBadgeClassName, getAppointmentStatusLabel } from '@/lib/appointmentStatus';
import { confirmDestructive } from '@/lib/confirm';
import { cn } from '@/lib/utils';
import ImageWithFallback from '@/components/ui/image-with-fallback';
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

  const deleteAccountMutation = useMutation({
    mutationFn: () => base44.account.delete(),
    onSuccess: () => {
      toast.success('Conta removida.');
      logout();
      queryClient.setQueryData(['me'], null);
      queryClient.removeQueries();
      navigate('/conta', { replace: true });
    },
    onError: () => toast.error('NÃ£o foi possÃ­vel remover a conta.'),
  });

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
          <h2 className="font-heading text-xl mb-4">Definições</h2>
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

      <div className="bg-card p-6 rounded-lg border border-destructive/30 mt-12">
        <h2 className="font-heading text-xl mb-2 text-destructive">Zona de perigo</h2>
        <p className="font-body text-sm text-muted-foreground">
          Ao apagar a conta, deixa de conseguir aceder ao site com este utilizador.
        </p>
        <div className="mt-4">
          <Button
            variant="destructive"
            className="rounded-none font-body text-sm gap-2"
            disabled={deleteAccountMutation.isPending}
            onClick={() => {
              if (!confirmDestructive('Tem certeza que deseja apagar a sua conta?')) return;
              deleteAccountMutation.mutate();
            }}
          >
            <Trash2 className="w-4 h-4" />
            {deleteAccountMutation.isPending ? 'A apagar...' : 'Apagar conta'}
          </Button>
        </div>
      </div>
    </div>
  );
}
