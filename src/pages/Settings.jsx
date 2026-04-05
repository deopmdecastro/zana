import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Settings as SettingsIcon, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import Auth from './Auth';
import { useAuth } from '@/lib/AuthContext';
import { useConfirm } from '@/components/ui/confirm-provider';

export default function Settings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { logout } = useAuth();

  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const [form, setForm] = useState({
    newsletter_opt_in: false,
    order_updates_email: true,
  });
  const [initialForm, setInitialForm] = useState(null);

  useEffect(() => {
    if (!user) return;
    const next = {
      newsletter_opt_in: Boolean(user.settings?.newsletter_opt_in),
      order_updates_email: user.settings?.order_updates_email !== false,
    };
    setForm(next);
    setInitialForm(next);
  }, [user]);

  const isDirty = useMemo(() => {
    if (!initialForm) return false;
    return JSON.stringify(form) !== JSON.stringify(initialForm);
  }, [form, initialForm]);

  const saveMutation = useMutation({
    mutationFn: (patch) => base44.user.updateMe(patch),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['me'], updatedUser);
      toast.success('Definições guardadas.');
      setInitialForm(form);
    },
    onError: (err) => {
      const code = err?.data?.error ?? err?.message;
      if (code === 'unauthorized') {
        toast.error('A sua sessão expirou. Inicie sessão novamente.');
        queryClient.setQueryData(['me'], null);
        logout();
        navigate('/conta', { replace: true });
        return;
      }
      toast.error('Não foi possível guardar as definições.');
    },
  });

  const handleSave = () => {
    saveMutation.mutate(form);
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
    onError: () => toast.error('Não foi possível remover a conta.'),
  });

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-heading text-3xl md:text-4xl">Definições</h1>
            <p className="font-body text-sm text-muted-foreground mt-1">Preferências da conta</p>
          </div>
        </div>

        <Button
          className="rounded-none font-body text-sm gap-2"
          disabled={!isDirty || saveMutation.isPending}
          onClick={handleSave}
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? 'A guardar...' : 'Guardar'}
        </Button>
      </div>

      <div className="bg-card p-6 rounded-lg border border-border">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-body text-sm font-medium">Newsletter</p>
              <p className="font-body text-xs text-muted-foreground">Receber novidades e promoções</p>
            </div>
            <Switch
              checked={form.newsletter_opt_in}
              onCheckedChange={(v) => setForm((p) => ({ ...p, newsletter_opt_in: v }))}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-body text-sm font-medium">Atualizações por email</p>
              <p className="font-body text-xs text-muted-foreground">Estado das encomendas e avisos</p>
            </div>
            <Switch
              checked={form.order_updates_email}
              onCheckedChange={(v) => setForm((p) => ({ ...p, order_updates_email: v }))}
            />
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-lg border border-destructive/30 mt-10">
        <h2 className="font-heading text-xl mb-2 text-destructive">Zona de perigo</h2>
        <p className="font-body text-sm text-muted-foreground">
          Ao apagar a conta, deixa de conseguir aceder ao site com este utilizador.
        </p>
        <div className="mt-4">
          <Button
            variant="destructive"
            className="rounded-none font-body text-sm gap-2"
            disabled={deleteAccountMutation.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: 'Apagar conta?',
                description: 'Tem certeza que deseja apagar a sua conta?',
                confirmText: 'Apagar',
                cancelText: 'Cancelar',
                destructive: true,
              });
              if (!ok) return;
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
