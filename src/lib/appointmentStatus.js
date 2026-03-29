/**
 * Estados de marcação — labels em PT e estilos alinhados a encomendas (OrderStatusCard).
 */

export const appointmentStatusLabels = {
  pending: 'Pendente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  completed: 'Concluída',
};

/** Classes Tailwind para Badge (fundo suave + texto, sem sólido primary/destructive). */
export const appointmentStatusBadgeClassName = {
  pending: 'border-transparent bg-secondary text-secondary-foreground shadow-none',
  confirmed: 'border-transparent bg-accent/20 text-accent-foreground shadow-none',
  cancelled: 'border-transparent bg-destructive/10 text-destructive shadow-none',
  completed: 'border-transparent bg-primary/10 text-primary shadow-none',
};

export function getAppointmentStatusLabel(status) {
  if (status === null || status === undefined || status === '') return '—';
  const key = String(status);
  return appointmentStatusLabels[key] ?? key;
}
