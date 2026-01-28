"use client";

import React from "react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const PendingPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 text-center space-y-6 animate-in fade-in zoom-in duration-500">
        <div className="h-20 w-20 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center mx-auto">
          <AlertCircle size={48} />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-primary">Pagamento Pendente</h2>
          <p className="text-muted-foreground font-medium">
            Aguardando a confirmação do pagamento. Seu acesso será liberado automaticamente assim que for aprovado.
          </p>
        </div>
        <Button asChild variant="outline" className="w-full py-8 text-xl font-black rounded-2xl shadow-md border-slate-200 hover:bg-slate-50 transition-all">
          <Link to="/">
            Voltar ao Início <ArrowRight className="ml-3 h-6 w-6" />
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default PendingPage;