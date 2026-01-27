"use client";

import React, { useState, useEffect, useCallback } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, RefreshCw, Loader2, ArrowUpRight, ArrowDownRight, CheckCircle2, AlertCircle, TrendingUp, History, ExternalLink } from "lucide-react";
import { showError } from "@/utils/toast";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/auth/SessionContextProvider";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const Index = () => {
  const { user, isLoading: sessionLoading } = useSession();
  const [firstName, setFirstName] = useState<string>("");
  const [data, setData] = useState({
    totalBank: 0,
    totalFin: 0,
    countBank: 0,
    countFin: 0,
    matches: 0
  });
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("id", user.id)
      .single();
    
    if (profile?.first_name) {
      setFirstName(profile.first_name);
    } else {
      const emailName = user.email?.split('@')[0] || "";
      const formatted = emailName.split('.')[0];
      setFirstName(formatted.charAt(0).toUpperCase() + formatted.slice(1));
    }
  }, [user]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [bankRes, finRes, matchRes] = await Promise.all([
        supabase.from("bank_statements").select("amount").eq("user_id", user.id),
        supabase.from("financial_entries").select("amount").eq("user_id", user.id),
        supabase.from("reconciliation_matches").select("id, created_at, bank_statement_id, financial_entry_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5)
      ]);

      if (bankRes.error) throw bankRes.error;
      if (finRes.error) throw finRes.error;

      const totalBank = bankRes.data?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
      const totalFin = finRes.data?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

      // Buscar detalhes dos matches recentes (precisamos do count total e também dos itens)
      const { count } = await supabase.from("reconciliation_matches").select("id", { count: 'exact', head: true }).eq("user_id", user.id);

      setData({
        totalBank,
        totalFin,
        countBank: bankRes.data?.length || 0,
        countFin: finRes.data?.length || 0,
        matches: count || 0
      });

      // Melhorar a busca de recentes para pegar os nomes (mocked for simplicity here, or we join)
      // Como não temos join fácil no supabase client sem view, vamos apenas marcar que existem
      setRecentMatches(matchRes.data || []);
      
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
      fetchProfile();
    }
  }, [user, fetchData, fetchProfile]);

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
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-12 animate-in fade-in duration-700">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl sm:text-6xl font-black text-primary tracking-tighter">
              Olá, {firstName}
            </h1>
            <p className="text-muted-foreground text-lg sm:text-2xl font-medium">
              Sua conciliação está <span className={cn("font-bold", recRate > 90 ? "text-emerald-500" : "text-amber-500")}>{recRate}% concluída</span>.
            </p>
          </div>
          <Button 
            onClick={fetchData} 
            variant="outline" 
            className="rounded-2xl px-8 h-14 shadow-md bg-white border-slate-200 hover:bg-slate-50 hover:scale-105 transition-all w-full md:w-auto font-black text-primary gap-3" 
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
            Sincronizar
          </Button>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="border-none shadow-2xl bg-gradient-to-br from-indigo-600 to-blue-800 text-white rounded-[2.5rem] p-8 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
              <ArrowUpRight size={160} />
            </div>
            <CardHeader className="p-0 pb-6 flex flex-row items-center justify-between relative z-10">
              <CardTitle className="text-sm font-black uppercase tracking-widest opacity-70">Saldo em Banco</CardTitle>
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                <DollarSign className="h-6 w-6" />
              </div>
            </CardHeader>
            <CardContent className="p-0 relative z-10">
              <div className="text-4xl font-black mb-2">{formatCurrency(data.totalBank)}</div>
              <div className="flex items-center gap-2 text-sm font-bold bg-white/10 w-fit px-3 py-1 rounded-full">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                {data.countBank} transações
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-[2.5rem] p-8 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
              <ArrowDownRight size={160} />
            </div>
            <CardHeader className="p-0 pb-6 flex flex-row items-center justify-between relative z-10">
              <CardTitle className="text-sm font-black uppercase tracking-widest opacity-70">Saldo em Sistema</CardTitle>
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                <TrendingUp className="h-6 w-6" />
              </div>
            </CardHeader>
            <CardContent className="p-0 relative z-10">
              <div className="text-4xl font-black mb-2">{formatCurrency(data.totalFin)}</div>
              <div className="flex items-center gap-2 text-sm font-bold bg-white/10 w-fit px-3 py-1 rounded-full">
                <div className="h-2 w-2 rounded-full bg-blue-300" />
                {data.countFin} lançamentos
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] p-8 col-span-1 md:col-span-2 lg:col-span-1">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Eficiência</h3>
                <div className="text-5xl font-black text-primary mt-1 tracking-tighter">{recRate}%</div>
              </div>
              <div className={cn(
                "h-16 w-16 rounded-[1.5rem] flex items-center justify-center shadow-inner",
                recRate === 100 ? "bg-emerald-50 text-emerald-500" : "bg-blue-50 text-blue-600"
              )}>
                {recRate === 100 ? <CheckCircle2 size={36} /> : <TrendingUp size={36} />}
              </div>
            </div>
            <div className="space-y-4">
              <Progress value={recRate} className="h-4 rounded-full bg-slate-100" />
              <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-slate-400">
                <span>Pendente</span>
                <span>{data.matches} de {data.countBank}</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-2xl font-black text-primary flex items-center gap-3">
                <History className="text-blue-600" /> Atividade Recente
              </h3>
              <Button variant="ghost" className="font-bold text-blue-600 hover:bg-blue-50" asChild>
                <Link to="/reconciliation">Ver tudo <ExternalLink size={14} className="ml-2" /></Link>
              </Button>
            </div>
            
            <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden">
              <CardContent className="p-0">
                {recentMatches.length > 0 ? (
                  <div className="divide-y divide-slate-50">
                    {recentMatches.map((match, i) => (
                      <div key={match.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                            <CheckCircle2 size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-primary">Item Conciliado #{i + 1}</p>
                            <p className="text-xs text-muted-foreground font-medium">{new Date(match.created_at).toLocaleString('pt-BR')}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="rounded-lg bg-slate-50 border-slate-200 font-bold uppercase text-[10px] text-slate-500 px-3">Automático</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center space-y-4">
                    <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                      <History size={40} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-500">Nenhuma conciliação recente</p>
                      <p className="text-sm text-slate-400 font-medium">Os últimos batimentos realizados aparecerão aqui.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <h3 className="text-2xl font-black text-primary px-2">Ações Rápidas</h3>
            <div className="grid grid-cols-1 gap-4">
              <Link to="/import" className="block group">
                <Card className="border-none shadow-lg rounded-3xl p-6 bg-white hover:bg-blue-600 hover:text-white transition-all duration-300 hover:-translate-y-1">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:bg-white/20 group-hover:text-white">
                      <ExternalLink size={24} />
                    </div>
                    <div>
                      <p className="font-black">Importar Novo Mês</p>
                      <p className="text-xs opacity-60 font-bold uppercase tracking-wider">Base de dados</p>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link to="/reports" className="block group">
                <Card className="border-none shadow-lg rounded-3xl p-6 bg-white hover:bg-emerald-600 hover:text-white transition-all duration-300 hover:-translate-y-1">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:bg-white/20 group-hover:text-white">
                      <TrendingUp size={24} />
                    </div>
                    <div>
                      <p className="font-black">Gerar Fechamento</p>
                      <p className="text-xs opacity-60 font-bold uppercase tracking-wider">Relatórios contábeis</p>
                    </div>
                  </div>
                </Card>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;