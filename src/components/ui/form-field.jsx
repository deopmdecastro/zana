import { Label } from '@/components/ui/label';

/**
 * FormField wrapper melhorado com:
 * - Error styling (red border)
 * - Required indicator (*)
 * - Help text
 * - ARIA attributes para acessibilidade
 * - Character counter
 */
export function FormField({
  label,
  error,
  required = false,
  helpText,
  children,
  maxLength,
  currentLength,
  className = 'space-y-2',
  id,
}) {
  const showCounter = maxLength && currentLength !== undefined;
  const errorId = id ? `${id}-error` : undefined;
  const helpId = id ? `${id}-help` : undefined;

  return (
    <div className={className}>
      {label && (
        <Label htmlFor={id} className="font-body text-xs">
          {label}
          {required && <span className="text-destructive ml-1" aria-label="obrigatório">*</span>}
        </Label>
      )}
      
      <div className={error ? 'border border-destructive rounded-md p-px' : ''}>
        {children}
      </div>

      <div className="space-y-1">
        {error && (
          <p
            id={errorId}
            role="alert"
            className="text-xs text-destructive font-medium"
          >
            {error}
          </p>
        )}

        {helpText && !error && (
          <p
            id={helpId}
            className="text-xs text-muted-foreground"
          >
            {helpText}
          </p>
        )}

        {showCounter && (
          <p className="text-xs text-muted-foreground text-right tabular-nums">
            {currentLength}/{maxLength}
          </p>
        )}
      </div>
    </div>
  );
}

export default FormField;
