"use client";

import React, { useState } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Settings, DollarSign, CalendarDays } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

const RulesPanel = () => {
  const [valueTolerance, setValueTolerance] = useState<string>("0.05");
  const [dateDifference, setDateDifference] = useState<string>("1");
  const [autoGroup, setAutoGroup] = useState<boolean>(false);
  const [suggestGroup, setSuggestGroup] = useState<boolean>(true);
  const [informDivergence, setInformDivergence] = useState<boolean>(true);

  const handleSaveRules = () => {
    // Em uma implementação real, você enviaria essas configurações para o backend (Supabase).
    console.log("Saving Rules:", {
      valueTolerance: parseFloat(valueTolerance),
      dateDifference: parseInt(dateDifference),
      autoGroup,
      suggestGroup,
      informDivergence,
    });
    showSuccess("Regras salvas com sucesso! (Simulado)");
    // Aqui você integraria com o backend para persistir as regras.
  };

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center h-full p-4">
        <Card className="w-full max-w-3xl rounded-xl shadow-lg border-none p-6 bg-card">
          <CardHeader className="text-center">
            <Settings className="h-16 w-16 mx-auto text-primary mb-4" />
            <CardTitle className="text-3xl font-bold text-primary">Painel de Regras de Conciliação</CardTitle>
            <CardDescription className="text-lg text-muted-foreground mt-2">
              Configure as tolerâncias e o comportamento do sistema para a conciliação automática.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold text-foreground flex items-center">
                <DollarSign className="mr-2 h-6 w-6 text-primary" />
                Tolerâncias
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="value-tolerance" className="text-lg font-medium text-foreground mb-2 block">
                    Tolerância de valor aceitável (R$)
                  </Label>
                  <Input
                    id="value-tolerance"
                    type="number"
                    step="0.01"
                    value={valueTolerance}
                    onChange={(e) => setValueTolerance(e.target.value)}
                    className="text-lg p-3 rounded-md border-input focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                  <p className="text-sm text-muted-foreground mt-1">Ex: 0.05 para R$ 0,05 de diferença.</p>
                </div>
                <div>
                  <Label htmlFor="date-difference" className="text-lg font-medium text-foreground mb-2 block">
                    Dias de diferença de data permitida
                  </Label>
                  <Input
                    id="date-difference"
                    type="number"
                    step="1"
                    min="0"
                    value={dateDifference}
                    onChange={(e) => setDateDifference(e.target.value)}
                    className="text-lg p-3 rounded-md border-input focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                  <p className="text-sm text-muted-foreground mt-1">Ex: 1 para ±1 dia.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-2xl font-semibold text-foreground flex items-center">
                <CalendarDays className="mr-2 h-6 w-6 text-primary" />
                Comportamento do Sistema
              </h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="auto-group"
                    checked={autoGroup}
                    onCheckedChange={(checked) => setAutoGroup(checked as boolean)}
                    className="h-5 w-5 rounded-md border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  />
                  <Label htmlFor="auto-group" className="text-lg font-medium text-foreground cursor-pointer">
                    Agrupar lançamentos automaticamente
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="suggest-group"
                    checked={suggestGroup}
                    onCheckedChange={(checked) => setSuggestGroup(checked as boolean)}
                    className="h-5 w-5 rounded-md border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  />
                  <Label htmlFor="suggest-group" className="text-lg font-medium text-foreground cursor-pointer">
                    Apenas sugerir agrupamentos
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="inform-divergence"
                    checked={informDivergence}
                    onCheckedChange={(checked) => setInformDivergence(checked as boolean)}
                    className="h-5 w-5 rounded-md border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  />
                  <Label htmlFor="inform-divergence" className="text-lg font-medium text-foreground cursor-pointer">
                    Apenas informar divergências
                  </Label>
                </div>
              </div>
            </div>

            <Button
              onClick={handleSaveRules}
              className="w-full py-3 text-lg font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Salvar Regras
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default RulesPanel;