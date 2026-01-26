"use client";

import React, { useState } from "react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, FileText } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

const ImportData = () => {
  const [bankStatementFile, setBankStatementFile] = useState<File | null>(null);
  const [financialEntriesFile, setFinancialEntriesFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleBankStatementChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setBankStatementFile(event.target.files[0]);
    } else {
      setBankStatementFile(null);
    }
  };

  const handleFinancialEntriesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFinancialEntriesFile(event.target.files[0]);
    } else {
      setFinancialEntriesFile(null);
    }
  };

  const handleUpload = async () => {
    if (!bankStatementFile || !financialEntriesFile) {
      showError("Por favor, selecione ambos os arquivos antes de importar.");
      return;
    }

    setIsUploading(true);
    // Simulação de upload. Em uma implementação real, você enviaria esses arquivos para o backend.
    console.log("Uploading Bank Statement:", bankStatementFile.name);
    console.log("Uploading Financial Entries:", financialEntriesFile.name);

    // Aqui você integraria com o backend (Node.js + Supabase) para processar os arquivos.
    // Por exemplo:
    // const formData = new FormData();
    // formData.append("bankStatement", bankStatementFile);
    // formData.append("financialEntries", financialEntriesFile);
    // try {
    //   const response = await fetch("/api/upload-excel", {
    //     method: "POST",
    //     body: formData,
    //   });
    //   if (response.ok) {
    //     showSuccess("Arquivos importados e normalizados com sucesso!");
    //     // Redirecionar ou atualizar o estado para mostrar os dados processados
    //   } else {
    //     showError("Erro ao importar arquivos.");
    //   }
    // } catch (error) {
    //   console.error("Upload error:", error);
    //   showError("Erro de rede ou servidor ao importar arquivos.");
    // }

    await new Promise((resolve) => setTimeout(resolve, 2000)); // Simula delay de upload
    showSuccess("Arquivos enviados para processamento! (Simulado)");
    setIsUploading(false);
    setBankStatementFile(null);
    setFinancialEntriesFile(null);
  };

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center h-full p-4">
        <Card className="w-full max-w-2xl rounded-xl shadow-lg border-none p-6 bg-card">
          <CardHeader className="text-center">
            <UploadCloud className="h-16 w-16 mx-auto text-primary mb-4" />
            <CardTitle className="text-3xl font-bold text-primary">Importar Dados para Conciliação</CardTitle>
            <CardDescription className="text-lg text-muted-foreground mt-2">
              Faça o upload do extrato bancário e dos lançamentos financeiros.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid w-full items-center gap-3">
              <Label htmlFor="bank-statement" className="text-lg font-medium text-foreground">
                <FileText className="inline-block mr-2 h-5 w-5" />
                Extrato Bancário (.xlsx)
              </Label>
              <Input
                id="bank-statement"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleBankStatementChange}
                className="file:text-primary file:font-semibold file:bg-primary/10 file:border-none file:rounded-md file:px-4 file:py-2 hover:file:bg-primary/20 transition-colors cursor-pointer"
              />
              {bankStatementFile && (
                <p className="text-sm text-muted-foreground mt-1">
                  Arquivo selecionado: <span className="font-medium">{bankStatementFile.name}</span>
                </p>
              )}
            </div>

            <div className="grid w-full items-center gap-3">
              <Label htmlFor="financial-entries" className="text-lg font-medium text-foreground">
                <FileText className="inline-block mr-2 h-5 w-5" />
                Lançamentos Financeiros (.xlsx)
              </Label>
              <Input
                id="financial-entries"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFinancialEntriesChange}
                className="file:text-primary file:font-semibold file:bg-primary/10 file:border-none file:rounded-md file:px-4 file:py-2 hover:file:bg-primary/20 transition-colors cursor-pointer"
              />
              {financialEntriesFile && (
                <p className="text-sm text-muted-foreground mt-1">
                  Arquivo selecionado: <span className="font-medium">{financialEntriesFile.name}</span>
                </p>
              )}
            </div>

            <Button
              onClick={handleUpload}
              disabled={isUploading || !bankStatementFile || !financialEntriesFile}
              className="w-full py-3 text-lg font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isUploading ? "Importando..." : "Importar Arquivos"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ImportData;