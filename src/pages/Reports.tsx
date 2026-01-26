"use client";

import React from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

const Reports = () => {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center h-full p-4">
        <Card className="w-full max-w-4xl rounded-xl shadow-lg border-none p-6 bg-card">
          <CardHeader className="text-center">
            <FileText className="h-16 w-16 mx-auto text-primary mb-4" />
            <CardTitle className="text-3xl font-bold text-primary">Relatórios de Conciliação</CardTitle>
            <CardDescription className="text-lg text-muted-foreground mt-2">
              Visualize resumos, gráficos e detalhes dos resultados da conciliação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-xl text-muted-foreground">
              Aqui você encontrará relatórios detalhados sobre o status da conciliação, divergências e performance.
            </p>
            <p className="text-center text-lg text-muted-foreground">
              Gráficos e tabelas interativas serão adicionados para uma análise completa.
            </p>
            {/* Futuramente, componentes de gráficos e tabelas de relatórios */}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Reports;