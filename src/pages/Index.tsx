"use client";

import React, { useState, useEffect, useCallback } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, DollarSign, AlertTriangle, CheckCircle, RefreshCw, Loader2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/auth/SessionContextProvider";

const Index = () => {
  const { user } = useSession();
  const [summary, setSummary] = useState({
    totalBank: 0,
    totalFin: 0,
    countBank: 0,
    countFin: 0
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [bankRes, finRes] = await Promise.all([
        supabase.from("bank_statements").select("amount").eq("user_id", user.id),
        supabase.from("financial_entries").select("amount").eq("user_id", user.id)
      ]);

      if (bankRes.error) throw bankRes.error;
      if (finRes.error) throw finRes.error;

      const totalBank = bankRes.data.reduce((acc, curr) => acc + Number(curr.amount), 0);
      const totalFin = finRes.data.reduce((acc, curr) => acc + Number(curr.amount), 0);

      setSummary({
        totalBank,
        totalFin,
        countBank: bankRes.data.length,
        countFin: finRes.data.length
      });
    } catch (error: any) {
      showError("Erro ao carregar dados: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-extrabold text-primary">Resumo da Conciliação</h1>
          <Button onClick={fetchData} variant="outline" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Atualizar
          </Button>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-blue-600 text-white border-none shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium opacity-90">Total no Extrato</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(summary.totalBank)}</div>
              <p className="text-sm opacity-80 mt-1">{summary.countBank} lançamentos importados</p>
            </CardContent>
          </Card>

          <Card className="bg-emerald-600 text-white border-none shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium opacity-90">Total Financeiro</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(summary.totalFin)}</div>
              <p className="text-sm opacity-80 mt-1">{summary.countFin} registros internos</p>
            </CardContent>
          </Card>

          <Card className="bg-amber-600 text-white border-none shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium opacity-90">Diferença Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(Math.abs(summary.totalBank - summary.totalFin))}</div>
              <p className="text-sm opacity-80 mt-1">Divergência entre bases</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-700 text-white border-none shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium opacity-90">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">Pendente</div>
              <p className="text-sm opacity-80 mt-1">Aguardando conciliação</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center bg-muted/30 rounded-2xl border-2 border-dashed border-muted p-12 text-center">
          <BarChart className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-2xl font-bold text-foreground mb-2">Pronto para Conciliar</h3>
          <p className="text-muted-foreground max-w-md mb-6">
            Os dados foram carregados. Agora você pode ir para a aba de Conciliação para fazer o batimento inteligente dos valores.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Index;