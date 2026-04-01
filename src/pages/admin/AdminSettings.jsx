import React, { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import BackupPanel from '@/components/admin/BackupPanel';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';
import { getErrorMessage, toastApiPromise } from '@/lib/toast';
import { useLocation } from 'react-router-dom';

export default function AdminSettings() {
  const { user, setAuthUser, logout } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const hash = String(location.hash ?? '').replace('#', '').trim();
    if (!hash) return;
    const el = document.getElementById(hash);
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [location.hash]);

  const initialEmail = String(user?.email ?? '').trim();
  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  const credentialsMutation = useMutation({
    mutationFn: (payload) => base44.admin.settings.updateCredentials(payload),
  });

  const canSubmitCredentials = useMemo(() => {
    const wantsEmail = String(email ?? '').trim().toLowerCase() !== String(initialEmail ?? '').trim().toLowerCase();
    const wantsPassword = String(newPassword ?? '').length > 0 || String(newPasswordConfirm ?? '').length > 0;
    if (!wantsEmail && !wantsPassword) return false;
    if (!String(currentPassword ?? '').trim()) return false;
    if (wantsPassword && String(newPassword) !== String(newPasswordConfirm)) return false;
    return true;
  }, [currentPassword, email, initialEmail, newPassword, newPasswordConfirm]);

  const saveCredentials = async () => {
    const payload = {
      email: String(email ?? '').trim() || null,
      current_password: String(currentPassword ?? ''),
      new_password: String(newPassword ?? '').trim() || null,
    };

    const result = await toastApiPromise(credentialsMutation.mutateAsync(payload), {
      loading: 'A guardar credenciais...',
      success: 'Credenciais atualizadas.',
      error: (e) => getErrorMessage(e, 'Não foi possível atualizar as credenciais.'),
    });

    if (result?.user) setAuthUser(result.user);
    setCurrentPassword('');
    setNewPassword('');
    setNewPasswordConfirm('');
  };

  const [keepCustomers, setKeepCustomers] = useState(true);
  const [keepProducts, setKeepProducts] = useState(true);
  const [purgePassword, setPurgePassword] = useState('');
  const [purgeConfirm, setPurgeConfirm] = useState('');

  const purgeMutation = useMutation({
    mutationFn: (payload) => base44.admin.settings.purgeDatabase(payload),
  });

  const canPurge = String(purgePassword ?? '').length > 0 && String(purgeConfirm ?? '').trim().toUpperCase() === 'APAGAR';

  const doPurge = async () => {
    const payload = {
      confirm: String(purgeConfirm ?? '').trim(),
      current_password: String(purgePassword ?? ''),
      keep_customers: !!keepCustomers,
      keep_products: !!keepProducts,
    };

    await toastApiPromise(purgeMutation.mutateAsync(payload), {
      loading: 'A limpar base de dados...',
      success: 'Base de dados limpa com sucesso.',
      error: (e) => getErrorMessage(e, 'Não foi possível limpar a base de dados.'),
    });

    // Garante estado consistente (alguns dados podem ter sido removidos).
    logout();
    window.location.assign('/');
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl">Configurações</h1>
        <p className="font-body text-sm text-muted-foreground mt-1">
          Backup, credenciais do admin e ações de manutenção.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="space-y-1">
          <h2 className="font-heading text-2xl">Credenciais do admin</h2>
          <p className="font-body text-sm text-muted-foreground">
            Para segurança, confirme a senha atual antes de guardar alterações.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label className="font-body text-xs">Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-none mt-1" />
          </div>

          <div>
            <Label className="font-body text-xs">Senha atual</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="rounded-none mt-1"
              autoComplete="current-password"
            />
          </div>

          <div />

          <div>
            <Label className="font-body text-xs">Nova senha</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="rounded-none mt-1"
              autoComplete="new-password"
            />
          </div>

          <div>
            <Label className="font-body text-xs">Confirmar nova senha</Label>
            <Input
              type="password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              className="rounded-none mt-1"
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="flex items-center justify-end">
          <Button onClick={saveCredentials} className="rounded-none font-body text-sm tracking-wider" disabled={!canSubmitCredentials}>
            Guardar credenciais
          </Button>
        </div>
      </div>

      <div id="backup">
        <BackupPanel showTitle={false} />
      </div>

      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="space-y-1">
          <h2 className="font-heading text-2xl text-destructive">Zona de perigo</h2>
          <p className="font-body text-sm text-muted-foreground">
            Limpa dados do sistema para recomeçar. Recomendado: exporte um backup antes de continuar.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox checked disabled className="mt-1" />
            <div>
              <div className="font-body text-sm">Manter admins</div>
              <div className="font-body text-xs text-muted-foreground">
                Sempre mantido para não perder acesso ao painel.
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <Checkbox checked={keepCustomers} onCheckedChange={(v) => setKeepCustomers(!!v)} className="mt-1" />
            <div>
              <div className="font-body text-sm">Manter clientes</div>
              <div className="font-body text-xs text-muted-foreground">Mantém contas de clientes e endereços.</div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <Checkbox checked={keepProducts} onCheckedChange={(v) => setKeepProducts(!!v)} className="mt-1" />
            <div>
              <div className="font-body text-sm">Manter produtos</div>
              <div className="font-body text-xs text-muted-foreground">Mantém catálogo e stock (mas limpa encomendas/compras).</div>
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <Label className="font-body text-xs">Confirme com a sua senha atual</Label>
            <Input
              type="password"
              value={purgePassword}
              onChange={(e) => setPurgePassword(e.target.value)}
              className="rounded-none mt-1"
              autoComplete="current-password"
            />
          </div>

          <div>
            <Label className="font-body text-xs">Digite APAGAR para confirmar</Label>
            <Input value={purgeConfirm} onChange={(e) => setPurgeConfirm(e.target.value)} className="rounded-none mt-1" />
          </div>
        </div>

        <div className="flex items-center justify-end">
          <Button variant="destructive" className="rounded-none font-body text-sm tracking-wider" onClick={doPurge} disabled={!canPurge}>
            Limpar base de dados
          </Button>
        </div>
      </div>
    </div>
  );
}
