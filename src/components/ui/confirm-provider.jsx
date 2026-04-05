import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ConfirmContext = React.createContext(null);

export function ConfirmProvider({ children }) {
  const resolverRef = React.useRef(null);
  const [state, setState] = React.useState({
    open: false,
    title: 'Confirmar',
    description: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    destructive: false,
  });

  const confirm = React.useCallback((options = {}) => {
    const next = {
      open: true,
      title: typeof options.title === 'string' && options.title.trim() ? options.title : 'Confirmar',
      description: typeof options.description === 'string' ? options.description : '',
      confirmText: typeof options.confirmText === 'string' && options.confirmText.trim() ? options.confirmText : 'Confirmar',
      cancelText: typeof options.cancelText === 'string' && options.cancelText.trim() ? options.cancelText : 'Cancelar',
      destructive: Boolean(options.destructive),
    };

    setState(next);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = React.useCallback((value) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setState((prev) => ({ ...prev, open: false }));
    if (typeof resolve === 'function') resolve(Boolean(value));
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={state.open}
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
      >
        <AlertDialogContent className="w-[calc(100vw-32px)] sm:w-full max-w-md overflow-hidden rounded-2xl p-0">
          <div className="p-6 space-y-4">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-heading text-xl">{state.title}</AlertDialogTitle>
              {state.description ? (
                <AlertDialogDescription className="font-body text-sm">
                  {state.description}
                </AlertDialogDescription>
              ) : null}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-none font-body">
                {state.cancelText}
              </AlertDialogCancel>
              <AlertDialogAction
                className={cn(
                  'rounded-none font-body',
                  state.destructive ? 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90' : null,
                )}
                onClick={() => settle(true)}
              >
                {state.confirmText}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>');
  return ctx;
}

