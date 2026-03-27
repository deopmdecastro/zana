import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Users, BarChart3, ArrowLeft } from 'lucide-react';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/produtos', icon: Package, label: 'Produtos' },
  { to: '/admin/encomendas', icon: ShoppingCart, label: 'Encomendas' },
  { to: '/admin/clientes', icon: Users, label: 'Clientes' },
  { to: '/admin/blog', icon: BarChart3, label: 'Blog' },
];

export default function AdminLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-sm font-body text-muted-foreground hover:text-primary">
            <ArrowLeft className="w-4 h-4" /> Voltar à Loja
          </Link>
          <span className="font-heading text-lg tracking-[0.2em] text-primary">ZANA</span>
          <span className="font-body text-xs text-muted-foreground">Admin</span>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-56 bg-card border-r border-border min-h-[calc(100vh-52px)] hidden md:block">
          <nav className="p-4 space-y-1">
            {navItems.map(item => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-body transition-colors ${
                    active ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-secondary'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 flex">
          {navItems.map(item => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-body ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Content */}
        <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}