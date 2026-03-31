import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, Eye, Search, Heart } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import ImageWithFallback from '@/components/ui/image-with-fallback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';
import { entityCode } from '@/utils/entityCode';
import LoadMoreControls from '@/components/ui/load-more-controls';

export default function AdminCustomers() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [form, setForm] = useState(null);
  const [pointsForm, setPointsForm] = useState({ delta: '', balance: '', reason: '' });

  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['admin-users', limit],
    queryFn: () => base44.entities.User.list('-created_date', limit),
  });

  const canLoadMore = !isLoadingUsers && Array.isArray(users) && users.length === limit && limit < 500;

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Cliente atualizado');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível atualizar o cliente.')),
  });

  const pointsMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      const updated = res?.user ?? null;
      if (updated) {
        setSelected(updated);
        setPointsForm((p) => ({ ...p, balance: String(updated.points_balance ?? 0) }));
      }
      toast.success('Pontos atualizados');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível atualizar os pontos.')),
  });

  const userOrdersQuery = useQuery({
    enabled: !!selected?.id,
    queryKey: ['admin-user-orders', selected?.id],
    queryFn: async () => {
      const res = await base44.entities.User.orders(selected.id);
      return res?.orders ?? [];
    },
  });

  const userWishlistQuery = useQuery({
    enabled: !!selected?.id,
    queryKey: ['admin-user-wishlist', selected?.id],
    queryFn: async () => {
      const res = await base44.entities.User.wishlist(selected.id);
      return res?.items ?? [];
    },
  });

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = [u.full_name, u.email, u.phone].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [users, search]);

  const openUser = (u) => {
    setSelected(u);
    setForm({
      full_name: u.full_name ?? '',
      phone: u.phone ?? '',
      address_line1: u.address?.line1 ?? '',
      address_line2: u.address?.line2 ?? '',
      city: u.address?.city ?? '',
      postal_code: u.address?.postal_code ?? '',
      country: u.address?.country ?? '',
      newsletter_opt_in: Boolean(u.settings?.newsletter_opt_in),
      order_updates_email: u.settings?.order_updates_email !== false,
      is_admin: Boolean(u.is_admin),
    });
    setPointsForm({ delta: '', balance: String(Number(u.points_balance ?? 0) || 0), reason: '' });
  };

  const save = () => {
    if (!selected?.id || !form) return;
    updateMutation.mutate({ id: selected.id, data: form });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="font-heading text-3xl">Clientes</h1>
        <div className="relative w-72 max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome, email, telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-none"
          />
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Nome</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Email</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Telefone</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Pontos</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Data Registo</th>
              <th className="text-right p-3 font-body text-xs text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                <td className="p-3 font-body text-sm font-medium">{user.full_name || '-'}</td>
                <td className="p-3 font-body text-sm text-muted-foreground">{user.email}</td>
                <td className="p-3 font-body text-sm text-muted-foreground">{user.phone || '-'}</td>
                <td className="p-3 font-body text-sm text-muted-foreground">{Number(user.points_balance ?? 0) || 0}</td>
                <td className="p-3 font-body text-xs text-muted-foreground">{new Date(user.created_date).toLocaleDateString('pt-PT')}</td>
                <td className="p-3 text-right">
                  <Button variant="ghost" size="icon" onClick={() => openUser(user)} title="Ver / editar">
                    <Eye className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredUsers.length === 0 && (
          <div className="text-center py-8">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="font-body text-sm text-muted-foreground">Sem clientes</p>
          </div>
        )}
      </div>

      <LoadMoreControls
        leftText={`A mostrar ${Math.min(limit, Array.isArray(users) ? users.length : 0)} clientes${search.trim() ? ` (${filteredUsers.length} filtrados)` : ''}.`}
        onLess={() => setLimit(50)}
        lessDisabled={isLoadingUsers || limit <= 50}
        onMore={() => setLimit((p) => Math.min(500, p + 50))}
        moreDisabled={!canLoadMore}
      />

      <Dialog
        open={!!selected}
        onOpenChange={() => {
          setSelected(null);
          setForm(null);
          setPointsForm({ delta: '', balance: '', reason: '' });
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Cliente</DialogTitle>
          </DialogHeader>

          {selected && form && (
            <Tabs defaultValue="perfil">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="perfil">Perfil</TabsTrigger>
                <TabsTrigger value="pontos">Pontos</TabsTrigger>
                <TabsTrigger value="encomendas">Encomendas</TabsTrigger>
                <TabsTrigger value="favoritos">Favoritos</TabsTrigger>
              </TabsList>

              <TabsContent value="perfil" className="pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-body text-xs">Email</Label>
                    <Input value={selected.email} disabled className="rounded-none mt-1" />
                  </div>
                  <div>
                    <Label className="font-body text-xs">Nome</Label>
                    <Input
                      value={form.full_name}
                      onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                      className="rounded-none mt-1"
                    />
                  </div>
                  <div>
                    <Label className="font-body text-xs">Telefone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                      className="rounded-none mt-1"
                    />
                  </div>
                  <div>
                    <Label className="font-body text-xs">País</Label>
                    <Input
                      value={form.country}
                      onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                      className="rounded-none mt-1"
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-body text-xs">Morada (Linha 1)</Label>
                    <Input
                      value={form.address_line1}
                      onChange={(e) => setForm((p) => ({ ...p, address_line1: e.target.value }))}
                      className="rounded-none mt-1"
                    />
                  </div>
                  <div>
                    <Label className="font-body text-xs">Morada (Linha 2)</Label>
                    <Input
                      value={form.address_line2}
                      onChange={(e) => setForm((p) => ({ ...p, address_line2: e.target.value }))}
                      className="rounded-none mt-1"
                    />
                  </div>
                  <div>
                    <Label className="font-body text-xs">Cidade</Label>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                      className="rounded-none mt-1"
                    />
                  </div>
                  <div>
                    <Label className="font-body text-xs">Código Postal</Label>
                    <Input
                      value={form.postal_code}
                      onChange={(e) => setForm((p) => ({ ...p, postal_code: e.target.value }))}
                      className="rounded-none mt-1"
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.newsletter_opt_in}
                      onCheckedChange={(v) => setForm((p) => ({ ...p, newsletter_opt_in: v }))}
                    />
                    <Label className="font-body text-xs">Newsletter</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.order_updates_email}
                      onCheckedChange={(v) => setForm((p) => ({ ...p, order_updates_email: v }))}
                    />
                    <Label className="font-body text-xs">Emails de encomendas</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.is_admin} onCheckedChange={(v) => setForm((p) => ({ ...p, is_admin: v }))} />
                    <Label className="font-body text-xs">Admin</Label>
                  </div>
                </div>

                <Button
                  onClick={save}
                  className="w-full rounded-none font-body text-sm tracking-wider"
                  disabled={updateMutation.isPending}
                >
                  Guardar alterações
                </Button>
              </TabsContent>

              <TabsContent value="pontos" className="pt-4 space-y-4">
                <div className="bg-secondary/20 border border-border rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-body text-xs text-muted-foreground">Saldo atual</div>
                    <div className="font-heading text-2xl">{Number(selected.points_balance ?? 0) || 0} pontos</div>
                    <div className="font-body text-xs text-muted-foreground">1 ponto = 0,01€</div>
                  </div>
                  {selected.is_admin ? <Badge className="bg-primary text-primary-foreground text-[10px]">Admin</Badge> : null}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                    <div className="font-heading text-base">Ajustar (+ / -)</div>
                    <div>
                      <Label className="font-body text-xs">Delta de pontos</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder="Ex: 50 ou -20"
                        value={pointsForm.delta}
                        onChange={(e) => setPointsForm((p) => ({ ...p, delta: e.target.value }))}
                        className="rounded-none mt-1"
                      />
                    </div>
                    <div>
                      <Label className="font-body text-xs">Motivo (opcional)</Label>
                      <Input
                        placeholder="Ex: compensação / bónus"
                        value={pointsForm.reason}
                        onChange={(e) => setPointsForm((p) => ({ ...p, reason: e.target.value }))}
                        className="rounded-none mt-1"
                      />
                    </div>
                    <Button
                      className="w-full rounded-none font-body text-sm tracking-wider"
                      disabled={pointsMutation.isPending || String(pointsForm.delta).trim() === '' || Number(pointsForm.delta) === 0}
                      onClick={() => {
                        const delta = Number(pointsForm.delta);
                        pointsMutation.mutate({
                          id: selected.id,
                          data: {
                            points_delta: delta,
                            points_reason: pointsForm.reason?.trim() || null,
                          },
                        });
                        setPointsForm((p) => ({ ...p, delta: '' }));
                      }}
                    >
                      Aplicar ajuste
                    </Button>
                  </div>

                  <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                    <div className="font-heading text-base">Definir saldo</div>
                    <div>
                      <Label className="font-body text-xs">Novo saldo</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={pointsForm.balance}
                        onChange={(e) => setPointsForm((p) => ({ ...p, balance: e.target.value }))}
                        className="rounded-none mt-1"
                      />
                    </div>
                    <div>
                      <Label className="font-body text-xs">Motivo (opcional)</Label>
                      <Input
                        placeholder="Ex: correção manual"
                        value={pointsForm.reason}
                        onChange={(e) => setPointsForm((p) => ({ ...p, reason: e.target.value }))}
                        className="rounded-none mt-1"
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="w-full rounded-none font-body text-sm tracking-wider"
                      disabled={pointsMutation.isPending || String(pointsForm.balance).trim() === '' || Number(pointsForm.balance) < 0}
                      onClick={() => {
                        const next = Number(pointsForm.balance);
                        pointsMutation.mutate({
                          id: selected.id,
                          data: {
                            points_balance: next,
                            points_reason: pointsForm.reason?.trim() || null,
                          },
                        });
                      }}
                    >
                      Definir saldo
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="encomendas" className="pt-4 space-y-3">
                {userOrdersQuery.isLoading ? (
                  <p className="font-body text-sm text-muted-foreground">A carregar...</p>
                ) : (userOrdersQuery.data ?? []).length === 0 ? (
                  <p className="font-body text-sm text-muted-foreground">Sem encomendas</p>
                ) : (
                  <div className="space-y-2">
	                    {(userOrdersQuery.data ?? []).map((o) => (
	                      <div key={o.id} className="p-3 rounded-md border border-border bg-secondary/20">
	                        <div className="flex items-center justify-between gap-4 flex-wrap">
	                          <div>
	                            <p className="font-body text-sm font-medium" title={String(o.id)}>
	                              {entityCode({ entityType: 'Order', entityId: o.id, createdDate: o.created_date })}
	                            </p>
	                            <p className="font-body text-xs text-muted-foreground">
	                              {new Date(o.created_date).toLocaleDateString('pt-PT')}
	                            </p>
	                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-secondary text-foreground text-[10px]">{o.status}</Badge>
                            <span className="font-body text-sm font-semibold">{o.total?.toFixed?.(2) ?? o.total} €</span>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {(o.items ?? []).slice(0, 3).map((it, idx) => (
                            <span key={idx}>
                              {it.product_name} x{it.quantity}
                              {idx < Math.min((o.items ?? []).length, 3) - 1 ? ' · ' : ''}
                            </span>
                          ))}
                          {(o.items ?? []).length > 3 ? <span> · +{(o.items ?? []).length - 3} itens</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="favoritos" className="pt-4 space-y-3">
                {userWishlistQuery.isLoading ? (
                  <p className="font-body text-sm text-muted-foreground">A carregar...</p>
                ) : (userWishlistQuery.data ?? []).length === 0 ? (
                  <div className="text-center py-6">
                    <Heart className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="font-body text-sm text-muted-foreground">Sem favoritos</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
	                    {(userWishlistQuery.data ?? []).map((w) => (
	                      <div key={w.id} className="flex gap-3 p-3 rounded-md border border-border bg-secondary/20">
                        <div className="w-14 h-14 rounded-md overflow-hidden bg-secondary/40 shrink-0">
                          <ImageWithFallback
                            src={w.product_image}
                            alt={w.product_name || ''}
                            className="w-full h-full"
                            iconClassName="w-6 h-6 text-muted-foreground/40"
                          />
                        </div>
	                        <div className="min-w-0">
	                          <p className="font-body text-sm font-medium truncate">{w.product_name ?? w.product_id}</p>
	                          {w.product_id ? (
	                            <p className="font-body text-[11px] text-muted-foreground truncate" title={String(w.product_id)}>
	                              {entityCode({ entityType: 'Product', entityId: w.product_id, createdDate: w.created_date })}
	                            </p>
	                          ) : null}
	                          <p className="font-body text-xs text-muted-foreground">
	                            {w.product_price !== null && w.product_price !== undefined
	                              ? `${Number(w.product_price).toFixed(2)} €`
	                              : '-'}
	                          </p>
                          <p className="font-body text-xs text-muted-foreground">
                            {new Date(w.created_date).toLocaleDateString('pt-PT')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
