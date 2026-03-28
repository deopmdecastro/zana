import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { MessageSquare, X, Send, RotateCcw, MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';

import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/toast';

const SUPPORT_SUGGESTIONS = [
  { value: 'encomendas', label: 'Encomendas' },
  { value: 'pagamentos', label: 'Pagamentos' },
  { value: 'envios', label: 'Envios' },
  { value: 'trocas', label: 'Trocas / Devoluções' },
  { value: 'produto', label: 'Produto' },
  { value: 'outro', label: 'Outro' },
];

let supportChatApiSupported = null;
try {
  if (typeof window !== 'undefined' && window?.localStorage?.getItem) {
    const saved = window.localStorage.getItem('zana_supportChatApiSupported');
    if (saved === 'true') supportChatApiSupported = true;
    if (saved === 'false') supportChatApiSupported = false;
  }
} catch {}
function markSupportChatApiSupported(next) {
  supportChatApiSupported = typeof next === 'boolean' ? next : null;
  try {
    if (typeof window === 'undefined' || !window?.localStorage) return;
    if (supportChatApiSupported === null) window.localStorage.removeItem('zana_supportChatApiSupported');
    else window.localStorage.setItem('zana_supportChatApiSupported', supportChatApiSupported ? 'true' : 'false');
  } catch {}
}

function formatWhen(value) {
  try {
    return new Date(value).toLocaleString('pt-PT');
  } catch {
    return '';
  }
}

async function fetchSupportChatThread() {
  if (supportChatApiSupported === false) {
    const tickets = await base44.support.tickets.list(50);
    const openTicket = (Array.isArray(tickets) ? tickets : []).find((t) => String(t?.status ?? '') !== 'closed');
    if (!openTicket?.id) return { ticket: null, messages: [] };
    return await base44.support.tickets.get(openTicket.id);
  }

  try {
    const thread = await base44.support.chat.get();
    markSupportChatApiSupported(true);
    return thread;
  } catch (err) {
    if (err?.status !== 404) throw err;
    markSupportChatApiSupported(false);

    // Fallback: older backend without /api/support/chat endpoints.
    const tickets = await base44.support.tickets.list(50);
    const openTicket = (Array.isArray(tickets) ? tickets : []).find((t) => String(t?.status ?? '') !== 'closed');
    if (!openTicket?.id) return { ticket: null, messages: [] };
    return await base44.support.tickets.get(openTicket.id);
  }
}

export default function SupportChatWidget() {
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const [showOther, setShowOther] = useState(false);

  const path = location.pathname ?? '';
  const hidden = path.startsWith('/admin') || path.startsWith('/suporte');

  const { data, isLoading } = useQuery({
    queryKey: ['support-chat'],
    queryFn: fetchSupportChatThread,
    enabled: !!user && open && !hidden,
    refetchInterval: open ? 10_000 : false,
  });

  const messages = useMemo(() => (Array.isArray(data?.messages) ? data.messages : []), [data]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, messages.length]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus?.(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const sendMutation = useMutation({
    mutationFn: async (message) => {
      if (supportChatApiSupported === false) {
        const ticketId = data?.ticket?.id;
        if (ticketId) {
          const msg = await base44.support.tickets.addMessage(ticketId, message);
          return { ticket_id: ticketId, created_ticket: false, message: msg };
        }
        const created = await base44.support.tickets.create({ subject: 'Chat / Suporte', message });
        return { ticket_id: created?.ticket?.id ?? null, created_ticket: true, message: null };
      }
      try {
        const result = await base44.support.chat.send(message);
        markSupportChatApiSupported(true);
        return result;
      } catch (err) {
        if (err?.status !== 404) throw err;
        markSupportChatApiSupported(false);

        const ticketId = data?.ticket?.id;
        if (ticketId) {
          const msg = await base44.support.tickets.addMessage(ticketId, message);
          return { ticket_id: ticketId, created_ticket: false, message: msg };
        }
        const created = await base44.support.tickets.create({ subject: 'Chat / Suporte', message });
        return { ticket_id: created?.ticket?.id ?? null, created_ticket: true, message: null };
      }
    },
    onSuccess: async () => {
      setDraft('');
      await queryClient.invalidateQueries({ queryKey: ['support-chat'] });
      await queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível enviar.')),
  });

  const openMutation = useMutation({
    mutationFn: async () => {
      if (supportChatApiSupported === false) {
        // Older backend: ticket is created on first message.
        return { ok: true, ticket_id: null, created_ticket: false };
      }
      try {
        const result = await base44.support.chat.open();
        markSupportChatApiSupported(true);
        return result;
      } catch (err) {
        if (err?.status !== 404) throw err;
        markSupportChatApiSupported(false);
        // Older backend without /api/support/chat/open; ticket will be created on first message.
        return { ok: true, ticket_id: null, created_ticket: false };
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['support-chat'] });
      await queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Suporte aberto');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível abrir suporte.')),
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (supportChatApiSupported === false) return { ok: true };
      try {
        const result = await base44.support.chat.close();
        markSupportChatApiSupported(true);
        return result;
      } catch (err) {
        if (err?.status !== 404) throw err;
        markSupportChatApiSupported(false);
        const ticketId = data?.ticket?.id;
        if (!ticketId) return { ok: true };
        // Fallback: no chat close endpoint yet; just collapse the widget.
        return { ok: true };
      }
    },
    onSuccess: async () => {
      queryClient.setQueryData(['support-chat'], { ticket: null, messages: [] });
      await queryClient.invalidateQueries({ queryKey: ['support-chat'] });
      await queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Chat encerrado');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível encerrar.')),
  });

  const handleOpen = () => {
    if (!user) {
      toast.error('Inicie sessão para falar com o suporte.');
      setOpen(true);
      return;
    }
    setOpen(true);
  };

  const handleSend = () => {
    const msg = draft.trim();
    if (!msg) return;
    if (!user) {
      toast.error('Inicie sessão para enviar mensagem.');
      return;
    }
    sendMutation.mutate(msg);
  };

  if (hidden) return null;

  const hasTicket = !!data?.ticket?.id;
  const hasMessages = messages.length > 0;
  const displayNameRaw = user?.full_name || user?.email || 'Cliente';
  const displayName = String(displayNameRaw).includes('@') ? String(displayNameRaw).split('@')[0] : String(displayNameRaw);

  const handleSuggestion = (value) => {
    if (!user) {
      toast.error('Inicie sessão para enviar mensagem.');
      return;
    }

    if (value === 'outro') {
      setShowOther(true);
      window.setTimeout(() => inputRef.current?.focus?.(), 0);
      return;
    }

    const label = SUPPORT_SUGGESTIONS.find((s) => s.value === value)?.label ?? value;
    const msg = `Olá, sou ${displayName}. Preciso de ajuda com ${String(label).toLowerCase()}.`;
    sendMutation.mutate(msg);
    setShowOther(false);
  };

  return (
    <div className="fixed right-5 z-50" style={{ bottom: 'calc(20px + var(--zana-cookie-banner-offset, 0px))' }}>
      {!open ? (
        <Button className="rounded-full h-12 px-4 font-body text-sm tracking-wide shadow-lg gap-2" onClick={handleOpen}>
          <MessageSquare className="w-4 h-4" />
          Suporte
        </Button>
      ) : null}

      {open ? (
        <div className="w-[340px] sm:w-[380px] h-[520px] max-h-[calc(100vh-120px)] bg-card border border-border shadow-2xl rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-card/95 backdrop-blur-md">
            <div className="min-w-0">
              <div className="font-heading text-base">Chat / Suporte</div>
              <div className="font-body text-[11px] text-muted-foreground truncate">
                {user ? 'Responderemos o mais rápido possível.' : 'Faça login para enviar mensagens.'}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {hasTicket ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label="Encerrar suporte"
                  title="Encerrar suporte"
                  disabled={!user || closeMutation.isPending}
                  onClick={() => closeMutation.mutate()}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label="Abrir suporte"
                  title="Abrir suporte"
                  disabled={!user || openMutation.isPending}
                  onClick={() => openMutation.mutate()}
                >
                  <MessageSquarePlus className="w-4 h-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setOpen(false)} aria-label="Fechar">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {!user ? (
            <div className="p-4 flex-1 flex flex-col justify-center items-start gap-3">
              <p className="font-body text-sm text-muted-foreground">
                Para falar com o suporte, precisa de iniciar sessão.
              </p>
              <Link to="/conta">
                <Button className="rounded-none font-body text-sm tracking-wider">Entrar</Button>
              </Link>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-3 bg-background">
                {isLoading ? (
                  <div className="font-body text-sm text-muted-foreground">A carregar…</div>
                ) : !hasMessages ? (
                  <div className="space-y-3">
                    <div className="border border-border rounded-lg p-3 bg-secondary/10">
                      <div className="font-body text-sm">
                        Olá, <span className="font-medium">{displayName}</span>. Em que podemos ajudar?
                      </div>
                      <div className="font-body text-[11px] text-muted-foreground mt-1">
                        Escolha uma opção ou escreva a sua dúvida.
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {SUPPORT_SUGGESTIONS.filter((s) => s.value !== 'outro').map((s) => (
                        <Button
                          key={s.value}
                          variant="outline"
                          className="rounded-md font-body text-xs justify-start"
                          disabled={sendMutation.isPending}
                          onClick={() => handleSuggestion(s.value)}
                        >
                          {s.label}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        className="rounded-md font-body text-xs justify-start col-span-2"
                        disabled={sendMutation.isPending}
                        onClick={() => handleSuggestion('outro')}
                      >
                        Outro (escrever dúvida)
                      </Button>
                    </div>

                    {showOther ? (
                      <div className="font-body text-xs text-muted-foreground">
                        Escreva a sua dúvida abaixo e carregue Enter para enviar.
                      </div>
                    ) : null}
                  </div>
                ) : (
                  messages.map((m) => {
                    const mine = m.author_type === 'customer';
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[92%] rounded-md px-3 py-2 border ${
                            mine ? 'bg-primary text-primary-foreground border-primary/30' : 'bg-secondary/20 border-border'
                          }`}
                        >
                          <div className="whitespace-pre-wrap font-body text-sm leading-relaxed">{m.message}</div>
                          <div className={`mt-1 font-body text-[10px] ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {formatWhen(m.created_date)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-3 border-t border-border bg-card">
                <div className="flex items-end gap-2">
                  <Textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="rounded-md min-h-[44px] max-h-[120px]"
                    placeholder="Escreva a sua mensagem…"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <Button
                    className="rounded-md h-11 w-11 p-0 shrink-0"
                    onClick={handleSend}
                    disabled={sendMutation.isPending}
                    aria-label="Enviar"
                    title="Enviar"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <div className="font-body text-[10px] text-muted-foreground mt-2">
                  Enter para enviar · Shift+Enter para nova linha
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
