import React from 'react';

export default function PageLoader({ label = 'A carregar...' } = {}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        <span className="font-body text-sm text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

