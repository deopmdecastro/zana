import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  BarChartBig,
 	  Boxes,
  CalendarClock,
 	  CreditCard,
 	  Euro,
 	  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Menu,
  Package,
  ScrollText,
  Sparkles,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  Tag,
  TrendingUp,
  Truck,
  Database,
  Users,
} from 'lucide-react';
import zanaLogo from '@/img/zana_logo_primary.svg';
import ImageWithFallback from '@/components/ui/image-with-fallback';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import AdminNotificationBell from '@/components/notifications/AdminNotificationBell';
import { useBranding } from '@/lib/useBranding';

const navSections = [
  {
    label: 'Gestão',
    items: [
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
	      { to: '/admin/produtos', icon: Package, label: 'Produtos' },
	      { to: '/admin/encomendas', icon: ShoppingCart, label: 'Encomendas' },
	      { to: '/admin/financeiro', icon: Euro, label: 'Financeiro' },
	      { to: '/admin/cupons', icon: Tag, label: 'Cupons' },
	      { to: '/admin/pontos', icon: Sparkles, label: 'Pontos' },
	      { to: '/admin/metas-vendas', icon: TrendingUp, label: 'Metas de Vendas' },
	      { to: '/admin/fecho-de-caixa', icon: CreditCard, label: 'Fecho de Caixa' },
	      { to: '/admin/clientes', icon: Users, label: 'Clientes' },
        { to: '/admin/marcacoes', icon: CalendarClock, label: 'Marcações' },
	      { to: '/admin/suporte', icon: MessageSquare, label: 'Suporte' },
	    ],
	  },
  {
    label: 'Conteúdo',
    items: [
      { to: '/admin/conteudo/landing', icon: FileText, label: 'Conteúdo' },
      { to: '/admin/conteudo/blog', icon: BarChart3, label: 'Blog' },
    ],
  },
  {
    label: 'Definições',
    items: [
      { to: '/admin/definicoes/pagamentos', icon: CreditCard, label: 'Pagamentos' },
      { to: '/admin/definicoes/envios', icon: Truck, label: 'Envios' },
      { to: '/admin/definicoes/backup', icon: Database, label: 'Backup' },
    ],
  },

  {
    label: 'Operação',
    items: [
      { to: '/admin/fornecedores', icon: Truck, label: 'Fornecedores' },
      { to: '/admin/compras', icon: ShoppingBasket, label: 'Compras' },
      { to: '/admin/inventario', icon: Boxes, label: 'Inventário' },
      { to: '/admin/relatorios', icon: BarChartBig, label: 'Relatórios' },
      { to: '/admin/avaliacoes', icon: MessageSquare, label: 'Avaliações' },
      { to: '/admin/logs', icon: ScrollText, label: 'Logs' },
    ],
  },
];

export default function AdminLayout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { branding } = useBranding();
  const logoSrc = String(branding?.logo_primary_url ?? '').trim() || zanaLogo;

  const doLogout = () => {
    logout();
    window.location.assign('/');
  };

  const renderNav = ({ onNavigate } = {}) => (
    <nav className="p-4 space-y-5">
      {navSections.map((section) => (
        <div key={section.label}>
          <div className="px-3 mb-2 font-body text-[10px] tracking-wider uppercase text-muted-foreground">
            {section.label}
          </div>
          <div className="space-y-1">
            {section.items.map((item) => {
              const active = location.pathname === item.to || (item.to !== '/admin' && location.pathname.startsWith(item.to));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-body transition-colors min-w-0 ${
                    active ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-secondary'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 relative bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-[280px] flex flex-col">
                <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                  <ImageWithFallback
                    src={logoSrc}
                    alt="Zana"
                    className="h-6 w-auto"
                    loading="eager"
                    iconClassName="w-6 h-6 text-muted-foreground/40"
                  />
                  <div className="min-w-0">
                    <div className="font-heading text-base">Admin</div>
                    <div className="font-body text-xs text-muted-foreground truncate">{user?.email ?? ''}</div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {renderNav({ onNavigate: () => setMobileOpen(false) })}
                </div>
                <div className="p-4 border-t border-border space-y-2">
                  <Button
                    variant="outline"
                    className="w-full rounded-none font-body text-xs gap-2"
                    onClick={() => {
                      setMobileOpen(false);
                      doLogout();
                    }}
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </Button>
                  <Link to="/" className="w-full inline-flex" onClick={() => setMobileOpen(false)} title="Voltar à loja">
                    <Button variant="ghost" className="w-full rounded-none font-body text-xs gap-2">
                      <ShoppingBag className="w-4 h-4" />
                      Loja
                    </Button>
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="hidden md:block">
            <ImageWithFallback
              src={logoSrc}
              alt="Zana"
              className="h-7 w-auto"
              loading="eager"
              iconClassName="w-7 h-7 text-muted-foreground/40"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="md:hidden absolute left-1/2 -translate-x-1/2">
            <ImageWithFallback
              src={logoSrc}
              alt="Zana"
              className="h-7 w-auto"
              loading="eager"
              iconClassName="w-7 h-7 text-muted-foreground/40"
            />
          </div>
          <AdminNotificationBell />
          <Link to="/" className="hidden md:inline-flex" title="Voltar à loja">
            <Button variant="ghost" size="icon" aria-label="Loja">
              <ShoppingBag className="w-4 h-4" />
            </Button>
          </Link>
          <div className="hidden md:block font-body text-xs text-muted-foreground max-w-[220px] truncate">
            {user?.email ?? ''}
          </div>
          <Button variant="outline" className="rounded-none font-body text-xs gap-2 hidden md:inline-flex" onClick={doLogout}>
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </div>
      </div>

      <div className="flex">
        <aside className="w-64 bg-card border-r border-border hidden md:block sticky top-[56px] h-[calc(100vh-56px)] overflow-y-auto">
          {renderNav()}
        </aside>

        <main className="flex-1 p-4 md:p-8 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
