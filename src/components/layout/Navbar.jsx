import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Heart, Menu, X, User, Store } from 'lucide-react';
import { useCart } from '@/lib/CartContext';
import { useAuth } from '@/lib/AuthContext';
import zanaLogo from '@/img/zana_logo_primary.svg';
import StoreNotificationBell from '@/components/notifications/StoreNotificationBell';
import { useBranding } from '@/lib/useBranding';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { itemCount } = useCart();
  const { user } = useAuth();
  const { branding } = useBranding();
  const logoSrc = String(branding?.logo_primary_url ?? '').trim() || zanaLogo;
  const siteName = String(branding?.site_name ?? 'Zana').trim() || 'Zana';
  const isLogged = Boolean(user);

  useEffect(() => {
    const updateThemeColor = () => {
      const meta = document.querySelector('meta[name="theme-color"]');
      const nav = document.getElementById('app-topbar');
      if (!meta || !nav) return;
      const bg = window.getComputedStyle(nav).backgroundColor;
      if (bg) {
        meta.setAttribute('content', bg);
      }
    };

    updateThemeColor();
    window.addEventListener('resize', updateThemeColor);
    return () => window.removeEventListener('resize', updateThemeColor);
  }, []);

  const links = [
    { to: '/', label: 'Início' },
    { to: '/catalogo', label: 'Catálogo' },
    { to: '/sobre', label: 'Sobre Nós' },
    { to: '/blog', label: 'Blog' },
	    { to: '/faq', label: 'FAQ' },
	    { to: '/suporte', label: 'Suporte' },
	    { to: '/contacto', label: 'Contacto' },
	  ];

  return (
    <nav id="app-topbar" className="sticky top-0 z-50 bg-primary/95 backdrop-blur-md border-b border-primary/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          <div className={`${isLogged ? 'justify-start' : 'justify-center md:justify-start'} flex-1 flex`}>
            <Link to="/" className="flex items-center" aria-label={siteName}>
              <img
                src={logoSrc}
                alt={siteName}
                className="h-8 md:h-10 w-auto"
                loading="eager"
              />
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {!isLogged && (
              <Link to="/catalogo" className="p-2 hover:text-primary transition-colors">
                <Store className="w-4 h-4" />
              </Link>
            )}

            {isLogged && (
              <>
                <div className="p-2">
                  <StoreNotificationBell />
                </div>
                <Link to="/catalogo" className="p-2 hover:text-primary transition-colors">
                  <Store className="w-4 h-4" />
                </Link>
                <Link to="/favoritos" className="p-2 hover:text-primary transition-colors">
                  <Heart className="w-4 h-4" />
                </Link>
                <Link to="/carrinho" className="p-2 hover:text-primary transition-colors relative">
                  <ShoppingBag className="w-4 h-4" />
                  {itemCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-body">
                      {itemCount}
                    </span>
                  )}
                </Link>
                <Link to="/conta" className="p-2 hover:text-primary transition-colors">
                  <User className="w-4 h-4" />
                </Link>
              </>
            )}

            {!isLogged && (
              <>
                <Link to="/favoritos" className="hidden md:block p-2 hover:text-primary transition-colors">
                  <Heart className="w-4 h-4" />
                </Link>
                <Link to="/carrinho" className="hidden md:block p-2 hover:text-primary transition-colors relative">
                  <ShoppingBag className="w-4 h-4" />
                  {itemCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-body">
                      {itemCount}
                    </span>
                  )}
                </Link>
                <Link to="/conta" className="hidden md:block p-2 hover:text-primary transition-colors">
                  <User className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-card border-t border-border pb-4">
          {links.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className="block px-6 py-3 text-sm font-body tracking-wide text-foreground/80 hover:text-primary hover:bg-secondary/50 transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/conta"
            className="block px-6 py-3 text-sm font-body tracking-wide text-foreground/80 hover:text-primary hover:bg-secondary/50 transition-colors"
            onClick={() => setMobileOpen(false)}
          >
            Minha Conta
          </Link>
        </div>
      )}
    </nav>
  );
}
