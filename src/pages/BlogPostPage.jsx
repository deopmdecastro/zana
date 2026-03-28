import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';

export default function BlogPostPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const postId = window.location.pathname.split('/blog/')[1];
  const [commentForm, setCommentForm] = useState({ author_name: '', author_email: '', content: '' });
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');

  const { data: post, isLoading } = useQuery({
    queryKey: ['blog-post', postId],
    queryFn: () => base44.entities.BlogPost.filter({ id: postId }),
    select: (data) => data[0],
    enabled: !!postId,
  });

  useEffect(() => {
    setCommentForm((p) => ({
      ...p,
      author_name: p.author_name || user?.full_name || '',
      author_email: p.author_email || user?.email || '',
    }));
  }, [user?.email, user?.full_name]);

  const { data: comments = [], isLoading: isLoadingComments } = useQuery({
    queryKey: ['blog-comments', postId],
    queryFn: () => base44.blog.comments.list(postId, 200),
    enabled: !!postId,
  });

  const createCommentMutation = useMutation({
    mutationFn: (payload) => base44.blog.comments.create(postId, payload),
    onSuccess: () => {
      setCommentForm((p) => ({ ...p, content: '' }));
      toast.success('Comentário enviado para aprovação.');
      queryClient.invalidateQueries({ queryKey: ['blog-comments', postId] });
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível enviar o comentário.')),
  });

  const replyMutation = useMutation({
    mutationFn: ({ commentId, message }) => base44.blog.comments.reply(commentId, message),
    onSuccess: () => {
      setReplyText('');
      setReplyingTo(null);
      toast.success('Resposta enviada.');
      queryClient.invalidateQueries({ queryKey: ['blog-comments', postId] });
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível responder.')),
  });

  if (isLoading) {
    return <div className="max-w-3xl mx-auto px-4 py-20 animate-pulse"><div className="h-8 bg-secondary/50 w-2/3 rounded" /></div>;
  }

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="font-heading text-2xl">Artigo não encontrado</p>
        <Link to="/blog" className="font-body text-sm text-primary mt-4 inline-block">← Voltar ao blog</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <Link to="/blog" className="inline-flex items-center gap-1 text-sm font-body text-muted-foreground hover:text-primary mb-8">
        <ChevronLeft className="w-4 h-4" /> Voltar ao blog
      </Link>

      {post.image_url && (
        <div className="aspect-[16/9] rounded-lg overflow-hidden mb-8">
          <img src={post.image_url} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}

      <span className="font-body text-xs text-muted-foreground flex items-center gap-1 mb-3">
        <Calendar className="w-3 h-3" />
        {format(new Date(post.created_date), 'd MMMM yyyy', { locale: pt })}
      </span>

      <h1 className="font-heading text-3xl md:text-5xl font-light mb-8">{post.title}</h1>

      <div className="prose prose-sm max-w-none font-body text-foreground/80 leading-relaxed">
        <ReactMarkdown>{post.content}</ReactMarkdown>
      </div>

      <div className="mt-12 pt-10 border-t border-border">
        <h2 className="font-heading text-2xl mb-2">Comentários</h2>
        <p className="font-body text-sm text-muted-foreground mb-6">Os comentários ficam visíveis após aprovação.</p>

        <div className="space-y-4">
          <div className="bg-card border border-border p-4 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="font-body text-xs">Nome</Label>
                <Input
                  value={commentForm.author_name}
                  onChange={(e) => setCommentForm((p) => ({ ...p, author_name: e.target.value }))}
                  className="rounded-none mt-1"
                />
              </div>
              <div>
                <Label className="font-body text-xs">Email (opcional)</Label>
                <Input
                  value={commentForm.author_email}
                  onChange={(e) => setCommentForm((p) => ({ ...p, author_email: e.target.value }))}
                  className="rounded-none mt-1"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="font-body text-xs">Comentário</Label>
                <Textarea
                  value={commentForm.content}
                  onChange={(e) => setCommentForm((p) => ({ ...p, content: e.target.value }))}
                  className="rounded-none mt-1 min-h-[120px]"
                />
              </div>
            </div>
            <Button
              onClick={() => {
                if (!commentForm.author_name.trim() || !commentForm.content.trim()) {
                  toast.error('Preencha nome e comentário');
                  return;
                }
                createCommentMutation.mutate({
                  author_name: commentForm.author_name.trim(),
                  author_email: commentForm.author_email?.trim() || null,
                  content: commentForm.content.trim(),
                });
              }}
              className="mt-4 w-full rounded-none font-body text-sm tracking-wider"
              disabled={createCommentMutation.isPending}
            >
              Enviar comentário
            </Button>
          </div>

          {isLoadingComments ? (
            <div className="font-body text-sm text-muted-foreground">A carregar comentários...</div>
          ) : comments.length === 0 ? (
            <div className="font-body text-sm text-muted-foreground">Ainda não há comentários.</div>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="bg-card border border-border p-4 rounded-lg">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-body text-sm font-medium">{c.author_name}</div>
                    <div className="font-body text-xs text-muted-foreground">{new Date(c.created_date).toLocaleDateString('pt-PT')}</div>
                  </div>
                  <div className="font-body text-sm text-foreground/80 mt-2 whitespace-pre-wrap">{c.content}</div>

                  {(c.replies ?? []).length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {(c.replies ?? []).map((r) => (
                        <div key={r.id} className="border border-border/70 bg-secondary/10 rounded-md p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-body text-xs font-medium text-foreground/80">{r.author_name}</div>
                            <div className="font-body text-[11px] text-muted-foreground">
                              {new Date(r.created_date).toLocaleString('pt-PT')}
                            </div>
                          </div>
                          <div className="font-body text-sm text-foreground/80 mt-1 whitespace-pre-wrap">{r.message}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {c.is_mine ? (
                    <div className="mt-4">
                      {replyingTo === c.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            className="rounded-none min-h-[90px]"
                            placeholder="Escreva uma resposta..."
                          />
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              variant="outline"
                              className="rounded-none font-body text-sm"
                              onClick={() => {
                                setReplyingTo(null);
                                setReplyText('');
                              }}
                              disabled={replyMutation.isPending}
                            >
                              Cancelar
                            </Button>
                            <Button
                              className="rounded-none font-body text-sm tracking-wider"
                              onClick={() => {
                                if (!replyText.trim()) return toast.error('Escreva uma resposta');
                                replyMutation.mutate({ commentId: c.id, message: replyText.trim() });
                              }}
                              disabled={replyMutation.isPending}
                            >
                              Enviar resposta
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          className="rounded-none font-body text-xs mt-3"
                          onClick={() => setReplyingTo(c.id)}
                        >
                          Responder
                        </Button>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
