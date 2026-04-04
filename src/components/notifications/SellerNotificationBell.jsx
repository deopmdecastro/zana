import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Check, ScrollText } from 'lucide-react';
import { Link } from 'react-router-dom';

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

const SELLER_NOTIFICATIONS_READ_KEY = 'zana_seller_notifications_read';

function readStoredIds() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SELLER_NOTIFICATIONS_READ_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatWhen(value) {
  try {
    return new Date(value).toLocaleString('pt-PT');
  } catch {
    return '';
  }
}

function roleLabelForLog(log) {
  if (String(log?.action ?? '') === 'notify' && String(log?.meta?.kind ?? '') === 'order_updated_by_admin') return 'Admin';
  if (log?.actor?.is_admin) return 'Admin';
  if (log?.actor?.is_seller) return 'Vendedor';
  return String(log?.actor?.full_name ?? log?.actor?.email ?? '').trim();
}

function titleForLog(l) {
  const entity = String(l?.entity_type ?? '').trim() || 'Sistema';
  const action = String(l?.action ?? '').trim() || 'evento';
  const kind = String(l?.meta?.kind ?? '').trim();
  if (action === 'notify' && kind === 'order_updated_by_admin') {
    const statusLabels = {
      pending: 'Pendente',
      confirmed: 'Confirmada',
      processing: 'Em preparação',
      shipped: 'Enviada',
      delivered: 'Entregue',
      cancelled: 'Cancelada',
    };
    const nextStatus = String(l?.meta?.status ?? '').trim();
    const label = statusLabels[nextStatus] ?? nextStatus;
    if (label) return `Admin atualizou encomenda (${label})`;
    return 'Admin atualizou encomenda';
  }
  if (entity === 'Order' && action === 'create') return 'Encomenda criada';
  if (entity === 'Order' && action === 'update') return 'Encomenda atualizada';
  if (entity === 'Inventory' && action === 'update') return 'Inventário atualizado';
  if (entity === 'Appointment' && action === 'update') return 'Marcação atualizada';
  return `${entity}: ${action}`;
}

function detailForLog(l) {
  const action = String(l?.action ?? '').trim();
  const kind = String(l?.meta?.kind ?? '').trim();
  if (action === 'notify' && kind === 'order_updated_by_admin') {
    const statusLabels = {
      pending: 'Pendente',
      confirmed: 'Confirmada',
      processing: 'Em preparação',
      shipped: 'Enviada',
      delivered: 'Entregue',
      cancelled: 'Cancelada',
    };
    const actor = String(l?.meta?.actor_email ?? '').trim();
    const prev = String(l?.meta?.previous_status ?? '').trim();
    const next = String(l?.meta?.status ?? '').trim();
    const bits = [];
    if (actor) bits.push(actor);
    if (prev || next) {
      const prevLabel = statusLabels[prev] ?? prev;
      const nextLabel = statusLabels[next] ?? next;
      bits.push(prev && next ? `${prevLabel} → ${nextLabel}` : nextLabel || prevLabel);
    }
    return bits.join(' · ');
  }
  const role = roleLabelForLog(l);
  const prefix = role ? `${role} · ` : '';

  if (String(l?.entity_type ?? '') === 'Appointment' && String(l?.action ?? '') === 'update') {
    const prev = String(l?.meta?.previous_status ?? '').trim();
    const next = String(l?.meta?.status ?? '').trim();
    const prevLabel = prev ? (appointmentStatusLabels[prev] ?? prev) : '';
    const nextLabel = next ? (appointmentStatusLabels[next] ?? next) : '';
    if (prevLabel || nextLabel) {
      return `${prefix}${prevLabel && nextLabel ? `${prevLabel} → ${nextLabel}` : nextLabel || prevLabel}`;
    }
    return role ? role : '';
  }
  if (role) return role;
  return '';
}

export default function SellerNotificationBell() {
  const [readIds, setReadIds] = useState(() => readStoredIds());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SELLER_NOTIFICATIONS_READ_KEY, JSON.stringify(readIds));
  }, [readIds]);

  const { data: logs = [] } = useQuery({
    queryKey: ['seller-logs-bell'],
    queryFn: () => base44.staff.logs.list(20),
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
    setReadIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) return;
        // Keep local state synced if another tab updated read ids.
        setReadIds(readStoredIds());
      }}
    >
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
                <Link to="/vendedor/notificacoes" className="flex items-start gap-3 flex-1 min-w-0" onClick={() => markRead(l.id)}>
                  <div className="mt-0.5 text-muted-foreground">
                    <ScrollText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-body text-sm">
                      <span className="font-medium">{titleForLog(l)}</span>
                    </div>
                    {detailForLog(l) ? (
                      <div className="font-body text-[11px] text-muted-foreground">{detailForLog(l)}</div>
                    ) : null}
                    <div className="font-body text-[11px] text-muted-foreground">{formatWhen(l.created_date)}</div>
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
          <Link to="/vendedor/notificacoes" className="font-body text-sm text-primary">
            Ver todas as notificações
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
