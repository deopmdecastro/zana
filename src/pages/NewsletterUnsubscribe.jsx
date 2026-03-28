import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { toast } from 'sonner';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/toast';

export default function NewsletterUnsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [status, setStatus] = useState('loading'); // loading | ok | error

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!token) {
          setStatus('error');
          return;
        }
        await base44.newsletter.unsubscribe(token);
        if (!alive) return;
        setStatus('ok');
      } catch (err) {
        if (!alive) return;
        setStatus('error');
        toast.error(getErrorMessage(err, 'Não foi possível cancelar.'));
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-card border border-border rounded-lg p-6 text-center">
        {status === 'loading' ? (
          <>
            <h1 className="font-heading text-3xl">A cancelar…</h1>
            <p className="font-body text-sm text-muted-foreground mt-2">Por favor aguarde.</p>
          </>
        ) : status === 'ok' ? (
          <>
            <h1 className="font-heading text-3xl">Subscrição cancelada</h1>
            <p className="font-body text-sm text-muted-foreground mt-2">
              Já não vai receber emails da newsletter.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-heading text-3xl">Não foi possível</h1>
            <p className="font-body text-sm text-muted-foreground mt-2">
              O link é inválido ou já foi usado.
            </p>
          </>
        )}

        <div className="mt-6 flex items-center justify-center gap-2">
          <Link to="/">
            <Button className="rounded-none font-body text-sm tracking-wider">Voltar ao site</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

