import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  BarChartBig,
  Boxes,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Menu,
  Package,
  ScrollText,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react';
import zanaLogo from '@/img/zana_logo_primary.svg';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import AdminNotificationBell from '@/components/notifications/AdminNotificationBell';

const navSections = [
  {
    label: 'Gestão',
    items: [
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
	      { to: '/admin/produtos', icon: Package, label: 'Produtos' },
	      { to: '/admin/encomendas', icon: ShoppingCart, label: 'Encomendas' },
	      { to: '/admin/clientes', icon: Users, label: 'Clientes' },
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
    items: [{ to: '/admin/definicoes/pagamentos', icon: CreditCard, label: 'Pagamentos' }],
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
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-body transition-colors ${
                    active ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-secondary'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
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
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-[280px]">
                <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                  <img src={zanaLogo} alt="Zana" className="h-6 w-auto brightness-0" loading="eager" />
                  <div className="min-w-0">
                    <div className="font-heading text-base">Admin</div>
                    <div className="font-body text-xs text-muted-foreground truncate">{user?.email ?? ''}</div>
                  </div>
                </div>
                {renderNav({ onNavigate: () => setMobileOpen(false) })}
              </SheetContent>
            </Sheet>
          </div>

          <img src={zanaLogo} alt="Zana" className="h-7 w-auto" loading="eager" />
        </div>

        <div className="flex items-center gap-2">
          <AdminNotificationBell />
          <Link to="/" className="hidden md:inline-flex" title="Voltar à loja">
            <Button variant="ghost" size="icon" aria-label="Loja">
              <ShoppingBag className="w-4 h-4" />
            </Button>
          </Link>
          <div className="hidden md:block font-body text-xs text-muted-foreground max-w-[220px] truncate">
            {user?.email ?? ''}
          </div>
          <Button
            variant="outline"
            className="rounded-none font-body text-xs gap-2"
            onClick={() => {
              logout();
              window.location.assign('/');
            }}
          >
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </div>
      </div>

      <div className="flex">
        <aside className="w-64 bg-card border-r border-border min-h-[calc(100vh-52px)] hidden md:block">
          {renderNav()}
        </aside>

        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
