import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

/**
 * LoadingButton component com spinner
 * Desabilita automaticamente e mostra loading state
 */
export function LoadingButton({
  isLoading = false,
  children,
  loadingText = 'Carregando...',
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <Button
      disabled={isLoading || disabled}
      className={className}
      {...props}
    >
      {isLoading && (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
      )}
      {isLoading ? loadingText : children}
    </Button>
  );
}

export default LoadingButton;
