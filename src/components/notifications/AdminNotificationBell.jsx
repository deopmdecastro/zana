import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, ScrollText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from 'react-router-dom';
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

export default function AdminNotificationBell() {
  const queryClient = useQueryClient();
  const [readIds, setReadIds] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(ADMIN_NOTIFICATIONS_READ_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ADMIN_NOTIFICATIONS_READ_STORAGE_KEY, JSON.stringify(readIds));
  }, [readIds]);

  const { data: logs = [] } = useQuery({
    queryKey: ['admin-logs-bell'],
    queryFn: () => base44.admin.logs.list(20),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const unreadLogs = useMemo(() => {
    const ids = new Set(readIds);
    return (Array.isArray(logs) ? logs : []).filter((l) => l?.id && !ids.has(l.id));
  }, [logs, readIds]);

  const count = unreadLogs.length;
  const badge = count > 9 ? '9+' : String(count);

  const markRead = (id) => {
    if (!id) return;
    setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const markAllRead = () => {
    const ids = unreadLogs.map((l) => l?.id).filter(Boolean);
    if (ids.length === 0) return;
    setReadIds((prev) => {
      const existing = new Set(prev);
      const next = [...prev];
      for (const id of ids) {
        if (!existing.has(id)) {
          existing.add(id);
          next.push(id);
        }
      }
      return next;
    });
  };

  const couponCloseMutation = useMutation({
    mutationFn: ({ id }) => base44.admin.coupons.update(id, { is_active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-logs-bell'] });
    },
  });

  const couponExtendMutation = useMutation({
    mutationFn: ({ id, expires_at }) => base44.admin.coupons.update(id, { expires_at }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-logs-bell'] });
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="w-4 h-4" />
          {count > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] px-1.5 h-4 min-w-4 rounded-full flex items-center justify-center font-body">
              {badge}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[360px] max-w-[calc(100vw-24px)]">
        <DropdownMenuLabel className="font-body text-xs text-muted-foreground">Notificações</DropdownMenuLabel>
        <DropdownMenuItem disabled={count === 0} className="cursor-pointer font-body text-sm" onSelect={() => markAllRead()}>
          Marcar todas como lidas
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {count === 0 ? (
          <DropdownMenuItem disabled className="font-body text-sm">
            Sem novidades
          </DropdownMenuItem>
        ) : (
          unreadLogs.slice(0, 8).map((l) => (
            <DropdownMenuItem key={l.id} className="cursor-pointer">
              <div className="flex items-start gap-3 w-full">
                <Link to={targetPath(l)} className="flex items-start gap-3 flex-1 min-w-0" onClick={() => markRead(l.id)}>
                  <div className="mt-0.5 text-muted-foreground">
                    <ScrollText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-body text-sm">
                      <span className="font-medium">{friendlyTitle(l)}</span>
                    </div>
                    {friendlyDetail(l) ? <div className="font-body text-[11px] text-muted-foreground">{friendlyDetail(l)}</div> : null}
                    <div className="font-body text-[11px] text-muted-foreground">
                      {l.actor?.email ?? '—'} · {formatWhen(l.created_date)}
                    </div>
                    {isCouponNotify(l) ? (
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          variant="outline"
                          className="h-7 px-2 rounded-none font-body text-[11px]"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const id = l.entity_id;
                            if (!id) return;
                            if (!window.confirm('Encerrar este cupom?')) return;
                            couponCloseMutation.mutate({ id });
                            markRead(l.id);
                          }}
                          disabled={couponCloseMutation.isPending}
                        >
                          Encerrar
                        </Button>
                        <Button
                          variant="outline"
                          className="h-7 px-2 rounded-none font-body text-[11px]"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const id = l.entity_id;
                            if (!id) return;

                            const current = parseDate(l?.meta?.expires_at);
                            const suggested = (current ? addDays(current, 7) : addDays(new Date(), 7)).toISOString().slice(0, 10);
                            const next = window.prompt('Nova data de validade (YYYY-MM-DD):', suggested);
                            if (!next) return;
                            couponExtendMutation.mutate({ id, expires_at: next });
                            markRead(l.id);
                          }}
                          disabled={couponExtendMutation.isPending}
                        >
                          Prorrogar
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </Link>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  title="Marcar como lida"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    markRead(l.id);
                  }}
                >
                  <Check className="w-4 h-4" />
                </Button>
              </div>
            </DropdownMenuItem>
          ))
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/admin/notificacoes" className="font-body text-sm text-primary">
            Ver todas as notificações
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
