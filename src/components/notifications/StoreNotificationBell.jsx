import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, MessageCircle, PackageCheck } from 'lucide-react';
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
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';

const statusLabel = {
  pending: 'Pendente',
  confirmed: 'Confirmada',
  processing: 'Em preparação',
  shipped: 'Enviada',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
};

export default function StoreNotificationBell() {
  const { user } = useAuth();

  const { data: orders = [] } = useQuery({
    enabled: !!user,
    queryKey: ['my-orders-bell'],
    queryFn: () => base44.orders.my(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: notifications = [] } = useQuery({
    enabled: !!user,
    queryKey: ['my-notifications-bell'],
    queryFn: () => base44.notifications.list(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const activeOrdersCount = useMemo(() => {
    return (orders ?? []).filter((o) => !['delivered', 'cancelled'].includes(o.status)).length;
  }, [orders]);

  const notificationsCount = Array.isArray(notifications) ? notifications.length : 0;
  const totalCount = activeOrdersCount + notificationsCount;
  const badge = totalCount > 9 ? '9+' : String(totalCount);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="w-4 h-4" />
          {totalCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] px-1.5 h-4 min-w-4 rounded-full flex items-center justify-center font-body">
              {badge}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[360px] max-w-[calc(100vw-24px)]">
        <DropdownMenuLabel className="font-body text-xs text-muted-foreground">Notificações</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {!user ? (
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/conta" className="font-body text-sm">
              Entrar para ver notificações
            </Link>
          </DropdownMenuItem>
        ) : (
          <>
            {notificationsCount > 0 ? (
              <>
                {notifications.slice(0, 4).map((n) => (
                  <DropdownMenuItem key={n.id} asChild className="cursor-pointer">
                    <Link to={n.link ?? '/'} className="flex items-start gap-3">
                      <div className="mt-0.5 text-muted-foreground">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-body text-sm">
                          <span className="font-medium">{n.title}</span>
                        </div>
                        {n.text ? (
                          <div className="font-body text-[11px] text-muted-foreground line-clamp-2">{n.text}</div>
                        ) : null}
                      </div>
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            ) : null}

            {(orders ?? []).length === 0 ? (
              <DropdownMenuItem disabled className="font-body text-sm">
                Sem encomendas
              </DropdownMenuItem>
            ) : (
              (orders ?? []).slice(0, 6).map((o) => (
                <DropdownMenuItem key={o.id} asChild className="cursor-pointer">
                  <Link to="/conta" className="flex items-start gap-3">
                    <div className="mt-0.5 text-muted-foreground">
                      <PackageCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-body text-sm">
                        <span className="font-medium">{statusLabel[o.status] ?? o.status}</span>{' '}
                        <span className="text-muted-foreground">· {Number(o.total ?? 0).toFixed(2)} €</span>
                      </div>
                      <div className="font-body text-[11px] text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString('pt-PT')} · {(o.items ?? []).length} itens
                      </div>
                    </div>
                  </Link>
                </DropdownMenuItem>
              ))
            )}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/conta" className="font-body text-sm text-primary">
            Ver detalhes na conta
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

