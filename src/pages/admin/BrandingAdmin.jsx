import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Image } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import ImageUpload from '@/components/uploads/ImageUpload';
import { getErrorMessage, toastApiPromise } from '@/lib/toast';

const defaults = {
  logo_primary_url: '',
  logo_url: '',
  favicon_url: '',
  app_icon_url: '',
  theme_color: '#782641',
  site_name: 'Zana',
};

export default function BrandingAdmin() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-branding'],
    queryFn: () => base44.admin.content.branding.get(),
  });

  const existing = data?.content ?? null;
  const initial = useMemo(() => ({ ...defaults, ...(existing ?? {}) }), [existing]);
  const [form, setForm] = useState(initial);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const saveMutation = useMutation({
    mutationFn: (payload) => base44.admin.content.branding.update(payload),
  });

  const handleSave = async () => {
    const payload = {
      site_name: String(form.site_name ?? '').trim() || null,
      logo_primary_url: String(form.logo_primary_url ?? '').trim() || null,
      logo_url: String(form.logo_url ?? '').trim() || null,
      favicon_url: String(form.favicon_url ?? '').trim() || null,
      app_icon_url: String(form.app_icon_url ?? '').trim() || null,
      theme_color: String(form.theme_color ?? '').trim() || null,
    };

    await toastApiPromise(saveMutation.mutateAsync(payload), {
      loading: 'A guardar...',
      success: 'Branding atualizado.',
      error: (e) => getErrorMessage(e, 'Não foi possível guardar.'),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h2 className="font-heading text-2xl flex items-center gap-2">
          <Image className="w-5 h-5" /> Branding
        </h2>
        <Button onClick={handleSave} className="rounded-none font-body text-sm tracking-wider" disabled={isLoading}>
          Guardar
        </Button>
      </div>

      {isLoading ? (
        <p className="font-body text-sm text-muted-foreground">A carregar...</p>
      ) : (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-heading text-xl mb-4">Nome do site</h3>
            <div className="max-w-xl">
              <Label className="font-body text-xs">Nome</Label>
              <Input
                value={form.site_name ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, site_name: e.target.value }))}
                className="rounded-none mt-1"
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-heading text-xl mb-4">Logotipos</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ImageUpload
                value={form.logo_primary_url ?? ''}
                label="Logo (header/admin)"
                recommended="SVG ou PNG (altura ~48px)"
                onChange={(url) => setForm((p) => ({ ...p, logo_primary_url: url }))}
              />
              <ImageUpload
                value={form.logo_url ?? ''}
                label="Logo (footer)"
                recommended="SVG ou PNG"
                onChange={(url) => setForm((p) => ({ ...p, logo_url: url }))}
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-heading text-xl mb-4">Tema</h3>
            <div className="max-w-xl">
              <Label className="font-body text-xs">Cor principal</Label>
              <Input
                type="color"
                value={form.theme_color ?? '#782641'}
                onChange={(e) => setForm((p) => ({ ...p, theme_color: e.target.value }))}
                className="rounded-none mt-1 h-12 w-24 p-0"
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-heading text-xl mb-4">Ícone do app</h3>
            <p className="font-body text-sm text-muted-foreground mb-4">
              Ícone usado para o PWA e instalações em telefones após guardar.
            </p>
            <div className="max-w-xl">
              <ImageUpload
                value={form.app_icon_url ?? ''}
                label="Ícone do app"
                recommended="PNG 512×512 (ou 256×256)"
                onChange={(url) => setForm((p) => ({ ...p, app_icon_url: url }))}
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-heading text-xl mb-4">Ícone do site</h3>
            <p className="font-body text-sm text-muted-foreground mb-4">
              O favicon é aplicado no browser após guardar (pode precisar de hard refresh).
            </p>
            <div className="max-w-xl">
              <ImageUpload
                value={form.favicon_url ?? ''}
                label="Favicon"
                recommended="PNG 512×512 (ou 256×256)"
                onChange={(url) => setForm((p) => ({ ...p, favicon_url: url }))}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

