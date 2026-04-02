import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, Eye, Search, KeyRound } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';
import LoadMoreControls from '@/components/ui/load-more-controls';

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [form, setForm] = useState(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users-admin', limit],
    queryFn: () => base44.entities.User.list('-created_date', limit),
    select: (data) => (Array.isArray(data) ? data.filter((u) => Boolean(u?.is_admin)) : []),
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
    onSuccess: () => toast.success('Email de redefinição enviado'),
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível enviar a redefinição de senha.')),
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
      is_admin: Boolean(u.is_admin),
    });
  };

  const save = () => {
    if (!selected?.id || !form) return;
    updateMutation.mutate({ id: selected.id, data: form });
  };

  const sendReset = () => {
    const email = String(selected?.email ?? '').trim();
    if (!email) return;
    if (!window.confirm(`Enviar email de redefinição de senha para ${email}?`)) return;
    resetMutation.mutate({ email });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl">Usuários</h1>
          <p className="font-body text-xs text-muted-foreground mt-1">Contas com acesso ao painel de administração.</p>
        </div>
        <div className="relative w-72 max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome, email, telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-none font-body text-sm"
          />
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <table className="w-full">
          <thead className="bg-secondary/30">
            <tr>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Nome</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Email</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Telefone</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Registo</th>
              <th className="text-right p-3 font-body text-xs text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="border-t border-border hover:bg-secondary/10">
                <td className="p-3 font-body text-sm truncate max-w-[220px]">{user.full_name || '-'}</td>
                <td className="p-3 font-body text-sm truncate max-w-[260px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{user.email || '-'}</span>
                    <Badge className="bg-primary text-primary-foreground text-[10px] rounded-none shrink-0">Admin</Badge>
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
        {filteredUsers.length === 0 && (
          <div className="text-center py-8">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="font-body text-sm text-muted-foreground">Sem usuários</p>
          </div>
        )}
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
        }}
      >
        <DialogContent className="w-[calc(100vw-32px)] sm:w-full max-w-2xl overflow-hidden rounded-2xl p-0">
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
                <div className="flex items-end justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.is_admin} onCheckedChange={(v) => setForm((p) => ({ ...p, is_admin: v }))} />
                    <Label className="font-body text-xs">Admin</Label>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-none font-body text-xs gap-2"
                    onClick={sendReset}
                    disabled={resetMutation.isPending}
                    title="Envia um email com link para redefinir a senha"
                  >
                    <KeyRound className="w-4 h-4" />
                    Redefinir senha
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={save}
                  className="flex-1 rounded-none font-body text-sm tracking-wider"
                  disabled={updateMutation.isPending}
                >
                  Guardar alterações
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-none font-body text-sm"
                  onClick={() => {
                    setSelected(null);
                    setForm(null);
                  }}
                >
                  Fechar
                </Button>
              </div>

              <p className="font-body text-[11px] text-muted-foreground">
                A redefinição de senha envia um link por email para o usuário definir uma nova palavra-passe.
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

