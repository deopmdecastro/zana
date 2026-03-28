import { toast } from 'sonner';

export function getErrorMessage(err, fallback = 'Ocorreu um erro.') {
  const fromApi = err?.data?.error;
  if (typeof fromApi === 'string' && fromApi.trim()) {
    const code = fromApi.trim();
    if (code === 'network_error') {
      const detail = err?.data?.detail ? String(err.data.detail) : '';
      return detail
        ? `Sem ligação ao servidor (${detail}). Confirme se o backend está a correr em http://localhost:3001`
        : 'Sem ligação ao servidor. Confirme se o backend está a correr em http://localhost:3001';
    }
    return code;
  }
  if (typeof err?.message === 'string' && err.message.trim()) return err.message;
  return fallback;
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

