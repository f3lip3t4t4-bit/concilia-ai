"use client";

import React from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

const Reconciliation = () => {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center h-full p-4">
        <Card className="w-full max-w-4xl rounded-xl shadow-lg border-none p-6 bg-card">
          <CardHeader className="text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-primary mb-4" />
            <CardTitle className="text-3xl font-bold text-primary">Conciliação Bancária</CardTitle>
            <CardDescription className="text-lg text-muted-foreground mt-2">
              Visualize os lançamentos conciliados, com divergências e não identificados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-xl text-muted-foreground">
              Após importar os dados, os resultados da conciliação automática e os alertas de qualidade aparecerão aqui.
            </p>
            <p className="text-center text-lg text-muted-foreground">
              Você poderá revisar, ajustar e confirmar os agrupamentos manualmente.
            </p>
            {/* Futuramente, tabelas para extrato, lançamentos, alertas e sugestões de matching */}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Reconciliation;