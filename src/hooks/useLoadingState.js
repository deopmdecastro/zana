import { useState } from 'react';

/**
 * Hook para gerenciar loading state em async actions
 * Útil para forms, API calls, etc
 */
export function useLoadingState() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const withLoading = async (fn, options = {}) => {
    const { onError, onSuccess } = options;
    
    try {
      setIsLoading(true);
      setError(null);
      const result = await fn();
      onSuccess?.(result);
      return result;
    } catch (err) {
      const errorMessage = err?.message || 'Ocorreu um erro';
      setError(errorMessage);
      onError?.(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setIsLoading(false);
    setError(null);
  };

  return { isLoading, error, withLoading, reset };
}

export default useLoadingState;
