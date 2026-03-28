import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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

function friendlyTitle(log) {
  const action = String(log?.action ?? '');
  const type = String(log?.entity_type ?? '');
  const meta = log?.meta ?? null;

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

  if (type === 'Purchase' && action === 'create') return 'Compra criada';
  if (type === 'Purchase' && action === 'update') return 'Compra atualizada';
  if (type === 'Inventory' && action === 'update') return 'Stock atualizado';
  if (type === 'Product' && action === 'update') return 'Produto atualizado';
  if (type === 'Supplier' && action === 'create') return 'Fornecedor criado';

  return `${action} ${type}`.trim() || 'Atualização';
}

function friendlyDetail(log) {
  const type = String(log?.entity_type ?? '');
  const id = log?.entity_id ? String(log.entity_id) : '';
  if (!id) return '';
  if (['BlogComment', 'BlogCommentReply', 'SupportMessage'].includes(type)) return '';
  return `${type} · ${id}`;
}

export default function AdminNotificationBell() {
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
        <DropdownMenuSeparator />

        {count === 0 ? (
          <DropdownMenuItem disabled className="font-body text-sm">
            Sem novidades
          </DropdownMenuItem>
        ) : (
          unreadLogs.slice(0, 8).map((l) => (
            <DropdownMenuItem key={l.id} className="cursor-pointer">
              <div className="flex items-start gap-3 w-full">
                <Link to="/admin/logs" className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-0.5 text-muted-foreground">
                    <ScrollText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-body text-sm">
                      <span className="font-medium">{friendlyTitle(l)}</span>
                    </div>
                    {friendlyDetail(l) ? (
                      <div className="font-body text-[11px] text-muted-foreground">{friendlyDetail(l)}</div>
                    ) : null}
                    <div className="font-body text-[11px] text-muted-foreground">
                      {l.actor?.email ?? '—'} · {formatWhen(l.created_date)}
                    </div>
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

