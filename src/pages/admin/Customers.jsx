import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users } from 'lucide-react';

export default function AdminCustomers() {
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => base44.entities.User.list('-created_date', 100),
  });

  return (
    <div>
      <h1 className="font-heading text-3xl mb-6">Clientes</h1>

      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Nome</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Email</th>
              <th className="text-left p-3 font-body text-xs text-muted-foreground">Data Registo</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                <td className="p-3 font-body text-sm font-medium">{user.full_name || '-'}</td>
                <td className="p-3 font-body text-sm text-muted-foreground">{user.email}</td>
                <td className="p-3 font-body text-xs text-muted-foreground">{new Date(user.created_date).toLocaleDateString('pt-PT')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="text-center py-8">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="font-body text-sm text-muted-foreground">Sem clientes registados</p>
          </div>
        )}
      </div>
    </div>
  );
}