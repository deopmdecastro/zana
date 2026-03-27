import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, Heart, LogOut, Package, Save, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import Auth from './Auth';
import { useAuth } from '@/lib/AuthContext';

const statusLabels = {
  pending: 'Pendente',
  confirmed: 'Confirmada',
  processing: 'Em preparação',
  shipped: 'Enviada',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
};

const statusColors = {
  pending: 'bg-secondary text-secondary-foreground',
  confirmed: 'bg-accent/20 text-accent-foreground',
  processing: 'bg-accent/30 text-accent-foreground',
  shipped: 'bg-primary/10 text-primary',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-destructive/10 text-destructive',
};

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
      <div className="grid grid-cols-2 gap-4 mb-10">
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
          {orders.map((order) => {
            const totalNumber = Number.parseFloat(order.total);
            return (
              <div key={order.id} className="bg-card p-5 rounded-lg border border-border">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="font-body text-xs text-muted-foreground">
                      {format(new Date(order.created_at), 'd MMM yyyy', { locale: pt })}
                    </p>
                    <p className="font-body text-sm font-semibold">
                      {Number.isFinite(totalNumber) ? totalNumber.toFixed(2) : order.total} €
                    </p>
                  </div>
                  <Badge className={statusColors[order.status] || 'bg-secondary'}>
                    {statusLabels[order.status] || order.status}
                  </Badge>
                </div>
                <Separator className="my-3" />
                <div className="flex flex-wrap gap-2">
                  {order.items?.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {item.product_image && (
                        <div className="w-10 h-10 rounded bg-secondary/30 overflow-hidden">
                          <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <span className="font-body text-xs text-muted-foreground">
                        {item.product_name} x{item.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
