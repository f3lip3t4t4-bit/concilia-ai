"use client";

import React, { useState, useEffect, useCallback } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, RefreshCw, Loader2, ArrowUpRight, ArrowDownRight, CheckCircle2, AlertCircle } from "lucide-react";
import { showError } from "@/utils/toast";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/auth/SessionContextProvider";
import { Progress } from "@/components/ui/progress";

const Index = () => {
  const { user } = useSession();
  const [data, setData] = useState({
    totalBank: 0,
    totalFin: 0,
    countBank: 0,
    countFin: 0,
    matches: 0
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [bankRes, finRes, matchRes] = await Promise.all([
        supabase.from("bank_statements").select("amount").eq("user_id", user.id),
        supabase.from("financial_entries").select("amount").eq("user_id", user.id),
        supabase.from("reconciliation_matches").select("id").eq("user_id", user.id)
      ]);

      if (bankRes.error) throw bankRes.error;
      if (finRes.error) throw finRes.error;

      const totalBank = bankRes.data.reduce((acc, curr) => acc + Number(curr.amount), 0);
      const totalFin = finRes.data.reduce((acc, curr) => acc + Number(curr.amount), 0);

      setData({
        totalBank,
        totalFin,
        countBank: bankRes.data.length,
        countFin: finRes.data.length,
        matches: matchRes.data?.length || 0
      });
    } catch (error: any) {
      showError("Erro ao carregar dashboard.");
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

  const recRate = data.countBank > 0 ? Math.round((data.matches / data.countBank) * 100) : 0;

  return (
    <Layout>
      <div className="space-y-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-black text-primary tracking-tight">Bem-vindo, {user?.email?.split('@')[0]}</h1>
            <p className="text-muted-foreground text-lg">Aqui está o status atual da sua conciliação bancária.</p>
          </div>
          <Button onClick={fetchData} variant="outline" className="rounded-xl px-6 py-5 shadow-sm bg-white" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sincronizar Dados
          </Button>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="border-none shadow-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-[2rem] overflow-hidden">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-widest opacity-70">Saldo em Extrato</CardTitle>
              <ArrowUpRight className="h-5 w-5 opacity-50" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black mb-1">{formatCurrency(data.totalBank)}</div>
              <p className="text-xs font-medium opacity-60">Baseado em {data.countBank} transações</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white rounded-[2rem] overflow-hidden">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-widest opacity-70">Saldo Financeiro</CardTitle>
              <ArrowDownRight className="h-5 w-5 opacity-50" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black mb-1">{formatCurrency(data.totalFin)}</div>
              <p className="text-xs font-medium opacity-60">Referente a {data.countFin} registros</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-white rounded-[2rem] p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Progresso</h3>
                <div className="text-3xl font-black text-primary">{recRate}%</div>
              </div>
              <div className={cn(
                "h-12 w-12 rounded-2xl flex items-center justify-center",
                recRate === 100 ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"
              )}>
                {recRate === 100 ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
              </div>
            </div>
            <Progress value={recRate} className="h-3 rounded-full bg-slate-100" />
            <p className="text-xs text-muted-foreground mt-4 font-medium italic">
              {data.matches} de {data.countBank} itens conciliados.
            </p>
          </Card>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-[2.5rem] p-12 text-center space-y-4">
          <div className="h-20 w-20 bg-white rounded-3xl shadow-lg flex items-center justify-center mx-auto mb-6 ring-1 ring-slate-200">
            <DollarSign className="h-10 w-10 text-blue-600" />
          </div>
          <h3 className="text-3xl font-black text-primary">Análise Pronta</h3>
          <p className="text-muted-foreground max-w-lg mx-auto text-lg leading-relaxed">
            Seus dados estão sincronizados com a nuvem. Utilize a ferramenta de <strong>Conciliação</strong> para realizar o batimento inteligente ou manual.
          </p>
          <div className="pt-4">
            <Button size="lg" className="rounded-2xl px-10 py-7 text-lg font-bold shadow-blue-200 shadow-xl" asChild>
              <a href="/reconciliation">Ir para Conciliação</a>
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;