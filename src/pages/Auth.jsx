import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { LogIn, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Auth() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const loginMutation = useMutation({
    mutationFn: (data) => base44.auth.login(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Bem-vindo(a) de volta!');
    },
    onError: () => toast.error('Credenciais inválidas.'),
  });

  const registerMutation = useMutation({
    mutationFn: (data) => base44.auth.register({ email: data.email, password: data.password, full_name: data.name }),
    onSuccess: () => {
      toast.success('Conta criada! Agora pode fazer login.');
      setIsLogin(true);
    },
    onError: (err) => toast.error(err.message || 'Erro ao criar conta.'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
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
            {isLogin ? 'Iniciar Sessão' : 'Criar Conta'}
          </h1>
          <p className="font-body text-sm text-muted-foreground">
            {isLogin ? 'Aceda à sua área de cliente.' : 'Junte-se à Zana Acessórios.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {!isLogin && (
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

          <div>
            <Label className="font-body text-xs">Palavra-passe</Label>
            <Input
              required
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="rounded-none mt-1"
            />
          </div>

          <Button
            type="submit"
            disabled={loginMutation.isPending || registerMutation.isPending}
            className="w-full rounded-none py-6 font-body text-sm tracking-wider gap-2 mt-2"
          >
            {isLogin ? (
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
          {isLogin && (
            <button className="text-xs font-body text-muted-foreground hover:text-primary transition-colors">
              Esqueceu-se da palavra-passe?
            </button>
          )}
          
          <Separator />
          
          <p className="font-body text-sm text-muted-foreground">
            {isLogin ? 'Ainda não tem conta?' : 'Já tem uma conta?'}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 text-primary font-medium hover:underline"
            >
              {isLogin ? 'Registe-se aqui' : 'Inicie sessão'}
            </button>
          </p>
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