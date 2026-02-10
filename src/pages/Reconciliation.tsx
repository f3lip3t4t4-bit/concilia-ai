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
import { Loader2, ArrowRightLeft, RefreshCw, Trash2, Zap, Search, LayoutDashboard, PartyPopper, Layers, Car } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { useNavigate } from "react-router-dom";

interface Entry {
  id: string;
  date: string;
  description: string;
  amount: number;
  sub_group?: string;
}

const Reconciliation = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [bankEntries, setBankEntries] = useState<Entry[]>([]);
  const [finEntries, setFinEntries] = useState<Entry[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [rules, setRules] = useState<any>({ value_tolerance: 0.05, date_tolerance_days: 1 });

  // OTIMIZAÇÃO: Usando Set para busca O(1) em vez de Array.includes (O(n))
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
      if (ruleRes.data) setRules(ruleRes.data);
    } catch (error: any) {
      showError("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const matchedBankIds = useMemo(() => new Set(matches.map(m => m.bank_statement_id)), [matches]);
  const matchedFinIds = useMemo(() => new Set(matches.map(m => m.financial_entry_id)), [matches]);

  const filteredBank = useMemo(() => bankEntries.filter(e => !matchedBankIds.has(e.id)), [bankEntries, matchedBankIds]);
  const filteredFin = useMemo(() => finEntries.filter(e => !matchedFinIds.has(e.id)), [finEntries, matchedFinIds]);

  const searchedBank = useMemo(() => {
    const term = searchTermBank.toLowerCase();
    return term ? filteredBank.filter(e => e.description.toLowerCase().includes(term)) : filteredBank;
  }, [filteredBank, searchTermBank]);

  const searchedFin = useMemo(() => {
    const term = searchTermFin.toLowerCase();
    return term ? filteredFin.filter(e => e.description.toLowerCase().includes(term)) : filteredFin;
  }, [filteredFin, searchTermFin]);

  const isAllClear = useMemo(() => {
    return !loading && (bankEntries.length > 0 || finEntries.length > 0) && filteredBank.length === 0 && filteredFin.length === 0;
  }, [loading, bankEntries.length, finEntries.length, filteredBank.length, filteredFin.length]);

  useEffect(() => {
    if (isAllClear) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    }
  }, [isAllClear]);

  const toggleBank = (id: string) => {
    setSelectedBankIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFin = (id: string) => {
    setSelectedFinIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleManualMatch = async () => {
    if (selectedBankIds.size === 0 || selectedFinIds.size === 0 || !user) {
      showError("Selecione itens de ambos os lados.");
      return;
    }
    setIsProcessing(true);
    try {
      const groupId = window.crypto.randomUUID();
      const payload: any[] = [];
      selectedBankIds.forEach(bId => {
        selectedFinIds.forEach(fId => {
          payload.push({ user_id: user.id, bank_statement_id: bId, financial_entry_id: fId, match_type: "manual", group_id: groupId });
        });
      });
      const { error } = await supabase.from("reconciliation_matches").insert(payload);
      if (error) throw error;
      showSuccess("Conciliado!");
      setSelectedBankIds(new Set());
      setSelectedFinIds(new Set());
      fetchData();
    } catch (error: any) {
      showError("Erro ao salvar.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoReconcile = async () => {
    if (!user) return;
    setIsProcessing(true);
    const newMatches: any[] = [];
    const usedFin = new Set<string>();
    const valTol = Number(rules.value_tolerance || 0);
    const dateTol = Number(rules.date_tolerance_days || 0);

    filteredBank.forEach(b => {
      const bDate = new Date(b.date).getTime();
      const match = filteredFin.find(f => {
        if (usedFin.has(f.id)) return false;
        const fDate = new Date(f.date).getTime();
        const diffDays = Math.abs((bDate - fDate) / (1000 * 3600 * 24));
        const diffAmount = Math.abs(b.amount - f.amount);
        return diffDays <= dateTol && diffAmount <= valTol;
      });
      if (match) {
        newMatches.push({ user_id: user.id, bank_statement_id: b.id, financial_entry_id: match.id, match_type: "exact", group_id: window.crypto.randomUUID() });
        usedFin.add(match.id);
      }
    });

    if (newMatches.length > 0) {
      await supabase.from("reconciliation_matches").insert(newMatches);
      showSuccess(`${newMatches.length} pares encontrados!`);
      fetchData();
    } else {
      showError("Nenhuma correspondência encontrada.");
    }
    setIsProcessing(false);
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const formatDateBR = (d: string) => d.split('-').reverse().join('/');

  const bankTotal = useMemo(() => {
    let total = 0;
    selectedBankIds.forEach(id => {
      const entry = bankEntries.find(e => e.id === id);
      if (entry) total += entry.amount;
    });
    return total;
  }, [selectedBankIds, bankEntries]);

  const finTotal = useMemo(() => {
    let total = 0;
    selectedFinIds.forEach(id => {
      const entry = finEntries.find(e => e.id === id);
      if (entry) total += entry.amount;
    });
    return total;
  }, [selectedFinIds, finEntries]);

  if (loading) return <Layout><div className="flex h-full items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div></Layout>;

  if (isAllClear) {
    return (
      <Layout>
        <div className="h-[70vh] flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="h-32 w-32 bg-emerald-500 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl"><PartyPopper size={64} /></div>
          <h1 className="text-5xl font-black text-primary tracking-tight">Tudo em ordem!</h1>
          <Button size="lg" onClick={() => navigate("/")} className="h-16 px-10 text-xl font-black rounded-2xl shadow-xl bg-primary">Ir para o Dashboard</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary">Conciliação Ativa</h1>
            <p className="text-muted-foreground italic">Selecione os itens para bater o saldo.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={fetchData} variant="outline" className="rounded-xl"><RefreshCw className="h-4 w-4 mr-2" /> Atualizar</Button>
            <Button onClick={handleAutoReconcile} disabled={isProcessing} className="bg-indigo-600 rounded-xl">
              {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : <Zap className="h-4 w-4 mr-2" />} Auto (1:1)
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tabela Banco */}
          <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
            <div className="bg-blue-600 p-6 text-white">
              <div className="flex justify-between items-center mb-4">
                <CardTitle className="text-xl">Banco</CardTitle>
                <Badge variant="secondary" className="bg-white/20 text-white">{selectedBankIds.size} selecionados</Badge>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
                <Input placeholder="Filtrar..." className="bg-white/10 border-none text-white placeholder:text-white/50 pl-10 h-10" value={searchTermBank} onChange={e => setSearchTermBank(e.target.value)} />
              </div>
            </div>
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                <TableBody>
                  {searchedBank.map(e => (
                    <TableRow key={e.id} className={cn("cursor-pointer", selectedBankIds.has(e.id) && "bg-blue-50")} onClick={() => toggleBank(e.id)}>
                      <TableCell onClick={ev => ev.stopPropagation()}><Checkbox checked={selectedBankIds.has(e.id)} onCheckedChange={() => toggleBank(e.id)} /></TableCell>
                      <TableCell className="text-xs">{formatDateBR(e.date)}</TableCell>
                      <TableCell className="font-medium text-slate-700 max-w-[200px] truncate">{e.description}</TableCell>
                      <TableCell className="text-right font-bold text-blue-600">{formatCurrency(e.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Tabela Sistema */}
          <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
            <div className="bg-emerald-600 p-6 text-white">
              <div className="flex justify-between items-center mb-4">
                <CardTitle className="text-xl">Sistema</CardTitle>
                <Badge variant="secondary" className="bg-white/20 text-white">{selectedFinIds.size} selecionados</Badge>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
                <Input placeholder="Filtrar..." className="bg-white/10 border-none text-white placeholder:text-white/50 pl-10 h-10" value={searchTermFin} onChange={e => setSearchTermFin(e.target.value)} />
              </div>
            </div>
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Data</TableHead><TableHead>Histórico</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                <TableBody>
                  {searchedFin.map(e => (
                    <TableRow key={e.id} className={cn("cursor-pointer", selectedFinIds.has(e.id) && "bg-emerald-50")} onClick={() => toggleFin(e.id)}>
                      <TableCell onClick={ev => ev.stopPropagation()}><Checkbox checked={selectedFinIds.has(e.id)} onCheckedChange={() => toggleFin(e.id)} /></TableCell>
                      <TableCell className="text-xs">{formatDateBR(e.date)}</TableCell>
                      <TableCell className="font-medium text-slate-700 max-w-[200px] truncate">{e.description}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(e.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 flex flex-col items-center gap-4">
          <div className="grid grid-cols-3 gap-8 w-full max-w-2xl text-center">
            <div><p className="text-xs font-bold text-muted-foreground uppercase">Banco</p><p className="text-xl font-black text-blue-600">{formatCurrency(bankTotal)}</p></div>
            <div><p className="text-xs font-bold text-muted-foreground uppercase">Sistema</p><p className="text-xl font-black text-emerald-600">{formatCurrency(finTotal)}</p></div>
            <div><p className="text-xs font-bold text-muted-foreground uppercase">Diferença</p><p className={cn("text-xl font-black", Math.abs(bankTotal - finTotal) < 0.01 ? "text-emerald-500" : "text-destructive")}>{formatCurrency(bankTotal - finTotal)}</p></div>
          </div>
          <Button size="lg" className="rounded-2xl px-12 h-16 text-lg font-black shadow-xl bg-primary" disabled={selectedBankIds.size === 0 || selectedFinIds.size === 0 || isProcessing} onClick={handleManualMatch}>
            <ArrowRightLeft className="mr-3 h-6 w-6" /> Conciliar Selecionados
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default Reconciliation;