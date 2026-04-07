import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CreditCard, Download } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { downloadCsv } from '@/lib/reportExport';
import LoadMoreControls from '@/components/ui/load-more-controls';
import EmptyState from '@/components/ui/empty-state';

function formatDatePt(value) {
  return value ? new Date(value).toLocaleDateString('pt-PT') : '—';
}

function moneyPt(value) {
  const n = Number(value ?? 0) || 0;
  return n.toFixed(2).replace('.', ',');
}

export default function AdminCashClosures() {
  const title = 'Fecho de Caixa';
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(50);

  const { data: cashClosures = [], isLoading } = useQuery({
    queryKey: ['admin-cash-closures', limit],
    queryFn: () => base44.admin.cashClosures.list('-created_date', limit),
  });

  const canLoadMore = !isLoading && Array.isArray(cashClosures) && cashClosures.length === limit && limit < 500;

  const [cashClosureForm, setCashClosureForm] = useState({
    started_at: new Date().toISOString().slice(0, 10),
    ended_at: new Date().toISOString().slice(0, 10),
    opening_balance: '',
    notes: '',
  });

  const { data: salesSummary } = useQuery({
    queryKey: ['admin-cash-closures-summary', cashClosureForm.started_at, cashClosureForm.ended_at],
    queryFn: () => base44.admin.cashClosures.summary({ started_at: cashClosureForm.started_at, ended_at: cashClosureForm.ended_at }),
    enabled: Boolean(cashClosureForm.started_at && cashClosureForm.ended_at),
    staleTime: 30_000,
  });

  const openingBalanceNumber = useMemo(() => {
    const raw = String(cashClosureForm.opening_balance ?? '').trim().replace(',', '.');
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }, [cashClosureForm.opening_balance]);

  const totalSalesNumber = useMemo(() => {
    const n = Number(salesSummary?.total_sales ?? 0);
    return Number.isFinite(n) ? n : 0;
  }, [salesSummary?.total_sales]);

  const closingBalanceNumber = useMemo(() => openingBalanceNumber + totalSalesNumber, [openingBalanceNumber, totalSalesNumber]);

  const handleCreateCashClosure = async (event) => {
    event.preventDefault();
    try {
      await base44.admin.cashClosures.create({
        started_at: cashClosureForm.started_at,
        ended_at: cashClosureForm.ended_at,
        opening_balance: String(openingBalanceNumber.toFixed(2)),
        closing_balance: String(closingBalanceNumber.toFixed(2)),
        total_sales: String(totalSalesNumber.toFixed(2)),
        notes: cashClosureForm.notes || null,
      });
      toast.success('Fecho de caixa registado');
      setCashClosureForm({ started_at: new Date().toISOString().slice(0, 10), ended_at: new Date().toISOString().slice(0, 10), opening_balance: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['admin-cash-closures'] });
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível registar o fecho de caixa');
    }
  };

  const exportCsv = () => {
    const now = new Date().toISOString().slice(0, 10);
    const rows = [
      ['Início', 'Fim', 'Saldo inicial (€)', 'Saldo final (€)', 'Total vendas (€)', 'Notas'],
      ...cashClosures.map((closure) => [
        formatDatePt(closure.started_at),
        formatDatePt(closure.ended_at),
        moneyPt(closure.opening_balance),
        moneyPt(closure.closing_balance),
        closure.total_sales != null ? moneyPt(closure.total_sales) : '—',
        closure.notes ?? '',
      ]),
    ];

    downloadCsv(`fecho_caixa_${now}.csv`, rows);
    toast.success('CSV de fecho de caixa exportado');
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <h1 className="font-heading text-3xl">{title}</h1>
        <Button variant="outline" className="rounded-none font-body text-sm gap-2" onClick={exportCsv}>
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-xl">Registar fecho de caixa</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateCashClosure} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                type="date"
                value={cashClosureForm.started_at}
                onChange={(e) => setCashClosureForm((prev) => ({ ...prev, started_at: e.target.value }))}
                className="rounded-none"
              />
              <Input
                type="date"
                value={cashClosureForm.ended_at}
                onChange={(e) => setCashClosureForm((prev) => ({ ...prev, ended_at: e.target.value }))}
                className="rounded-none"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="font-body text-xs">Saldo inicial</label>
                <Input
                  value={cashClosureForm.opening_balance}
                  onChange={(e) => setCashClosureForm((prev) => ({ ...prev, opening_balance: e.target.value }))}
                  placeholder="Saldo inicial"
                  className="rounded-none mt-1"
                />
              </div>
              <div>
                <label className="font-body text-xs">Saldo final</label>
                <Input
                  value={moneyPt(closingBalanceNumber)}
                  placeholder="Saldo final"
                  className="rounded-none mt-1"
                  disabled
                />
              </div>
            </div>
            <div>
              <label className="font-body text-xs">Total de vendas</label>
              <Input
                value={moneyPt(totalSalesNumber)}
                placeholder="Total de vendas"
                className="rounded-none mt-1"
                disabled
              />
            </div>
            <textarea
              value={cashClosureForm.notes}
              onChange={(e) => setCashClosureForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Notas"
              className="w-full rounded-none border border-border p-2 text-sm"
            />
            <Button type="submit" className="rounded-none font-body text-sm">
              Registar fecho
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-heading text-xl">Histórico de fechos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Período</th>
                  <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Saldo inicial</th>
                  <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Saldo final</th>
                  <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Vendas</th>
                </tr>
              </thead>
              <tbody>
                {!isLoading && cashClosures.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-0">
                      <EmptyState icon={CreditCard} description="Sem fechos registados" className="py-10" />
                    </td>
                  </tr>
                ) : (
                  cashClosures.map((closure) => (
                    <tr key={closure.id} className="border-b border-border hover:bg-secondary/20">
                      <td className="p-3 font-body text-sm whitespace-nowrap">
                        {formatDatePt(closure.started_at)} – {formatDatePt(closure.ended_at)}
                      </td>
                      <td className="p-3 font-body text-sm whitespace-nowrap">{moneyPt(closure.opening_balance)} €</td>
                      <td className="p-3 font-body text-sm whitespace-nowrap">{moneyPt(closure.closing_balance)} €</td>
                      <td className="p-3 font-body text-sm whitespace-nowrap">{closure.total_sales != null ? `${moneyPt(closure.total_sales)} €` : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <LoadMoreControls
            leftText={`A mostrar ${Math.min(limit, Array.isArray(cashClosures) ? cashClosures.length : 0)} fechos.`}
            onLess={() => setLimit(50)}
            lessDisabled={isLoading || limit <= 50}
            onMore={() => setLimit((p) => Math.min(500, p + 50))}
            moreDisabled={!canLoadMore}
          />
        </CardContent>
      </Card>
    </div>
  );
}
