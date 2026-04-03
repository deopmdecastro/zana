import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LayoutDashboard, LogOut, Menu, Settings, ShoppingBag, Store, User } from 'lucide-react';

import { useCart } from '@/lib/CartContext';
import { useAuth } from '@/lib/AuthContext';
import { useBranding } from '@/lib/useBranding';
import zanaLogo from '@/img/zana_logo_primary.svg';

import StoreNotificationBell from '@/components/notifications/StoreNotificationBell';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export default function Navbar() {
  const navigate = useNavigate();
  const { itemCount } = useCart();
  const { user, logout } = useAuth();
  const { branding } = useBranding();

  const logoSrc = String(branding?.logo_primary_url ?? '').trim() || zanaLogo;
  const siteName = String(branding?.site_name ?? 'Zana').trim() || 'Zana';
  const isLogged = Boolean(user);
  const isAdmin = Boolean(user?.is_admin);

  useEffect(() => {
    const updateThemeColor = () => {
      const meta = document.querySelector('meta[name="theme-color"]');
      const nav = document.getElementById('app-topbar');
      if (!meta || !nav) return;
      const bg = window.getComputedStyle(nav).backgroundColor;
      if (bg) meta.setAttribute('content', bg);
    };

    updateThemeColor();
    window.addEventListener('resize', updateThemeColor);
    return () => window.removeEventListener('resize', updateThemeColor);
  }, [branding?.theme_color, branding?.background_color]);

  const links = [
    { to: '/', label: 'Início' },
    { to: '/catalogo', label: 'Catálogo' },
    { to: '/sobre', label: 'Sobre Nós' },
    { to: '/blog', label: 'Blog' },
    { to: '/faq', label: 'FAQ' },
    { to: '/suporte', label: 'Suporte' },
    { to: '/contacto', label: 'Contacto' },
    { to: '/favoritos', label: 'Favoritos' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/conta', { replace: true });
  };

  const iconLinkClassName =
    'inline-flex items-center justify-center rounded-md p-2 hover:text-primary hover:bg-secondary/40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

  return (
    <nav id="app-topbar" className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 items-center h-16 md:h-20">
          {/* Left: Hamburger */}
          <div className="flex items-center justify-start">
            <Sheet>
              <SheetTrigger asChild>
                <button className={iconLinkClassName} aria-label="Abrir menu">
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>

              <SheetContent side="left" className="w-[320px] sm:w-[360px] p-0">
                <div className="p-5">
                  <SheetHeader className="space-y-0 text-left">
                    <SheetTitle className="font-heading text-lg">
                      <Link to="/" className="inline-flex items-center" aria-label={siteName}>
                        <img src={logoSrc} alt={siteName} className="h-9 w-auto" loading="eager" />
                      </Link>
                    </SheetTitle>
                  </SheetHeader>
                </div>

                <Separator />

                {/* Main items (mirror quick shortcuts) */}
                <div className="p-3">
                  <div className="px-2 py-2 text-[11px] font-body tracking-widest text-muted-foreground uppercase">
                    Atalhos
                  </div>
                  <div className="space-y-1">
                    <SheetClose asChild>
                      <Link
                        to="/carrinho"
                        className="flex items-center justify-between gap-3 rounded-md px-3 py-2 font-body text-sm hover:bg-secondary/60 transition-colors"
                      >
                        <span className="flex items-center gap-3">
                          <ShoppingBag className="w-4 h-4" />
                          Carrinho
                        </span>
                        {itemCount > 0 ? (
                          <span className="bg-primary text-primary-foreground text-[10px] px-1.5 h-5 min-w-5 rounded-full flex items-center justify-center">
                            {itemCount > 9 ? '9+' : itemCount}
                          </span>
                        ) : null}
                      </Link>
                    </SheetClose>

                    <SheetClose asChild>
                      <Link
                        to="/catalogo"
                        className="flex items-center gap-3 rounded-md px-3 py-2 font-body text-sm hover:bg-secondary/60 transition-colors"
                      >
                        <Store className="w-4 h-4" />
                        Loja
                      </Link>
                    </SheetClose>

                    <SheetClose asChild>
                      <Link
                        to={isLogged ? '/notificacoes' : '/conta'}
                        className="flex items-center gap-3 rounded-md px-3 py-2 font-body text-sm hover:bg-secondary/60 transition-colors"
                      >
                        <Bell className="w-4 h-4" />
                        Notificações
                      </Link>
                    </SheetClose>
                  </div>
                </div>

                <Separator />

                {/* Navigation */}
                <div className="p-3">
                  <div className="px-2 py-2 text-[11px] font-body tracking-widest text-muted-foreground uppercase">
                    Navegação
                  </div>
                  <div className="space-y-1">
                    {links.map((link) => (
                      <SheetClose asChild key={link.to}>
                        <Link
                          to={link.to}
                          className="block rounded-md px-3 py-2 font-body text-sm text-foreground/90 hover:bg-secondary/60 transition-colors"
                        >
                          {link.label}
                        </Link>
                      </SheetClose>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* User / admin / actions */}
                <div className="p-3">
                  <div className="px-2 py-2 text-[11px] font-body tracking-widest text-muted-foreground uppercase">
                    Conta
                  </div>

                  <div className="space-y-1">
                    <SheetClose asChild>
                      <Link
                        to="/conta"
                        className="flex items-center gap-3 rounded-md px-3 py-2 font-body text-sm hover:bg-secondary/60 transition-colors"
                      >
                        <User className="w-4 h-4" />
                        {isLogged ? 'Perfil / Minha Conta' : 'Entrar / Criar conta'}
                      </Link>
                    </SheetClose>

                    {isLogged ? (
                      <SheetClose asChild>
                        <Link
                          to="/definicoes"
                          className="flex items-center gap-3 rounded-md px-3 py-2 font-body text-sm hover:bg-secondary/60 transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          Definições
                        </Link>
                      </SheetClose>
                    ) : null}

                    {isAdmin ? (
                      <SheetClose asChild>
                        <Link
                          to="/admin"
                          className="flex items-center gap-3 rounded-md px-3 py-2 font-body text-sm hover:bg-secondary/60 transition-colors"
                        >
                          <LayoutDashboard className="w-4 h-4" />
                          Painel Admin
                        </Link>
                      </SheetClose>
                    ) : null}

                    <SheetClose asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full justify-start gap-3 rounded-md px-3 py-2 font-body text-sm hover:bg-secondary/60 disabled:opacity-50"
                        disabled={!isLogged}
                        onClick={handleLogout}
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </Button>
                    </SheetClose>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Center: Logo */}
          <div className="flex items-center justify-center">
            <Link to="/" className="flex items-center" aria-label={siteName}>
              <img src={logoSrc} alt={siteName} className="h-8 md:h-10 w-auto" loading="eager" />
            </Link>
          </div>

          {/* Right: quick shortcuts */}
          <div className="flex items-center justify-end gap-1">
            <div className="p-1">
              {isLogged ? (
                <StoreNotificationBell />
              ) : (
                <Link to="/conta" className={iconLinkClassName} aria-label="Notificações">
                  <Bell className="w-4 h-4" />
                </Link>
              )}
            </div>

            <Link to="/catalogo" className={iconLinkClassName} aria-label="Loja">
              <Store className="w-4 h-4" />
            </Link>

            {isAdmin ? (
              <Link to="/admin" className={iconLinkClassName} aria-label="Painel Admin" title="Painel Admin">
                <LayoutDashboard className="w-4 h-4" />
              </Link>
            ) : null}

            <Link to="/carrinho" className={`${iconLinkClassName} relative`} aria-label="Carrinho">
              <ShoppingBag className="w-4 h-4" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-body">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
