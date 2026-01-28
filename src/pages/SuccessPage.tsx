"use client";

import React, { useEffect } from "react";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "@/components/auth/SessionContextProvider";

const SuccessPage = () => {
  const { refreshSubscription, isLoading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    // Força a atualização da sessão para buscar o novo status de assinatura
    refreshSubscription();
    
    // Redireciona após um pequeno delay para garantir que a sessão seja atualizada
    const timer = setTimeout(() => {
      navigate("/", { replace: true });
    }, 5000); 

    return () => clearTimeout(timer);
  }, [refreshSubscription, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 text-center space-y-6 animate-in fade-in zoom-in duration-500">
        <div className="h-20 w-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto">
          <CheckCircle size={48} />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-primary">Pagamento Aprovado!</h2>
          <p className="text-muted-foreground font-medium">
            Seu acesso ao Concilia Pro foi ativado com sucesso. Você será redirecionado em breve.
          </p>
        </div>
        <Button asChild className="w-full py-8 text-xl font-black rounded-2xl shadow-xl bg-primary hover:scale-105 transition-all">
          <Link to="/">
            Ir para o Dashboard <ArrowRight className="ml-3 h-6 w-6" />
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default SuccessPage;