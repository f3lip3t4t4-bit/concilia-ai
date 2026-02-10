"use client";

import React from "react";
import { useSession } from "./SessionContextProvider";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2, ShieldAlert, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export const SubscriptionGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { subscription, profile, isLoading, user } = useSession();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // BYPASS PARA ADMIN: Se o usuário for admin, ele tem acesso total sempre
  const isAdmin = profile?.role === 'admin';

  // Permitir acesso às páginas de login e checkout sem restrição
  if (location.pathname === "/login" || location.pathname === "/checkout") {
    return <>{children}</>;
  }

  if (isAdmin) {
    return (
      <>
        <div className="bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.2em] py-1 text-center flex items-center justify-center gap-2">
          <ShieldCheck size={12} />
          Modo Administrador Ativo — Acesso Vitalício Liberado
        </div>
        {children}
      </>
    );
  }

  // Lógica de Trial de 7 dias
  const createdAt = user?.created_at ? new Date(user.created_at) : new Date();
  const trialEndsAt = new Date(createdAt);
  trialEndsAt.setDate(trialEndsAt.getDate() + 7);
  
  const isTrialActive = new Date() < trialEndsAt;
  
  // Lógica de Acesso Pago
  const paidUntilDate = subscription?.paid_until ? new Date(subscription.paid_until) : null;
  const isPaidAccessValid = paidUntilDate ? paidUntilDate > new Date() : false;

  // BLOQUEIO: Só bloqueia se o trial acabou E o acesso pago não é válido
  if (!isTrialActive && !isPaidAccessValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 text-center space-y-6 animate-in fade-in zoom-in duration-300">
          <div className="h-20 w-20 bg-destructive/10 text-destructive rounded-3xl flex items-center justify-center mx-auto">
            <ShieldAlert size={48} />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-primary">Acesso Expirado</h2>
            <p className="text-muted-foreground font-medium">
              Seu período de acesso chegou ao fim. 
              Assine o Concilia Pro para continuar gerenciando suas finanças com inteligência.
            </p>
          </div>
          <Button asChild className="w-full py-8 text-xl font-black rounded-2xl shadow-xl bg-primary hover:scale-105 transition-all">
            <Link to="/checkout">Ativar Concilia Pro</Link>
          </Button>
          <div className="pt-4 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              ID: {user?.id.slice(0,12)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const daysRemaining = Math.ceil((trialEndsAt.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
  
  return (
    <>
      {isTrialActive && !isPaidAccessValid && (
        <div className="bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] py-1 text-center flex items-center justify-center gap-2">
          <Sparkles size={12} className="animate-pulse" />
          Período de Teste Ativo — Expira em {daysRemaining} dias
          <Link to="/checkout" className="underline ml-2">Assinar Agora</Link>
        </div>
      )}
      {children}
    </>
  );
};