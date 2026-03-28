import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BookOpen, FileText, HelpCircle, Instagram, LayoutTemplate, MessageSquare } from 'lucide-react';

const tabs = [
  { to: 'landing', label: 'Landing', icon: LayoutTemplate },
  { to: 'blog', label: 'Blog', icon: BookOpen },
  { to: 'blog-comentarios', label: 'Comentários', icon: MessageSquare },
  { to: 'sobre', label: 'Sobre Nós', icon: FileText },
  { to: 'instagram', label: 'Instagram', icon: Instagram },
  { to: 'faq', label: 'FAQ', icon: HelpCircle },
];

export default function ContentLayout() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl">Conteúdo</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">Gestão de textos, imagens e secções do site.</p>
        </div>
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

