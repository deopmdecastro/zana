import React, { useMemo, useRef, useState } from 'react';
import { UploadCloud, X, Image as ImageIcon } from 'lucide-react';
import ImageWithFallback from '@/components/ui/image-with-fallback';
import { Button } from '@/components/ui/button';
import { toastApiPromise } from '@/lib/toast';
import { base44 } from '@/api/base44Client';

function isLikelyImageUrl(url) {
  const value = String(url ?? '');
  return value.startsWith('data:image/') || /^https?:\/\//.test(value);
}

export default function ImageUpload({
  value,
  onChange,
  label = 'Imagem',
  helper,
  accept = 'image/*',
  recommended = '1200×800',
} = {}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const preview = useMemo(() => (isLikelyImageUrl(value) ? value : null), [value]);

  const uploadFile = async (file) => {
    if (!file) return;
    const res = await toastApiPromise(base44.integrations.Core.UploadFile({ file }), {
      loading: 'A enviar imagem...',
      success: 'Imagem carregada.',
      error: 'Não foi possível enviar a imagem.',
    });
    const fileUrl = res?.file_url;
    if (fileUrl) onChange?.(fileUrl);
  };

  const onPick = () => inputRef.current?.click?.();

  const onInputChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    await uploadFile(file);
  };

  const onDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    await uploadFile(file);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="font-body text-xs text-muted-foreground">{label}</div>
        {value ? (
          <Button type="button" variant="outline" className="rounded-none h-8 px-2 text-xs" onClick={() => onChange?.('')}>
            <X className="w-3.5 h-3.5 mr-1" />
            Remover
          </Button>
        ) : null}
      </div>

      <div
        className={`mt-2 border border-border bg-card rounded-md overflow-hidden ${
          isDragging ? 'ring-2 ring-primary/30 border-primary/40' : ''
        }`}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <div className="p-4 flex items-center gap-4">
          <div className="w-16 h-16 rounded-md overflow-hidden bg-secondary/30 border border-border flex items-center justify-center shrink-0">
            {preview ? (
              <ImageWithFallback
                src={preview}
                alt=""
                className="w-full h-full object-cover"
                iconClassName="w-6 h-6 text-muted-foreground/50"
              />
            ) : (
              <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-body text-sm text-foreground/90">
              {value ? 'Imagem selecionada' : 'Arraste e solte aqui, ou escolha um ficheiro'}
            </div>
            <div className="font-body text-xs text-muted-foreground mt-1">
              Recomendado: {recommended}. {helper ? ` ${helper}` : ''}
            </div>
          </div>
          <Button type="button" onClick={onPick} className="rounded-none font-body text-sm gap-2">
            <UploadCloud className="w-4 h-4" />
            Upload
          </Button>
          <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onInputChange} />
        </div>
      </div>
    </div>
  );
}

