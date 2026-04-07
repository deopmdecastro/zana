import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchableSelect from '@/components/ui/searchable-select';
import { FileText, Search, TrendingUp, MapPin, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { appointmentStatusLabels } from '@/lib/appointmentStatus';
import { entityCode } from '@/utils/entityCode';
import LoadMoreControls from '@/components/ui/load-more-controls';
import EmptyState from '@/components/ui/empty-state';

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

function formatDateCode(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const y = String(d.getFullYear());
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function fnv1a32(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

function logCode(log) {
  const datePart = formatDateCode(log?.created_date);
  const raw = String(log?.id ?? '');
  const base = fnv1a32(raw).toString(36).padStart(6, '0').slice(0, 6);
  const dotted = `${base.slice(0, 2)}.${base.slice(2, 4)}.${base.slice(4, 6)}`;
  return `zana_logs_${datePart}_${dotted}`;
}

function actionLabel(action) {
  if (action === 'create') return 'criado';
  if (action === 'update') return 'atualizado';
  if (action === 'delete') return 'removido';
  return String(action ?? '-');
}

function entityLabel(entityType) {
  if (!entityType) return '-';
  const map = {
    Order: 'Encomenda',
    Product: 'Produto',
    Supplier: 'Fornecedor',
    Purchase: 'Compra',
    Inventory: 'Inventário',
    BlogPost: 'Blog',
    BlogComment: 'Comentário',
    SiteContent: 'Conteúdo do site',
    Review: 'Avaliação',
    SupportTicket: 'Suporte',
    SupportMessage: 'Mensagem de suporte',
    User: 'Utilizador',
  };
  return map[entityType] ?? String(entityType);
}

function statusLabel(status) {
  const map = {
    ...appointmentStatusLabels,
    processing: 'Em preparação',
    shipped: 'Enviada',
    delivered: 'Entregue',
  };
  return map[status] ?? status;
}

function metaSummary(meta, { action, entityType } = {}) {
  if (meta === null || meta === undefined) return null;
  if (typeof meta !== 'object') return String(meta);

  const status = typeof meta.status === 'string' ? meta.status : null;
  const prev = typeof meta.previous_status === 'string' ? meta.previous_status : null;
  const source = typeof meta.source === 'string' ? meta.source : null;
  const customerEmail = typeof meta.customer_email === 'string' ? meta.customer_email : null;
  const keys = Array.isArray(meta.keys) ? meta.keys.filter(Boolean) : null;

  if (entityType === 'Order' && action === 'update' && (status || prev)) {
    const right = status ? statusLabel(status) : '';
    const left = prev ? statusLabel(prev) : '';
    if (left && right) return `Estado: ${left} → ${right}`;
    if (right) return `Estado: ${right}`;
  }

  if (entityType === 'Order' && action === 'create' && customerEmail) {
    return `Cliente: ${customerEmail}`;
  }

  if (entityType === 'SiteContent' && keys?.length) {
    return `Campos: ${keys.slice(0, 4).join(', ')}${keys.length > 4 ? '…' : ''}`;
  }

  if (source) return `Origem: ${source}`;
  if (customerEmail) return `Cliente: ${customerEmail}`;

  const firstKey = Object.keys(meta)[0];
  if (!firstKey) return null;
  return `${firstKey}: ${String(meta[firstKey]).slice(0, 60)}`;
}

function metaPairs(meta) {
  if (meta === null || meta === undefined) return [];
  if (typeof meta !== 'object') return [['Detalhe', String(meta)]];

  const pairs = [];
  if (typeof meta.source === 'string') pairs.push(['Origem', meta.source]);
  if (typeof meta.customer_email === 'string') pairs.push(['Cliente', meta.customer_email]);
  if (typeof meta.status === 'string') pairs.push(['Estado', statusLabel(meta.status)]);
  if (typeof meta.previous_status === 'string') pairs.push(['Estado anterior', statusLabel(meta.previous_status)]);

  if (typeof meta.tracking_code === 'string' && meta.tracking_code) pairs.push(['Rastreamento', meta.tracking_code]);
  if (typeof meta.tracking_carrier === 'string' && meta.tracking_carrier) pairs.push(['Transportadora', meta.tracking_carrier]);
  if (typeof meta.tracking_url === 'string' && meta.tracking_url) pairs.push(['Link de rastreamento', meta.tracking_url]);

  if (Array.isArray(meta.keys) && meta.keys.length) pairs.push(['Campos alterados', meta.keys.join(', ')]);

  return pairs;
}

export default function AdminLogs() {
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [showRawMeta, setShowRawMeta] = useState(false);
  const [limit, setLimit] = useState(10);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin-logs', limit],
    queryFn: () => base44.admin.logs.list(limit),
  });

  const canLoadMore = !isLoading && Array.isArray(logs) && logs.length === limit && limit < 500;

  const entityFirstSeen = useMemo(() => {
    const seen = new Map();
    (Array.isArray(logs) ? logs : []).forEach((l) => {
      const entityType = l?.entity_type;
      const entityId = l?.entity_id;
      if (!entityType || !entityId) return;
      const key = `${entityType}:${entityId}`;
      const date = new Date(l?.created_date);
      if (Number.isNaN(date.getTime())) return;
      const current = seen.get(key);
      if (!current || date < current) seen.set(key, date);
    });
    return seen;
  }, [logs]);

  const { data: analytics } = useQuery({
    queryKey: ['admin-analytics-summary'],
    queryFn: () => base44.admin.analytics.summary(30),
  });

  useEffect(() => {
    setShowRawMeta(false);
  }, [selected?.id]);

  const peakHour = useMemo(() => {
    const hours = analytics?.visits_by_hour ?? [];
    if (!hours.length) return null;
    return hours.reduce((best, cur) => (cur.count > best.count ? cur : best), hours[0]);
  }, [analytics]);

  const entities = useMemo(() => {
    const unique = new Set(logs.map((l) => l.entity_type).filter(Boolean));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const entityFilterOptions = useMemo(() => {
    return [{ value: 'all', label: 'Todas' }, ...entities.map((e) => ({ value: e, label: e }))];
  }, [entities]);

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
          {entities.length > 10 ? (
            <div className="w-44">
              <SearchableSelect
                value={entityFilter}
                onChange={setEntityFilter}
                options={entityFilterOptions}
                placeholder="Entidade"
                searchPlaceholder="Pesquisar entidade..."
                className="rounded-none"
              />
            </div>
          ) : (
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
          )}
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
              placeholder="Pesquisar (ator, entidade, id, detalhes)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-none"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-xs text-muted-foreground">Clientes que mais compram (30d)</span>
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            {(analytics?.top_customers ?? []).length === 0 ? (
              <EmptyState icon={FileText} description="Sem dados" className="py-6" />
            ) : (
              <div className="space-y-2">
                {(analytics?.top_customers ?? []).slice(0, 4).map((c) => (
                  <div key={c.email} className="flex items-center justify-between gap-3 font-body text-sm">
                    <span className="truncate max-w-[240px]">{c.email}</span>
                    <span className="text-muted-foreground whitespace-nowrap">{Number(c.total ?? 0).toFixed(2)} €</span>
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
              <EmptyState icon={TrendingUp} description="Sem dados" className="py-6" />
            ) : (
              <div className="space-y-2">
                {(analytics?.orders_by_country ?? []).slice(0, 4).map((c) => (
                  <div key={c.country} className="flex items-center justify-between gap-3 font-body text-sm">
                    <span className="truncate max-w-[240px]">{c.country}</span>
                    <span className="text-muted-foreground whitespace-nowrap">{c.orders}</span>
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
              <EmptyState icon={MapPin} description="Sem dados" className="py-6" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Data</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Ator</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Ação</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Entidade</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Código</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Detalhes</th>
              <th className="text-right p-3 font-body text-xs text-muted-foreground whitespace-nowrap">Ver</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading && filtered.length === 0 ? (
              <tr className="border-b border-border last:border-0">
                <td colSpan={7} className="p-0">
                  <EmptyState icon={FileText} description="Sem logs" className="py-6" />
                </td>
              </tr>
            ) : (
              (isLoading ? [] : filtered).map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                  <td className="p-3 font-body text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(l.created_date).toLocaleString('pt-PT')}
                  </td>
                  <td className="p-3 font-body text-sm">{l.actor?.email ?? '-'}</td>
                  <td className="p-3">
                    <Badge className={`${actionColor[l.action] ?? 'bg-secondary text-foreground'} text-[10px]`}>
                      {l.action}
                    </Badge>
                  </td>
                  <td className="p-3 font-body text-sm">
                    <div className="font-medium">{entityLabel(l.entity_type)}</div>
                    {l.entity_type && l.entity_id ? (
                      <div className="font-body text-[11px] text-muted-foreground truncate max-w-[260px]">
                        <span title={String(l.entity_id)}>
                          {entityCode({
                            entityType: l.entity_type,
                            entityId: l.entity_id,
                            createdDate: entityFirstSeen.get(`${l.entity_type}:${l.entity_id}`) ?? l.created_date,
                          })}
                        </span>
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3 font-body text-xs text-muted-foreground whitespace-nowrap">{logCode(l)}</td>
                  <td className="p-3 font-body text-xs text-muted-foreground">
                    <span className="line-clamp-2">
                      {metaSummary(safeJson(l.meta), { action: l.action, entityType: l.entity_type }) ?? '—'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => setSelected(l)} title="Ver detalhes">
                      <FileText className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <LoadMoreControls
        leftText={`A mostrar os últimos ${Math.min(limit, Array.isArray(logs) ? logs.length : 0)} logs.`}
        onLess={() => setLimit(10)}
        lessDisabled={isLoading || limit <= 10}
        onMore={() => setLimit((p) => Math.min(500, p + 20))}
        moreDisabled={!canLoadMore}
      />

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Detalhes do log</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 font-body text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">Data</p>
                  <p className="font-medium">{new Date(selected.created_date).toLocaleString('pt-PT')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Ator</p>
                  <p className="font-medium">{selected.actor?.email ?? '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Código do log</p>
                  <p className="font-medium">{logCode(selected)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Código da entidade</p>
                  <p className="font-medium">
                    {selected.entity_type && selected.entity_id
                      ? entityCode({
                          entityType: selected.entity_type,
                          entityId: selected.entity_id,
                          createdDate:
                            entityFirstSeen.get(`${selected.entity_type}:${selected.entity_id}`) ?? selected.created_date,
                        })
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Ação</p>
                  <p className="font-medium">{actionLabel(selected.action)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground text-xs">Entidade</p>
                  <p className="font-medium">
                    {entityLabel(selected.entity_type)} {selected.entity_id ? `(${selected.entity_id})` : ''}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div>
                    <p className="text-muted-foreground text-xs">Detalhes</p>
                    <p className="text-[11px] text-muted-foreground">
                      “Meta” é informação técnica do que foi guardado no log. Aqui está em formato mais claro (e pode ver o
                      JSON completo se quiser).
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-none font-body text-sm"
                    onClick={() => setShowRawMeta((p) => !p)}
                  >
                    {showRawMeta ? 'Ver resumo' : 'Ver JSON'}
                  </Button>
                </div>

                {(() => {
                  const meta = safeJson(selected.meta);
                  const pairs = metaPairs(meta);

                  if (!showRawMeta) {
                    return pairs.length ? (
                      <div className="bg-secondary/20 border border-border rounded-md p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {pairs.map(([k, v]) => (
                            <div key={k} className="min-w-0">
                              <div className="text-[11px] text-muted-foreground">{k}</div>
                              <div className="font-body text-sm font-medium truncate">{String(v)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="font-body text-sm text-muted-foreground">Sem detalhes adicionais.</p>
                    );
                  }

                  return (
                    <pre className="text-xs bg-secondary/30 border border-border rounded-md p-3 overflow-x-auto">
                      {JSON.stringify(meta, null, 2)}
                    </pre>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
