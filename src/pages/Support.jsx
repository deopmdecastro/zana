import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';

function statusLabel(status) {
  return status === 'closed' ? 'Fechado' : 'Aberto';
}

const SUPPORT_TOPICS = [
  { value: 'encomendas', label: 'Encomendas' },
  { value: 'pagamentos', label: 'Pagamentos' },
  { value: 'envios', label: 'Envios' },
  { value: 'trocas', label: 'Trocas / Devoluções' },
  { value: 'produto', label: 'Produto' },
  { value: 'outro', label: 'Outro' },
];

export default function Support() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({ topic: '', subject: '', message: '' });
  const [reply, setReply] = useState('');

  const { data: tickets = [], isLoading: isLoadingTickets } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () => base44.support.tickets.list(200),
    enabled: !!user,
  });

  const sortedTickets = useMemo(() => {
    return [...(tickets ?? [])].sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date));
  }, [tickets]);

  const { data: thread, isLoading: isLoadingThread } = useQuery({
    queryKey: ['support-ticket', selectedId],
    queryFn: () => base44.support.tickets.get(selectedId),
    enabled: !!user && !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: (payload) => base44.support.tickets.create(payload),
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      setDialogOpen(false);
      setNewTicket({ topic: '', subject: '', message: '' });
      const id = res?.ticket?.id;
      if (id) setSelectedId(id);
      toast.success('Pedido criado');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível criar.')),
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, message }) => base44.support.tickets.addMessage(id, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-ticket'] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      setReply('');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível enviar.')),
  });

  const submitNew = async () => {
    if (!newTicket.subject.trim() || !newTicket.message.trim()) {
      toast.error('Preencha assunto e mensagem');
      return;
    }
    const topicLabel = SUPPORT_TOPICS.find((t) => t.value === newTicket.topic)?.label ?? '';
    const baseSubject = newTicket.subject.trim();
    const subject = topicLabel && !baseSubject.startsWith('[') ? `[${topicLabel}] ${baseSubject}` : baseSubject;
    createMutation.mutate({ subject, message: newTicket.message.trim() });
  };

  const submitReply = () => {
    if (!selectedId) return;
    if (!reply.trim()) return toast.error('Escreva uma mensagem');
    replyMutation.mutate({ id: selectedId, message: reply.trim() });
  };

  if (!user) {
    return (
      <div className="min-h-screen">
        <div className="bg-primary py-12 md:py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="font-body text-xs tracking-[0.3em] uppercase text-primary-foreground/60 mb-2">Ajuda</p>
            <h1 className="font-heading text-4xl md:text-6xl text-primary-foreground font-light">Suporte</h1>
            <p className="font-body text-sm text-primary-foreground/70 mt-3">Para abrir um pedido de suporte, inicie sessão.</p>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <Link to="/conta" className="inline-flex">
            <Button className="rounded-none font-body text-sm tracking-wider">Entrar</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="bg-primary py-12 md:py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="font-body text-xs tracking-[0.3em] uppercase text-primary-foreground/60 mb-2">Ajuda</p>
          <h1 className="font-heading text-4xl md:text-6xl text-primary-foreground font-light">Suporte</h1>
          <p className="font-body text-sm text-primary-foreground/70 mt-3 max-w-2xl">
            Acompanhe as suas mensagens com a equipa Zana num só lugar.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between gap-3">
              <div className="font-heading text-lg">Pedidos</div>
              <Button variant="outline" className="rounded-none font-body text-xs" onClick={() => setDialogOpen(true)}>
                Novo
              </Button>
            </div>

            {isLoadingTickets ? (
              <div className="p-4 font-body text-sm text-muted-foreground">A carregar...</div>
            ) : sortedTickets.length === 0 ? (
              <div className="p-4 font-body text-sm text-muted-foreground">Ainda não tem pedidos.</div>
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
                        <div className="font-body text-sm font-medium line-clamp-1">{t.subject}</div>
                        <Badge className={`${t.status === 'closed' ? 'bg-secondary text-foreground' : 'bg-green-100 text-green-800'} text-[10px]`}>
                          {statusLabel(t.status)}
                        </Badge>
                      </div>
                      <div className="font-body text-xs text-muted-foreground mt-1">
                        Atualizado: {new Date(t.updated_date).toLocaleString('pt-PT')}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-3 bg-card border border-border rounded-lg overflow-hidden flex flex-col min-h-[420px]">
            <div className="p-4 border-b border-border">
              <div className="font-heading text-lg">Conversa</div>
              <div className="font-body text-xs text-muted-foreground mt-1">
                {selectedId ? `Ticket: ${selectedId}` : 'Selecione um pedido à esquerda.'}
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto">
              {!selectedId ? (
                <div className="font-body text-sm text-muted-foreground">Escolha um pedido para ver as mensagens.</div>
              ) : isLoadingThread ? (
                <div className="font-body text-sm text-muted-foreground">A carregar...</div>
              ) : (
                <div className="space-y-3">
                  {(thread?.messages ?? []).map((m) => {
                    const mine = m.author_type === 'customer';
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
              <Label className="font-body text-xs">Nova mensagem</Label>
              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  className="rounded-none min-h-[88px] sm:min-h-[44px] sm:h-[44px]"
                  placeholder="Escreva aqui..."
                  disabled={!selectedId}
                />
                <Button onClick={submitReply} className="rounded-none font-body text-sm tracking-wider sm:w-40" disabled={!selectedId}>
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Novo pedido</DialogTitle>
          </DialogHeader>
	          <div className="space-y-3">
	            <div>
	              <Label className="font-body text-xs">Tópico</Label>
	              <select
	                value={newTicket.topic}
	                onChange={(e) => setNewTicket((p) => ({ ...p, topic: e.target.value }))}
	                className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm font-body rounded-none"
	                disabled={SUPPORT_TOPICS.length === 0}
	              >
	                {SUPPORT_TOPICS.length === 0 ? (
	                  <option value="">Sem dados ainda</option>
	                ) : (
	                  <>
	                    <option value="">Selecionar...</option>
	                    {SUPPORT_TOPICS.map((t) => (
	                      <option key={t.value} value={t.value}>
	                        {t.label}
	                      </option>
	                    ))}
	                  </>
	                )}
	              </select>
	            </div>
	            <div>
	              <Label className="font-body text-xs">Assunto</Label>
	              <Input value={newTicket.subject} onChange={(e) => setNewTicket((p) => ({ ...p, subject: e.target.value }))} className="rounded-none mt-1" />
	            </div>
            <div>
              <Label className="font-body text-xs">Mensagem</Label>
              <Textarea
                value={newTicket.message}
                onChange={(e) => setNewTicket((p) => ({ ...p, message: e.target.value }))}
                className="rounded-none mt-1 min-h-[160px]"
              />
            </div>
            <Button onClick={submitNew} className="w-full rounded-none font-body text-sm tracking-wider">
              Criar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
