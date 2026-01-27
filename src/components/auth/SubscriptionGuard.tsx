"use client";

import React from "react";
import { useSession } from "./SessionContextProvider";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export const SubscriptionGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { subscription, isLoading, user } = useSession();
  const location = useLocation();

  // Se estiver carregando, mostra spinner
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // Permitir acesso às páginas de login e checkout sem restrição
  if (location.pathname === "/login" || location.pathname === "/checkout") {
    return <>{children}</>;
  }

  const isPaid = subscription?.status === 'active';
  const isPastDue = subscription?.status === 'past_due';
  const isExpired = subscription?.paid_until ? new Date(subscription.paid_until) < new Date() : true;

  // BLOQUEIO ANTI-BURLA: Se não estiver ativo ou se a data expirou
  if (!isPaid || isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 text-center space-y-6">
          <div className="h-20 w-20 bg-destructive/10 text-destructive rounded-3xl flex items-center justify-center mx-auto">
            <ShieldAlert size={48} />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-primary">Acesso Restrito</h2>
            <p className="text-muted-foreground font-medium">
              Sua assinatura está {isPastDue ? 'atrasada' : 'inativa'}. 
              Regularize seu pagamento para continuar utilizando o Concilia Pro.
            </p>
          </div>
          <Button asChild className="w-full py-8 text-xl font-black rounded-2xl shadow-xl bg-primary">
            <Link to="/checkout">Regularizar Agora</Link>
          </Button>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
            ID do Usuário: {user?.id.slice(0,8)}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};