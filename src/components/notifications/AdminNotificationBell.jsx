import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, ScrollText } from 'lucide-react';
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

function formatWhen(value) {
  try {
    return new Date(value).toLocaleString('pt-PT');
  } catch {
    return '';
  }
}

export default function AdminNotificationBell() {
  const { data: logs = [] } = useQuery({
    queryKey: ['admin-logs-bell'],
    queryFn: () => base44.admin.logs.list(20),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const count = Array.isArray(logs) ? logs.length : 0;
  const badge = count > 9 ? '9+' : String(count);

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
          logs.slice(0, 8).map((l) => (
            <DropdownMenuItem key={l.id} asChild className="cursor-pointer">
              <Link to="/admin/logs" className="flex items-start gap-3">
                <div className="mt-0.5 text-muted-foreground">
                  <ScrollText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-body text-sm">
                    <span className="font-medium">{l.action}</span>{' '}
                    <span className="text-muted-foreground">
                      {l.entity_type}
                      {l.entity_id ? ` · ${l.entity_id}` : ''}
                    </span>
                  </div>
                  <div className="font-body text-[11px] text-muted-foreground">
                    {l.actor?.email ?? '—'} · {formatWhen(l.created_date)}
                  </div>
                </div>
              </Link>
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

