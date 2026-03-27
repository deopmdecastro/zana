import React from 'react';

const UserNotRegisteredError = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-8 p-8 text-center">
        <div className="mx-auto h-24 w-24">
          <div className="h-24 w-24 rounded-full bg-destructive"></div>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conta não encontrada</h1>
          <p className="mt-2 text-muted-foreground">
            A tua conta não está registada nesta aplicação. Por favor verifica as tuas credenciais ou contacta o suporte.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;

