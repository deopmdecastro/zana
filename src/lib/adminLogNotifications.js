export const ADMIN_NOTIFICATIONS_READ_STORAGE_KEY = 'zana_admin_notifications_read';

export function formatWhen(value) {
  try {
    return new Date(value).toLocaleString('pt-PT');
  } catch {
    return '';
  }
}

export function targetPath(log) {
  const type = String(log?.entity_type ?? '');

  if (type === 'SupportTicket' || type === 'SupportMessage') return '/admin/suporte';
  if (type === 'BlogComment' || type === 'BlogCommentReply') return '/admin/conteudo/blog-comentarios';
  if (type === 'Order' || type === 'OrderItem') return '/admin/encomendas';
  if (type === 'SalesTarget') return '/admin/metas-vendas';
  if (type === 'CashClosure') return '/admin/fecho-de-caixa';
  if (type === 'Coupon') return '/admin/cupons';

  if (type === 'Purchase' || type === 'PurchaseItem') return '/admin/compras';
  if (type === 'Inventory' || type === 'InventoryMovement') return '/admin/inventario';
  if (type === 'Product') return '/admin/produtos';
  if (type === 'Supplier') return '/admin/fornecedores';
  if (type === 'InstagramPost') return '/admin/conteudo/instagram';

  return '/admin/logs';
}

export function friendlyTitle(log) {
  const action = String(log?.action ?? '');
  const type = String(log?.entity_type ?? '');
  const meta = log?.meta ?? null;

  if (action === 'notify') {
    const kind = String(meta?.kind ?? '');
    if (kind === 'sales_target_expired') return 'Meta de vendas expirada';
    if (kind === 'sales_target_achieved') return 'Meta de vendas alcançada';
    if (kind === 'coupon_expired') return 'Cupom expirado';
    if (kind === 'coupon_expiring') return 'Cupom a expirar';
    return 'Notificação';
  }

  if (type === 'Order') {
    if (action === 'return_request') return 'Pedido de devolução';
    if (action === 'return_approved') return 'Devolução aprovada';
    if (action === 'return_rejected') return 'Devolução rejeitada';
    if (action === 'return_received') return 'Devolução recebida (stock atualizado)';
    if (action === 'refund_recorded') return 'Reembolso registado';
  }

  if (type === 'SupportTicket' && action === 'create') return 'Novo pedido de suporte';
  if (type === 'SupportTicket' && action === 'update') return 'Pedido de suporte atualizado';
  if (type === 'SupportMessage' && action === 'create') return 'Nova mensagem no suporte';

  if (type === 'BlogComment' && action === 'create') return 'Novo comentário no blog';
  if (type === 'BlogComment' && action === 'update') {
    if (meta && typeof meta.is_approved === 'boolean') return meta.is_approved ? 'Comentário aprovado' : 'Comentário reprovado';
    return 'Comentário atualizado';
  }
  if (type === 'BlogCommentReply' && action === 'create') return 'Nova resposta a comentário';

  if (type === 'InstagramPost') {
    if (action === 'create') return 'Instagram: link adicionado';
    if (action === 'update') return 'Instagram: link atualizado';
    if (action === 'delete') return 'Instagram: link removido';
  }

  if (type === 'Supplier') {
    if (action === 'create') return 'Fornecedor criado';
    if (action === 'update') return 'Fornecedor atualizado';
    if (action === 'delete') return 'Fornecedor removido';
  }

  if (type === 'Product') {
    if (action === 'create') return 'Produto criado';
    if (action === 'update') return 'Produto atualizado';
    if (action === 'delete') return 'Produto removido';
  }

  if (type === 'Purchase') {
    if (action === 'create') return 'Compra registada';
    if (action === 'update') return 'Compra atualizada';
    if (action === 'return') return 'Devolução ao fornecedor registada';
  }

  if (type === 'NewsletterCampaign') {
    if (action === 'create') return 'Campanha de newsletter criada';
    if (action === 'update') return 'Campanha de newsletter atualizada';
    if (action === 'delete') return 'Campanha de newsletter removida';
  }

  if (type === 'SmtpTest') {
    if (action === 'create') return 'Teste de email (SMTP) enviado';
    if (action === 'update') return 'Teste de email (SMTP) atualizado';
  }

  if (type === 'Appointment') {
    if (action === 'create') return 'Marcação criada';
    if (action === 'update') return 'Marcação atualizada';
    if (action === 'reminder') return 'Lembrete de marcação enviado';
  }

  if (type === 'SalesTarget') {
    if (action === 'create') return 'Meta de vendas criada';
    if (action === 'update') return 'Meta de vendas atualizada';
    if (action === 'delete') return 'Meta de vendas removida';
  }

  if (type === 'CashClosure') {
    if (action === 'create') return 'Fecho de caixa registado';
    if (action === 'update') return 'Fecho de caixa atualizado';
  }

  if (type === 'Coupon') {
    if (action === 'create') return 'Cupom criado';
    if (action === 'update') return 'Cupom atualizado';
    if (action === 'delete') return 'Cupom removido';
  }

  if (type === 'Order') {
    if (action === 'create') return 'Encomenda criada';
    if (action === 'update') return 'Encomenda atualizada';
  }

  if (type === 'SiteContent' && action === 'update') return 'Conteúdo do site atualizado';
  if (type === 'Inventory' && action === 'update') return 'Stock atualizado';

  const actionLabel =
    action === 'create'
      ? 'criado'
      : action === 'update'
        ? 'atualizado'
        : action === 'delete'
          ? 'removido'
          : action === 'return'
            ? 'devolução registada'
            : action;

  return `${type || 'Item'} ${actionLabel}`.trim() || 'Atualização';
}

export function friendlyDetail(log) {
  const action = String(log?.action ?? '');
  const type = String(log?.entity_type ?? '');
  const meta = log?.meta ?? null;
  const id = log?.entity_id ? String(log.entity_id) : '';

  if (action === 'notify') {
    const kind = String(meta?.kind ?? '');
    if (kind === 'sales_target_expired' || kind === 'sales_target_achieved') return meta?.name ? String(meta.name) : id ? `Meta · ${id}` : '';
    if (kind === 'coupon_expired' || kind === 'coupon_expiring') return meta?.code ? `Cupom · ${meta.code}` : id ? `Cupom · ${id}` : '';
    return '';
  }

  if (!id) return '';
  if (['BlogComment', 'BlogCommentReply', 'SupportMessage'].includes(type)) return '';
  if (type === 'Coupon' && meta?.code) return `Cupom · ${meta.code}`;
  if (type === 'SalesTarget' && meta?.name) return `Meta · ${meta.name}`;
  if (type === 'SiteContent') return `Conteúdo · ${id}`;
  if (type === 'Supplier' && meta?.name) return `Fornecedor · ${meta.name}`;
  if (type === 'Product' && meta?.name) return `Produto · ${meta.name}`;
  if (type === 'Purchase' && meta?.supplier_name) return `Compra · ${meta.supplier_name}`;
  return `${type} · ${id}`;
}

export function parseDate(value) {
  try {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isCouponNotify(log) {
  if (!log) return false;
  if (String(log.action ?? '') !== 'notify') return false;
  if (String(log.entity_type ?? '') !== 'Coupon') return false;
  const kind = String(log?.meta?.kind ?? '');
  return kind === 'coupon_expired' || kind === 'coupon_expiring';
}
