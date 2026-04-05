import React, { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import { getErrorMessage, toastApiPromise } from '@/lib/toast';
import { Database } from 'lucide-react';
import { useConfirm } from '@/components/ui/confirm-provider';

export default function BackupPanel({ showTitle = true } = {}) {
  const inputRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const historyQuery = useQuery({
    queryKey: ['admin-backup-history'],
    queryFn: () => base44.admin.backup.history.list({ limit: 30 }),
    staleTime: 30_000,
  });

  const restoreHistoryMutation = useMutation({
    mutationFn: (id) => base44.admin.backup.history.restore(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-backup-history'] });
    },
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const backup = await base44.admin.backup.export();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `zana-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toastApiPromise(Promise.reject(error), {
        loading: 'A exportar...',
        success: 'Backup exportado com sucesso.',
        error: (e) => getErrorMessage(e, 'Não foi possível exportar o backup.'),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImporting(true);

    try {
      const content = await file.text();
      const payload = JSON.parse(content);
      await toastApiPromise(base44.admin.backup.import(payload), {
        loading: 'A importar backup...',
        success: 'Backup importado com sucesso.',
        error: (e) => getErrorMessage(e, 'Não foi possível importar o backup.'),
      });
    } catch (error) {
      toastApiPromise(Promise.reject(error), {
        loading: 'A importar...',
        success: 'Backup importado com sucesso.',
        error: (e) => getErrorMessage(e, 'Não foi possível importar o backup.'),
      });
    } finally {
      setIsImporting(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {showTitle ? (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-heading text-2xl">Backup de dados</h2>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Exporta e importa dados do site para restaurar ou mover a loja.
            </p>
          </div>
        </div>
      ) : null}

      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="space-y-2">
          <h3 className="font-heading text-xl">Exportar backup</h3>
          <p className="font-body text-sm text-muted-foreground">
            Descarrega um ficheiro JSON com os dados atuais do site.
          </p>
        </div>

        <Button onClick={handleExport} disabled={isExporting} className="rounded-none">
          {isExporting ? 'A exportar...' : 'Exportar backup'}
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="space-y-2">
          <h3 className="font-heading text-xl">Importar backup</h3>
          <p className="font-body text-sm text-muted-foreground">
            Carrega um ficheiro JSON exportado anteriormente para restaurar dados.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input ref={inputRef} type="file" accept=".json,application/json" onChange={handleImport} className="sr-only" />
          <Button onClick={() => inputRef.current?.click()} disabled={isImporting} className="rounded-none">
            {isImporting ? 'A importar...' : 'Selecionar ficheiro de backup'}
          </Button>
          <span className="text-sm text-muted-foreground">O ficheiro será lido e aplicado automaticamente.</span>
        </div>
      </div>

      <div className="bg-muted p-5 rounded-lg text-sm text-muted-foreground space-y-2">
        <p className="font-semibold">Aviso</p>
        <p>A importação substitui os dados atuais do site. Use apenas ficheiros exportados por este painel.</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <h3 className="font-heading text-xl">Histórico de backups (automático)</h3>
            <p className="font-body text-sm text-muted-foreground">
              Sempre que a base de dados é limpa, é guardado um backup aqui para poder restaurar depois.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-none"
            onClick={() => historyQuery.refetch()}
            disabled={historyQuery.isFetching}
          >
            {historyQuery.isFetching ? 'A atualizar...' : 'Atualizar'}
          </Button>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary/20">
              <tr>
                <th className="text-left p-3 text-xs font-body text-muted-foreground uppercase tracking-wide">Data</th>
                <th className="text-left p-3 text-xs font-body text-muted-foreground uppercase tracking-wide">Tipo</th>
                <th className="text-left p-3 text-xs font-body text-muted-foreground uppercase tracking-wide">Detalhes</th>
                <th className="text-right p-3 text-xs font-body text-muted-foreground uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(historyQuery.data?.backups) && historyQuery.data.backups.length > 0 ? (
                historyQuery.data.backups.map((b) => {
                  const createdAt = b?.created_at ? new Date(b.created_at) : null;
                  const dateText = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString('pt-PT') : '-';
                  const meta = b?.meta && typeof b.meta === 'object' ? b.meta : null;
                  const keepCustomers = meta?.keep_customers === true;
                  const keepProducts = meta?.keep_products === true;
                  const counts = meta?.counts && typeof meta.counts === 'object' ? meta.counts : null;
                  const details = [
                    keepCustomers ? 'mantém clientes' : 'remove clientes',
                    keepProducts ? 'mantém produtos' : 'remove produtos',
                    counts?.orders !== undefined ? `${counts.orders} encom.` : null,
                    counts?.purchases !== undefined ? `${counts.purchases} compras` : null,
                  ]
                    .filter(Boolean)
                    .join(' • ');

                  return (
                    <tr key={b.id} className="border-t border-border">
                      <td className="p-3 font-body text-sm">{dateText}</td>
                      <td className="p-3 font-body text-sm">{b.type === 'purge' ? 'Limpeza' : String(b.type ?? '-')}</td>
                      <td className="p-3 font-body text-sm text-muted-foreground">{details || '-'}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-none h-8 px-3 text-xs"
                            onClick={async () => {
                              try {
                                const payload = await base44.admin.backup.history.export(b.id);
                                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `zana-backup-historico-${String(b.id).slice(0, 8)}.json`;
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                                URL.revokeObjectURL(url);
                              } catch (e) {
                                toastApiPromise(Promise.reject(e), {
                                  loading: 'A exportar...',
                                  success: 'Backup exportado.',
                                  error: (err) => getErrorMessage(err, 'Não foi possível exportar o backup.'),
                                });
                              }
                            }}
                          >
                            Exportar
                          </Button>

                          <Button
                            type="button"
                            variant="destructive"
                            className="rounded-none h-8 px-3 text-xs"
                            disabled={restoreHistoryMutation.isPending}
                            onClick={async () => {
                              const ok = await confirm({
                                title: 'Restaurar backup?',
                                description: 'Restaurar este backup vai substituir os dados atuais do site. Tem a certeza?',
                                confirmText: 'Restaurar',
                                cancelText: 'Cancelar',
                                destructive: true,
                              });
                              if (!ok) return;
                              await toastApiPromise(restoreHistoryMutation.mutateAsync(b.id), {
                                loading: 'A restaurar backup...',
                                success: 'Backup restaurado. A recarregar...',
                                error: (err) => getErrorMessage(err, 'Não foi possível restaurar o backup.'),
                              });
                              window.location.reload();
                            }}
                          >
                            Restaurar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr className="border-t border-border">
                  <td colSpan={4} className="p-0">
                    <EmptyState icon={Database} description="Sem backups automáticos ainda." className="py-6" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
