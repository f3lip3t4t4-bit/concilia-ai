"use client";

import React, { useState } from "react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud, FileText, Loader2, Trash2, Info, Building2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/auth/SessionContextProvider";
import * as XLSX from "xlsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ImportData = () => {
  const { user } = useSession();
  const [bankType, setBankType] = useState("padrao");
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
          
          // Se for Sicredi, vamos ler de uma forma que capture as colunas mesmo que o cabeçalho não esteja na linha 1
          // Usamos header: 1 para ler como array de arrays e depois procuramos o cabeçalho
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          resolve(rows);
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

  const processRowsAsArrays = (rows: any[][], userId: string, type: string) => {
    let headerIndex = -1;
    let colMap: Record<string, number> = {};

    // 1. Encontrar a linha do cabeçalho
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].map(c => String(c || "").toLowerCase());
      
      if (type === "sicredi") {
        if (row.includes("data") && row.includes("descrição") && row.includes("valor (r$)")) {
          headerIndex = i;
          colMap = {
            date: row.indexOf("data"),
            desc: row.indexOf("descrição"),
            amount: row.indexOf("valor (r$)")
          };
          break;
        }
      } else {
        // Lógica padrão: busca por colunas que pareçam data e valor
        const hasDate = row.some(c => c.includes("data") || c.includes("date") || c.includes("dia"));
        const hasAmount = row.some(c => c.includes("valor") || c.includes("amount") || c.includes("quantia"));
        if (hasDate && hasAmount) {
          headerIndex = i;
          colMap = {
            date: row.findIndex(c => c.includes("data") || c.includes("date") || c.includes("dia")),
            desc: row.findIndex(c => c.includes("descri") || c.includes("hist") || c.includes("lança") || c.includes("detalhe")),
            amount: row.findIndex(c => c.includes("valor") || c.includes("amount") || c.includes("quantia") || c.includes("saldo"))
          };
          break;
        }
      }
    }

    if (headerIndex === -1) return [];

    // 2. Processar dados a partir da linha após o cabeçalho
    return rows.slice(headerIndex + 1)
      .map(row => {
        const dateRaw = row[colMap.date];
        const descRaw = row[colMap.desc];
        const amountRaw = row[colMap.amount];

        const date = formatDate(dateRaw);
        const description = String(descRaw || "").trim();
        const amount = parseFloat(String(amountRaw || "0").replace(".", "").replace(",", "."));

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
      const rawBankRows = await parseExcel(bankStatementFile);
      const formattedBankData = processRowsAsArrays(rawBankRows, user.id, bankType);

      const rawFinRows = await parseExcel(financialEntriesFile);
      const formattedFinancialData = processRowsAsArrays(rawFinRows, user.id, "padrao");

      if (formattedBankData.length === 0 && formattedFinancialData.length === 0) {
        throw new Error("Não conseguimos identificar os dados. Verifique se o modelo do banco está correto.");
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
          <p className="text-muted-foreground text-lg">Suba seus arquivos para realizar o batimento inteligente.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="md:col-span-2 rounded-[2.5rem] shadow-2xl border-none p-8 sm:p-10 bg-white">
            <CardHeader className="p-0 mb-8">
              <CardTitle className="text-2xl font-black flex items-center gap-3 text-primary">
                <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                  <Building2 size={24} />
                </div>
                Configuração e Upload
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-8">
              <div className="space-y-6">
                <div className="grid w-full items-center gap-3">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Modelo do Extrato Bancário</Label>
                  <Select value={bankType} onValueChange={setBankType}>
                    <SelectTrigger className="rounded-2xl h-14 bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Selecione o banco" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="padrao">Modelo Inteligente (Padrão)</SelectItem>
                      <SelectItem value="sicredi">Sicredi (.xlsx)</SelectItem>
                      <SelectItem value="itau" disabled>Itaú (Em breve)</SelectItem>
                      <SelectItem value="bradesco" disabled>Bradesco (Em breve)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid w-full items-center gap-3">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Arquivo do Extrato (.xlsx)</Label>
                  <Input 
                    type="file" 
                    accept=".xlsx, .xls" 
                    onChange={handleBankStatementChange} 
                    className="rounded-2xl h-16 bg-slate-50 border-slate-200 pt-4" 
                  />
                </div>

                <div className="grid w-full items-center gap-3">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Arquivo Interno/ERP (.xlsx)</Label>
                  <Input 
                    type="file" 
                    accept=".xlsx, .xls" 
                    onChange={handleFinancialEntriesChange} 
                    className="rounded-2xl h-16 bg-slate-50 border-slate-200 pt-4" 
                  />
                </div>
              </div>

              <Button
                onClick={handleUpload}
                disabled={isUploading || !bankStatementFile || !financialEntriesFile}
                className="w-full py-8 text-xl font-black rounded-3xl shadow-xl transition-all active:scale-95 bg-primary"
              >
                {isUploading ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Processando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <UploadCloud /> Sincronizar Agora
                  </div>
                )}
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
                Recomendado limpar antes de cada nova importação completa.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Button
                variant="outline"
                onClick={handleClearData}
                disabled={isClearing}
                className="w-full border-destructive/20 text-destructive hover:bg-destructive hover:text-white rounded-2xl py-7 font-bold transition-all"
              >
                {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Zerar registros atuais"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Alert className="rounded-2xl border-blue-200 bg-blue-50/50 text-blue-900 shadow-sm">
          <Info className="h-5 w-5 text-blue-600" />
          <AlertTitle className="font-bold mb-2">Dica para Sicredi:</AlertTitle>
          <AlertDescription>
            O sistema irá escanear o arquivo até encontrar a linha contendo <strong>Data</strong>, <strong>Descrição</strong> e <strong>Valor (R$)</strong>. Não é necessário remover as linhas iniciais de saldo do banco manualmente.
          </AlertDescription>
        </Alert>
      </div>
    </Layout>
  );
};

export default ImportData;