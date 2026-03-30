import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { CreditCard, Database, Truck } from 'lucide-react';

const tabs = [
  { to: 'pagamentos', label: 'Pagamentos', icon: CreditCard },
  { to: 'envios', label: 'Envios', icon: Truck },
  { to: 'backup', label: 'Backup', icon: Database },
];

export default function SettingsLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">Definições</h1>
        <p className="font-body text-sm text-muted-foreground mt-1">Configurações e métodos de pagamento.</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-body transition-colors ${
                  isActive ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-secondary'
                }`
              }
              end
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </NavLink>
          ))}
        </div>
      </div>

      <Outlet />
    </div>
  );
}
