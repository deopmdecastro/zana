import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, FileText, TrendingUp, MapPin, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

function safeJson(value) {
  if (value === null || value === undefined) return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return value;
  }
}

const actionColor = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-destructive/10 text-destructive',
};

export default function AdminLogs() {
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin-logs'],
    queryFn: () => base44.admin.logs.list(300),
  });

  const { data: analytics } = useQuery({
    queryKey: ['admin-analytics-summary'],
    queryFn: () => base44.admin.analytics.summary(30),
  });

  const peakHour = useMemo(() => {
    const hours = analytics?.visits_by_hour ?? [];
    if (!hours.length) return null;
    return hours.reduce((best, cur) => (cur.count > best.count ? cur : best), hours[0]);
  }, [analytics]);

  const entities = useMemo(() => {
    const unique = new Set(logs.map((l) => l.entity_type).filter(Boolean));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (entityFilter !== 'all' && l.entity_type !== entityFilter) return false;
      if (actionFilter !== 'all' && l.action !== actionFilter) return false;
      if (!q) return true;
      const hay = [l.action, l.entity_type, l.entity_id, l.actor?.email, JSON.stringify(l.meta ?? null)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [logs, search, entityFilter, actionFilter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="font-heading text-3xl">Logs</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-44 rounded-none">
              <SelectValue placeholder="Entidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {entities.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-36 rounded-none">
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="create">create</SelectItem>
              <SelectItem value="update">update</SelectItem>
              <SelectItem value="delete">delete</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-72 max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar (ator, entidade, id, meta)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-none"
            />
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-xs text-muted-foreground">Clientes que mais compram (30d)</span>
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            {(analytics?.top_customers ?? []).length === 0 ? (
              <p className="font-body text-sm text-muted-foreground">Sem dados</p>
            ) : (
              <div className="space-y-2">
                {(analytics?.top_customers ?? []).slice(0, 4).map((c) => (
                  <div key={c.email} className="flex items-center justify-between font-body text-sm">
                    <span className="truncate max-w-[210px]">{c.email}</span>
                    <span className="text-muted-foreground">{c.total.toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-xs text-muted-foreground">Países (encomendas, 30d)</span>
              <MapPin className="w-4 h-4 text-accent" />
            </div>
            {(analytics?.orders_by_country ?? []).length === 0 ? (
              <p className="font-body text-sm text-muted-foreground">Sem dados</p>
            ) : (
              <div className="space-y-2">
                {(analytics?.orders_by_country ?? []).slice(0, 4).map((c) => (
                  <div key={c.country} className="flex items-center justify-between font-body text-sm">
                    <span className="truncate max-w-[210px]">{c.country}</span>
                    <span className="text-muted-foreground">{c.orders}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-xs text-muted-foreground">Horário com mais visitas (30d)</span>
              <Clock className="w-4 h-4 text-green-700" />
            </div>
            {peakHour ? (
              <div className="font-body text-sm">
                <div className="text-2xl font-heading">{String(peakHour.hour).padStart(2, '0')}:00</div>
                <div className="text-muted-foreground">{peakHour.count} visitas</div>
              </div>
            ) : (
              <p className="font-body text-sm text-muted-foreground">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Data</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Ator</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Ação</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Entidade</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">ID</th>
              <th className="text-right p-3 font-body text-xs text-muted-foreground">Meta</th>
            </tr>
          </thead>
          <tbody>
            {(isLoading ? [] : filtered).map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                <td className="p-3 font-body text-xs text-muted-foreground">
                  {new Date(l.created_date).toLocaleString('pt-PT')}
                </td>
                <td className="p-3 font-body text-sm">{l.actor?.email ?? '-'}</td>
                <td className="p-3">
                  <Badge className={`${actionColor[l.action] ?? 'bg-secondary text-foreground'} text-[10px]`}>
                    {l.action}
                  </Badge>
                </td>
                <td className="p-3 font-body text-sm">{l.entity_type}</td>
                <td className="p-3 font-body text-xs text-muted-foreground">{l.entity_id ?? '-'}</td>
                <td className="p-3 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelected(l)}
                    disabled={l.meta === null || l.meta === undefined}
                    title="Ver meta"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && filtered.length === 0 && (
          <p className="text-center py-8 font-body text-sm text-muted-foreground">Sem logs</p>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Detalhes do log</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 font-body text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">Data</p>
                  <p className="font-medium">{new Date(selected.created_date).toLocaleString('pt-PT')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Ator</p>
                  <p className="font-medium">{selected.actor?.email ?? '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Ação</p>
                  <p className="font-medium">{selected.action}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Entidade</p>
                  <p className="font-medium">
                    {selected.entity_type} {selected.entity_id ? `(${selected.entity_id})` : ''}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-2">Meta</p>
                <pre className="text-xs bg-secondary/30 border border-border rounded-md p-3 overflow-x-auto">
                  {JSON.stringify(safeJson(selected.meta), null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

