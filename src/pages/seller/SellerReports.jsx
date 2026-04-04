import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, CalendarClock, Download, Euro, ShoppingCart, TrendingUp, User } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import zanaLogoPrimary from '@/img/zana_logo_primary.svg';
import { useBranding } from '@/lib/useBranding';
import { downloadBlob, exportSellerReportsExcel, exportSellerReportsPdf } from '@/lib/reportExport';

function money(value) {
  const n = Number(value ?? 0) || 0;
  return n.toFixed(2).replace('.', ',');
}

function formatLocalYmd(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(d.getTime())) return '';
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function useMediaQuery(query) {
  const getMatches = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

function SalesByDayTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const label = String(row?.fullDate ?? row?.date ?? '');
  const salesRevenue = Number(row?.sales_revenue ?? 0) || 0;
  const orders = Number(row?.orders ?? 0) || 0;

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-sm">
      <div className="font-body text-xs text-muted-foreground">Data</div>
      <div className="font-body text-sm font-semibold">{label || '—'}</div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <div className="font-body text-xs text-muted-foreground">Vendas</div>
          <div className="font-body text-sm font-semibold">€{money(salesRevenue)}</div>
        </div>
        <div>
          <div className="font-body text-xs text-muted-foreground">Encomendas</div>
          <div className="font-body text-sm font-semibold">{orders}</div>
        </div>
      </div>
    </div>
  );
}

function AppointmentsByDayTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const label = String(row?.fullDate ?? row?.date ?? '');
  const apptRevenue = Number(row?.appointments_revenue ?? 0) || 0;
  const appointmentsCompleted = Number(row?.appointments_completed ?? 0) || 0;

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-sm">
      <div className="font-body text-xs text-muted-foreground">Data</div>
      <div className="font-body text-sm font-semibold">{label || '—'}</div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <div className="font-body text-xs text-muted-foreground">Marcações</div>
          <div className="font-body text-sm font-semibold">€{money(apptRevenue)}</div>
        </div>
        <div>
          <div className="font-body text-xs text-muted-foreground">Concluídas</div>
          <div className="font-body text-sm font-semibold">{appointmentsCompleted}</div>
        </div>
      </div>
    </div>
  );
}

export default function SellerReports() {
  const isTinyChart = useMediaQuery('(max-width: 420px)');
  const isNarrowChart = useMediaQuery('(max-width: 640px)');
  const [days, setDays] = useState(30);
  const { branding } = useBranding();
  const reportLogoUrl = String(branding?.logo_primary_url ?? '').trim() || zanaLogoPrimary;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['seller-reports-summary', days],
    queryFn: () => base44.staff.reports.summary(days),
    staleTime: 30_000,
  });

  const { data: appointmentsSettingsRes } = useQuery({
    queryKey: ['seller-appointments-settings-for-reports'],
    queryFn: () => base44.appointments.settings(),
    staleTime: 60_000,
  });

  const appointmentsEnabled = Boolean(appointmentsSettingsRes?.content?.enabled);
  const apptFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - Math.max(1, Number(days) || 30));
    return formatLocalYmd(d);
  }, [days]);
  const apptTo = useMemo(() => formatLocalYmd(new Date()), []);

  const { data: apptRes, isLoading: isLoadingAppt, isError: isErrorAppt, refetch: refetchAppt } = useQuery({
    enabled: appointmentsEnabled,
    queryKey: ['seller-appointments-for-reports', apptFrom, apptTo],
    queryFn: () => base44.staff.appointments.list({ from: apptFrom, to: apptTo, range_by: 'created_at', status: 'all', limit: 5000 }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const appointmentAnalytics = useMemo(() => {
    if (!appointmentsEnabled) return null;
    const appointments = Array.isArray(apptRes?.appointments) ? apptRes.appointments : [];
    const byService = new Map();
    const byStaff = new Map();
    let total = 0;
    let pending = 0;
    let confirmed = 0;
    let completed = 0;
    let cancelled = 0;
    let completedRevenue = 0;
    let completedProfit = 0;

    for (const a of appointments) {
      total += 1;
      const status = String(a?.status ?? '');
      if (status === 'pending') pending += 1;
      if (status === 'confirmed') confirmed += 1;
      if (status === 'completed') completed += 1;
      if (status === 'cancelled') cancelled += 1;

      const serviceName = String(a?.service?.name ?? '').trim() || 'Sem serviço';
      const staffName = String(a?.staff?.name ?? '').trim() || 'Sem atendente';
      const servicePrice = Number(a?.service?.price ?? 0) || 0;
      if (status === 'completed') {
        completedRevenue += servicePrice;
        completedProfit += servicePrice;
      }

      const sRow = byService.get(serviceName) ?? { name: serviceName, total: 0, completed: 0 };
      sRow.total += 1;
      if (status === 'completed') sRow.completed += 1;
      byService.set(serviceName, sRow);

      const stRow = byStaff.get(staffName) ?? { name: staffName, total: 0, completed: 0 };
      stRow.total += 1;
      if (status === 'completed') stRow.completed += 1;
      byStaff.set(staffName, stRow);
    }

    const topServices = Array.from(byService.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
    const topStaff = Array.from(byStaff.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);

    return {
      enabled: true,
      from: apptFrom,
      to: apptTo,
      total,
      pending,
      confirmed,
      completed,
      cancelled,
      completed_revenue: Number(completedRevenue.toFixed(2)),
      completed_profit: Number(completedProfit.toFixed(2)),
      topServices,
      topStaff,
    };
  }, [appointmentsEnabled, apptRes, apptFrom, apptTo]);

  const showAppointmentsCard = Boolean(appointmentsEnabled || isLoadingAppt || isErrorAppt || appointmentAnalytics);

  const byDay = useMemo(() => {
    const list = Array.isArray(data?.by_day) ? data.by_day : [];
    const salesByDate = new Map();

    for (const r of list) {
      const key = String(r?.date ?? '').slice(0, 10);
      if (!key) continue;
      salesByDate.set(key, {
        orders: Number(r?.orders ?? 0) || 0,
        sales_revenue: Number(r?.revenue ?? 0) || 0,
      });
    }

    const apptByDate = new Map();
    const appointments = appointmentsEnabled && Array.isArray(apptRes?.appointments) ? apptRes.appointments : [];
    for (const a of appointments) {
      const status = String(a?.status ?? '');
      if (status !== 'completed') continue;
      const created = a?.created_date ? new Date(a.created_date) : null;
      const key = created && Number.isFinite(created.getTime()) ? created.toISOString().slice(0, 10) : '';
      if (!key) continue;

      const price = Number(a?.service?.price ?? 0) || 0;
      const existing = apptByDate.get(key) ?? { appointments_completed: 0, appointments_revenue: 0 };
      existing.appointments_completed += 1;
      existing.appointments_revenue += price;
      apptByDate.set(key, existing);
    }

    const allDates = new Set([...salesByDate.keys(), ...apptByDate.keys()]);
    return Array.from(allDates)
      .sort((a, b) => String(a).localeCompare(String(b)))
      .map((key) => {
        const sales = salesByDate.get(key) ?? { orders: 0, sales_revenue: 0 };
        const appt = apptByDate.get(key) ?? { appointments_completed: 0, appointments_revenue: 0 };
        return {
          fullDate: key,
          date: String(key).slice(5),
          orders: Number(sales.orders ?? 0) || 0,
          sales_revenue: Number(sales.sales_revenue ?? 0) || 0,
          appointments_completed: Number(appt.appointments_completed ?? 0) || 0,
          appointments_revenue: Number((appt.appointments_revenue ?? 0).toFixed ? appt.appointments_revenue.toFixed(2) : appt.appointments_revenue) || 0,
        };
      });
  }, [appointmentsEnabled, apptRes, data]);

  const salesHasData = useMemo(() => byDay.some((r) => (Number(r?.sales_revenue ?? 0) || 0) > 0), [byDay]);
  const appointmentsHasData = useMemo(
    () => byDay.some((r) => (Number(r?.appointments_revenue ?? 0) || 0) > 0),
    [byDay],
  );

  const scopeLabel = data?.scope === 'mine' ? 'minhas ações' : 'todas as encomendas';

  const exportPdf = async () => {
    const date = formatLocalYmd(new Date());
    const outName = `relatorio_vendedor_${date}.pdf`;
    const popup = window.open('', '_blank');

    try {
      if (popup) popup.document.title = outName;

      const blob = await exportSellerReportsPdf({
        filename: outName,
        title: 'Relatórios (Vendedor)',
        logoUrl: reportLogoUrl,
        createdAt: new Date(),
        orderSummary: data ?? null,
        appointmentAnalytics,
        mode: 'blob',
      });

      if (!(blob instanceof Blob)) throw new Error('pdf_blob_failed');

      if (popup && !popup.closed) {
        const blobUrl = URL.createObjectURL(blob);
        popup.location.href = blobUrl;
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      } else {
        downloadBlob(outName, blob);
      }

      toast.success('PDF exportado');
    } catch (err) {
      console.error(err);
      if (popup && !popup.closed) popup.close();
      toast.error('Não foi possível exportar PDF');
    }
  };

  const exportExcel = async () => {
    try {
      const date = formatLocalYmd(new Date());
      await exportSellerReportsExcel({
        filename: `relatorio_vendedor_${date}.xls`,
        title: 'Relatórios (Vendedor)',
        logoUrl: reportLogoUrl,
        createdAt: new Date(),
        orderSummary: data ?? null,
        appointmentAnalytics,
      });
      toast.success('Excel exportado');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível exportar Excel');
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-heading text-3xl">Relatórios</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Resumo dos últimos {days} dias ({scopeLabel}).
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant={days === 7 ? 'default' : 'outline'} className="rounded-none font-body text-xs" onClick={() => setDays(7)}>
            7 dias
          </Button>
          <Button variant={days === 30 ? 'default' : 'outline'} className="rounded-none font-body text-xs" onClick={() => setDays(30)}>
            30 dias
          </Button>
          <Button variant={days === 90 ? 'default' : 'outline'} className="rounded-none font-body text-xs" onClick={() => setDays(90)}>
            90 dias
          </Button>
          <Button variant="outline" className="rounded-none font-body text-xs" onClick={() => refetch()} disabled={isLoading}>
            Atualizar
          </Button>
          <Button variant="outline" className="rounded-none font-body text-xs gap-2" onClick={exportExcel} disabled={isLoading || isError}>
            <Download className="w-4 h-4" /> Excel
          </Button>
          <Button variant="outline" className="rounded-none font-body text-xs gap-2" onClick={exportPdf} disabled={isLoading || isError}>
            <Download className="w-4 h-4" /> PDF
          </Button>
        </div>
      </div>

      {isError ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <EmptyState icon={BarChart3} description="Não foi possível carregar os relatórios." className="py-6" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card className="rounded-lg">
              <CardHeader className="pb-2">
                <CardTitle className="font-body text-xs text-muted-foreground flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-primary" />
                  Encomendas
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="font-heading text-2xl">{Number(data?.total_orders ?? 0) || 0}</div>
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader className="pb-2">
                <CardTitle className="font-body text-xs text-muted-foreground flex items-center gap-2">
                  <Euro className="w-4 h-4 text-primary" />
                  Receita (total)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="font-heading text-2xl">€{money(data?.revenue_total ?? 0)}</div>
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader className="pb-2">
                <CardTitle className="font-body text-xs text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Receita (entregue)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="font-heading text-2xl">€{money(data?.revenue_delivered ?? 0)}</div>
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader className="pb-2">
                <CardTitle className="font-body text-xs text-muted-foreground flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-primary" />
                  Marcações (concluídas)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="font-heading text-2xl">
                  {appointmentsEnabled ? `€${money(appointmentAnalytics?.completed_revenue ?? 0)}` : '—'}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader className="pb-2">
                <CardTitle className="font-body text-xs text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Ticket médio
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="font-heading text-2xl">
                  €{money((Number(data?.revenue_total ?? 0) || 0) / Math.max(1, Number(data?.total_orders ?? 0) || 0))}
                </div>
              </CardContent>
            </Card>
          </div>

          {showAppointmentsCard ? (
            <Card className="mt-6">
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <CardTitle className="font-heading text-xl">Marcações (últimos {days} dias)</CardTitle>
                  <div className="text-right min-w-0">
                    <div className="font-body text-xs text-muted-foreground">Período</div>
                    <div className="font-body text-sm tabular-nums text-muted-foreground">
                      {appointmentAnalytics?.from ?? apptFrom} → {appointmentAnalytics?.to ?? apptTo}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isErrorAppt ? (
                  <div className="space-y-3">
                    <EmptyState icon={CalendarClock} description="Não foi possível carregar as marcações." className="py-6" />
                    <div className="flex justify-center">
                      <Button variant="outline" className="rounded-none font-body text-sm" onClick={() => refetchAppt()}>
                        Tentar novamente
                      </Button>
                    </div>
                  </div>
                ) : isLoadingAppt ? (
                  <EmptyState icon={CalendarClock} description="A carregar..." className="py-6" />
                ) : (appointmentAnalytics?.total ?? 0) === 0 ? (
                  <EmptyState icon={CalendarClock} description="Sem marcações" className="py-6" />
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-secondary text-foreground text-[10px] tabular-nums">Total: {appointmentAnalytics?.total ?? 0}</Badge>
                      <Badge className="bg-secondary text-foreground text-[10px] tabular-nums">
                        Pendentes: {appointmentAnalytics?.pending ?? 0}
                      </Badge>
                      <Badge className="bg-secondary text-foreground text-[10px] tabular-nums">
                        Confirmadas: {appointmentAnalytics?.confirmed ?? 0}
                      </Badge>
                      <Badge className="bg-secondary text-foreground text-[10px] tabular-nums">
                        Concluídas: {appointmentAnalytics?.completed ?? 0}
                      </Badge>
                      <Badge className="bg-secondary text-foreground text-[10px] tabular-nums">
                        Canceladas: {appointmentAnalytics?.cancelled ?? 0}
                      </Badge>
                      <Badge className="bg-secondary text-foreground text-[10px] tabular-nums">
                        Receita (concluídas): €{money(appointmentAnalytics?.completed_revenue ?? 0)}
                      </Badge>
                      <Badge className="bg-secondary text-foreground text-[10px] tabular-nums">
                        Lucro (concluídas): €{money(appointmentAnalytics?.completed_profit ?? 0)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="rounded-lg border border-border bg-secondary/10 p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <CalendarClock className="w-4 h-4 text-primary shrink-0" />
                            <h3 className="font-heading text-lg truncate">Serviços com mais marcações</h3>
                          </div>
                          <Badge className="bg-secondary text-foreground text-[10px] tabular-nums">{appointmentAnalytics?.total ?? 0}</Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="grid grid-cols-[1fr_auto_auto] gap-3 text-xs text-muted-foreground font-body">
                            <span>Serviço</span>
                            <span className="text-right">Total</span>
                            <span className="text-right">Concl.</span>
                          </div>
                          {(appointmentAnalytics?.topServices ?? []).slice(0, 8).map((s) => (
                            <div key={s.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 font-body text-sm">
                              <div className="min-w-0 truncate">{s.name}</div>
                              <div className="text-right tabular-nums text-muted-foreground">{s.total}</div>
                              <div className="text-right tabular-nums text-muted-foreground">{s.completed}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border border-border bg-secondary/10 p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <User className="w-4 h-4 text-accent shrink-0" />
                            <h3 className="font-heading text-lg truncate">Atendentes com mais marcações</h3>
                          </div>
                          <Badge className="bg-secondary text-foreground text-[10px] tabular-nums">
                            {appointmentAnalytics?.completed ?? 0} concluídas
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="grid grid-cols-[1fr_auto_auto] gap-3 text-xs text-muted-foreground font-body">
                            <span>Atendente</span>
                            <span className="text-right">Total</span>
                            <span className="text-right">Concl.</span>
                          </div>
                          {(appointmentAnalytics?.topStaff ?? []).slice(0, 8).map((s) => (
                            <div key={s.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 font-body text-sm">
                              <div className="min-w-0 truncate">{s.name}</div>
                              <div className="text-right tabular-nums text-muted-foreground">{s.total}</div>
                              <div className="text-right tabular-nums text-muted-foreground">{s.completed}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-xl">Receita de vendas por dia</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 relative">
                  {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <EmptyState icon={BarChart3} description="A carregar..." className="py-0" iconClassName="w-8 h-8" />
                    </div>
                  ) : !salesHasData ? (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <EmptyState icon={BarChart3} description="Sem dados para este período." className="py-0" iconClassName="w-8 h-8" />
                    </div>
                  ) : null}

                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={byDay}
                      margin={{ top: 18, right: 10, bottom: isTinyChart ? 56 : isNarrowChart ? 38 : 12, left: 0 }}
                      barCategoryGap={isNarrowChart ? 10 : 16}
                    >
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isNarrowChart ? 10 : 12 }}
                        interval={isNarrowChart ? 1 : 0}
                        height={isTinyChart ? 60 : isNarrowChart ? 48 : 36}
                        angle={isTinyChart ? -35 : isNarrowChart ? -25 : 0}
                        textAnchor={isNarrowChart ? 'end' : 'middle'}
                        tickMargin={isTinyChart ? 14 : isNarrowChart ? 10 : 8}
                      />
                      <YAxis
                        dataKey="sales_revenue"
                        tickLine={false}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isNarrowChart ? 10 : 12 }}
                        width={isNarrowChart ? 34 : 42}
                        domain={[0, (dataMax) => Math.max(1, Number(dataMax) || 0)]}
                        tickFormatter={(v) => `€${money(v)}`}
                      />
                      <Tooltip cursor={{ fill: 'hsl(var(--secondary) / 0.35)' }} content={<SalesByDayTooltip />} />
                      <Bar dataKey="sales_revenue" radius={[8, 8, 0, 0]} maxBarSize={isNarrowChart ? 36 : 56} fill="hsl(var(--chart-1))">
                        {!isNarrowChart && byDay.length > 0 && byDay.length <= 10 ? (
                          <LabelList dataKey="sales_revenue" position="top" className="font-body text-xs fill-foreground" formatter={(v) => `€${money(v)}`} />
                        ) : null}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-xl">Receita de marcações por dia</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 relative">
                  {appointmentsEnabled && (isLoadingAppt || isErrorAppt) ? (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <EmptyState icon={CalendarClock} description={isLoadingAppt ? 'A carregar...' : 'Não foi possível carregar.'} className="py-0" iconClassName="w-8 h-8" />
                    </div>
                  ) : !appointmentsEnabled ? (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <EmptyState icon={CalendarClock} description="Serviço de marcações desativado." className="py-0" iconClassName="w-8 h-8" />
                    </div>
                  ) : !appointmentsHasData ? (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <EmptyState icon={CalendarClock} description="Sem dados para este período." className="py-0" iconClassName="w-8 h-8" />
                    </div>
                  ) : null}

                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={byDay}
                      margin={{ top: 18, right: 10, bottom: isTinyChart ? 56 : isNarrowChart ? 38 : 12, left: 0 }}
                      barCategoryGap={isNarrowChart ? 10 : 16}
                    >
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isNarrowChart ? 10 : 12 }}
                        interval={isNarrowChart ? 1 : 0}
                        height={isTinyChart ? 60 : isNarrowChart ? 48 : 36}
                        angle={isTinyChart ? -35 : isNarrowChart ? -25 : 0}
                        textAnchor={isNarrowChart ? 'end' : 'middle'}
                        tickMargin={isTinyChart ? 14 : isNarrowChart ? 10 : 8}
                      />
                      <YAxis
                        dataKey="appointments_revenue"
                        tickLine={false}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isNarrowChart ? 10 : 12 }}
                        width={isNarrowChart ? 34 : 42}
                        domain={[0, (dataMax) => Math.max(1, Number(dataMax) || 0)]}
                        tickFormatter={(v) => `€${money(v)}`}
                      />
                      <Tooltip cursor={{ fill: 'hsl(var(--secondary) / 0.35)' }} content={<AppointmentsByDayTooltip />} />
                      <Bar dataKey="appointments_revenue" radius={[8, 8, 0, 0]} maxBarSize={isNarrowChart ? 36 : 56} fill="hsl(var(--chart-4))">
                        {!isNarrowChart && byDay.length > 0 && byDay.length <= 10 ? (
                          <LabelList dataKey="appointments_revenue" position="top" className="font-body text-xs fill-foreground" formatter={(v) => `€${money(v)}`} />
                        ) : null}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
