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
  if (!value) return 'Sem limite';
  return new Date(value).toLocaleDateString('pt-PT');
}

function moneyPt(value) {
  const n = Number(value ?? 0) || 0;
  return n.toFixed(2).replace('.', ',');
}

export default function AdminCoupons() {
  const title = 'Cupons';
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(50);

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['admin-coupons', limit],
    queryFn: () => base44.admin.coupons.list('-created_date', limit),
  });

  const canLoadMore = !isLoading && Array.isArray(coupons) && coupons.length === limit && limit < 500;

  const [couponForm, setCouponForm] = useState({
    code: '',
    type: 'amount',
    value: '',
    description: '',
    max_uses: '',
    min_order_subtotal: '',
    expires_at: '',
  });

  const handleCreateCoupon = async (event) => {
    event.preventDefault();
    try {
      await base44.admin.coupons.create({
        code: couponForm.code,
        type: couponForm.type,
        value: couponForm.value,
        description: couponForm.description || null,
        max_uses: couponForm.max_uses || null,
        min_order_subtotal: couponForm.min_order_subtotal || null,
        expires_at: couponForm.expires_at || null,
      });
      toast.success('Cupom criado');
      setCouponForm({ code: '', type: 'amount', value: '', description: '', max_uses: '', min_order_subtotal: '', expires_at: '' });
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível criar o cupom');
    }
  };

  const exportCsv = () => {
    const now = new Date().toISOString().slice(0, 10);
    const rows = [
      ['Código', 'Tipo', 'Valor', 'Usos', 'Máximo usos', 'Subtotal mínimo', 'Expira', 'Ativo', 'Descrição'],
      ...coupons.map((coupon) => [
        coupon.code,
        coupon.type,
        coupon.type === 'percent' ? `${coupon.value}%` : `${moneyPt(coupon.value)} €`,
        coupon.used_count ?? 0,
        coupon.max_uses ?? '∞',
        coupon.min_order_subtotal != null ? `${moneyPt(coupon.min_order_subtotal)} €` : 'Nenhum',
        coupon.expires_at ? formatDatePt(coupon.expires_at) : 'Sem limite',
        coupon.is_active ? 'Sim' : 'Não',
        coupon.description ?? '',
      ]),
    ];

    downloadCsv(`cupons_${now}.csv`, rows);
    toast.success('CSV de cupons exportado');
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
          <CardTitle className="font-heading text-xl">Criar cupom</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateCoupon} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={couponForm.code}
                onChange={(e) => setCouponForm((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="Código"
                className="rounded-none"
              />
              <Select value={couponForm.type} onValueChange={(value) => setCouponForm((prev) => ({ ...prev, type: value }))}>
                <SelectTrigger className="rounded-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount">Valor fixo</SelectItem>
                  <SelectItem value="percent">Percentual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                value={couponForm.value}
                onChange={(e) => setCouponForm((prev) => ({ ...prev, value: e.target.value }))}
                placeholder="Valor"
                className="rounded-none"
              />
              <Input
                value={couponForm.max_uses}
                onChange={(e) => setCouponForm((prev) => ({ ...prev, max_uses: e.target.value }))}
                placeholder="Número de usos"
                className="rounded-none"
              />
              <Input
                value={couponForm.min_order_subtotal}
                onChange={(e) => setCouponForm((prev) => ({ ...prev, min_order_subtotal: e.target.value }))}
                placeholder="Subtotal mínimo"
                className="rounded-none"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={couponForm.expires_at}
                type="date"
                onChange={(e) => setCouponForm((prev) => ({ ...prev, expires_at: e.target.value }))}
                className="rounded-none"
              />
              <Input
                value={couponForm.description}
                onChange={(e) => setCouponForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição"
                className="rounded-none"
              />
            </div>
            <Button type="submit" className="rounded-none font-body text-sm">
              Criar cupom
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-heading text-xl">Lista de cupons</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left p-3 font-body text-xs text-muted-foreground">Código</th>
                  <th className="text-left p-3 font-body text-xs text-muted-foreground">Valor</th>
                  <th className="text-left p-3 font-body text-xs text-muted-foreground">Usos</th>
                  <th className="text-left p-3 font-body text-xs text-muted-foreground">Expira</th>
                  <th className="text-left p-3 font-body text-xs text-muted-foreground">Ativo</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon.id} className="border-b border-border hover:bg-secondary/20">
                    <td className="p-3 font-body text-sm">{coupon.code}</td>
                    <td className="p-3 font-body text-sm">
                      {coupon.type === 'percent' ? `${coupon.value}%` : `${moneyPt(coupon.value)} €`}
                    </td>
                    <td className="p-3 font-body text-sm">
                      {coupon.used_count}/{coupon.max_uses ?? '∞'}
                    </td>
                    <td className="p-3 font-body text-sm">{formatDatePt(coupon.expires_at)}</td>
                    <td className="p-3 font-body text-sm">{coupon.is_active ? 'Sim' : 'Não'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <LoadMoreControls
            leftText={`A mostrar ${Math.min(limit, Array.isArray(coupons) ? coupons.length : 0)} cupons.`}
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
