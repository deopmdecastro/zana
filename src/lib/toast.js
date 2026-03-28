import { toast } from 'sonner';

export function getErrorMessage(err, fallback = 'Ocorreu um erro.') {
  const fromApi = err?.data?.error;
  if (typeof fromApi === 'string' && fromApi.trim()) return fromApi;
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

