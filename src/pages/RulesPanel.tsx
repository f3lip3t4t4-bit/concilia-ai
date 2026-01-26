"use client";

import React, { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Settings, DollarSign, CalendarDays, Loader2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/auth/SessionContextProvider";

const RulesPanel = () => {
  const { user } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [rules, setRules] = useState({
    value_tolerance: "0.05",
    date_tolerance_days: "1",
    auto_group: false,
    suggest_group: true,
    inform_divergence: true,
  });

  useEffect(() => {
    const fetchRules = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("reconciliation_rules")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (error && error.code !== "PGRST116") throw error; // PGRST116 is "not found"
        
        if (data) {
          setRules({
            value_tolerance: data.value_tolerance.toString(),
            date_tolerance_days: data.date_tolerance_days.toString(),
            auto_group: data.auto_group,
            suggest_group: data.suggest_group,
            inform_divergence: data.inform_divergence,
          });
        }
      } catch (error: any) {
        showError("Erro ao carregar regras: " + error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRules();
  }, [user]);

  const handleSaveRules = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const payload = {
        user_id: user.id,
        value_tolerance: parseFloat(rules.value_tolerance),
        date_tolerance_days: parseInt(rules.date_tolerance_days),
        auto_group: rules.auto_group,
        suggest_group: rules.suggest_group,
        inform_divergence: rules.inform_divergence,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("reconciliation_rules")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;
      showSuccess("Regras salvas com sucesso!");
    } catch (error: any) {
      showError("Erro ao salvar regras: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

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
                    value={rules.value_tolerance}
                    onChange={(e) => setRules({ ...rules, value_tolerance: e.target.value })}
                    className="text-lg p-3 rounded-md border-input"
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
                    value={rules.date_tolerance_days}
                    onChange={(e) => setRules({ ...rules, date_tolerance_days: e.target.value })}
                    className="text-lg p-3 rounded-md border-input"
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
                    checked={rules.auto_group}
                    onCheckedChange={(checked) => setRules({ ...rules, auto_group: !!checked })}
                    className="h-5 w-5"
                  />
                  <Label htmlFor="auto-group" className="text-lg font-medium cursor-pointer">
                    Agrupar lançamentos automaticamente
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="suggest-group"
                    checked={rules.suggest_group}
                    onCheckedChange={(checked) => setRules({ ...rules, suggest_group: !!checked })}
                    className="h-5 w-5"
                  />
                  <Label htmlFor="suggest-group" className="text-lg font-medium cursor-pointer">
                    Apenas sugerir agrupamentos
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="inform-divergence"
                    checked={rules.inform_divergence}
                    onCheckedChange={(checked) => setRules({ ...rules, inform_divergence: !!checked })}
                    className="h-5 w-5"
                  />
                  <Label htmlFor="inform-divergence" className="text-lg font-medium cursor-pointer">
                    Apenas informar divergências
                  </Label>
                </div>
              </div>
            </div>

            <Button
              onClick={handleSaveRules}
              disabled={isSaving}
              className="w-full py-3 text-lg font-semibold"
            >
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Salvar Regras"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default RulesPanel;