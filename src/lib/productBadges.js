/**
 * Estados e etiquetas de produto — mesmo padrão visual que marcações / OrderStatusCard
 * (fundos suaves, texto colorido, sem badges sólidos primary/destructive).
 */

export const productStatusLabels = {
  active: 'Ativo',
  inactive: 'Inativo',
  out_of_stock: 'Sem stock',
};

export const productStatusBadgeClassName = {
  active: 'border-transparent bg-primary/10 text-primary shadow-none',
  inactive: 'border-transparent bg-secondary text-secondary-foreground shadow-none',
  out_of_stock: 'border-transparent bg-destructive/10 text-destructive shadow-none',
};

export function getProductStatusLabel(status) {
  if (status === null || status === undefined || status === '') return '—';
  const key = String(status);
  return productStatusLabels[key] ?? key;
}

/** Etiquetas na grelha / detalhe (Novo, bestseller, desconto) */
export const productPromoBadgeClassName = {
  new: 'border-transparent bg-primary/10 text-primary shadow-none',
  bestseller: 'border-transparent bg-accent/20 text-accent-foreground shadow-none',
  discount: 'border-transparent bg-destructive/10 text-destructive shadow-none',
};
