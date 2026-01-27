"use client";

import React, { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Settings, ShieldCheck, CalendarRange, Coins, Loader2, Info } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/auth/SessionContextProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const RulesPanel = () => {
  const { user } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [rules, setRules] = useState({
    value_tolerance: "0.00",
    date_tolerance_days: "0",
  });

  useEffect(() => {
    const fetchRules = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("reconciliation_rules")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data) {
          setRules({
            value_tolerance: data.value_tolerance.toString(),
            date_tolerance_days: data.date_tolerance_days.toString(),
          });
        }
      } catch (error: any) {
        showError("Erro ao carregar regras.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchRules();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("reconciliation_rules")
        .upsert({
          user_id: user.id,
          value_tolerance: parseFloat(rules.value_tolerance),
          date_tolerance_days: parseInt(rules.date_tolerance_days),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (error) throw error;
      showSuccess("Configurações aplicadas!");
    } catch (error: any) {
      showError("Erro ao salvar.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <Layout><div className="flex h-full items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">
        <header>
          <h1 className="text-4xl font-black text-primary tracking-tight">Configurações de Inteligência</h1>
          <p className="text-muted-foreground text-lg mt-2">Defina o nível de rigor do motor de busca automática.</p>
        </header>

        <Alert className="rounded-2xl border-indigo-200 bg-indigo-50 text-indigo-900">
          <Info className="h-5 w-5 text-indigo-600" />
          <AlertTitle className="font-bold">Como isso afeta o sistema?</AlertTitle>
          <AlertDescription>
            Essas regras são aplicadas apenas no botão <strong>"Auto (1:1)"</strong>. A conciliação manual ignora essas restrições, dando total liberdade para o agrupamento.
          </AlertDescription>
        </Alert>

        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="bg-slate-50 border-b border-slate-100 p-8">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                <ShieldCheck size={32} />
              </div>
              <div>
                <CardTitle className="text-2xl font-black">Critérios de Match</CardTitle>
                <CardDescription>Defina as margens de erro aceitáveis.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-indigo-600" />
                  <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">Tolerância de Valor</Label>
                </div>
                <Input 
                  type="number" step="0.01" 
                  value={rules.value_tolerance}
                  onChange={e => setRules({...rules, value_tolerance: e.target.value})}
                  className="h-14 rounded-2xl text-lg font-bold border-slate-200"
                />
                <p className="text-xs text-muted-foreground italic">Ex: 0,05 permite bater R$ 100,00 com R$ 100,05.</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CalendarRange className="h-5 w-5 text-indigo-600" />
                  <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">Janela de Dias (±)</Label>
                </div>
                <Input 
                  type="number" 
                  value={rules.date_tolerance_days}
                  onChange={e => setRules({...rules, date_tolerance_days: e.target.value})}
                  className="h-14 rounded-2xl text-lg font-bold border-slate-200"
                />
                <p className="text-xs text-muted-foreground italic">0 significa que as datas devem ser idênticas.</p>
              </div>
            </div>

            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="w-full py-8 text-xl font-black rounded-3xl shadow-xl transition-all active:scale-95 bg-primary"
            >
              {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Settings className="mr-2" />}
              Salvar Configurações
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default RulesPanel;