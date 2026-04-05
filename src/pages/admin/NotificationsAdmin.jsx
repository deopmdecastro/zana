import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, ExternalLink, ScrollText } from 'lucide-react';
import { Link } from 'react-router-dom';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import LoadMoreControls from '@/components/ui/load-more-controls';
import EmptyState from '@/components/ui/empty-state';
import {
  addDays,
  ADMIN_NOTIFICATIONS_READ_STORAGE_KEY,
  friendlyDetail,
  friendlyTitle,
  formatWhen,
  isCouponNotify,
  parseDate,
  targetPath,
} from '@/lib/adminLogNotifications';
import { useConfirm } from '@/components/ui/confirm-provider';

function readStoredReadIds() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ADMIN_NOTIFICATIONS_READ_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function NotificationsAdmin() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [limit, setLimit] = useState(50);
  const [filter, setFilter] = useState('unread'); // unread | all
  const [readIds, setReadIds] = useState(() => readStoredReadIds());
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ADMIN_NOTIFICATIONS_READ_STORAGE_KEY, JSON.stringify(readIds));
  }, [readIds]);

  const { data: logs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-notifications', limit],
    queryFn: () => base44.admin.logs.list(limit),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const sorted = useMemo(() => {
    const list = Array.isArray(logs) ? logs : [];
    const filtered = list.filter((l) => {
      if (String(l?.action ?? '') !== 'notify') return true;
      const toUser = l?.meta?.to_user_id ?? null;
      // Hide notifications targeted to sellers from the admin bell.
      return !toUser;
    });
    return filtered
      .slice()
      .sort((a, b) => new Date(b?.created_date ?? 0).getTime() - new Date(a?.created_date ?? 0).getTime());
  }, [logs]);

  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const unreadCount = useMemo(() => sorted.filter((l) => l?.id && !readSet.has(l.id)).length, [sorted, readSet]);

  const visible = useMemo(() => {
    if (filter === 'all') return sorted;
    return sorted.filter((l) => l?.id && !readSet.has(l.id));
  }, [sorted, filter, readSet]);

  const canLoadMore = !isLoading && Array.isArray(logs) && logs.length === limit && limit < 500;

  const markRead = (id) => {
    if (!id) return;
    setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const markAllRead = () => {
    const ids = sorted.map((l) => l?.id).filter(Boolean);
    if (ids.length === 0) return;
    setReadIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const couponCloseMutation = useMutation({
    mutationFn: ({ id }) => base44.admin.coupons.update(id, { is_active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-logs-bell'] });
    },
  });

  const couponExtendMutation = useMutation({
    mutationFn: ({ id, expires_at }) => base44.admin.coupons.update(id, { expires_at }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-logs-bell'] });
    },
  });

  const openNotification = (log) => {
    if (!log) return;
    setSelected(log);
    if (log?.id) markRead(log.id);
  };

  const isRead = selected?.id ? readSet.has(selected.id) : true;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-heading text-3xl">Notificações</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} por ler` : 'Sem novas notificações'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" className="rounded-none font-body text-sm" onClick={() => refetch()} disabled={isLoading}>
            Atualizar
          </Button>
          <Button className="rounded-none font-body text-sm gap-2" onClick={markAllRead} disabled={sorted.length === 0 || unreadCount === 0}>
            <CheckCheck className="w-4 h-4" />
            Marcar tudo lido
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Button
          variant={filter === 'unread' ? 'default' : 'outline'}
          className="rounded-none font-body text-xs"
          onClick={() => setFilter('unread')}
        >
          Por ler
        </Button>
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          className="rounded-none font-body text-xs"
          onClick={() => setFilter('all')}
        >
          Todas
        </Button>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="font-body text-sm text-muted-foreground">A carregar...</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center">
            <p className="font-body text-sm text-muted-foreground">Não foi possível carregar as notificações.</p>
            <Button variant="outline" className="rounded-none font-body text-sm mt-4" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Bell}
            description={filter === 'unread' ? 'Sem novas notificações.' : 'Ainda não tem notificações.'}
            className="py-10"
          />
        ) : (
          <div className="divide-y divide-border">
            {visible.map((l) => {
              const id = l?.id;
              const read = id ? readSet.has(id) : true;
              const title = friendlyTitle(l);
              const detail = friendlyDetail(l);
              return (
                <div
                  key={id ?? `${l?.entity_type ?? ''}:${l?.created_date ?? ''}`}
                  className={`p-4 sm:p-5 ${read ? '' : 'bg-primary/5'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex items-start gap-3">
                      <div className="mt-0.5 text-muted-foreground">
                        <ScrollText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-body text-sm font-semibold truncate">{title}</div>
                          {!read ? (
                            <span className="text-[10px] font-body tracking-widest uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              Nova
                            </span>
                          ) : null}
                        </div>
                        {detail ? <div className="font-body text-[12px] text-muted-foreground mt-1">{detail}</div> : null}
                        <div className="font-body text-[11px] text-muted-foreground mt-2">
                          {l?.actor?.email ?? '—'} · {formatWhen(l?.created_date)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        className="rounded-none font-body text-xs h-8"
                        onClick={() => markRead(id)}
                        disabled={read || !id}
                      >
                        Marcar lida
                      </Button>
                      <Button className="rounded-none font-body text-xs h-8" onClick={() => openNotification(l)}>
                        Abrir
                      </Button>
                    </div>
                  </div>

                  {isCouponNotify(l) ? (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        className="h-8 px-3 rounded-none font-body text-xs"
                        onClick={async () => {
                          const couponId = l?.entity_id;
                          if (!couponId) return;
                          const ok = await confirm({
                            title: 'Encerrar cupom?',
                            description: 'Tem certeza que deseja encerrar este cupom?',
                            confirmText: 'Encerrar',
                            cancelText: 'Cancelar',
                          });
                          if (!ok) return;
                          couponCloseMutation.mutate({ id: couponId });
                          if (id) markRead(id);
                        }}
                        disabled={couponCloseMutation.isPending}
                      >
                        Encerrar cupom
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 px-3 rounded-none font-body text-xs"
                        onClick={() => {
                          const couponId = l?.entity_id;
                          if (!couponId) return;

                          const current = parseDate(l?.meta?.expires_at);
                          const suggested = (current ? addDays(current, 7) : addDays(new Date(), 7)).toISOString().slice(0, 10);
                          const next = window.prompt('Nova data de validade (YYYY-MM-DD):', suggested);
                          if (!next) return;
                          couponExtendMutation.mutate({ id: couponId, expires_at: next });
                          if (id) markRead(id);
                        }}
                        disabled={couponExtendMutation.isPending}
                      >
                        Prorrogar validade
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <LoadMoreControls
        leftText={`A mostrar as últimas ${Math.min(limit, Array.isArray(logs) ? logs.length : 0)} notificações.`}
        onLess={() => setLimit(50)}
        lessDisabled={isLoading || limit <= 50}
        onMore={() => setLimit((p) => Math.min(500, p + 50))}
        moreDisabled={!canLoadMore}
      />

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-w-[640px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{selected ? friendlyTitle(selected) : 'Notificação'}</DialogTitle>
            <DialogDescription className="font-body text-xs">
              {selected?.created_date ? formatWhen(selected.created_date) : 'Detalhes da notificação'}
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="space-y-2 font-body text-sm">
              {friendlyDetail(selected) ? <div className="text-muted-foreground">{friendlyDetail(selected)}</div> : null}
              <div className="text-muted-foreground text-xs">
                {selected?.actor?.email ?? '—'} · {String(selected?.entity_type ?? '')} · {String(selected?.action ?? '')}
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="rounded-none font-body text-sm"
              onClick={() => markRead(selected?.id)}
              disabled={!selected?.id || isRead}
            >
              Marcar lida
            </Button>
            {selected ? (
              <Button asChild className="rounded-none font-body text-sm gap-2">
                <Link to={targetPath(selected)} onClick={() => setSelected(null)}>
                  <ExternalLink className="w-4 h-4" />
                  Ir para a página
                </Link>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
