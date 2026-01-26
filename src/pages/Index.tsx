"use client";

import React from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, DollarSign, AlertTriangle, CheckCircle } from "lucide-react";

const Index = () => {
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
              <div className="text-3xl font-bold">R$ 0,00</div>
              <p className="text-sm text-white/90">Total dos extratos importados</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-lg border-none bg-gradient-to-br from-green-500 to-green-700 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-medium">Lançado Corretamente</CardTitle>
              <CheckCircle className="h-6 w-6 text-white/80" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">R$ 0,00</div>
              <p className="text-sm text-white/90">Itens conciliados sem divergência</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-lg border-none bg-gradient-to-br from-yellow-500 to-yellow-700 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-medium">Com Divergência</CardTitle>
              <AlertTriangle className="h-6 w-6 text-white/80" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">R$ 0,00</div>
              <p className="text-sm text-white/90">Itens com pequenas diferenças</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-lg border-none bg-gradient-to-br from-red-500 to-red-700 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-medium">Não Identificado</CardTitle>
              <BarChart className="h-6 w-6 text-white/80" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">R$ 0,00</div>
              <p className="text-sm text-white/90">Itens sem correspondência</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <p className="text-xl text-muted-foreground">
            Use o menu lateral para importar dados e iniciar a conciliação.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Index;