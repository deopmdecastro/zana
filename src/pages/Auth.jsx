import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const getAuthErrorMessage = (err, mode) => {
  const code = err?.data?.error ?? err?.message;
  if (code === 'invalid_credentials') return 'Credenciais inválidas.';
  if (code === 'email_taken') return 'Este email já está em uso.';
  if (code === 'invalid_body') return 'Dados inválidos. Verifique os campos.';
  if (code === 'invalid_token') return 'Token inválido ou expirado.';
  if (code === 'internal_error') return 'Erro interno. Tente novamente.';
  if (code === 'Missing credentials') return 'Preencha email e palavra-passe.';
  if (code === 'Missing email') return 'Preencha o email.';
  if (code === 'Missing fields') return 'Preencha todos os campos.';
  if (mode === 'login') return 'Não foi possível iniciar sessão.';
  if (mode === 'reset') return 'Não foi possível enviar o email de recuperação.';
  return 'Não foi possível criar a conta.';
};

export default function Auth() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isLogin, setIsLogin] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetStep, setResetStep] = useState('request'); // request | confirm
  const [resetToken, setResetToken] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    setErrorMessage('');
  }, [isLogin]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset_token');
    if (token) {
      setResetMode(true);
      setResetStep('confirm');
      setResetToken(token);
    }
  }, []);

  useEffect(() => {
    if (!resetMode) return;
    setErrorMessage('');
  }, [resetMode, resetStep]);

  const loginMutation = useMutation({
    mutationFn: (data) => base44.auth.login(data),
    onSuccess: () => {
      setErrorMessage('');
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Bem-vindo(a) de volta!');
      navigate('/conta', { replace: true });
    },
    onError: (err) => {
      const msg = getAuthErrorMessage(err, 'login');
      setErrorMessage(msg);
      toast.error(msg);
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data) =>
      base44.auth.register({ email: data.email, password: data.password, full_name: data.name }),
    onSuccess: () => {
      setErrorMessage('');
      toast.success('Conta criada! Agora pode fazer login.');
      setIsLogin(true);
    },
    onError: (err) => {
      const msg = getAuthErrorMessage(err, 'register');
      setErrorMessage(msg);
      toast.error(msg);
    },
  });

  const resetRequestMutation = useMutation({
    mutationFn: ({ email }) => base44.auth.requestPasswordReset({ email }),
    onSuccess: (data) => {
      setErrorMessage('');
      toast.success('Se existir uma conta com este email, enviamos instruções.');
      if (data?.resetToken) {
        setResetToken(data.resetToken);
        toast.message('Token de recuperação (dev)', { description: data.resetToken });
      }
      setResetStep('confirm');
    },
    onError: (err) => {
      const msg = getAuthErrorMessage(err, 'reset');
      setErrorMessage(msg);
      toast.error(msg);
    },
  });

  const resetConfirmMutation = useMutation({
    mutationFn: ({ token, new_password }) => base44.auth.confirmPasswordReset({ token, new_password }),
    onSuccess: () => {
      setErrorMessage('');
      toast.success('Palavra-passe atualizada. Pode iniciar sessão.');
      setResetMode(false);
      setResetStep('request');
      setResetToken('');
      setResetNewPassword('');
      setIsLogin(true);
      navigate('/conta', { replace: true });
    },
    onError: (err) => {
      const msg = getAuthErrorMessage(err, 'reset');
      setErrorMessage(msg);
      toast.error(msg);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (resetMode) {
      if (resetStep === 'request') {
        resetRequestMutation.mutate({ email: form.email });
      } else {
        resetConfirmMutation.mutate({ token: resetToken, new_password: resetNewPassword });
      }
      return;
    }
    if (isLogin) {
      loginMutation.mutate({ email: form.email, password: form.password });
    } else {
      registerMutation.mutate(form);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 md:py-20">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card p-8 rounded-lg border border-border shadow-sm"
      >
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl mb-2">
            {resetMode ? 'Recuperar Palavra-passe' : isLogin ? 'Iniciar Sessão' : 'Criar Conta'}
          </h1>
          <p className="font-body text-sm text-muted-foreground">
            {resetMode
              ? resetStep === 'request'
                ? 'Insira o seu email para gerar um token de recuperação (dev).'
                : 'Cole o token e defina uma nova palavra-passe.'
              : isLogin
                ? 'Aceda à sua área de cliente.'
                : 'Junte-se à Zana Acessórios.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {!resetMode && !isLogin && (
              <motion.div
                key="name-field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Label className="font-body text-xs">Nome Completo</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="rounded-none mt-1"
                  placeholder="Ex: Maria Silva"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <Label className="font-body text-xs">Email</Label>
            <Input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-none mt-1"
              placeholder="seu@email.com"
            />
          </div>

          {!resetMode ? (
            <div>
              <Label className="font-body text-xs">Palavra-passe</Label>
              <div className="relative mt-1">
                <Input
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="rounded-none pr-10"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar palavra-passe' : 'Ver palavra-passe'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : resetStep === 'confirm' ? (
            <>
              <div>
                <Label className="font-body text-xs">Token</Label>
                <Input
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="rounded-none mt-1"
                  placeholder="Cole aqui o token"
                />
              </div>
              <div>
                <Label className="font-body text-xs">Nova palavra-passe</Label>
                <div className="relative mt-1">
                  <Input
                    required
                    type={showResetPassword ? 'text' : 'password'}
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    className="rounded-none pr-10"
                  />
                  <button
                    type="button"
                    aria-label={showResetPassword ? 'Ocultar palavra-passe' : 'Ver palavra-passe'}
                    onClick={() => setShowResetPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {errorMessage ? (
            <p className="text-xs font-body text-destructive">{errorMessage}</p>
          ) : null}

          <Button
            type="submit"
            disabled={loginMutation.isPending || registerMutation.isPending || resetRequestMutation.isPending || resetConfirmMutation.isPending}
            className="w-full rounded-none py-6 font-body text-sm tracking-wider gap-2 mt-2"
          >
            {resetMode ? (
              resetStep === 'request' ? (
                'Gerar token'
              ) : resetConfirmMutation.isPending ? (
                'A atualizar...'
              ) : (
                'Atualizar palavra-passe'
              )
            ) : isLogin ? (
              <>
                <LogIn className="w-4 h-4" />
                {loginMutation.isPending ? 'A entrar...' : 'Entrar'}
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                {registerMutation.isPending ? 'A criar...' : 'Criar Conta'}
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center space-y-4">
          {!resetMode && isLogin && (
            <button
              type="button"
              onClick={() => {
                setResetMode(true);
                setResetStep('request');
                setResetToken('');
                setResetNewPassword('');
              }}
              className="text-xs font-body text-muted-foreground hover:text-primary transition-colors"
            >
              Esqueceu-se da palavra-passe?
            </button>
          )}

          {resetMode && (
            <button
              type="button"
              onClick={() => {
                setResetMode(false);
                setResetStep('request');
                setResetToken('');
                setResetNewPassword('');
              }}
              className="text-xs font-body text-muted-foreground hover:text-primary transition-colors"
            >
              Voltar ao login
            </button>
          )}

          <Separator />

          {!resetMode && (
            <p className="font-body text-sm text-muted-foreground">
              {isLogin ? 'Ainda não tem conta?' : 'Já tem uma conta?'}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 text-primary font-medium hover:underline"
              >
                {isLogin ? 'Registe-se aqui' : 'Inicie sessão'}
              </button>
            </p>
          )}
        </div>
      </motion.div>

      <div className="mt-12 grid grid-cols-2 gap-8 text-center opacity-50 grayscale scale-90">
        <div className="space-y-1">
          <p className="font-heading text-lg italic">Zana</p>
          <p className="text-[10px] uppercase tracking-widest font-body">Elegância</p>
        </div>
        <div className="space-y-1">
          <p className="font-heading text-lg italic">Acessórios</p>
          <p className="text-[10px] uppercase tracking-widest font-body">Essência</p>
        </div>
      </div>
    </div>
  );
}
