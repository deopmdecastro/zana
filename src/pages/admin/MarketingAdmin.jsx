import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getErrorMessage } from '@/lib/toast';

const DEFAULT_EMAILS = {
  from_name: 'Zana',
  welcome: { enabled: true, subject: '', html: '', text: '' },
  order: { enabled: true, subject: '', html: '', text: '' },
  campaign: { enabled: true, subject: '', html: '', text: '' },
};

function mergeEmailContent(existing) {
  const v = existing && typeof existing === 'object' ? existing : {};
  return {
    ...DEFAULT_EMAILS,
    ...v,
    welcome: { ...DEFAULT_EMAILS.welcome, ...(v.welcome ?? {}) },
    order: { ...DEFAULT_EMAILS.order, ...(v.order ?? {}) },
    campaign: { ...DEFAULT_EMAILS.campaign, ...(v.campaign ?? {}) },
  };
}

export default function MarketingAdmin() {
  const queryClient = useQueryClient();
  const { data: emailData, isLoading: emailLoading } = useQuery({
    queryKey: ['admin-marketing-email'],
    queryFn: () => base44.admin.marketing.email.get(),
  });

  const initialEmailForm = useMemo(() => mergeEmailContent(emailData?.content), [emailData?.content]);
  const [emailForm, setEmailForm] = useState(initialEmailForm);

  React.useEffect(() => {
    setEmailForm(initialEmailForm);
  }, [initialEmailForm]);

  const updateEmailMutation = useMutation({
    mutationFn: (payload) => base44.admin.marketing.email.update(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-marketing-email'] });
      toast.success('Templates guardados');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível guardar.')),
  });

  const [smtpTestEmail, setSmtpTestEmail] = useState('');
  const smtpTestMutation = useMutation({
    mutationFn: (payload) => base44.admin.smtp.test(payload),
    onSuccess: () => toast.success('Email de teste enviado'),
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível enviar o email de teste.')),
  });

  const { data: subscribers = [] } = useQuery({
    queryKey: ['admin-newsletter-subscribers'],
    queryFn: () => base44.admin.newsletter.subscribers.list({ status: 'subscribed', limit: 500 }),
  });

  const [campaign, setCampaign] = useState({
    audience: 'all',
    subject: 'Novidades Zana',
    content: '',
    test_email: '',
  });

  const sendCampaignMutation = useMutation({
    mutationFn: (payload) => base44.admin.newsletter.send(payload),
    onSuccess: (res) => {
      const sent = Number(res?.sent ?? 0);
      const failed = Number(res?.failed ?? 0);
      const firstFailure = Array.isArray(res?.failures) ? res.failures[0] : null;
      const failureDetail = firstFailure?.error ? ` (${String(firstFailure.error).slice(0, 140)})` : '';

      if (failed > 0) toast.error(`Falhas: ${failed} | Enviado: ${sent}${failureDetail}`);
      else toast.success(`Enviado: ${sent}`);
      setCampaign((p) => ({ ...p, content: '' }));
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível enviar.')),
  });

  const smtpConfigured = !!emailData?.smtp_configured;

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl">Marketing</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">Emails (templates) e newsletter.</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-heading text-2xl flex items-center gap-2">
            <Mail className="w-5 h-5" /> Templates de Email
          </h2>
          <div className="font-body text-xs text-muted-foreground">
            SMTP: {smtpConfigured ? 'Configurado' : 'Não configurado'}
          </div>
        </div>

        <p className="font-body text-sm text-muted-foreground mt-2">
          Variáveis disponíveis:{' '}
          <span className="font-mono">
            {'{{first_name}} {{full_name}} {{email}} {{app_url}} {{store_name}} {{store_email}} {{store_phone}} {{store_address}} {{logo_url}} {{year}} {{instagram_url}} {{instagram_icon_url}}'}
          </span>{' '}
          (encomendas: <span className="font-mono">{'{{order_id}} {{total}} {{customer_name}}'}</span>; campanhas:{' '}
          <span className="font-mono">{'{{content}} {{content_html}} {{unsubscribe_url}}'}</span>).
        </p>

        {emailLoading ? (
          <div className="font-body text-sm text-muted-foreground mt-6">A carregar…</div>
        ) : (
          <div className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="font-body text-xs">Nome do remetente (opcional)</Label>
                <Input
                  value={emailForm.from_name ?? ''}
                  onChange={(e) => setEmailForm((p) => ({ ...p, from_name: e.target.value }))}
                  className="rounded-none mt-1"
                  placeholder="Zana"
                />
              </div>
            </div>

            {[
              { key: 'welcome', label: 'Boas-vindas' },
              { key: 'order', label: 'Compras / Encomendas' },
              { key: 'campaign', label: 'Campanhas / Publicidade' },
            ].map((t) => (
              <div key={t.key} className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="font-heading text-lg">{t.label}</div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={emailForm?.[t.key]?.enabled !== false}
                      onCheckedChange={(v) =>
                        setEmailForm((p) => ({ ...p, [t.key]: { ...p[t.key], enabled: v } }))
                      }
                    />
                    <span className="font-body text-xs text-muted-foreground">Ativo</span>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <Label className="font-body text-xs">Assunto</Label>
                    <Input
                      value={emailForm?.[t.key]?.subject ?? ''}
                      onChange={(e) =>
                        setEmailForm((p) => ({ ...p, [t.key]: { ...p[t.key], subject: e.target.value } }))
                      }
                      className="rounded-none mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="font-body text-xs">HTML</Label>
                      <Textarea
                        value={emailForm?.[t.key]?.html ?? ''}
                        onChange={(e) =>
                          setEmailForm((p) => ({ ...p, [t.key]: { ...p[t.key], html: e.target.value } }))
                        }
                        className="rounded-none mt-1 min-h-[140px]"
                        placeholder="<p>…</p>"
                      />
                    </div>
                    <div>
                      <Label className="font-body text-xs">Texto</Label>
                      <Textarea
                        value={emailForm?.[t.key]?.text ?? ''}
                        onChange={(e) =>
                          setEmailForm((p) => ({ ...p, [t.key]: { ...p[t.key], text: e.target.value } }))
                        }
                        className="rounded-none mt-1 min-h-[140px]"
                        placeholder="…"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Button
              className="w-full rounded-none font-body text-sm tracking-wider"
              disabled={updateEmailMutation.isPending}
              onClick={() => updateEmailMutation.mutate(emailForm)}
            >
              {updateEmailMutation.isPending ? 'A guardar…' : 'Guardar templates'}
            </Button>

            {smtpConfigured ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label className="font-body text-xs">Email de teste</Label>
                  <Input
                    type="email"
                    value={smtpTestEmail}
                    onChange={(e) => setSmtpTestEmail(e.target.value)}
                    className="rounded-none mt-1"
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full rounded-none font-body text-sm tracking-wider"
                    disabled={smtpTestMutation.isPending}
                    onClick={() => {
                      const to = String(smtpTestEmail ?? '').trim();
                      if (!to) return toast.error('Escreva um email.');
                      smtpTestMutation.mutate({ to });
                    }}
                  >
                    {smtpTestMutation.isPending ? 'A enviar…' : 'Enviar email de teste'}
                  </Button>
                </div>
              </div>
            ) : null}

            {!smtpConfigured ? (
              <div className="mt-2 font-body text-xs text-muted-foreground">
                Para enviar emails, define as variáveis no backend: <span className="font-mono">SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASS SMTP_FROM</span>.
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-heading text-2xl">Newsletter</h2>
        <p className="font-body text-sm text-muted-foreground mt-2">
          Subscritores ativos: <span className="font-medium">{Array.isArray(subscribers) ? subscribers.length : 0}</span>
        </p>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="font-body text-xs">Audiência</Label>
              <Select value={campaign.audience} onValueChange={(v) => setCampaign((p) => ({ ...p, audience: v }))}>
                <SelectTrigger className="rounded-none mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos (subscritores + clientes)</SelectItem>
                  <SelectItem value="subscribers">Só subscritores</SelectItem>
                  <SelectItem value="customers">Só clientes (opt-in)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="font-body text-xs">Assunto</Label>
              <Input
                value={campaign.subject}
                onChange={(e) => setCampaign((p) => ({ ...p, subject: e.target.value }))}
                className="rounded-none mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="font-body text-xs">Conteúdo *</Label>
            <Textarea
              value={campaign.content}
              onChange={(e) => setCampaign((p) => ({ ...p, content: e.target.value }))}
              className="rounded-none mt-1 min-h-[180px]"
              placeholder="Escreva a mensagem da campanha…"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="font-body text-xs">Enviar teste para (opcional)</Label>
              <Input
                type="email"
                value={campaign.test_email}
                onChange={(e) => setCampaign((p) => ({ ...p, test_email: e.target.value }))}
                className="rounded-none mt-1"
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="flex items-end">
              <Button
                className="w-full rounded-none font-body text-sm tracking-wider"
                disabled={sendCampaignMutation.isPending}
                onClick={() => {
                  const subject = String(campaign.subject ?? '').trim();
                  const content = String(campaign.content ?? '').trim();
                  if (!subject) return toast.error('Escreva um assunto.');
                  if (!content) return toast.error('Escreva o conteúdo.');
                  const payload = {
                    audience: campaign.audience,
                    subject,
                    content,
                    test_email: String(campaign.test_email ?? '').trim() || null,
                  };
                  sendCampaignMutation.mutate(payload);
                }}
              >
                {sendCampaignMutation.isPending ? 'A enviar…' : 'Enviar campanha'}
              </Button>
            </div>
          </div>

          <div className="font-body text-xs text-muted-foreground">
            O email usa o template “Campanhas / Publicidade” e inclui link de cancelamento automático.
          </div>
        </div>
      </div>
    </div>
  );
}
