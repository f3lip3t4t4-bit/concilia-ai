"use client";

import React, { useState, useEffect, useCallback } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, AlertCircle, HelpCircle, Loader2, ArrowRightLeft, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";

interface Entry {
  id: string;
  date: string;
  description: string;
  amount: number;
}

const Reconciliation = () => {
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [bankEntries, setBankEntries] = useState<Entry[]>([]);
  const [finEntries, setFinEntries] = useState<Entry[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [rules, setRules] = useState<any>(null);

  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedFinId, setSelectedFinId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [bankRes, finRes, matchRes, ruleRes] = await Promise.all([
        supabase.from("bank_statements").select("*").eq("user_id", user.id).order("date", { ascending: false }),
        supabase.from("financial_entries").select("*").eq("user_id", user.id).order("date", { ascending: false }),
        supabase.from("reconciliation_matches").select("*").eq("user_id", user.id),
        supabase.from("reconciliation_rules").select("*").eq("user_id", user.id).single()
      ]);

      setBankEntries(bankRes.data || []);
      setFinEntries(finRes.data || []);
      setMatches(matchRes.data || []);
      setRules(ruleRes.data || { value_tolerance: 0.05, date_tolerance_days: 1 });
    } catch (error: any) {
      showError("Erro ao carregar dados: " + error.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isMatched = (id: string, type: "bank" | "fin") => {
    const field = type === "bank" ? "bank_statement_id" : "financial_entry_id";
    return matches.some(m => m[field] === id);
  };

  const getMatchInfo = (id: string, type: "bank" | "fin") => {
    const field = type === "bank" ? "bank_statement_id" : "financial_entry_id";
    return matches.find(m => m[field] === id);
  };

  const handleManualMatch = async () => {
    if (!selectedBankId || !selectedFinId || !user) return;

    try {
      const { error } = await supabase.from("reconciliation_matches").insert({
        user_id: user.id,
        bank_statement_id: selectedBankId,
        financial_entry_id: selectedFinId,
        match_type: "manual"
      });

      if (error) throw error;

      showSuccess("Conciliação manual realizada!");
      setSelectedBankId(null);
      setSelectedFinId(null);
      fetchData();
    } catch (error: any) {
      showError("Erro ao conciliar: " + error.message);
    }
  };

  const handleUnmatch = async (matchId: string) => {
    try {
      const { error } = await supabase.from("reconciliation_matches").delete().eq("id", matchId);
      if (error) throw error;
      showSuccess("Conciliação desfeita.");
      fetchData();
    } catch (error: any) {
      showError("Erro ao desfazer: " + error.message);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const unmatchedBank = bankEntries.filter(e => !isMatched(e.id, "bank"));
  const unmatchedFin = finEntries.filter(e => !isMatched(e.id, "fin"));

  return (
    <Layout>
      <div className="space-y-6">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary">Conciliação Ativa</h1>
            <p className="text-muted-foreground">Selecione um item de cada lado para conciliar manualmente.</p>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lado do Banco */}
          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="bg-blue-600 text-white p-4">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Extrato Bancário</span>
                <Badge variant="secondary" className="bg-white/20 text-white border-none">
                  {unmatchedBank.length} pendentes
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead className="w-24">Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmatchedBank.map((entry) => (
                      <TableRow 
                        key={entry.id} 
                        className={`cursor-pointer transition-colors ${selectedBankId === entry.id ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedBankId(selectedBankId === entry.id ? null : entry.id)}
                      >
                        <TableCell className="text-sm">{new Date(entry.date).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="font-medium">{entry.description}</TableCell>
                        <TableCell className="text-right font-bold text-blue-600">{formatCurrency(entry.amount)}</TableCell>
                      </TableRow>
                    ))}
                    {unmatchedBank.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Tudo conciliado!</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Lado Financeiro */}
          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="bg-emerald-600 text-white p-4">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Lançamentos Internos</span>
                <Badge variant="secondary" className="bg-white/20 text-white border-none">
                  {unmatchedFin.length} pendentes
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead className="w-24">Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmatchedFin.map((entry) => (
                      <TableRow 
                        key={entry.id} 
                        className={`cursor-pointer transition-colors ${selectedFinId === entry.id ? 'bg-emerald-50' : ''}`}
                        onClick={() => setSelectedFinId(selectedFinId === entry.id ? null : entry.id)}
                      >
                        <TableCell className="text-sm">{new Date(entry.date).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="font-medium">{entry.description}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(entry.amount)}</TableCell>
                      </TableRow>
                    ))}
                    {unmatchedFin.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Sem pendências internas.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ações e Conciliados */}
        <div className="flex flex-col gap-6">
          <div className="flex justify-center">
            <Button 
              size="lg" 
              className="px-12 py-6 text-xl rounded-full shadow-lg"
              disabled={!selectedBankId || !selectedFinId}
              onClick={handleManualMatch}
            >
              <ArrowRightLeft className="mr-3 h-6 w-6" />
              Conciliar Selecionados
            </Button>
          </div>

          <Tabs defaultValue="matched" className="w-full">
            <TabsList className="grid w-full grid-cols-1 max-w-[400px]">
              <TabsTrigger value="matched">Itens Conciliados ({matches.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="matched">
              <Card className="border-none shadow-md">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Banco (Ref)</TableHead>
                        <TableHead>Interno (Ref)</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matches.map((m) => {
                        const b = bankEntries.find(e => e.id === m.bank_statement_id);
                        const f = finEntries.find(e => e.id === m.financial_entry_id);
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="text-sm">
                              {b?.description} <span className="block text-xs text-muted-foreground">{formatCurrency(b?.amount || 0)}</span>
                            </TableCell>
                            <TableCell className="text-sm">
                              {f?.description} <span className="block text-xs text-muted-foreground">{formatCurrency(f?.amount || 0)}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={m.match_type === 'manual' ? 'outline' : 'default'}>
                                {m.match_type === 'manual' ? 'Manual' : 'Auto'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => handleUnmatch(m.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {matches.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma conciliação efetuada.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default Reconciliation;