"use client";

import React, { useState, useEffect, useCallback } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, RefreshCw, Loader2, ArrowUpRight, ArrowDownRight, CheckCircle2, AlertCircle, TrendingUp } from "lucide-react";
import { showError } from "@/utils/toast";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/auth/SessionContextProvider";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const Index = () => {
  const { user, isLoading: sessionLoading } = useSession();
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

      const totalBank = bankRes.data?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
      const totalFin = finRes.data?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

      setData({
        totalBank,
        totalFin,
        countBank: bankRes.data?.length || 0,
        countFin: finRes.data?.length || 0,
        matches: matchRes.data?.length || 0
      });
    } catch (error: any) {
      console.error(error);
      showError("Erro ao carregar dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const recRate = data.countBank > 0 ? Math.round((data.matches / data.countBank) * 100) : 0;

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-black text-primary tracking-tight">
              Olá, {user?.email?.split('@')[0]}
            </h1>
            <p className="text-muted-foreground text-lg">
              Resumo da sua saúde financeira e conciliação.
            </p>
          </div>
          <Button 
            onClick={fetchData} 
            variant="outline" 
            className="rounded-2xl px-6 h-12 shadow-sm bg-white border-slate-200 hover:bg-slate-50 transition-all" 
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2 text-primary" />}
            Atualizar Dados
          </Button>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-[2.5rem] p-4">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-widest opacity-80">Saldo Bancário</CardTitle>
              <div className="bg-white/20 p-2 rounded-xl">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black mb-1">{formatCurrency(data.totalBank)}</div>
              <p className="text-xs font-medium opacity-60">{data.countBank} transações importadas</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-[2.5rem] p-4">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-widest opacity-80">Saldo Financeiro</CardTitle>
              <div className="bg-white/20 p-2 rounded-xl">
                <ArrowDownRight className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black mb-1">{formatCurrency(data.totalFin)}</div>
              <p className="text-xs font-medium opacity-60">{data.countFin} lançamentos internos</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-white rounded-[2.5rem] p-8">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Taxa de Batimento</h3>
                <div className="text-4xl font-black text-primary mt-1">{recRate}%</div>
              </div>
              <div className={cn(
                "h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner",
                recRate === 100 ? "bg-emerald-50 text-emerald-500" : "bg-blue-50 text-blue-500"
              )}>
                {recRate === 100 ? <CheckCircle2 size={32} /> : <TrendingUp size={32} />}
              </div>
            </div>
            <Progress value={recRate} className="h-3 rounded-full bg-slate-100" />
            <p className="text-xs text-muted-foreground mt-4 font-semibold italic">
              {data.matches} itens conciliados com sucesso.
            </p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-slate-50 border border-slate-100 rounded-[3rem] p-10 flex flex-col justify-center space-y-6">
            <div className="h-16 w-16 bg-white rounded-2xl shadow-lg flex items-center justify-center ring-1 ring-slate-200">
              <DollarSign className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-3xl font-black text-primary">Pronto para conciliar?</h3>
              <p className="text-muted-foreground text-lg leading-relaxed mt-2">
                Nosso motor de busca inteligente encontra divergências e sugestões de batimento em segundos.
              </p>
            </div>
            <Button size="lg" className="rounded-2xl w-fit px-8 py-6 text-md font-bold shadow-xl transition-all hover:scale-105" asChild>
              <a href="/reconciliation">Começar agora</a>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card className="border-none shadow-md rounded-[2rem] bg-white p-6 flex flex-col justify-between">
              <div className="bg-amber-50 text-amber-600 p-3 rounded-2xl w-fit mb-4">
                <AlertCircle size={24} />
              </div>
              <div>
                <h4 className="font-bold text-lg text-primary">Pendências</h4>
                <p className="text-sm text-muted-foreground">Existem {data.countBank - data.matches} itens aguardando ação.</p>
              </div>
            </Card>
            <Card className="border-none shadow-md rounded-[2rem] bg-white p-6 flex flex-col justify-between">
              <div className="bg-blue-50 text-blue-600 p-3 rounded-2xl w-fit mb-4">
                <RefreshCw size={24} />
              </div>
              <div>
                <h4 className="font-bold text-lg text-primary">Sincronismo</h4>
                <p className="text-sm text-muted-foreground">Última atualização realizada agora mesmo.</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;