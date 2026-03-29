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

const READ_STORAGE_KEY = 'zana_admin_notifications_read';

function formatWhen(value) {
  try {
    return new Date(value).toLocaleString('pt-PT');
  } catch {
    return '';
  }
}

function targetPath(log) {
  const type = String(log?.entity_type ?? '');

  if (type === 'SupportTicket' || type === 'SupportMessage') return '/admin/suporte';
  if (type === 'BlogComment' || type === 'BlogCommentReply') return '/admin/conteudo/blog-comentarios';
  if (type === 'Order' || type === 'OrderItem') return '/admin/encomendas';
  if (type === 'SalesTarget') return '/admin/metas-vendas';
  if (type === 'CashClosure') return '/admin/fecho-de-caixa';
  if (type === 'Coupon') return '/admin/cupons';

  if (type === 'Purchase' || type === 'PurchaseItem') return '/admin/compras';
  if (type === 'Inventory' || type === 'InventoryMovement') return '/admin/inventario';
  if (type === 'Product') return '/admin/produtos';
  if (type === 'Supplier') return '/admin/fornecedores';
  if (type === 'InstagramPost') return '/admin/conteudo/instagram';

  return '/admin/logs';
}

function friendlyTitle(log) {
  const action = String(log?.action ?? '');
  const type = String(log?.entity_type ?? '');
  const meta = log?.meta ?? null;

  if (action === 'notify') {
    const kind = String(meta?.kind ?? '');
    if (kind === 'sales_target_expired') return 'Meta de vendas expirada';
    if (kind === 'sales_target_achieved') return 'Meta de vendas alcançada';
    if (kind === 'coupon_expired') return 'Cupom expirado';
    if (kind === 'coupon_expiring') return 'Cupom a expirar';
    return 'Notificação';
  }

  if (type === 'SupportTicket' && action === 'create') return 'Novo pedido de suporte';
  if (type === 'SupportTicket' && action === 'update') return 'Pedido de suporte atualizado';
  if (type === 'SupportMessage' && action === 'create') return 'Nova mensagem no suporte';

  if (type === 'BlogComment' && action === 'create') return 'Novo comentário no blog';
  if (type === 'BlogComment' && action === 'update') {
    if (meta && typeof meta.is_approved === 'boolean') return meta.is_approved ? 'Comentário aprovado' : 'Comentário reprovado';
    return 'Comentário atualizado';
  }
  if (type === 'BlogCommentReply' && action === 'create') return 'Nova resposta a comentário';

  if (type === 'InstagramPost') {
    if (action === 'create') return 'Instagram: link adicionado';
    if (action === 'update') return 'Instagram: link atualizado';
    if (action === 'delete') return 'Instagram: link removido';
  }

  if (type === 'SalesTarget') {
    if (action === 'create') return 'Meta de vendas criada';
    if (action === 'update') return 'Meta de vendas atualizada';
    if (action === 'delete') return 'Meta de vendas removida';
  }

  if (type === 'CashClosure') {
    if (action === 'create') return 'Fecho de caixa registado';
    if (action === 'update') return 'Fecho de caixa atualizado';
  }

  if (type === 'Coupon') {
    if (action === 'create') return 'Cupom criado';
    if (action === 'update') return 'Cupom atualizado';
    if (action === 'delete') return 'Cupom removido';
  }

  if (type === 'Order') {
    if (action === 'create') return 'Encomenda criada';
    if (action === 'update') return 'Encomenda atualizada';
  }

  if (type === 'SiteContent' && action === 'update') return 'Conteúdo do site atualizado';
  if (type === 'Inventory' && action === 'update') return 'Stock atualizado';

  return `${action} ${type}`.trim() || 'Atualização';
}

function friendlyDetail(log) {
  const action = String(log?.action ?? '');
  const type = String(log?.entity_type ?? '');
  const meta = log?.meta ?? null;
  const id = log?.entity_id ? String(log.entity_id) : '';

  if (action === 'notify') {
    const kind = String(meta?.kind ?? '');
    if (kind === 'sales_target_expired' || kind === 'sales_target_achieved') return meta?.name ? String(meta.name) : id ? `SalesTarget · ${id}` : '';
    if (kind === 'coupon_expired' || kind === 'coupon_expiring') return meta?.code ? `Cupom · ${meta.code}` : id ? `Coupon · ${id}` : '';
    return '';
  }

  if (!id) return '';
  if (['BlogComment', 'BlogCommentReply', 'SupportMessage'].includes(type)) return '';
  if (type === 'Coupon' && meta?.code) return `Cupom · ${meta.code}`;
  if (type === 'SalesTarget' && meta?.name) return `Meta · ${meta.name}`;
  if (type === 'SiteContent') return `Conteúdo · ${id}`;
  return `${type} · ${id}`;
}

function parseDate(value) {
  try {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default function AdminNotificationBell() {
  const queryClient = useQueryClient();
  const [readIds, setReadIds] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(READ_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(readIds));
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

  const isCouponNotify = (log) => {
    if (!log) return false;
    if (String(log.action ?? '') !== 'notify') return false;
    if (String(log.entity_type ?? '') !== 'Coupon') return false;
    const kind = String(log?.meta?.kind ?? '');
    return kind === 'coupon_expired' || kind === 'coupon_expiring';
  };

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
          <Link to="/admin/logs" className="font-body text-sm text-primary">
            Ver todos os logs
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
