import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, CheckCheck, ScrollText } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import LoadMoreControls from '@/components/ui/load-more-controls';
import { getAppointmentStatusLabel } from '@/lib/appointmentStatus';

const READ_KEY = 'zana_seller_notifications_read';

function readStoredIds() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(READ_KEY);
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

const entityLabelsPt = {
  Order: 'Encomenda',
  Appointment: 'Marcação',
  Inventory: 'Inventário',
  Coupon: 'Cupom',
  Product: 'Produto',
  Purchase: 'Compra',
  Return: 'Devolução',
};

const actionLabelsPt = {
  create: 'criada',
  update: 'atualizada',
  delete: 'removida',
  notify: 'notificação',
};

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

  const entityPt = entityLabelsPt[entity] ?? entity;
  const actionPt = actionLabelsPt[action] ?? action;
  return `${entityPt} ${actionPt}`;
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
    const prevLabel = prev ? getAppointmentStatusLabel(prev) : '';
    const nextLabel = next ? getAppointmentStatusLabel(next) : '';
    if (prevLabel || nextLabel) {
      return `${prefix}${prevLabel && nextLabel ? `${prevLabel} → ${nextLabel}` : nextLabel || prevLabel}`;
    }
    return role || '';
  }

  return role || '';
}

export default function SellerNotifications() {
  const [limit, setLimit] = useState(50);
  const [readIds, setReadIds] = useState(() => readStoredIds());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(READ_KEY, JSON.stringify(readIds));
  }, [readIds]);

  const { data: logs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['seller-notifications', limit],
    queryFn: () => base44.staff.logs.list(limit),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const sorted = useMemo(() => {
    const list = Array.isArray(logs) ? logs : [];
    return list
      .slice()
      .sort((a, b) => new Date(b?.created_date ?? 0).getTime() - new Date(a?.created_date ?? 0).getTime());
  }, [logs]);

  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const unreadCount = useMemo(() => sorted.filter((l) => l?.id && !readSet.has(l.id)).length, [sorted, readSet]);

  const canLoadMore = !isLoading && Array.isArray(logs) && logs.length === limit && limit < 500;

  const markRead = (id) => {
    if (!id) return;
    setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const markAllRead = () => {
    const ids = sorted.map((l) => l?.id).filter(Boolean);
    if (!ids.length) return;
    setReadIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

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

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isError ? (
          <div className="p-6">
            <EmptyState icon={Bell} description="Não foi possível carregar as notificações." className="py-6" />
            <div className="mt-4 flex justify-center">
              <Button className="rounded-none font-body text-sm" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          </div>
        ) : sorted.length === 0 && !isLoading ? (
          <EmptyState icon={Bell} description="Ainda não tem notificações." className="py-10" />
        ) : (
          <div className="divide-y divide-border">
            {(sorted ?? []).map((l) => {
              const id = l?.id;
              const read = id ? readSet.has(id) : true;
              const detail = detailForLog(l);
              return (
                <div key={id ?? `${l?.entity_type ?? ''}:${l?.created_date ?? ''}`} className={`p-4 sm:p-5 ${read ? '' : 'bg-primary/5'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex items-start gap-3">
                      <div className="mt-0.5 text-muted-foreground">
                        <ScrollText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-body text-sm font-semibold truncate">{titleForLog(l)}</div>
                          {!read ? (
                            <span className="text-[10px] font-body tracking-widest uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              Nova
                            </span>
                          ) : null}
                        </div>
                        <div className="font-body text-[11px] text-muted-foreground mt-2">
                          {formatWhen(l?.created_date)}
                        </div>
                        {detail ? <div className="font-body text-[12px] text-muted-foreground mt-1">{detail}</div> : null}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <Button
                        variant="outline"
                        className="rounded-none font-body text-xs h-8"
                        onClick={() => markRead(id)}
                        disabled={read || !id}
                      >
                        Marcar lida
                      </Button>
                    </div>
                  </div>
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
    </div>
  );
}
