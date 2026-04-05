import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/toast';
import { MessageSquare } from 'lucide-react';
import DeleteIcon from '@/components/ui/delete-icon';
import { getPrimaryImage } from '@/lib/images';
import LoadMoreControls from '@/components/ui/load-more-controls';
import { useConfirm } from '@/components/ui/confirm-provider';

export default function AdminReviews() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [approved, setApproved] = useState('false');
  const [selected, setSelected] = useState(null);
  const [limit, setLimit] = useState(50);

  const { data: products = [] } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => base44.entities.Product.list('-created_date', 500),
  });

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['admin-reviews', approved, limit],
    queryFn: () => base44.admin.reviews.list({ approved, limit }),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, is_approved }) => base44.admin.reviews.approve(id, is_approved),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      toast.success('Atualizado');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível atualizar.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.admin.reviews.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      toast.success('Removido');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível remover.')),
  });

  const sorted = useMemo(() => {
    return [...reviews].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [reviews]);

  const canLoadMore = !isLoading && Array.isArray(reviews) && reviews.length === limit && limit < 500;

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="font-heading text-3xl">Comentários & Avaliações</h1>
        <Select value={approved} onValueChange={setApproved}>
          <SelectTrigger className="w-56 rounded-none">
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
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Produto</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Rating</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Autor</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Estado</th>
              <th className="text-right p-3 font-body text-xs text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(isLoading ? [] : sorted).map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                <td className="p-3 font-body text-sm">
                  <div className="font-medium">{productById.get(r.product_id)?.name ?? r.product_id}</div>
                  {r.comment ? <div className="text-xs text-muted-foreground line-clamp-1">{r.comment}</div> : null}
                </td>
                <td className="p-3 font-body text-sm">⭐ {r.rating}/5</td>
                <td className="p-3 font-body text-sm text-muted-foreground">{r.author_name ?? '-'}</td>
                <td className="p-3">
                  <Badge className={`${r.is_approved ? 'bg-green-100 text-green-800' : 'bg-secondary text-foreground'} text-[10px]`}>
                    {r.is_approved ? 'Aprovado' : 'Pendente'}
                  </Badge>
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <Button variant="outline" className="rounded-none font-body text-xs mr-2" onClick={() => setSelected(r)}>
                    Ver
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-none font-body text-xs mr-2"
                    onClick={() => approveMutation.mutate({ id: r.id, is_approved: !r.is_approved })}
                  >
                    {r.is_approved ? 'Reprovar' : 'Aprovar'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Remover avaliação?',
                        description: 'Tem certeza que deseja remover esta avaliação/comentário?',
                        confirmText: 'Remover',
                        cancelText: 'Cancelar',
                        destructive: true,
                      });
                      if (!ok) return;
                      deleteMutation.mutate(r.id);
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
        leftText={`A mostrar os últimos ${Math.min(limit, Array.isArray(reviews) ? reviews.length : 0)} itens.`}
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
            <div className="space-y-2 font-body text-sm">
              <div className="text-xs text-muted-foreground">{new Date(selected.created_date).toLocaleString('pt-PT')}</div>
              <div className="flex items-center gap-3 pt-1">
                {(() => {
                  const p = productById.get(selected.product_id);
                  const image = selected.product_image ?? getPrimaryImage(p?.images);
                  const name = selected.product_name ?? p?.name ?? selected.product_id;

                  return (
                    <>
                      {image ? (
                        <img
                          src={image}
                          alt={name}
                          className="w-14 h-14 rounded-md object-cover border border-border bg-secondary/30"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-md border border-border bg-secondary/30" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{name}</div>
                        <div className="text-xs text-muted-foreground truncate">{selected.product_id}</div>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div><span className="text-muted-foreground">Rating:</span> {selected.rating}/5</div>
              <div><span className="text-muted-foreground">Autor:</span> {selected.author_name ?? '-'}</div>
              {selected.comment ? <div className="pt-2 whitespace-pre-wrap">{selected.comment}</div> : <div>-</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
