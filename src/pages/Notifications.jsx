import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, CheckCheck, MessageCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/AuthContext';
import Auth from './Auth';

const READ_STORAGE_KEY = 'zana_notifications_read';

function readStoredReadIds() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(READ_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [readIds, setReadIds] = useState(() => readStoredReadIds());
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(readIds));
  }, [readIds]);

  const { data: notifications = [], isLoading, isError, refetch } = useQuery({
    enabled: !!user,
    queryKey: ['my-notifications'],
    queryFn: () => base44.notifications.list(),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const sorted = useMemo(() => {
    const list = Array.isArray(notifications) ? notifications : [];
    return list
      .slice()
      .sort(
        (a, b) =>
          new Date(b?.created_at ?? b?.created_date ?? 0).getTime() -
          new Date(a?.created_at ?? a?.created_date ?? 0).getTime(),
      );
  }, [notifications]);

  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const unreadCount = useMemo(() => sorted.filter((n) => n?.id && !readSet.has(n.id)).length, [sorted, readSet]);

  const markAllRead = () => {
    const ids = sorted.map((n) => n?.id).filter(Boolean);
    setReadIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const markRead = (id) => {
    if (!id) return;
    setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const openNotification = (notification) => {
    if (!notification) return;
    setSelectedNotification(notification);
    setIsOpen(true);
    markRead(notification?.id);
  };

  const goToNotificationLink = (href) => {
    const target = String(href ?? '').trim();
    if (!target) return;
    setIsOpen(false);
    setSelectedNotification(null);
    if (target.startsWith('/')) {
      navigate(target);
      return;
    }
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  if (!user) return <Auth />;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-heading text-3xl md:text-4xl">Notificações</h1>
            <p className="font-body text-sm text-muted-foreground mt-1">
              {unreadCount > 0 ? `${unreadCount} por ler` : 'Sem novas notificações'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-none font-body text-sm" onClick={() => refetch()} disabled={isLoading}>
            Atualizar
          </Button>
          <Button
            className="rounded-none font-body text-sm gap-2"
            onClick={markAllRead}
            disabled={sorted.length === 0 || unreadCount === 0}
          >
            <CheckCheck className="w-4 h-4" />
            Marcar tudo lido
          </Button>
        </div>
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
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-body text-sm text-muted-foreground">Ainda não tem notificações.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sorted.map((n) => {
              const id = n?.id;
              const isRead = id ? readSet.has(id) : true;
              const href = String(n?.link ?? '').trim() || '/';
              return (
                <div key={id ?? href} className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex items-start gap-3">
                      <div className="mt-0.5 text-muted-foreground">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-body text-sm font-semibold truncate">{n?.title ?? 'Notificação'}</div>
                          {!isRead ? (
                            <span className="text-[10px] font-body tracking-widest uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              Nova
                            </span>
                          ) : null}
                        </div>
                        {n?.text ? (
                          <div className="font-body text-[12px] text-muted-foreground mt-1 whitespace-pre-line">
                            {n.text}
                          </div>
                        ) : null}
                        {n?.created_at || n?.created_date ? (
                          <div className="font-body text-[11px] text-muted-foreground mt-2">
                            {new Date(n.created_at ?? n.created_date).toLocaleString('pt-PT')}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        className="rounded-none font-body text-xs h-8"
                        onClick={() => markRead(id)}
                        disabled={isRead || !id}
                      >
                        Marcar lida
                      </Button>
                      <Button className="rounded-none font-body text-xs h-8" onClick={() => openNotification(n)}>
                        Abrir
                      </Button>
                    </div>
                  </div>
                  <Separator className="mt-4" />
                  <div className="pt-3">
                    <Link to="/catalogo" className="font-body text-xs text-muted-foreground hover:text-primary transition-colors">
                      Ir para a loja
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={isOpen}
        onOpenChange={(next) => {
          setIsOpen(next);
          if (!next) setSelectedNotification(null);
        }}
      >
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {selectedNotification?.title ?? 'Notificação'}
            </DialogTitle>
            {selectedNotification?.created_at || selectedNotification?.created_date ? (
              <DialogDescription className="font-body text-xs">
                {new Date(selectedNotification.created_at ?? selectedNotification.created_date).toLocaleString('pt-PT')}
              </DialogDescription>
            ) : (
              <DialogDescription className="font-body text-xs text-muted-foreground">
                Detalhes da notificação
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedNotification?.text ? (
            <div className="font-body text-sm whitespace-pre-line">{selectedNotification.text}</div>
          ) : (
            <div className="font-body text-sm text-muted-foreground">Sem mensagem.</div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="rounded-none font-body text-sm"
              onClick={() => markRead(selectedNotification?.id)}
              disabled={!selectedNotification?.id}
            >
              Marcar lida
            </Button>
            {String(selectedNotification?.link ?? '').trim() ? (
              <Button
                className="rounded-none font-body text-sm"
                onClick={() => goToNotificationLink(selectedNotification?.link)}
              >
                Ir para o detalhe
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
