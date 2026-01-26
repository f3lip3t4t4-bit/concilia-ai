"use client";

import React, { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FileText, PieChart, TrendingUp, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/auth/SessionContextProvider";

const Reports = () => {
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBank: 0,
    totalFin: 0,
    matchesCount: 0,
    totalMatchesValue: 0,
    unmatchedBankCount: 0,
    unmatchedFinCount: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const [bankRes, finRes, matchesRes] = await Promise.all([
          supabase.from("bank_statements").select("*").eq("user_id", user.id),
          supabase.from("financial_entries").select("*").eq("user_id", user.id),
          supabase.from("reconciliation_matches").select("*").eq("user_id", user.id)
        ]);

        const bankData = bankRes.data || [];
        const finData = finRes.data || [];
        const matchesData = matchesRes.data || [];

        // Valor total conciliado
        let matchesValue = 0;
        matchesData.forEach(m => {
          const b = bankData.find(e => e.id === m.bank_statement_id);
          if (b) matchesValue += Number(b.amount);
        });

        setStats({
          totalBank: bankData.length,
          totalFin: finData.length,
          matchesCount: matchesData.length,
          totalMatchesValue: matchesValue,
          unmatchedBankCount: bankData.length - matchesData.length,
          unmatchedFinCount: finData.length - matchesData.length
        });
      } catch (error) {
        console.error("Erro ao carregar estatísticas", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  
  const reconciliationRate = stats.totalBank > 0 
    ? Math.round((stats.matchesCount / stats.totalBank) * 100) 
    : 0;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <header>
          <h1 className="text-4xl font-extrabold text-primary">Relatórios e Insights</h1>
          <p className="text-xl text-muted-foreground mt-2">Uma visão detalhada da saúde financeira e precisão dos dados.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-700 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium opacity-90">Eficiência de Conciliação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-bold mb-4">{reconciliationRate}%</div>
              <Progress value={reconciliationRate} className="h-2 bg-white/20" />
              <p className="text-sm opacity-80 mt-4">Dos lançamentos bancários foram processados.</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium text-muted-foreground flex items-center">
                <CheckCircle2 className="mr-2 h-5 w-5 text-emerald-500" />
                Valor Conciliado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{formatCurrency(stats.totalMatchesValue)}</div>
              <p className="text-sm text-muted-foreground mt-2">Total de valores que batem entre as bases.</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium text-muted-foreground flex items-center">
                <AlertCircle className="mr-2 h-5 w-5 text-amber-500" />
                Pendências Totais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats.unmatchedBankCount + stats.unmatchedFinCount}</div>
              <p className="text-sm text-muted-foreground mt-2">Itens que ainda precisam de atenção manual.</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center">
                <PieChart className="mr-2 h-5 w-5 text-primary" />
                Composição por Fonte
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>Extrato Bancário</span>
                  <span>{stats.totalBank} itens</span>
                </div>
                <Progress value={100} className="h-2 bg-blue-100" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>Lançamentos Internos</span>
                  <span>{stats.totalFin} itens</span>
                </div>
                <Progress value={(stats.totalFin / stats.totalBank) * 100} className="h-2 bg-emerald-100" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="mr-2 h-5 w-5 text-primary" />
                Próximos Passos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">1</div>
                  <p className="text-sm">Existem {stats.unmatchedBankCount} itens no banco sem correspondência. Verifique se há taxas ou estornos esquecidos.</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">2</div>
                  <p className="text-sm">Você tem {stats.unmatchedFinCount} registros internos sem entrada bancária. Pode haver pagamentos atrasados ou erros de digitação.</p>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Reports;