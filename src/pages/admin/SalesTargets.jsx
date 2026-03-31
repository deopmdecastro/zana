import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { downloadCsv } from '@/lib/reportExport';
import LoadMoreControls from '@/components/ui/load-more-controls';

function formatDatePt(value) {
  return value ? new Date(value).toLocaleDateString('pt-PT') : '—';
}

function moneyPt(value) {
  const n = Number(value ?? 0) || 0;
  return n.toFixed(2).replace('.', ',');
}

export default function AdminSalesTargets() {
  const title = 'Metas de Vendas';
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(50);

  const { data: salesTargets = [], isLoading } = useQuery({
    queryKey: ['admin-sales-targets', limit],
    queryFn: () => base44.admin.salesTargets.list('-created_date', limit),
  });

  const canLoadMore = !isLoading && Array.isArray(salesTargets) && salesTargets.length === limit && limit < 500;

  const [salesTargetForm, setSalesTargetForm] = useState({
    name: '',
    description: '',
    start_at: new Date().toISOString().slice(0, 10),
    end_at: new Date().toISOString().slice(0, 10),
    goal_amount: '',
    is_active: true,
  });

  const handleCreateSalesTarget = async (event) => {
    event.preventDefault();
    try {
      await base44.admin.salesTargets.create({
        name: salesTargetForm.name,
        description: salesTargetForm.description || null,
        start_at: salesTargetForm.start_at,
        end_at: salesTargetForm.end_at,
        goal_amount: salesTargetForm.goal_amount,
        is_active: salesTargetForm.is_active,
      });
      toast.success('Meta de vendas criada');
      setSalesTargetForm({ name: '', description: '', start_at: new Date().toISOString().slice(0, 10), end_at: new Date().toISOString().slice(0, 10), goal_amount: '', is_active: true });
      queryClient.invalidateQueries({ queryKey: ['admin-sales-targets'] });
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível criar a meta');
    }
  };

  const exportCsv = () => {
    const now = new Date().toISOString().slice(0, 10);
    const rows = [
      ['Nome', 'Objetivo (€)', 'Concluído (€)', 'Progresso (%)', 'Ativa', 'Início', 'Fim', 'Descrição'],
      ...salesTargets.map((target) => [
        target.name,
        moneyPt(target.goal_amount),
        moneyPt(target.achieved_amount ?? 0),
        target.progress != null ? target.progress.toFixed(2) : '0.00',
        target.is_active ? 'Sim' : 'Não',
        formatDatePt(target.start_at),
        formatDatePt(target.end_at),
        target.description ?? '',
      ]),
    ];

    downloadCsv(`metas_vendas_${now}.csv`, rows);
    toast.success('CSV de metas exportado');
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
          <CardTitle className="font-heading text-xl">Criar meta de vendas</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateSalesTarget} className="space-y-4">
            <div className="grid gap-3">
              <Input
                value={salesTargetForm.name}
                onChange={(e) => setSalesTargetForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nome da meta"
                className="rounded-none"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={salesTargetForm.goal_amount}
                onChange={(e) => setSalesTargetForm((prev) => ({ ...prev, goal_amount: e.target.value }))}
                placeholder="Objetivo (€)"
                className="rounded-none"
              />
              <Input
                type="date"
                value={salesTargetForm.start_at}
                onChange={(e) => setSalesTargetForm((prev) => ({ ...prev, start_at: e.target.value }))}
                className="rounded-none"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                type="date"
                value={salesTargetForm.end_at}
                onChange={(e) => setSalesTargetForm((prev) => ({ ...prev, end_at: e.target.value }))}
                className="rounded-none"
              />
              <Select
                value={salesTargetForm.is_active ? 'active' : 'inactive'}
                onValueChange={(value) => setSalesTargetForm((prev) => ({ ...prev, is_active: value === 'active' }))}
              >
                <SelectTrigger className="rounded-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="inactive">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              value={salesTargetForm.description}
              onChange={(e) => setSalesTargetForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Descrição"
              className="rounded-none"
            />
            <Button type="submit" className="rounded-none font-body text-sm">
              Criar meta
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-heading text-xl">Lista de metas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left p-3 font-body text-xs text-muted-foreground">Meta</th>
                  <th className="text-left p-3 font-body text-xs text-muted-foreground">Objetivo</th>
                  <th className="text-left p-3 font-body text-xs text-muted-foreground">Concluído</th>
                  <th className="text-left p-3 font-body text-xs text-muted-foreground">Progresso</th>
                  <th className="text-left p-3 font-body text-xs text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {salesTargets.map((target) => (
                  <tr key={target.id} className="border-b border-border hover:bg-secondary/20">
                    <td className="p-3 font-body text-sm">{target.name}</td>
                    <td className="p-3 font-body text-sm">{moneyPt(target.goal_amount)} €</td>
                    <td className="p-3 font-body text-sm">{moneyPt(target.achieved_amount ?? 0)} €</td>
                    <td className="p-3 font-body text-sm">{target.progress != null ? `${target.progress.toFixed(2)}%` : '0.00%'}</td>
                    <td className="p-3 font-body text-sm">{target.is_active ? 'Ativa' : 'Inativa'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <LoadMoreControls
            leftText={`A mostrar ${Math.min(limit, Array.isArray(salesTargets) ? salesTargets.length : 0)} metas.`}
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
