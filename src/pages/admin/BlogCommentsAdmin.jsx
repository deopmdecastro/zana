import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';
import { MessageSquare } from 'lucide-react';
import DeleteIcon from '@/components/ui/delete-icon';
import LoadMoreControls from '@/components/ui/load-more-controls';
import { useConfirm } from '@/components/ui/confirm-provider';

export default function BlogCommentsAdmin() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [approved, setApproved] = useState('false');
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');
  const [limit, setLimit] = useState(50);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['admin-blog-comments', approved, limit],
    queryFn: () => base44.admin.blogComments.list({ approved, limit }),
  });

  const sorted = useMemo(() => {
    return [...(comments ?? [])].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [comments]);

  const canLoadMore = !isLoading && Array.isArray(comments) && comments.length === limit && limit < 500;

  const approveMutation = useMutation({
    mutationFn: ({ id, is_approved }) => base44.admin.blogComments.approve(id, is_approved),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blog-comments'] });
      queryClient.invalidateQueries({ queryKey: ['blog-comments'] });
      toast.success('Atualizado');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível atualizar.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.admin.blogComments.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blog-comments'] });
      queryClient.invalidateQueries({ queryKey: ['blog-comments'] });
      toast.success('Removido');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível remover.')),
  });

  const { data: selectedDetail } = useQuery({
    queryKey: ['admin-blog-comment-detail', selected?.id],
    queryFn: () => base44.admin.blogComments.get(selected.id),
    enabled: !!selected?.id,
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, message }) => base44.admin.blogComments.reply(id, message),
    onSuccess: () => {
      setReply('');
      queryClient.invalidateQueries({ queryKey: ['admin-blog-comments'] });
      queryClient.invalidateQueries({ queryKey: ['blog-comments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-blog-comment-detail'] });
      toast.success('Resposta enviada');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível responder.')),
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="font-heading text-3xl w-full">Comentários do Blog</h1>
        <Select value={approved} onValueChange={setApproved}>
          <SelectTrigger className="w-full sm:w-56 rounded-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="false">Pendentes</SelectItem>
            <SelectItem value="true">Aprovados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full min-w-max">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Artigo</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Autor</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Estado</th>
              <th className="text-right p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(isLoading ? [] : sorted).map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                <td className="p-3 font-body text-sm">
                  <div className="font-medium">{c.post?.title ?? c.post_id}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">{c.content}</div>
                </td>
                <td className="p-3 font-body text-sm text-muted-foreground">
                  <div>{c.author_name}</div>
                  {c.author_email ? <div className="text-xs text-muted-foreground">{c.author_email}</div> : null}
                </td>
                <td className="p-3">
                  <Badge className={`${c.is_approved ? 'bg-green-100 text-green-800' : 'bg-secondary text-foreground'} text-[10px]`}>
                    {c.is_approved ? 'Aprovado' : 'Pendente'}
                  </Badge>
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <Button variant="outline" className="rounded-none font-body text-xs mr-2" onClick={() => setSelected(c)}>
                    Ver
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-none font-body text-xs mr-2"
                    onClick={() => approveMutation.mutate({ id: c.id, is_approved: !c.is_approved })}
                  >
                    {c.is_approved ? 'Reprovar' : 'Aprovar'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Remover comentário?',
                        description: 'Tem certeza que deseja remover este comentário?',
                        confirmText: 'Remover',
                        cancelText: 'Cancelar',
                        destructive: true,
                      });
                      if (!ok) return;
                      deleteMutation.mutate(c.id);
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
        {!isLoading && sorted.length === 0 && (
          <div className="text-center py-10">
            <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="font-body text-sm text-muted-foreground">Sem itens</p>
          </div>
        )}
      </div>

      <LoadMoreControls
        leftText={`A mostrar os últimos ${Math.min(limit, Array.isArray(comments) ? comments.length : 0)} comentários.`}
        onLess={() => setLimit(50)}
        lessDisabled={isLoading || limit <= 50}
        onMore={() => setLimit((p) => Math.min(500, p + 50))}
        moreDisabled={!canLoadMore}
      />

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent aria-describedby={undefined} className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Detalhe</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 font-body text-sm">
              <div className="text-xs text-muted-foreground">{new Date(selected.created_date).toLocaleString('pt-PT')}</div>
              <div>
                <span className="text-muted-foreground">Artigo:</span> {selected.post?.title ?? selected.post_id}
              </div>
              <div>
                <span className="text-muted-foreground">Autor:</span> {selected.author_name}
              </div>
              {selected.author_email ? (
                <div>
                  <span className="text-muted-foreground">Email:</span> {selected.author_email}
                </div>
              ) : null}
              <div className="pt-2 whitespace-pre-wrap">{selected.content}</div>

              {(selectedDetail?.replies ?? []).length > 0 ? (
                <div className="pt-2 space-y-2">
                  <div className="font-heading text-base">Respostas</div>
                  {(selectedDetail?.replies ?? []).map((r) => (
                    <div key={r.id} className="border border-border rounded-md p-3 bg-secondary/10">
                      <div className="text-xs text-muted-foreground">
                        {r.author_type === 'admin' ? 'Admin' : 'Cliente'} · {new Date(r.created_date).toLocaleString('pt-PT')}
                      </div>
                      <div className="mt-1 whitespace-pre-wrap">{r.message}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="pt-2">
                <div className="font-heading text-base mb-2">Responder</div>
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  className="rounded-none min-h-[110px]"
                  placeholder="Escreva uma resposta..."
                />
                <Button
                  className="mt-3 w-full rounded-none font-body text-sm tracking-wider"
                  onClick={() => {
                    if (!reply.trim()) return toast.error('Escreva uma resposta');
                    replyMutation.mutate({ id: selected.id, message: reply.trim() });
                  }}
                  disabled={replyMutation.isPending}
                >
                  Enviar resposta
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
