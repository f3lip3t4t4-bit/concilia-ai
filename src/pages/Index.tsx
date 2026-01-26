"use client";

import React, { useState } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, DollarSign, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

const Index = () => {
  const [totalExtrato, setTotalExtrato] = useState<number>(0);
  const [lancadoCorretamente, setLancadoCorretamente] = useState<number>(0);
  const [comDivergencia, setComDivergencia] = useState<number>(0);
  const [naoIdentificado, setNaoIdentificado] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleRefreshData = async () => {
    setIsLoading(true);
    showSuccess("Atualizando dados do dashboard...");
    // Simulação de carregamento de dados do backend
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Em uma implementação real, você faria uma chamada API aqui para buscar os dados
    // Ex: const response = await fetch("/api/dashboard-summary");
    // const data = await response.json();
    // setTotalExtrato(data.totalExtrato);
    // setLancadoCorretamente(data.lancadoCorretamente);
    // setComDivergencia(data.comDivergencia);
    // setNaoIdentificado(data.naoIdentificado);

    // Por enquanto, vamos apenas simular que os dados foram "carregados" (ainda zeros)
    setTotalExtrato(0);
    setLancadoCorretamente(0);
    setComDivergencia(0);
    setNaoIdentificado(0);

    showSuccess("Dados do dashboard atualizados!");
    setIsLoading(false);
  };

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <h1 className="text-4xl font-extrabold text-primary mb-8 text-center">Dashboard de Conciliação</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="rounded-xl shadow-lg border-none bg-gradient-to-br from-blue-500 to-blue-700 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-medium">Total Extrato</CardTitle>
              <DollarSign className="h-6 w-6 text-white/80" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(totalExtrato)}</div>
              <p className="text-sm text-white/90">Total dos extratos importados</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-lg border-none bg-gradient-to-br from-green-500 to-green-700 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-medium">Lançado Corretamente</CardTitle>
              <CheckCircle className="h-6 w-6 text-white/80" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(lancadoCorretamente)}</div>
              <p className="text-sm text-white/90">Itens conciliados sem divergência</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-lg border-none bg-gradient-to-br from-yellow-500 to-yellow-700 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-medium">Com Divergência</CardTitle>
              <AlertTriangle className="h-6 w-6 text-white/80" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(comDivergencia)}</div>
              <p className="text-sm text-white/90">Itens com pequenas diferenças</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-lg border-none bg-gradient-to-br from-red-500 to-red-700 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-medium">Não Identificado</CardTitle>
              <BarChart className="h-6 w-6 text-white/80" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(naoIdentificado)}</div>
              <p className="text-sm text-white/90">Itens sem correspondência</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col items-center justify-center flex-1 p-4">
          <p className="text-xl text-muted-foreground mb-6 text-center max-w-prose">
            Para começar, importe seus extratos bancários e lançamentos financeiros usando o menu "Importar Dados".
            Depois, configure as regras de conciliação no "Painel de Regras".
          </p>
          <Button
            onClick={handleRefreshData}
            disabled={isLoading}
            className="py-3 px-6 text-lg font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isLoading ? (
              <>
                <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                Atualizando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-5 w-5" />
                Atualizar Dados do Dashboard
              </>
            )}
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default Index;