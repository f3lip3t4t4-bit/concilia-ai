"use client";

import React, { useState } from "react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, FileText, Loader2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/auth/SessionContextProvider";
import * as XLSX from "xlsx";

const ImportData = () => {
  const { user } = useSession();
  const [bankStatementFile, setBankStatementFile] = useState<File | null>(null);
  const [financialEntriesFile, setFinancialEntriesFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

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
      // Processar Extrato
      const bankData = await parseExcel(bankStatementFile);
      const formattedBankData = bankData.map((row: any) => ({
        user_id: user.id,
        date: new Date(row.Data || row.date || new Date()).toISOString().split('T')[0],
        description: row.Descrição || row.description || "Sem descrição",
        amount: parseFloat(row.Valor || row.amount || 0),
      }));

      // Processar Lançamentos
      const financialData = await parseExcel(financialEntriesFile);
      const formattedFinancialData = financialData.map((row: any) => ({
        user_id: user.id,
        date: new Date(row.Data || row.date || new Date()).toISOString().split('T')[0],
        description: row.Descrição || row.description || "Sem descrição",
        amount: parseFloat(row.Valor || row.amount || 0),
      }));

      // Limpar dados antigos (opcional, dependendo do fluxo desejado)
      // await supabase.from("bank_statements").delete().eq("user_id", user.id);
      // await supabase.from("financial_entries").delete().eq("user_id", user.id);

      // Inserir novos dados
      const { error: bankError } = await supabase.from("bank_statements").insert(formattedBankData);
      if (bankError) throw bankError;

      const { error: finError } = await supabase.from("financial_entries").insert(formattedFinancialData);
      if (finError) throw finError;

      showSuccess("Dados importados com sucesso!");
      setBankStatementFile(null);
      setFinancialEntriesFile(null);
    } catch (error: any) {
      console.error("Erro na importação:", error);
      showError(`Erro ao importar dados: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center h-full p-4">
        <Card className="w-full max-w-2xl rounded-xl shadow-lg border-none p-6 bg-card">
          <CardHeader className="text-center">
            <UploadCloud className="h-16 w-16 mx-auto text-primary mb-4" />
            <CardTitle className="text-3xl font-bold text-primary">Importar Dados</CardTitle>
            <CardDescription className="text-lg text-muted-foreground mt-2">
              Envie seus arquivos Excel para processamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid w-full items-center gap-3">
              <Label htmlFor="bank-statement" className="text-lg font-medium">
                <FileText className="inline-block mr-2 h-5 w-5" />
                Extrato Bancário (.xlsx)
              </Label>
              <Input
                id="bank-statement"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleBankStatementChange}
                className="cursor-pointer"
              />
            </div>

            <div className="grid w-full items-center gap-3">
              <Label htmlFor="financial-entries" className="text-lg font-medium">
                <FileText className="inline-block mr-2 h-5 w-5" />
                Lançamentos Financeiros (.xlsx)
              </Label>
              <Input
                id="financial-entries"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFinancialEntriesChange}
                className="cursor-pointer"
              />
            </div>

            <Button
              onClick={handleUpload}
              disabled={isUploading || !bankStatementFile || !financialEntriesFile}
              className="w-full py-6 text-lg font-semibold"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processando...
                </>
              ) : (
                "Importar e Sincronizar"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ImportData;