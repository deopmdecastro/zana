import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Mail, MapPin } from 'lucide-react';
import zanaLogo from '@/img/zana_logo.svg';
import ImageWithFallback from '@/components/ui/image-with-fallback';
import { useBranding } from '@/lib/useBranding';

export default function Footer() {
  const { branding } = useBranding();
  const logoSrc = String(branding?.logo_url ?? '').trim() || zanaLogo;
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <ImageWithFallback
              src={logoSrc}
              alt={String(branding?.site_name ?? 'Zana')}
              className="h-10 w-auto mb-4"
              loading="lazy"
              iconClassName="w-10 h-10 text-muted-foreground/40"
            />
            <p className="text-sm opacity-80 leading-relaxed">
              Elegância em cada detalhe. Bijuterias que celebram a essência da mulher moderna.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-heading text-lg mb-4">Navegação</h4>
            <div className="space-y-2">
              {[
                { to: '/catalogo', label: 'Catálogo' },
                { to: '/sobre', label: 'Sobre Nós' },
                { to: '/blog', label: 'Blog' },
                { to: '/contacto', label: 'Contacto' },
              ].map(link => (
                <Link key={link.to} to={link.to} className="block text-sm opacity-70 hover:opacity-100 transition-opacity">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-heading text-lg mb-4">Apoio ao Cliente</h4>
            <div className="space-y-2">
              {[
                { to: '/faq', label: 'FAQ' },
                { to: '/suporte', label: 'Suporte' },
                { to: '/politica-privacidade', label: 'Política de Privacidade' },
                { to: '/cookies', label: 'Política de Cookies' },
                { to: '/termos', label: 'Termos e Condições' },
              ].map((link, i) => (
                <Link key={i} to={link.to} className="block text-sm opacity-70 hover:opacity-100 transition-opacity">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading text-lg mb-4">Contacto</h4>
            <div className="space-y-3">
              <a href="mailto:info@zanaacessorios.com" className="flex items-center gap-2 text-sm opacity-70 hover:opacity-100">
                <Mail className="w-4 h-4" /> info@zanaacessorios.com
              </a>
              <a href="https://instagram.com/zanaacessorios" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm opacity-70 hover:opacity-100">
                <Instagram className="w-4 h-4" /> @zanaacessorios
              </a>
              <div className="flex items-center gap-2 text-sm opacity-70">
                <MapPin className="w-4 h-4" /> Portugal
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-primary-foreground/20 mt-10 pt-6 text-center">
          <p className="text-xs opacity-60">© 2025 Zana Acessórios. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
