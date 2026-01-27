"use client";

import React, { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, FileText, AlertCircle, CheckCircle2, Loader2, Info, ArrowDownToLine, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import * as XLSX from "xlsx";

const Reports = () => {
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    bank: [] as any[],
    fin: [] as any[],
    matches: [] as any[]
  });

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [bankRes, finRes, matchesRes] = await Promise.all([
        supabase.from("bank_statements").select("*").eq("user_id", user.id).order("date", { ascending: true }),
        supabase.from("financial_entries").select("*").eq("user_id", user.id).order("date", { ascending: true }),
        supabase.from("reconciliation_matches").select("*").eq("user_id", user.id)
      ]);

      setData({
        bank: bankRes.data || [],
        fin: finRes.data || [],
        matches: matchesRes.data || []
      });
    } catch (error) {
      showError("Erro ao carregar dados para relatórios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const formatDateBR = (d: string) => {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  const exportToExcel = (reportData: any[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
    showSuccess("Relatório gerado com sucesso!");
  };

  const generateGeneralReport = () => {
    const matchedBankIds = new Set(data.matches.map(m => m.bank_statement_id));
    const matchedFinIds = new Set(data.matches.map(m => m.financial_entry_id));

    const report: any[] = [];

    data.bank.forEach(b => {
      report.push({
        "Data": formatDateBR(b.date),
        "Descrição": b.description,
        "Valor": b.amount,
        "Origem": "Extrato Bancário",
        "Status": matchedBankIds.has(b.id) ? "Conciliado" : "Não Conciliado"
      });
    });

    data.fin.filter(f => !matchedFinIds.has(f.id)).forEach(f => {
      report.push({
        "Data": formatDateBR(f.date),
        "Descrição": f.description,
        "Valor": f.amount,
        "Origem": "Sistema Financeiro",
        "Status": "Não Conciliado"
      });
    });

    const sortedReport = report.sort((a, b) => {
      const dateA = a.Data.split('/').reverse().join('');
      const dateB = b.Data.split('/').reverse().join('');
      return dateA.localeCompare(dateB);
    });

    exportToExcel(sortedReport, "Relatorio_Geral_Conciliacao");
  };

  const generateUnmatchedBankReport = () => {
    const matchedBankIds = new Set(data.matches.map(m => m.bank_statement_id));
    const unmatched = data.bank
      .filter(b => !matchedBankIds.has(b.id))
      .map(b => ({
        "Data": formatDateBR(b.date),
        "Descrição": b.description,
        "Valor": b.amount,
        "Status": "Pendente no Banco"
      }));

    if (unmatched.length === 0) return showSuccess("Não existem pendências no banco!");
    exportToExcel(unmatched, "Pendencias_Extrato_Bancario");
  };

  const generateUnmatchedFinReport = () => {
    const matchedFinIds = new Set(data.matches.map(m => m.financial_entry_id));
    const unmatched = data.fin
      .filter(f => !matchedFinIds.has(f.id))
      .map(f => ({
        "Data": formatDateBR(f.date),
        "Descrição": f.description,
        "Valor": f.amount,
        "Status": "Pendente no Sistema"
      }));

    if (unmatched.length === 0) return showSuccess("Não existem pendências no sistema!");
    exportToExcel(unmatched, "Pendencias_Sistema_Financeiro");
  };

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
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-4xl font-black text-primary tracking-tight">Exportação de Relatórios</h1>
            <p className="text-muted-foreground text-sm sm:text-lg">Gere planilhas Excel para conferência contábil e auditoria.</p>
          </div>
          <Button onClick={fetchData} variant="outline" className="rounded-xl w-full md:w-auto font-bold h-12 shadow-sm">
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar Dados
          </Button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Relatório Geral */}
          <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden flex flex-col hover:scale-[1.02] transition-transform duration-300">
            <div className="h-2 bg-blue-600 w-full" />
            <CardHeader className="p-6 sm:p-8 space-y-4">
              <div className="h-12 w-12 sm:h-14 sm:w-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                <FileText size={28} />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-xl sm:text-2xl font-black">Relatório Geral</CardTitle>
                <CardDescription className="text-sm sm:text-base leading-relaxed">
                  Visão completa 360°. Inclui todos os itens do extrato e as pendências do sistema organizadas por data.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 pt-0 mt-auto">
              <Button 
                onClick={generateGeneralReport}
                className="w-full py-6 sm:py-7 text-base sm:text-lg font-black rounded-2xl shadow-lg bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all"
              >
                <ArrowDownToLine className="mr-2 h-5 w-5 sm:h-6 sm:w-6" /> Exportar Geral
              </Button>
            </CardContent>
          </Card>

          {/* Pendências do Extrato */}
          <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden flex flex-col hover:scale-[1.02] transition-transform duration-300">
            <div className="h-2 bg-amber-500 w-full" />
            <CardHeader className="p-6 sm:p-8 space-y-4">
              <div className="h-12 w-12 sm:h-14 sm:w-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                <AlertCircle size={28} />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-xl sm:text-2xl font-black">Pendências: Banco</CardTitle>
                <CardDescription className="text-sm sm:text-base leading-relaxed">
                  Lista focada exclusivamente nos lançamentos do extrato que não possuem correspondência no sistema.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 pt-0 mt-auto">
              <Button 
                onClick={generateUnmatchedBankReport}
                variant="outline"
                className="w-full py-6 sm:py-7 text-base sm:text-lg font-black rounded-2xl shadow-md border-amber-200 text-amber-700 hover:bg-amber-50 active:scale-95 transition-all"
              >
                <FileDown className="mr-2 h-5 w-5 sm:h-6 sm:w-6" /> Exportar Extrato
              </Button>
            </CardContent>
          </Card>

          {/* Pendências do Sistema */}
          <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden flex flex-col hover:scale-[1.02] transition-transform duration-300 md:col-span-2 lg:col-span-1">
            <div className="h-2 bg-emerald-600 w-full" />
            <CardHeader className="p-6 sm:p-8 space-y-4">
              <div className="h-12 w-12 sm:h-14 sm:w-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                <CheckCircle2 size={28} />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-xl sm:text-2xl font-black">Pendências: Sistema</CardTitle>
                <CardDescription className="text-sm sm:text-base leading-relaxed">
                  Lista de todos os lançamentos internos do seu relatório que ainda não apareceram no banco.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 pt-0 mt-auto">
              <Button 
                onClick={generateUnmatchedFinReport}
                variant="outline"
                className="w-full py-6 sm:py-7 text-base sm:text-lg font-black rounded-2xl shadow-md border-emerald-200 text-emerald-700 hover:bg-emerald-50 active:scale-95 transition-all"
              >
                <FileDown className="mr-2 h-5 w-5 sm:h-6 sm:w-6" /> Exportar Sistema
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-6 sm:p-8 flex flex-col sm:flex-row items-start gap-4">
          <div className="h-10 w-10 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0 text-primary">
            <Info size={24} />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-lg text-primary">Sobre a exportação</h4>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              Os relatórios são gerados em tempo real com base na sua última conciliação. 
              As datas são exportadas no formato <strong>DD/MM/AAAA</strong> e os valores numéricos permitem cálculos diretos no Excel.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Reports;