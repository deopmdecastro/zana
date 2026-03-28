import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Heart, Search, Menu, X, User } from 'lucide-react';
import { useCart } from '@/lib/CartContext';
import { useAuth } from '@/lib/AuthContext';
import zanaLogo from '@/img/zana_logo_primary.svg';
import StoreNotificationBell from '@/components/notifications/StoreNotificationBell';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { itemCount } = useCart();
  const { user } = useAuth();

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
    <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Mobile menu button */}
          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Logo */}
          <Link to="/" className="flex items-center" aria-label="Zana">
            <img
              src={zanaLogo}
              alt="Zana Acessórios"
              className="h-8 md:h-10 w-auto"
              loading="eager"
            />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {links.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-body tracking-wide text-foreground/80 hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {user?.is_admin && (
              <Link to="/admin" className="hidden md:block px-3 py-1.5 border border-border text-xs font-body hover:border-primary hover:text-primary transition-colors">
                Admin
              </Link>
            )}
            <StoreNotificationBell />
            <Link to="/catalogo" className="p-2 hover:text-primary transition-colors">
              <Search className="w-4 h-4" />
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
            <Link to="/conta" className="p-2 hover:text-primary transition-colors hidden md:block">
              <User className="w-4 h-4" />
            </Link>
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
