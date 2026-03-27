import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Heart, Search, Menu, X, User } from 'lucide-react';
import { useCart } from '@/lib/CartContext';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { itemCount } = useCart();

  const links = [
    { to: '/', label: 'Início' },
    { to: '/catalogo', label: 'Catálogo' },
    { to: '/sobre', label: 'Sobre Nós' },
    { to: '/blog', label: 'Blog' },
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
          <Link to="/" className="flex flex-col items-center">
            <span className="font-heading text-2xl md:text-3xl font-semibold tracking-[0.3em] text-primary">ZANA</span>
            <span className="text-[9px] md:text-[10px] tracking-[0.4em] text-muted-foreground font-body uppercase -mt-1">acessórios</span>
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