import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';
import { Plus, Pencil, HelpCircle } from 'lucide-react';
import DeleteIcon from '@/components/ui/delete-icon';
import LoadMoreControls from '@/components/ui/load-more-controls';
import { useConfirm } from '@/components/ui/confirm-provider';

const emptyItem = { question: '', answer: '', order: 0, is_active: true };

export default function FAQAdmin() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyItem);
  const [questionStatus, setQuestionStatus] = useState('pending');
  const [questionsLimit, setQuestionsLimit] = useState(50);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [answerDraft, setAnswerDraft] = useState('');
  const [publish, setPublish] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ['admin-faq'],
    queryFn: () => base44.entities.FaqItem.list(500),
  });

  const { data: questions = [], isLoading: isLoadingQuestions } = useQuery({
    queryKey: ['admin-faq-questions', questionStatus, questionsLimit],
    queryFn: () => base44.admin.faqQuestions.list({ status: questionStatus, public: 'all', limit: questionsLimit }),
  });

  const canLoadMoreQuestions =
    !isLoadingQuestions && Array.isArray(questions) && questions.length === questionsLimit && questionsLimit < 500;

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [items]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.FaqItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-faq'] });
      setDialogOpen(false);
      toast.success('Pergunta criada');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível criar.')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FaqItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-faq'] });
      setDialogOpen(false);
      toast.success('Pergunta atualizada');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível atualizar.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FaqItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-faq'] });
      toast.success('Removida');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível remover.')),
  });

  const answerQuestionMutation = useMutation({
    mutationFn: ({ id, patch }) => base44.admin.faqQuestions.update(id, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-faq-questions'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-faq'] });
      await queryClient.invalidateQueries({ queryKey: ['faq'] });
      toast.success('Resposta guardada');
      setSelectedQuestion(null);
      setAnswerDraft('');
      setPublish(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível guardar.')),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyItem);
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      question: item.question ?? '',
      answer: item.answer ?? '',
      order: item.order ?? 0,
      is_active: item.is_active !== false,
    });
    setDialogOpen(true);
  };

  const openAnswer = (q) => {
    setSelectedQuestion(q);
    setAnswerDraft(q?.answer ?? '');
    setPublish(!!q?.is_public);
  };

  const submit = () => {
    if (!form.question.trim() || !form.answer.trim()) {
      toast.error('Preencha pergunta e resposta');
      return;
    }
    const data = { ...form, order: Number(form.order) || 0 };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  return (
    <div>
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-3xl">FAQ</h1>
            <p className="font-body text-sm text-muted-foreground mt-1">Perguntas enviadas pelos clientes e conteúdo do FAQ.</p>
          </div>
          <Select value={questionStatus} onValueChange={setQuestionStatus}>
            <SelectTrigger className="w-56 rounded-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Perguntas pendentes</SelectItem>
              <SelectItem value="answered">Respondidas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card rounded-lg border border-border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left p-3 font-body text-xs text-muted-foreground">Pergunta</th>
                <th className="text-left p-3 font-body text-xs text-muted-foreground">Contacto</th>
                <th className="text-left p-3 font-body text-xs text-muted-foreground">Estado</th>
                <th className="text-right p-3 font-body text-xs text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(isLoadingQuestions ? [] : questions).map((q) => (
                <tr key={q.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                  <td className="p-3 font-body text-sm">
                    <div className="font-medium line-clamp-2">{q.question}</div>
                    {q.answer ? <div className="text-xs text-muted-foreground line-clamp-1 mt-1">{q.answer}</div> : null}
                  </td>
                  <td className="p-3 font-body text-xs text-muted-foreground">
                    <div>{q.author_name ?? '—'}</div>
                    <div className="mt-1">{q.author_email ?? '—'}</div>
                  </td>
                  <td className="p-3 font-body text-xs">
                    {q.answered_date ? <span className="text-green-700">Respondida</span> : <span className="text-muted-foreground">Pendente</span>}
                    {q.is_public ? <span className="ml-2 text-primary">• Pública</span> : null}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button variant="outline" className="rounded-none font-body text-xs" onClick={() => openAnswer(q)}>
                      Responder
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoadingQuestions && (questions ?? []).length === 0 ? (
            <div className="text-center py-10">
              <HelpCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="font-body text-sm text-muted-foreground">Sem perguntas</p>
            </div>
          ) : null}
        </div>

        <LoadMoreControls
          leftText={`A mostrar as últimas ${Math.min(questionsLimit, Array.isArray(questions) ? questions.length : 0)} perguntas.`}
          onLess={() => setQuestionsLimit(50)}
          lessDisabled={isLoadingQuestions || questionsLimit <= 50}
          onMore={() => setQuestionsLimit((p) => Math.min(500, p + 50))}
          moreDisabled={!canLoadMoreQuestions}
        />
      </div>

      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h2 className="font-heading text-2xl">Perguntas Frequentes</h2>
        <Button onClick={openCreate} className="rounded-none font-body text-sm gap-2">
          <Plus className="w-4 h-4" /> Nova
        </Button>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Ordem</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Pergunta</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Ativo</th>
              <th className="text-right p-3 font-body text-xs text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                <td className="p-3 font-body text-xs text-muted-foreground">{item.order ?? 0}</td>
                <td className="p-3 font-body text-sm font-medium">{item.question}</td>
                <td className="p-3 font-body text-xs">{item.is_active ? 'Sim' : 'Não'}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Editar">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Remover pergunta?',
                        description: 'Tem certeza que deseja remover esta pergunta do FAQ?',
                        confirmText: 'Remover',
                        cancelText: 'Cancelar',
                        destructive: true,
                      });
                      if (!ok) return;
                      deleteMutation.mutate(item.id);
                    }}
                    title="Remover"
                  >
                    <DeleteIcon className="text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="text-center py-10">
            <HelpCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="font-body text-sm text-muted-foreground">Sem perguntas</p>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{editing ? 'Editar' : 'Nova'} pergunta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="font-body text-xs">Pergunta</Label>
              <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} className="rounded-none mt-1" />
            </div>
            <div>
              <Label className="font-body text-xs">Resposta</Label>
              <Textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} className="rounded-none mt-1 min-h-[140px]" />
            </div>
            <div className="grid grid-cols-2 gap-4 items-center">
              <div>
                <Label className="font-body text-xs">Ordem</Label>
                <Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} className="rounded-none mt-1" />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label className="font-body text-xs">Ativo</Label>
              </div>
            </div>
            <Button onClick={submit} className="w-full rounded-none font-body text-sm tracking-wider">
              {editing ? 'Guardar' : 'Criar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedQuestion}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedQuestion(null);
            setAnswerDraft('');
            setPublish(false);
          }
        }}
      >
        <DialogContent aria-describedby={undefined} className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Responder pergunta</DialogTitle>
          </DialogHeader>
          {selectedQuestion ? (
            <div className="space-y-4">
              <div className="font-body text-sm">
                <div className="text-xs text-muted-foreground">
                  {new Date(selectedQuestion.created_date).toLocaleString('pt-PT')} • {selectedQuestion.author_email ?? '—'}
                </div>
                <div className="mt-2 whitespace-pre-wrap">{selectedQuestion.question}</div>
              </div>

              <div>
                <Label className="font-body text-xs">Resposta</Label>
                <Textarea
                  value={answerDraft}
                  onChange={(e) => setAnswerDraft(e.target.value)}
                  className="rounded-none mt-1 min-h-[140px]"
                  placeholder="Escreva a resposta…"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={publish} onCheckedChange={setPublish} />
                <Label className="font-body text-xs">Publicar no FAQ para clientes</Label>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" className="rounded-none font-body text-sm" onClick={() => setSelectedQuestion(null)}>
                  Cancelar
                </Button>
                <Button
                  className="rounded-none font-body text-sm tracking-wider"
                  disabled={answerQuestionMutation.isPending}
                  onClick={() => {
                    if (!selectedQuestion?.id) return;
                    const answer = String(answerDraft ?? '').trim();
                    if (!answer) return toast.error('Escreva uma resposta');
                    answerQuestionMutation.mutate({ id: selectedQuestion.id, patch: { answer, is_public: publish } });
                  }}
                >
                  {answerQuestionMutation.isPending ? 'A guardar…' : 'Guardar'}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
