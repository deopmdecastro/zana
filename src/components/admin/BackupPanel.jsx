import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { getErrorMessage, toastApiPromise } from '@/lib/toast';

export default function BackupPanel({ showTitle = true } = {}) {
  const inputRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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
    </div>
  );
}

