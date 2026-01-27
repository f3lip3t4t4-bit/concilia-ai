"use client";

import React, { useState } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, CreditCard, Rocket, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { showError } from "@/utils/toast";

const Checkout = () => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", tax_id: "" });

  const handleSubscribe = async () => {
    if (!formData.name || !formData.tax_id) {
      showError("Preencha todos os campos.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mercadopago-subscription', {
        body: formData
      });

      if (error) throw error;
      if (data.init_point) {
        window.location.href = data.init_point;
      }
    } catch (err: any) {
      showError("Erro ao iniciar checkout.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-10 py-10">
        <header className="text-center space-y-4">
          <h1 className="text-5xl font-black text-primary tracking-tighter">Assine o Concilia Pro</h1>
          <p className="text-xl text-muted-foreground font-medium">Controle total, automação e relatórios ilimitados.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="border-none shadow-2xl rounded-[3rem] bg-primary text-white p-8">
            <CardHeader className="p-0 space-y-4">
              <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <Rocket className="text-white" />
              </div>
              <CardTitle className="text-3xl font-black">Plano Mensal</CardTitle>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black">R$ 49,90</span>
                <span className="opacity-70 font-bold">/mês</span>
              </div>
            </CardHeader>
            <CardContent className="p-0 mt-8 space-y-4">
              {[
                "Conciliação 1:1 Ilimitada",
                "Suporte a Sicoob e Sicredi",
                "Relatórios de Auditoria",
                "Painel de Regras Customizáveis"
              ].map(item => (
                <div key={item} className="flex items-center gap-3 font-bold">
                  <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center"><Check size={14} /></div>
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl rounded-[3rem] bg-white p-8">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-2xl font-black flex items-center gap-2">
                <ShieldCheck className="text-blue-600" /> Seus Dados
              </CardTitle>
              <CardDescription className="font-medium">Necessário para emissão da nota e MP.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-6">
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-widest text-slate-400">Nome ou Razão Social</Label>
                <Input 
                  placeholder="Nome Completo" 
                  className="h-14 rounded-2xl border-slate-200"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-widest text-slate-400">CPF ou CNPJ</Label>
                <Input 
                  placeholder="000.000.000-00" 
                  className="h-14 rounded-2xl border-slate-200"
                  value={formData.tax_id}
                  onChange={e => setFormData({...formData, tax_id: e.target.value})}
                />
              </div>
              <Button 
                onClick={handleSubscribe} 
                disabled={loading}
                className="w-full py-8 text-xl font-black rounded-3xl bg-blue-600 shadow-xl hover:scale-105 transition-all"
              >
                {loading ? <Loader2 className="animate-spin" /> : <CreditCard className="mr-3" />}
                Pagar com Mercado Pago
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Checkout;