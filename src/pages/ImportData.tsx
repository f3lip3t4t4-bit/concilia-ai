"use client";

import React, { useState } from "react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, FileText, Loader2, Trash2, AlertCircle } from "lucide-react";
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

  const parseExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
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

  const handleUpload = async () => {
    if (!bankStatementFile || !financialEntriesFile || !user) {
      showError("Por favor, selecione ambos os arquivos.");
      return;
    }

    setIsUploading(true);

    try {
      const bankData = await parseExcel(bankStatementFile);
      const formattedBankData = bankData.map((row: any) => ({
        user_id: user.id,
        date: new Date(row.Data || row.date || new Date()).toISOString().split('T')[0],
        description: row.Descrição || row.description || "Sem descrição",
        amount: parseFloat(row.Valor || row.amount || 0),
      }));

      const financialData = await parseExcel(financialEntriesFile);
      const formattedFinancialData = financialData.map((row: any) => ({
        user_id: user.id,
        date: new Date(row.Data || row.date || new Date()).toISOString().split('T')[0],
        description: row.Descrição || row.description || "Sem descrição",
        amount: parseFloat(row.Valor || row.amount || 0),
      }));

      const { error: bankError } = await supabase.from("bank_statements").insert(formattedBankData);
      if (bankError) throw bankError;

      const { error: finError } = await supabase.from("financial_entries").insert(formattedFinancialData);
      if (finError) throw finError;

      showSuccess("Dados importados com sucesso!");
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
      // Devido ao CASCADE, apagar bank_statements e financial_entries deve apagar matches
      await Promise.all([
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
          <h1 className="text-4xl font-black text-primary mb-2">Gestão de Dados</h1>
          <p className="text-muted-foreground">Alimente o sistema com seus arquivos de extrato e lançamentos.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="md:col-span-2 rounded-3xl shadow-xl border-none p-8 bg-white">
            <CardHeader className="p-0 mb-8">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <UploadCloud className="text-blue-600" />
                Nova Importação
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-6">
              <div className="space-y-4">
                <div className="grid w-full items-center gap-3">
                  <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Extrato Bancário (.xlsx)</Label>
                  <Input type="file" accept=".xlsx, .xls" onChange={handleBankStatementChange} className="rounded-xl h-12 bg-muted/30" />
                </div>
                <div className="grid w-full items-center gap-3">
                  <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Lançamentos Financeiros (.xlsx)</Label>
                  <Input type="file" accept=".xlsx, .xls" onChange={handleFinancialEntriesChange} className="rounded-xl h-12 bg-muted/30" />
                </div>
              </div>

              <Button
                onClick={handleUpload}
                disabled={isUploading || !bankStatementFile || !financialEntriesFile}
                className="w-full py-7 text-lg font-bold rounded-2xl shadow-lg transition-all active:scale-95"
              >
                {isUploading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Iniciar Sincronização"}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-xl border-none p-8 bg-slate-50 border border-slate-100">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-xl font-bold text-destructive flex items-center gap-2">
                <Trash2 size={20} />
                Zona de Perigo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Precisa recomeçar do zero? Você pode remover todos os registros associados à sua conta.
              </p>
              <Button
                variant="outline"
                onClick={handleClearData}
                disabled={isClearing}
                className="w-full border-destructive/20 text-destructive hover:bg-destructive hover:text-white rounded-xl py-6 transition-all"
              >
                {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apagar tudo"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Alert className="rounded-2xl border-blue-100 bg-blue-50 text-blue-800">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          <AlertTitle className="font-bold">Dica de Formatação</AlertTitle>
          <AlertDescription>
            Certifique-se de que seus arquivos tenham colunas com nomes como <strong>Data</strong>, <strong>Descrição</strong> e <strong>Valor</strong>.
          </AlertDescription>
        </Alert>
      </div>
    </Layout>
  );
};

export default ImportData;