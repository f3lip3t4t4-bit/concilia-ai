"use client";

import React, { useState } from "react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge"; 
import { Building2, Loader2, Trash2, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/auth/SessionContextProvider";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ImportData = () => {
  const { user, isLoading } = useSession();
  const navigate = useNavigate();
  const [bankType, setBankType] = useState("padrao");
  const [bankStatementFile, setBankStatementFile] = useState<File | null>(null);
  const [financialEntriesFile, setFinancialEntriesFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user) return null;

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
      const userOffset = val.getTimezoneOffset() * 60000;
      d = new Date(val.getTime() + userOffset);
      d.setHours(12, 0, 0, 0);
    } else if (typeof val === 'number') {
      d = new Date((val - 25569) * 86400 * 1000);
      const userOffset = d.getTimezoneOffset() * 60000;
      d = new Date(d.getTime() + userOffset);
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
      // Correção: removendo a barra invertida antes do 'g'
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
      str = str.replace(',', '.');
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const parseSicoobAmount = (val: any) => {
    if (!val) return 0;
    let str = String(val).trim().toUpperCase();
    const isDebit = str.endsWith('D') || str.startsWith('-');
    const isCredit = str.endsWith('C');
    let cleanStr = str.replace(/[CD]/g, '').replace(/[^0-9,-]/g, '');
    if (cleanStr.includes(',') && cleanStr.includes('.')) {
      // Correção: removendo a barra invertida antes do 'g'
      cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
    } else if (cleanStr.includes(',')) {
      cleanStr = cleanStr.replace(',', '.');
    }
    let num = parseFloat(cleanStr);
    if (isNaN(num)) return 0;
    if (isDebit && num > 0) num = num * -1;
    if (isCredit && num < 0) num = Math.abs(num);
    return num;
  };

  const processInternalSystemRows = (rows: any[][], userId: string) => {
    if (rows.length < 2) return [];
    return rows.slice(2)
      .map(row => {
        const date = formatDate(row[0]);
        const history = String(row[7] || "").trim();
        const entrada = parseAmount(row[9]);
        const saida = parseAmount(row[10]);
        const amount = entrada !== 0 ? Math.abs(entrada) : (saida !== 0 ? -Math.abs(saida) : 0);
        if (!date || !history || amount === 0) return null;
        return { user_id: userId, date, description: history, amount };
      })
      .filter(item => item !== null);
  };

  const processBankRows = (rows: any[][], userId: string, type: string) => {
    if (type === "sicoob") {
      return rows.slice(2)
        .map(row => {
          const date = formatDate(row[0]);
          const description = String(row[2] || "").trim();
          const amount = parseSicoobAmount(row[3]);
          if (!date || description.toUpperCase().includes("SALDO") || amount === 0) return null;
          return { user_id: userId, date, description, amount };
        })
        .filter(item => item !== null);
    }

    let headerIndex = -1;
    let colMap: Record<string, number> = {};
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = (rows[i] || []).map(c => String(c || "").toLowerCase().trim());
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
        return { user_id: userId, date, description, amount };
      })
      .filter(item => item !== null);
  };

  const handleUpload = async () => {
    if (!bankStatementFile || !financialEntriesFile || !user) {
      showError("Selecione os arquivos.");
      return;
    }
    setIsUploading(true);
    try {
      const rawBankRows = await parseExcel(bankStatementFile);
      const formattedBankData = processBankRows(rawBankRows, user.id, bankType);
      const rawFinRows = await parseExcel(financialEntriesFile);
      const formattedFinancialData = processInternalSystemRows(rawFinRows, user.id);

      if (formattedBankData.length > 0) {
        const { error } = await supabase.from("bank_statements").insert(formattedBankData);
        if (error) throw error;
      }
      if (formattedFinancialData.length > 0) {
        const { error } = await supabase.from("financial_entries").insert(formattedFinancialData);
        if (error) throw error;
      }
      showSuccess(`Sincronização concluída! (${formattedBankData.length} itens bancários)`);
      navigate("/reconciliation");
    } catch (error: any) {
      showError(`Erro: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearData = async () => {
    if (!user) return;
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
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="text-center space-y-2">
          <Badge className="bg-primary/10 text-primary border-none rounded-full px-4 py-1 mb-2 font-bold uppercase tracking-wider text-[10px]">Importação Inteligente</Badge>
          <h1 className="text-3xl sm:text-5xl font-black text-primary tracking-tight">Gestão de Dados</h1>
          <p className="text-muted-foreground text-base sm:text-xl font-medium max-w-2xl mx-auto">
            Consolide suas informações bancárias e internas em um só lugar com processamento automático.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          <Card className="lg:col-span-2 rounded-[2rem] sm:rounded-[3rem] shadow-2xl border-none overflow-hidden bg-white">
            <CardHeader className="p-8 sm:p-10 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 bg-white text-blue-600 rounded-2xl flex items-center justify-center shadow-md ring-1 ring-slate-200">
                  <FileSpreadsheet size={30} />
                </div>
                <div>
                  <CardTitle className="text-2xl font-black text-primary">Upload de Planilhas</CardTitle>
                  <CardDescription className="font-medium">Formatos suportados: .xlsx, .xls</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 sm:p-10 space-y-8">
              <div className="space-y-6">
                <div className="grid w-full items-center gap-3">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Modelo do Banco</Label>
                  <Select value={bankType} onValueChange={setBankType}>
                    <SelectTrigger className="rounded-2xl h-14 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-primary/20 transition-all font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200">
                      <SelectItem value="padrao">Auto-detecção (Genérico)</SelectItem>
                      <SelectItem value="sicoob">Sicoob Oficial (.xlsx)</SelectItem>
                      <SelectItem value="sicredi">Sicredi Oficial (.xlsx)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Extrato Bancário</Label>
                    <div className={cn(
                      "relative group rounded-2xl border-2 border-dashed transition-all p-4 text-center cursor-pointer",
                      bankStatementFile ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 hover:border-primary/50 hover:bg-slate-50"
                    )}>
                      <Input 
                        type="file" 
                        accept=".xlsx, .xls" 
                        onChange={handleBankStatementChange} 
                        className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                      />
                      {bankStatementFile ? (
                        <div className="flex flex-col items-center gap-1">
                          <CheckCircle2 className="text-emerald-500 h-8 w-8" />
                          <span className="text-xs font-bold text-emerald-700 truncate max-w-full px-2">{bankStatementFile.name}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 py-2">
                          <Building2 className="text-slate-400 group-hover:text-primary transition-colors h-8 w-8" />
                          <span className="text-xs font-bold text-slate-500">Selecionar Extrato</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Sistema Financeiro</Label>
                    <div className={cn(
                      "relative group rounded-2xl border-2 border-dashed transition-all p-4 text-center cursor-pointer",
                      financialEntriesFile ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 hover:border-primary/50 hover:bg-slate-50"
                    )}>
                      <Input 
                        type="file" 
                        accept=".xlsx, .xls" 
                        onChange={handleFinancialEntriesChange} 
                        className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                      />
                      {financialEntriesFile ? (
                        <div className="flex flex-col items-center gap-1">
                          <CheckCircle2 className="text-emerald-500 h-8 w-8" />
                          <span className="text-xs font-bold text-emerald-700 truncate max-w-full px-2">{financialEntriesFile.name}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 py-2">
                          <FileSpreadsheet className="text-slate-400 group-hover:text-primary transition-colors h-8 w-8" />
                          <span className="text-xs font-bold text-slate-500">Selecionar Relatório</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleUpload}
                disabled={isUploading || !bankStatementFile || !financialEntriesFile}
                className="w-full py-8 text-xl font-black rounded-3xl shadow-xl transition-all active:scale-95 bg-primary hover:bg-primary/90"
              >
                {isUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Sincronizar Dados"}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] sm:rounded-[3rem] shadow-xl border-none p-8 bg-slate-50 border border-slate-100 flex flex-col justify-between overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Trash2 size={120} />
            </div>
            <CardHeader className="p-0 mb-6 relative z-10">
              <CardTitle className="text-xl font-black text-destructive flex items-center gap-2">
                <AlertTriangle size={24} className="animate-pulse" />
                Zona de Risco
              </CardTitle>
              <CardDescription className="font-medium mt-1">Apague todos os registros atuais para uma nova importação limpa.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 relative z-10">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={isClearing}
                    className="w-full border-destructive/20 text-destructive hover:bg-destructive hover:text-white rounded-2xl py-7 font-bold transition-all shadow-sm"
                  >
                    {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Zerar Registros"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl p-8 border-none shadow-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-2xl font-black text-primary">Tem certeza absoluta?</AlertDialogTitle>
                    <AlertDialogDescription className="text-lg font-medium text-muted-foreground mt-2">
                      Essa ação irá apagar permanentemente todos os seus extratos, lançamentos e conciliações já realizadas. Não há como desfazer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="mt-6 gap-3">
                    <AlertDialogCancel className="rounded-2xl py-6 font-bold border-slate-200">Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleClearData}
                      className="rounded-2xl py-6 font-black bg-destructive text-white hover:bg-destructive/90"
                    >
                      Sim, apagar tudo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ImportData;