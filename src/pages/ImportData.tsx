"use client";

import React, { useState } from "react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, FileText, Loader2, Trash2, AlertCircle, Info } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/auth/SessionContextProvider";
import * as XLSX from "xlsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ImportData = () => {
  const { user } = useSession();
  const [bankStatementFile, setBankStatementFile] = useState<File | null>(null);
  const [financialEntriesFile, setFinancialEntriesFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleBankStatementChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setBankStatementFile(event.target.files[0]);
    }
  };

  const handleFinancialEntriesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFinancialEntriesFile(event.target.files[0]);
    }
  };

  // Função inteligente para encontrar valores baseada em palavras-chave comuns
  const findValue = (row: any, keywords: string[]) => {
    const keys = Object.keys(row);
    const foundKey = keys.find(key => 
      keywords.some(kw => key.toLowerCase().includes(kw.toLowerCase()))
    );
    return foundKey ? row[foundKey] : null;
  };

  const parseExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array", cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  };

  const formatDate = (val: any) => {
    if (!val) return null;
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  };

  const processRows = (rows: any[], userId: string) => {
    return rows
      .map(row => {
        const dateRaw = findValue(row, ["data", "date", "movimento", "dia"]);
        const descRaw = findValue(row, ["descri", "hist", "lança", "detalhe"]);
        const amountRaw = findValue(row, ["valor", "amount", "quantia", "saldo"]);

        const date = formatDate(dateRaw);
        const description = String(descRaw || "").trim();
        const amount = parseFloat(String(amountRaw || "0").replace(",", "."));

        // Só retorna se tiver os dados básicos válidos para evitar linhas vazias
        if (!date || !description || isNaN(amount) || amount === 0) return null;

        return {
          user_id: userId,
          date,
          description,
          amount,
        };
      })
      .filter(item => item !== null);
  };

  const handleUpload = async () => {
    if (!bankStatementFile || !financialEntriesFile || !user) {
      showError("Por favor, selecione ambos os arquivos.");
      return;
    }

    setIsUploading(true);

    try {
      const rawBankData = await parseExcel(bankStatementFile);
      const formattedBankData = processRows(rawBankData, user.id);

      const rawFinData = await parseExcel(financialEntriesFile);
      const formattedFinancialData = processRows(rawFinData, user.id);

      if (formattedBankData.length === 0 && formattedFinancialData.length === 0) {
        throw new Error("Não encontramos dados válidos nos arquivos. Verifique os nomes das colunas.");
      }

      if (formattedBankData.length > 0) {
        const { error: bankError } = await supabase.from("bank_statements").insert(formattedBankData);
        if (bankError) throw bankError;
      }

      if (formattedFinancialData.length > 0) {
        const { error: finError } = await supabase.from("financial_entries").insert(formattedFinancialData);
        if (finError) throw finError;
      }

      showSuccess(`Sucesso! Importamos ${formattedBankData.length} itens do banco e ${formattedFinancialData.length} internos.`);
      setBankStatementFile(null);
      setFinancialEntriesFile(null);
    } catch (error: any) {
      showError(`Erro ao importar: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearData = async () => {
    if (!user || !window.confirm("Isso apagará TODOS os seus dados importados e conciliações. Tem certeza?")) return;
    
    setIsClearing(true);
    try {
      await Promise.all([
        supabase.from("reconciliation_matches").delete().eq("user_id", user.id),
        supabase.from("bank_statements").delete().eq("user_id", user.id),
        supabase.from("financial_entries").delete().eq("user_id", user.id)
      ]);
      showSuccess("Todos os dados foram removidos.");
    } catch (error: any) {
      showError("Erro ao limpar dados: " + error.message);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-4xl font-black text-primary mb-2 tracking-tight">Gestão de Dados</h1>
          <p className="text-muted-foreground text-lg">Suba seus arquivos .xlsx para realizar o batimento.</p>
        </header>

        <Alert className="rounded-2xl border-blue-200 bg-blue-50/50 text-blue-900 shadow-sm">
          <Info className="h-5 w-5 text-blue-600" />
          <AlertTitle className="font-bold mb-2">Como formatar seu arquivo:</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>O sistema agora é capaz de identificar automaticamente colunas com nomes parecidos, mas para garantir 100% de sucesso, certifique-se de que suas planilhas tenham estas colunas:</p>
            <ul className="list-disc pl-5 space-y-1 font-medium">
              <li><strong>Data</strong> (ou "Data Mov.", "Date")</li>
              <li><strong>Descrição</strong> (ou "Histórico", "Lançamento")</li>
              <li><strong>Valor</strong> (ou "Quantia", "Saldo")</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="md:col-span-2 rounded-[2.5rem] shadow-2xl border-none p-8 sm:p-10 bg-white">
            <CardHeader className="p-0 mb-8">
              <CardTitle className="text-2xl font-black flex items-center gap-3 text-primary">
                <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                  <UploadCloud size={24} />
                </div>
                Nova Importação
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-8">
              <div className="space-y-6">
                <div className="grid w-full items-center gap-3">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Extrato Bancário (.xlsx)</Label>
                  <div className="relative group">
                    <Input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      onChange={handleBankStatementChange} 
                      className="rounded-2xl h-16 bg-slate-50 border-slate-200 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-blue-600 file:text-white hover:bg-slate-100 transition-all pt-4" 
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-600 transition-colors">
                      <FileText size={20} />
                    </div>
                  </div>
                </div>

                <div className="grid w-full items-center gap-3">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Lançamentos Financeiros (.xlsx)</Label>
                  <div className="relative group">
                    <Input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      onChange={handleFinancialEntriesChange} 
                      className="rounded-2xl h-16 bg-slate-50 border-slate-200 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-emerald-600 file:text-white hover:bg-slate-100 transition-all pt-4" 
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-emerald-600 transition-colors">
                      <FileText size={20} />
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleUpload}
                disabled={isUploading || !bankStatementFile || !financialEntriesFile}
                className="w-full py-8 text-xl font-black rounded-3xl shadow-xl transition-all active:scale-95 hover:scale-[1.02] bg-primary"
              >
                {isUploading ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Processando Planilhas...
                  </div>
                ) : "Sincronizar Dados Reais"}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] shadow-xl border-none p-8 bg-slate-50 border border-slate-100 flex flex-col justify-between">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-xl font-black text-destructive flex items-center gap-2">
                <Trash2 size={22} />
                Limpar Base
              </CardTitle>
              <CardDescription className="text-slate-600 font-medium mt-2">
                Use esta opção se os dados aparecerem errados ou zerados para recomeçar.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Button
                variant="outline"
                onClick={handleClearData}
                disabled={isClearing}
                className="w-full border-destructive/20 text-destructive hover:bg-destructive hover:text-white rounded-2xl py-7 font-bold transition-all"
              >
                {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Zerar todos os registros"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ImportData;