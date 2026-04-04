import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, LogOut, Menu, ShoppingBag, ShoppingCart, Users, Bell, BarChart3, CalendarClock, User, Package, Tag, CreditCard } from 'lucide-react';

import zanaLogo from '@/img/zana_logo_primary.svg';
import ImageWithFallback from '@/components/ui/image-with-fallback';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { useBranding } from '@/lib/useBranding';
import SellerNotificationBell from '@/components/notifications/SellerNotificationBell';

const navItems = [
  { to: '/vendedor', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/vendedor/encomendas', icon: ShoppingCart, label: 'Encomendas' },
  { to: '/vendedor/produtos', icon: Package, label: 'Produtos' },
  { to: '/vendedor/clientes', icon: Users, label: 'Clientes' },
  { to: '/vendedor/cupons', icon: Tag, label: 'Cupons' },
  { to: '/vendedor/fecho-de-caixa', icon: CreditCard, label: 'Fecho de Caixa' },
  { to: '/vendedor/relatorios', icon: BarChart3, label: 'Relatórios' },
  { to: '/vendedor/notificacoes', icon: Bell, label: 'Notificações' },
  { to: '/vendedor/marcacoes', icon: CalendarClock, label: 'Marcações' },
  { to: '/vendedor/perfil', icon: User, label: 'Perfil' },
];

export default function SellerLayout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { branding } = useBranding();
  const logoSrc = String(branding?.logo_primary_url ?? '').trim() || zanaLogo;

  React.useEffect(() => {
    const updateThemeColor = () => {
      const meta = document.querySelector('meta[name="theme-color"]');
      const nav = document.getElementById('seller-topbar');
      if (!meta || !nav) return;
      const bg = window.getComputedStyle(nav).backgroundColor;
      if (bg) meta.setAttribute('content', bg);
    };

    updateThemeColor();
    window.addEventListener('resize', updateThemeColor);
    return () => window.removeEventListener('resize', updateThemeColor);
  }, [branding?.theme_color, branding?.background_color]);

  const doLogout = () => {
    logout();
    window.location.assign('/');
  };

  const renderNav = ({ onNavigate } = {}) => (
    <nav className="p-4 space-y-1">
      {navItems.map((item) => {
        const active =
          location.pathname === item.to || (item.to !== '/vendedor' && location.pathname.startsWith(item.to));
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-body transition-colors ${
              active ? 'bg-secondary text-foreground' : 'text-foreground/70 hover:bg-secondary/70'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="h-[var(--app-height,100vh)] overflow-hidden bg-background flex flex-col">
      <div
        id="seller-topbar"
        className="relative bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between shrink-0"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                overlayClassName="bg-background/70 backdrop-blur-[2px]"
                className="p-0 w-[280px] flex flex-col"
              >
                <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                  <ImageWithFallback
                    src={logoSrc}
                    alt="Zana"
                    className="h-6 w-auto"
                    loading="eager"
                    iconClassName="w-6 h-6 text-muted-foreground/40"
                  />
                  <div className="min-w-0">
                    <div className="font-heading text-base">Vendedor</div>
                    <div className="font-body text-xs text-muted-foreground truncate">{user?.email ?? ''}</div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">{renderNav({ onNavigate: () => setMobileOpen(false) })}</div>
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

          <div className="hidden md:flex items-center gap-3">
            <ImageWithFallback
              src={logoSrc}
              alt="Zana"
              className="h-7 w-auto"
              loading="eager"
              iconClassName="w-7 h-7 text-muted-foreground/40"
            />
            <div className="font-heading text-base">Vendedor</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SellerNotificationBell />
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

      <div className="flex-1 overflow-hidden flex">
        <aside className="hidden md:block w-64 border-r border-border bg-card/60 overflow-y-auto">
          {renderNav()}
        </aside>
        <main className="flex-1 overflow-y-auto p-5 md:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
