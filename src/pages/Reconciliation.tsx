"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowRightLeft, RefreshCw, Trash2, Zap, Search } from "lucide-react";
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [bankEntries, setBankEntries] = useState<Entry[]>([]);
  const [finEntries, setFinEntries] = useState<Entry[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [rules, setRules] = useState<any>({ value_tolerance: 0.05, date_tolerance_days: 1 });

  // Seleção Múltipla
  const [selectedBankIds, setSelectedBankIds] = useState<Set<string>>(new Set());
  const [selectedFinIds, setSelectedFinIds] = useState<Set<string>>(new Set());
  
  const [searchTermBank, setSearchTermBank] = useState("");
  const [searchTermFin, setSearchTermFin] = useState("");

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [bankRes, finRes, matchRes, ruleRes] = await Promise.all([
        supabase.from("bank_statements").select("*").eq("user_id", user.id).order("date", { ascending: true }),
        supabase.from("financial_entries").select("*").eq("user_id", user.id).order("date", { ascending: true }),
        supabase.from("reconciliation_matches").select("*").eq("user_id", user.id),
        supabase.from("reconciliation_rules").select("*").eq("user_id", user.id).maybeSingle()
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

  const handleToggleBank = (id: string) => {
    const next = new Set(selectedBankIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedBankIds(next);
  };

  const handleToggleFin = (id: string) => {
    const next = new Set(selectedFinIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedFinIds(next);
  };

  const handleManualMatch = async () => {
    if (selectedBankIds.size === 0 || selectedFinIds.size === 0 || !user) return;
    
    setIsProcessing(true);
    try {
      const groupId = crypto.randomUUID();
      const newMatches: any[] = [];

      // Criar registros para todas as combinações selecionadas no mesmo grupo
      selectedBankIds.forEach(bId => {
        selectedFinIds.forEach(fId => {
          newMatches.push({
            user_id: user.id,
            bank_statement_id: bId,
            financial_entry_id: fId,
            match_type: "manual",
            group_id: groupId
          });
        });
      });

      const { error } = await supabase.from("reconciliation_matches").insert(newMatches);
      if (error) throw error;
      
      showSuccess("Conciliação manual realizada!");
      setSelectedBankIds(new Set());
      setSelectedFinIds(new Set());
      fetchData();
    } catch (error: any) {
      showError("Erro ao conciliar: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoReconcile = async () => {
    if (!user || !rules) return;
    setIsProcessing(true);
    
    const unmatchedBank = bankEntries.filter(e => !isMatched(e.id, "bank"));
    const unmatchedFin = finEntries.filter(e => !isMatched(e.id, "fin"));
    
    const newMatches: any[] = [];
    const usedFinIds = new Set<string>();

    const valTol = Number(rules.value_tolerance || 0.05);
    const dateTol = Number(rules.date_tolerance_days || 1);

    // Conciliação 1:1 exata apenas
    unmatchedBank.forEach(b => {
      const bDate = new Date(b.date);
      const match = unmatchedFin.find(f => {
        if (usedFinIds.has(f.id)) return false;
        const fDate = new Date(f.date);
        const diffTime = Math.abs(bDate.getTime() - fDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const diffAmount = Math.abs(Number(b.amount) - Number(f.amount));
        return diffDays <= dateTol && diffAmount <= valTol;
      });

      if (match) {
        newMatches.push({
          user_id: user.id,
          bank_statement_id: b.id,
          financial_entry_id: match.id,
          match_type: "exact",
          group_id: crypto.randomUUID()
        });
        usedFinIds.add(match.id);
      }
    });

    if (newMatches.length === 0) {
      showError("Nenhuma correspondência exata encontrada.");
      setIsProcessing(false);
      return;
    }

    try {
      const { error } = await supabase.from("reconciliation_matches").insert(newMatches);
      if (error) throw error;
      showSuccess(`${newMatches.length} conciliações realizadas!`);
      fetchData();
    } catch (error: any) {
      showError("Erro: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnmatch = async (matchId: string) => {
    try {
      // Se for parte de um grupo, poderíamos apagar o grupo todo, mas para ser simples, apagamos o registro individual
      const { error } = await supabase.from("reconciliation_matches").delete().eq("id", matchId);
      if (error) throw error;
      showSuccess("Conciliação desfeita.");
      fetchData();
    } catch (error: any) {
      showError("Erro ao desfazer: " + error.message);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  
  const formatDateBR = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const filteredUnmatchedBank = useMemo(() => {
    return bankEntries
      .filter(e => !isMatched(e.id, "bank"))
      .filter(e => e.description.toLowerCase().includes(searchTermBank.toLowerCase()));
  }, [bankEntries, matches, searchTermBank]);

  const filteredUnmatchedFin = useMemo(() => {
    return finEntries
      .filter(e => !isMatched(e.id, "fin"))
      .filter(e => e.description.toLowerCase().includes(searchTermFin.toLowerCase()));
  }, [finEntries, matches, searchTermFin]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const selectedBankTotal = Array.from(selectedBankIds).reduce((acc, id) => {
    const entry = bankEntries.find(e => e.id === id);
    return acc + (entry ? Number(entry.amount) : 0);
  }, 0);

  const selectedFinTotal = Array.from(selectedFinIds).reduce((acc, id) => {
    const entry = finEntries.find(e => e.id === id);
    return acc + (entry ? Number(entry.amount) : 0);
  }, 0);

  return (
    <Layout>
      <div className="space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary tracking-tight">Conciliação Ativa</h1>
            <p className="text-muted-foreground">Selecione múltiplos itens para conciliar manualmente ou use a automação 1:1.</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button onClick={fetchData} variant="outline" size="sm" className="rounded-xl">
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
            <Button 
              onClick={handleAutoReconcile} 
              variant="default" 
              size="sm" 
              className="bg-indigo-600 hover:bg-indigo-700 rounded-xl"
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
              Auto-Conciliar (1:1)
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Extrato Bancário */}
          <Card className="border-none shadow-xl overflow-hidden rounded-[2rem] bg-white">
            <CardHeader className="bg-blue-600 text-white p-6">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-xl font-bold">Extrato Bancário</CardTitle>
                <Badge variant="secondary" className="bg-white/20 text-white border-none rounded-lg px-3 py-1">
                  {selectedBankIds.size} selecionados
                </Badge>
              </div>
              <p className="text-blue-100 text-sm font-medium">Total selecionado: {formatCurrency(selectedBankTotal)}</p>
              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                <Input 
                  placeholder="Buscar..." 
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 pl-10 rounded-xl"
                  value={searchTermBank}
                  onChange={(e) => setSearchTermBank(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-12 pl-6"></TableHead>
                      <TableHead className="w-24">Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right pr-6">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnmatchedBank.map((entry) => (
                      <TableRow 
                        key={entry.id} 
                        className={`cursor-pointer transition-all border-none ${selectedBankIds.has(entry.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                        onClick={() => handleToggleBank(entry.id)}
                      >
                        <TableCell className="pl-6" onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={selectedBankIds.has(entry.id)} 
                            onCheckedChange={() => handleToggleBank(entry.id)}
                          />
                        </TableCell>
                        <TableCell className="text-sm">{formatDateBR(entry.date)}</TableCell>
                        <TableCell className="font-semibold text-slate-700">{entry.description}</TableCell>
                        <TableCell className="text-right font-black text-blue-600 pr-6">{formatCurrency(entry.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Lançamentos Internos */}
          <Card className="border-none shadow-xl overflow-hidden rounded-[2rem] bg-white">
            <CardHeader className="bg-emerald-600 text-white p-6">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-xl font-bold">Relatório do Sistema</CardTitle>
                <Badge variant="secondary" className="bg-white/20 text-white border-none rounded-lg px-3 py-1">
                  {selectedFinIds.size} selecionados
                </Badge>
              </div>
              <p className="text-emerald-100 text-sm font-medium">Total selecionado: {formatCurrency(selectedFinTotal)}</p>
              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                <Input 
                  placeholder="Buscar..." 
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 pl-10 rounded-xl"
                  value={searchTermFin}
                  onChange={(e) => setSearchTermFin(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-12 pl-6"></TableHead>
                      <TableHead className="w-24">Data</TableHead>
                      <TableHead>Histórico</TableHead>
                      <TableHead className="text-right pr-6">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnmatchedFin.map((entry) => (
                      <TableRow 
                        key={entry.id} 
                        className={`cursor-pointer transition-all border-none ${selectedFinIds.has(entry.id) ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                        onClick={() => handleToggleFin(entry.id)}
                      >
                        <TableCell className="pl-6" onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={selectedFinIds.has(entry.id)} 
                            onCheckedChange={() => handleToggleFin(entry.id)}
                          />
                        </TableCell>
                        <TableCell className="text-sm">{formatDateBR(entry.date)}</TableCell>
                        <TableCell className="font-semibold text-slate-700">{entry.description}</TableCell>
                        <TableCell className="text-right font-black text-emerald-600 pr-6">{formatCurrency(entry.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col items-center justify-center py-6 gap-4">
          <div className="text-center">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Diferença entre Seleções</p>
            <p className={cn(
              "text-3xl font-black",
              Math.abs(selectedBankTotal - selectedFinTotal) < 0.01 ? "text-emerald-500" : "text-destructive"
            )}>
              {formatCurrency(selectedBankTotal - selectedFinTotal)}
            </p>
          </div>
          <Button 
            size="lg" 
            className="px-12 py-8 text-xl font-black rounded-3xl shadow-2xl transition-all active:scale-95 bg-primary hover:scale-105"
            disabled={selectedBankIds.size === 0 || selectedFinIds.size === 0 || isProcessing}
            onClick={handleManualMatch}
          >
            <ArrowRightLeft className="mr-4 h-8 w-8" />
            Conciliar Selecionados
          </Button>
        </div>

        <Tabs defaultValue="matched" className="w-full">
          <TabsList className="bg-slate-100 p-1 rounded-2xl mb-6">
            <TabsTrigger value="matched" className="px-8 py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg font-bold text-lg">
              Itens Conciliados ({matches.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="matched">
            <Card className="border-none shadow-xl overflow-hidden rounded-[2rem] bg-white">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="pl-6 py-4">Banco</TableHead>
                      <TableHead>Financeiro</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right pr-6">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches.map((m) => {
                      const b = bankEntries.find(e => e.id === m.bank_statement_id);
                      const f = finEntries.find(e => e.id === m.financial_entry_id);
                      return (
                        <TableRow key={m.id} className="border-b border-slate-50 last:border-0">
                          <TableCell className="pl-6 py-4">
                            <div className="font-bold text-slate-800">{b?.description || "N/A"}</div>
                            <div className="text-xs font-black text-blue-600 mt-1">{formatCurrency(b?.amount || 0)} • {b ? formatDateBR(b.date) : ""}</div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="font-bold text-slate-800">{f?.description || "N/A"}</div>
                            <div className="text-xs font-black text-emerald-600 mt-1">{formatCurrency(f?.amount || 0)} • {f ? formatDateBR(f.date) : ""}</div>
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge variant={m.match_type === 'manual' ? 'outline' : 'secondary'} className="rounded-lg font-bold">
                              {m.match_type === 'manual' ? 'Manual' : 'Automático'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6 py-4">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleUnmatch(m.id)}
                              className="text-destructive hover:bg-destructive/10 rounded-xl"
                            >
                              <Trash2 className="h-5 w-5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Reconciliation;