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
import { useNavigate } from "react-router-dom";

const ImportData = () => {
  const { user } = useSession();
  const navigate = useNavigate();
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

  const parseExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          // cellDates: true converte para Date, mas o fuso horário pode atrapalhar
          const workbook = XLSX.read(data, { type: "array", cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true }) as any[][];
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
    
    let d: Date;
    
    if (val instanceof Date) {
      // Se for Date, adicionamos algumas horas para garantir que a extração UTC não caia no dia anterior
      // Isso resolve o problema de datas como 01/10/2025 aparecendo como 30/09/2025
      d = new Date(val.getTime() + (val.getTimezoneOffset() * 60000));
      // Adicionalmente, forçamos o meio do dia para evitar bordas de meia-noite
      d.setHours(12, 0, 0, 0);
    } else if (typeof val === 'string' && val.includes('/')) {
      const parts = val.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        return `${year}-${month}-${day}`;
      }
      return null;
    } else {
      d = new Date(val);
    }

    if (isNaN(d.getTime())) return null;

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  const parseAmount = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let str = String(val).trim();
    str = str.replace(/R\$/g, '').replace(/\$/g, '').replace(/\s/g, '');
    if (str.includes(',') && str.includes('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
      str = str.replace(',', '.');
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const processRowsAsArrays = (rows: any[][], userId: string, type: string) => {
    let headerIndex = -1;
    let colMap: Record<string, number> = {};

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].map(c => String(c || "").toLowerCase().trim());
      if (type === "sicredi") {
        if (row.some(c => c === "data") && row.some(c => c.includes("descrição")) && row.some(c => c.includes("valor (r$)"))) {
          headerIndex = i;
          colMap = {
            date: row.indexOf("data"),
            desc: row.findIndex(c => c.includes("descrição")),
            amount: row.findIndex(c => c.includes("valor (r$)"))
          };
          break;
        }
      } else {
        const hasDate = row.some(c => c.includes("data") || c.includes("date") || c.includes("dia"));
        const hasAmount = row.some(c => c.includes("valor") || c.includes("amount") || c.includes("quantia"));
        if (hasDate && hasAmount) {
          headerIndex = i;
          colMap = {
            date: row.findIndex(c => c.includes("data") || c.includes("date") || c.includes("dia")),
            desc: row.findIndex(c => c.includes("descri") || c.includes("hist") || c.includes("lança") || c.includes("detalhe")),
            amount: row.findIndex(c => c.includes("valor") || c.includes("amount") || c.includes("quantia"))
          };
          break;
        }
      }
    }

    if (headerIndex === -1) return [];

    return rows.slice(headerIndex + 1)
      .map(row => {
        const date = formatDate(row[colMap.date]);
        const description = String(row[colMap.desc] || "").trim();
        const amount = parseAmount(row[colMap.amount]);
        if (!date || !description || amount === 0) return null;
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
      showError("Selecione os arquivos de extrato e lançamentos.");
      return;
    }

    setIsUploading(true);
    try {
      const rawBankRows = await parseExcel(bankStatementFile);
      const formattedBankData = processRowsAsArrays(rawBankRows, user.id, bankType);

      const rawFinRows = await parseExcel(financialEntriesFile);
      const formattedFinancialData = processRowsAsArrays(rawFinRows, user.id, "padrao");

      if (formattedBankData.length === 0 && formattedFinancialData.length === 0) {
        throw new Error("Dados não identificados. Verifique se o modelo do banco selecionado está correto.");
      }

      if (formattedBankData.length > 0) {
        const { error } = await supabase.from("bank_statements").insert(formattedBankData);
        if (error) throw error;
      }

      if (formattedFinancialData.length > 0) {
        const { error } = await supabase.from("financial_entries").insert(formattedFinancialData);
        if (error) throw error;
      }

      showSuccess(`Importados ${formattedBankData.length} itens bancários e ${formattedFinancialData.length} internos.`);
      setBankStatementFile(null);
      setFinancialEntriesFile(null);
      
      navigate("/reconciliation");
    } catch (error: any) {
      showError(`Erro: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearData = async () => {
    if (!user || !window.confirm("Deseja apagar todos os dados importados?")) return;
    setIsClearing(true);
    try {
      await Promise.all([
        supabase.from("reconciliation_matches").delete().eq("user_id", user.id),
        supabase.from("bank_statements").delete().eq("user_id", user.id),
        supabase.from("financial_entries").delete().eq("user_id", user.id)
      ]);
      showSuccess("Base de dados zerada.");
    } catch (error: any) {
      showError("Erro: " + error.message);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-4xl font-black text-primary mb-2 tracking-tight">Gestão de Dados</h1>
          <p className="text-muted-foreground text-lg">Sincronização precisa de extratos e ERP.</p>
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
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Modelo do Banco</Label>
                  <Select value={bankType} onValueChange={setBankType}>
                    <SelectTrigger className="rounded-2xl h-14 bg-slate-50 border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="padrao">Inteligente (Tenta adivinhar)</SelectItem>
                      <SelectItem value="sicredi">Sicredi Oficial (.xlsx)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid w-full items-center gap-3">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Extrato Bancário (.xlsx)</Label>
                  <Input 
                    type="file" 
                    accept=".xlsx, .xls" 
                    onChange={handleBankStatementChange} 
                    className="rounded-2xl h-16 bg-slate-50 border-slate-200 pt-4" 
                  />
                </div>

                <div className="grid w-full items-center gap-3">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Arquivo Interno (.xlsx)</Label>
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
                {isUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Sincronizar Dados"}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] shadow-xl border-none p-8 bg-slate-50 border border-slate-100 flex flex-col justify-between">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-xl font-black text-destructive flex items-center gap-2">
                <Trash2 size={22} />
                Limpar Base
              </CardTitle>
              <CardDescription className="text-slate-600 mt-2">
                Limpe os dados antes de uma nova importação.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Button
                variant="outline"
                onClick={handleClearData}
                disabled={isClearing}
                className="w-full border-destructive/20 text-destructive hover:bg-destructive hover:text-white rounded-2xl py-7 font-bold transition-all"
              >
                {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Zerar registros"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Alert className="rounded-2xl border-blue-200 bg-blue-50/50 text-blue-900">
          <Info className="h-5 w-5 text-blue-600" />
          <AlertTitle className="font-bold mb-2">Dica de Precisão:</AlertTitle>
          <AlertDescription>
            Ajustamos o motor de importação para ler valores no formato brasileiro (ex: 1.234,56) e datas exatas do Excel. Se o erro persistir, certifique-se de que o arquivo não possui células mescladas no cabeçalho.
          </AlertDescription>
        </Alert>
      </div>
    </Layout>
  );
};

export default ImportData;