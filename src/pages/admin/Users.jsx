import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, Eye, Search, KeyRound, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';
import LoadMoreControls from '@/components/ui/load-more-controls';
import EmptyState from '@/components/ui/empty-state';

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [form, setForm] = useState(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    full_name: '',
    phone: '',
    is_admin: false,
    is_seller: true,
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users-admin', limit],
    queryFn: () => base44.entities.User.list('-created_date', limit),
    select: (data) => (Array.isArray(data) ? data.filter((u) => Boolean(u?.is_admin) || Boolean(u?.is_seller)) : []),
  });

  const canLoadMore = !isLoading && Array.isArray(users) && users.length === limit && limit < 500;

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users-admin'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Usuário atualizado');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível atualizar o usuário.')),
  });

  const resetMutation = useMutation({
    mutationFn: ({ email }) => base44.auth.requestPasswordReset({ email }),
    onSuccess: (data) => {
      toast.success('Email de redefinição enviado');
      if (data?.resetToken) toast.message('Token de redefinição (dev)', { description: data.resetToken });
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível enviar a redefinição de senha.')),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => base44.entities.User.create(payload),
    onSuccess: async (res) => {
      const created = res?.user ?? null;
      await queryClient.invalidateQueries({ queryKey: ['admin-users-admin'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Usuário criado');
      if (res?.temp_password) toast.message('Senha temporária (dev)', { description: res.temp_password });
      if (res?.resetToken) toast.message('Token de redefinição (dev)', { description: res.resetToken });
      setCreateOpen(false);
      setCreateForm({ email: '', full_name: '', phone: '', is_admin: false, is_seller: true });
      if (created) openUser(created);
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível criar o usuário.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.User.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users-admin'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Usuário removido');
      setSelected(null);
      setForm(null);
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível remover o usuário.')),
  });

  const createUser = () => {
    const email = String(createForm.email ?? '').trim();
    if (!email) return toast.error('Preencha o email.');
    if (!createForm.is_admin && !createForm.is_seller) return toast.error('Selecione Admin ou Vendedor.');
    createMutation.mutate({
      email,
      full_name: createForm.full_name,
      phone: createForm.phone,
      is_admin: createForm.is_admin,
      is_seller: createForm.is_seller,
    });
  };

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
      is_admin: Boolean(u.is_admin),
      is_seller: Boolean(u.is_seller),
    });
  };

  const save = () => {
    if (!selected?.id || !form) return;
    updateMutation.mutate({ id: selected.id, data: form });
  };

  const sendReset = () => {
    const email = String(selected?.email ?? '').trim();
    if (!email) return;
    setConfirmResetOpen(true);
  };

  const deleteUser = () => {
    if (!selected?.id) return;
    setConfirmDeleteOpen(true);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div className="w-full">
          <h1 className="font-heading text-3xl">Usuários</h1>
          <p className="font-body text-xs text-muted-foreground mt-1">Contas de staff (admin e vendedor).</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto sm:justify-end">
          <Button
            type="button"
            className="rounded-none font-body text-sm gap-2 w-full sm:w-auto"
            onClick={() => setCreateOpen(true)}
            title="Criar novo usuário (staff)"
          >
            <Plus className="w-4 h-4" />
            Novo
          </Button>
          <div className="relative w-full sm:w-72 max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, email, telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-none font-body text-sm"
            />
          </div>
        </div>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
          <thead className="bg-secondary/30">
            <tr>
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Nome</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Email</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Telefone</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Registo</th>
              <th className="text-right p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="border-t border-border hover:bg-secondary/10">
                <td className="p-3 font-body text-sm truncate max-w-[220px]">{user.full_name || '-'}</td>
                <td className="p-3 font-body text-sm truncate max-w-[260px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{user.email || '-'}</span>
                    {user.is_admin ? (
                      <Badge className="bg-primary text-primary-foreground text-[10px] rounded-none shrink-0">Admin</Badge>
                    ) : null}
                    {user.is_seller ? (
                      <Badge className="bg-secondary text-foreground text-[10px] rounded-none shrink-0">Vendedor</Badge>
                    ) : null}
                  </div>
                </td>
                <td className="p-3 font-body text-sm text-muted-foreground whitespace-nowrap">{user.phone || '-'}</td>
                <td className="p-3 font-body text-xs text-muted-foreground whitespace-nowrap">
                  {user.created_date ? new Date(user.created_date).toLocaleDateString('pt-PT') : '-'}
                </td>
                <td className="p-3 text-right">
                  <Button variant="ghost" size="icon" onClick={() => openUser(user)} title="Ver / editar">
                    <Eye className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
        {isLoading && (Array.isArray(users) ? users.length : 0) === 0 ? (
          <EmptyState icon={Users} description="A carregar..." className="py-8" />
        ) : filteredUsers.length === 0 ? (
          <EmptyState icon={Users} description="Sem usuários" className="py-8" />
        ) : null}
      </div>

      <LoadMoreControls
        leftText={`A mostrar ${Math.min(limit, Array.isArray(users) ? users.length : 0)} usuários${search.trim() ? ` (${filteredUsers.length} filtrados)` : ''}.`}
        onLess={() => setLimit(50)}
        lessDisabled={isLoading || limit <= 50}
        onMore={() => setLimit((p) => Math.min(500, p + 50))}
        moreDisabled={!canLoadMore}
      />

      <Dialog
        open={!!selected}
        onOpenChange={() => {
          setSelected(null);
          setForm(null);
          setConfirmResetOpen(false);
          setConfirmDeleteOpen(false);
        }}
      >
        <DialogContent aria-describedby={undefined} className="w-[calc(100vw-32px)] sm:w-full max-w-2xl overflow-hidden rounded-2xl p-0">
          {selected && form ? (
            <div className="p-6 space-y-4">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl">Usuário</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-body text-xs">Email</Label>
                  <Input value={selected.email ?? ''} disabled className="rounded-none mt-1" />
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
                <div className="md:col-span-2 rounded-lg border border-border bg-secondary/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Switch checked={form.is_admin} onCheckedChange={(v) => setForm((p) => ({ ...p, is_admin: v }))} />
                      <Label className="font-body text-xs">Admin</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={form.is_seller} onCheckedChange={(v) => setForm((p) => ({ ...p, is_seller: v }))} />
                      <Label className="font-body text-xs">Vendedor</Label>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-none font-body text-xs gap-2 w-full sm:w-auto"
                      onClick={sendReset}
                      disabled={resetMutation.isPending}
                      title="Envia um email com link para redefinir a senha"
                    >
                      <KeyRound className="w-4 h-4" />
                      Redefinir senha
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="rounded-none font-body text-xs gap-2 w-full sm:w-auto"
                      onClick={deleteUser}
                      disabled={deleteMutation.isPending}
                      title="Remove o acesso do usuário"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remover
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-none font-body text-sm w-full sm:w-auto"
                  onClick={() => {
                    setSelected(null);
                    setForm(null);
                  }}
                >
                  Fechar
                </Button>
                <Button
                  onClick={save}
                  className="rounded-none font-body text-sm tracking-wider w-full sm:w-auto"
                  disabled={updateMutation.isPending}
                >
                  Guardar alterações
                </Button>
              </div>

              <p className="font-body text-[11px] text-muted-foreground">
                A redefinição de senha envia um link por email para o usuário definir uma nova palavra-passe.
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar redefinição de senha?</AlertDialogTitle>
            <AlertDialogDescription>
              Vai ser enviado um email com link para o usuário definir uma nova palavra-passe.
              {selected?.email ? ` (${String(selected.email)})` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={resetMutation.isPending}
              onClick={() => {
                const email = String(selected?.email ?? '').trim();
                if (!email) return;
                resetMutation.mutate({ email });
              }}
            >
              Enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação desativa o acesso imediatamente.
              {selected?.email ? ` (${String(selected.email)})` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (!selected?.id) return;
                deleteMutation.mutate(selected.id);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateForm({ email: '', full_name: '', phone: '', is_admin: false, is_seller: true });
        }}
      >
        <DialogContent aria-describedby={undefined} className="w-[calc(100vw-32px)] sm:w-full max-w-2xl overflow-hidden rounded-2xl p-0">
          <div className="p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl">Novo usuário</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="font-body text-xs">Email</Label>
                <Input
                  value={createForm.email}
                  onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                  className="rounded-none mt-1"
                  placeholder="ex: vendedor@zana.local"
                />
              </div>
              <div>
                <Label className="font-body text-xs">Nome</Label>
                <Input
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, full_name: e.target.value }))}
                  className="rounded-none mt-1"
                />
              </div>
              <div>
                <Label className="font-body text-xs">Telefone</Label>
                <Input
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))}
                  className="rounded-none mt-1"
                />
              </div>

              <div className="md:col-span-2 rounded-lg border border-border bg-secondary/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Switch checked={createForm.is_admin} onCheckedChange={(v) => setCreateForm((p) => ({ ...p, is_admin: v }))} />
                    <Label className="font-body text-xs">Admin</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={createForm.is_seller} onCheckedChange={(v) => setCreateForm((p) => ({ ...p, is_seller: v }))} />
                    <Label className="font-body text-xs">Vendedor</Label>
                  </div>
                </div>
                <div className="font-body text-[11px] text-muted-foreground">
                  Ao criar, geramos um link/token para definir a palavra-passe.
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-none font-body text-sm w-full sm:w-auto"
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="rounded-none font-body text-sm tracking-wider w-full sm:w-auto"
                onClick={createUser}
                disabled={createMutation.isPending}
              >
                Criar usuário
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
