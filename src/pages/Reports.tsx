"use client";

import React, { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, FileText, AlertCircle, CheckCircle2, Loader2, Info, ArrowDownToLine } from "lucide-react";
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

    // 1. Adiciona todos os itens do banco (Conciliados ou Não)
    data.bank.forEach(b => {
      report.push({
        "Data": formatDateBR(b.date),
        "Descrição": b.description,
        "Valor": b.amount,
        "Origem": "Extrato Bancário",
        "Status": matchedBankIds.has(b.id) ? "Conciliado" : "Não Conciliado"
      });
    });

    // 2. Adiciona apenas os itens não conciliados do financeiro
    data.fin.filter(f => !matchedFinIds.has(f.id)).forEach(f => {
      report.push({
        "Data": formatDateBR(f.date),
        "Descrição": f.description,
        "Valor": f.amount,
        "Origem": "Sistema Financeiro",
        "Status": "Não Conciliado"
      });
    });

    // Ordena por data para facilitar a conferência
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
      <div className="max-w-6xl mx-auto space-y-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-black text-primary tracking-tight">Exportação de Relatórios</h1>
            <p className="text-muted-foreground text-lg">Gere planilhas Excel para conferência contábil e auditoria.</p>
          </div>
          <Button onClick={fetchData} variant="outline" className="rounded-xl">
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar Dados
          </Button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Relatório Geral */}
          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden group hover:scale-[1.02] transition-all">
            <div className="h-3 bg-blue-600 w-full" />
            <CardHeader className="p-8">
              <div className="h-14 w-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                <FileText size={32} />
              </div>
              <CardTitle className="text-2xl font-black">Relatório Geral</CardTitle>
              <CardDescription className="text-md">
                Visão completa 360°. Inclui todos os itens do extrato e as pendências do sistema organizadas por data.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              <Button 
                onClick={generateGeneralReport}
                className="w-full py-7 text-lg font-black rounded-2xl shadow-lg bg-blue-600 hover:bg-blue-700"
              >
                <ArrowDownToLine className="mr-2 h-6 w-6" /> Exportar Geral
              </Button>
            </CardContent>
          </Card>

          {/* Pendências do Extrato */}
          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden group hover:scale-[1.02] transition-all">
            <div className="h-3 bg-amber-500 w-full" />
            <CardHeader className="p-8">
              <div className="h-14 w-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
                <AlertCircle size={32} />
              </div>
              <CardTitle className="text-2xl font-black">Pendências: Banco</CardTitle>
              <CardDescription className="text-md">
                Lista focada exclusivamente nos lançamentos do extrato que não possuem correspondência no sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              <Button 
                onClick={generateUnmatchedBankReport}
                variant="outline"
                className="w-full py-7 text-lg font-black rounded-2xl shadow-md border-amber-200 text-amber-700 hover:bg-amber-50"
              >
                <FileDown className="mr-2 h-6 w-6" /> Exportar Extrato
              </Button>
            </CardContent>
          </Card>

          {/* Pendências do Sistema */}
          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden group hover:scale-[1.02] transition-all">
            <div className="h-3 bg-emerald-600 w-full" />
            <CardHeader className="p-8">
              <div className="h-14 w-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                <CheckCircle2 size={32} />
              </div>
              <CardTitle className="text-2xl font-black">Pendências: Sistema</CardTitle>
              <CardDescription className="text-md">
                Lista de todos os lançamentos internos do seu relatório que ainda não apareceram no banco.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              <Button 
                onClick={generateUnmatchedFinReport}
                variant="outline"
                className="w-full py-7 text-lg font-black rounded-2xl shadow-md border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                <FileDown className="mr-2 h-6 w-6" /> Exportar Sistema
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 flex items-start gap-4">
          <div className="h-10 w-10 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0 text-primary">
            <Info size={24} />
          </div>
          <div>
            <h4 className="font-bold text-lg text-primary">Sobre a exportação</h4>
            <p className="text-muted-foreground">
              Os relatórios são gerados em tempo real com base na sua última conciliação. 
              As datas são exportadas no formato <strong>DD/MM/AAAA</strong> e os valores numéricos permitem cálculos diretos no Excel.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

import { RefreshCw } from "lucide-react";

export default Reports;