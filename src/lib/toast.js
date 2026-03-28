import { toast } from 'sonner';

export function getErrorMessage(err, fallback = 'Ocorreu um erro.') {
  const normalize = (v) => (typeof v === 'string' ? v.trim() : '');
  const message = normalize(err?.message);
  const fromApi = normalize(err?.data?.error);
  const codeFromMessage = message && message.includes(':') ? message.split(':')[0].trim() : '';
  const code = fromApi || codeFromMessage || '';
  const detail = codeFromMessage ? message.slice(message.indexOf(':') + 1).trim() : message;

  const defaultNetwork = 'Sem ligação ao servidor. Confirme se o backend está a correr em http://localhost:3001';

  if (code === 'network_error') {
    const extra = normalize(err?.data?.detail);
    return extra ? `Sem ligação ao servidor (${extra}). Confirme se o backend está a correr em http://localhost:3001` : defaultNetwork;
  }

  if (code === 'unauthorized') return 'Sessão expirada. Faça login novamente.';
  if (code === 'invalid_body') return detail ? `Dados inválidos (${detail}).` : 'Dados inválidos.';
  if (code === 'invalid_items') return 'Itens inválidos. Confirme nome, custo e quantidade.';
  if (code === 'purchase_locked') return 'Compra recebida: não é possível alterar itens.';
  if (code === 'not_found') return 'Registo não encontrado.';

  if (code === 'internal_error' && /prisma|Invalid `prisma\.|Unknown argument|does not exist|column/i.test(detail)) {
    return 'Backend/BD desatualizados (Prisma). Reinicie o backend e rode prisma generate/migrações.';
  }

  return detail || fallback;
}

export function toastApiPromise(promise, { loading, success, error } = {}) {
  const wrapped = Promise.resolve(promise);
  toast.promise(wrapped, {
    loading: loading ?? 'A processar...',
    success: success ?? 'Concluído com sucesso.',
    error: (err) =>
      typeof error === 'function'
        ? error(err)
        : error ?? getErrorMessage(err, 'Não foi possível concluir.'),
  });
  return wrapped;
}
