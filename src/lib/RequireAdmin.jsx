import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

export default function RequireAdmin({ children }) {
  const { user, isLoadingAuth } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!isLoadingAuth && user && !user.is_admin) {
      toast.error('Sem permissão para acessar o admin.');
    }
  }, [isLoadingAuth, user]);

  if (isLoadingAuth) return null;
  if (!user) return <Navigate to="/conta" replace state={{ from: location }} />;
  if (!user.is_admin) return <Navigate to="/" replace />;
  return children;
}

