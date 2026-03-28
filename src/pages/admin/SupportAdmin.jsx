import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';

function statusLabel(status) {
  return status === 'closed' ? 'Fechado' : 'Aberto';
}

export default function SupportAdmin() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [reply, setReply] = useState('');

  const { data: tickets = [], isLoading: isLoadingTickets } = useQuery({
    queryKey: ['admin-support-tickets'],
    queryFn: () => base44.admin.support.tickets.list(500),
  });

  const sortedTickets = useMemo(() => {
    return [...(tickets ?? [])].sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date));
  }, [tickets]);

  const { data: thread, isLoading: isLoadingThread } = useQuery({
    queryKey: ['admin-support-ticket', selectedId],
    queryFn: () => base44.admin.support.tickets.get(selectedId),
    enabled: !!selectedId,
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, message }) => base44.admin.support.tickets.addMessage(id, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-ticket'] });
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      setReply('');
      toast.success('Enviado');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível enviar.')),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.admin.support.tickets.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-ticket'] });
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      toast.success('Atualizado');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível atualizar.')),
  });

  const submitReply = () => {
    if (!selectedId) return;
    if (!reply.trim()) return toast.error('Escreva uma mensagem');
    replyMutation.mutate({ id: selectedId, message: reply.trim() });
  };

  const ticket = thread?.ticket ?? null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl">Suporte</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">Pedidos de ajuda enviados pelos clientes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="font-heading text-lg">Tickets</div>
            <div className="font-body text-xs text-muted-foreground">{sortedTickets.length}</div>
          </div>

          {isLoadingTickets ? (
            <div className="p-4 font-body text-sm text-muted-foreground">A carregar...</div>
          ) : sortedTickets.length === 0 ? (
            <div className="p-4 font-body text-sm text-muted-foreground">Sem tickets.</div>
          ) : (
            <div className="divide-y divide-border">
              {sortedTickets.map((t) => {
                const active = t.id === selectedId;
                return (
                  <button
                    key={t.id}
                    className={`w-full text-left p-4 hover:bg-secondary/30 transition-colors ${active ? 'bg-secondary/30' : ''}`}
                    onClick={() => setSelectedId(t.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-body text-sm font-medium line-clamp-1">{t.subject}</div>
                        <div className="font-body text-xs text-muted-foreground mt-1 line-clamp-1">
                          {t.customer_email ?? '—'}
                        </div>
                      </div>
                      <Badge className={`${t.status === 'closed' ? 'bg-secondary text-foreground' : 'bg-green-100 text-green-800'} text-[10px]`}>
                        {statusLabel(t.status)}
                      </Badge>
                    </div>
                    <div className="font-body text-xs text-muted-foreground mt-2">
                      Atualizado: {new Date(t.updated_date).toLocaleString('pt-PT')}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-3 bg-card border border-border rounded-lg overflow-hidden flex flex-col min-h-[520px]">
          <div className="p-4 border-b border-border flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="font-heading text-lg">Conversa</div>
              <div className="font-body text-xs text-muted-foreground mt-1">
                {selectedId ? `Ticket: ${selectedId}` : 'Selecione um ticket à esquerda.'}
              </div>
              {ticket?.customer_email ? (
                <div className="font-body text-xs text-muted-foreground mt-1">Cliente: {ticket.customer_email}</div>
              ) : null}
            </div>
            {ticket ? (
              <Button
                variant="outline"
                className="rounded-none font-body text-xs"
                onClick={() => statusMutation.mutate({ id: ticket.id, status: ticket.status === 'closed' ? 'open' : 'closed' })}
              >
                {ticket.status === 'closed' ? 'Reabrir' : 'Fechar'}
              </Button>
            ) : null}
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            {!selectedId ? (
              <div className="font-body text-sm text-muted-foreground">Escolha um ticket para ver as mensagens.</div>
            ) : isLoadingThread ? (
              <div className="font-body text-sm text-muted-foreground">A carregar...</div>
            ) : (
              <div className="space-y-3">
                {(thread?.messages ?? []).map((m) => {
                  const mine = m.author_type === 'admin';
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[92%] sm:max-w-[75%] rounded-md px-3 py-2 border ${
                          mine ? 'bg-primary text-primary-foreground border-primary/30' : 'bg-secondary/20 border-border'
                        }`}
                      >
                        <div className="whitespace-pre-wrap font-body text-sm leading-relaxed">{m.message}</div>
                        <div className={`mt-1 font-body text-[10px] ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {new Date(m.created_date).toLocaleString('pt-PT')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border">
            <Label className="font-body text-xs">Responder</Label>
            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                className="rounded-none min-h-[88px] sm:min-h-[44px] sm:h-[44px]"
                placeholder="Mensagem para o cliente..."
                disabled={!selectedId || ticket?.status === 'closed'}
              />
              <Button
                onClick={submitReply}
                className="rounded-none font-body text-sm tracking-wider sm:w-40"
                disabled={!selectedId || ticket?.status === 'closed'}
              >
                Enviar
              </Button>
            </div>
            {ticket?.status === 'closed' ? (
              <div className="font-body text-xs text-muted-foreground mt-2">Ticket fechado: reabra para responder.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

