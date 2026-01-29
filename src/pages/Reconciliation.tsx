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

  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [selectedFinIds, setSelectedFinIds] = useState<string[]>([]);
  
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
      showError("Erro ao carregar dados: " + error.message);
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

  const isAllClear = useMemo(() => {
    return !loading && 
           (bankEntries.length > 0 || finEntries.length > 0) && 
           filteredBank.length === 0 && 
           filteredFin.length === 0;
  }, [loading, bankEntries.length, finEntries.length, filteredBank.length, filteredFin.length]);

  useEffect(() => {
    if (isAllClear) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
      return () => clearInterval(interval);
    }
  }, [isAllClear]);

  const toggleBank = (id: string) => {
    setSelectedBankIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleFin = (id: string) => {
    setSelectedFinIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleManualMatch = async () => {
    if (selectedBankIds.length === 0 || selectedFinIds.length === 0 || !user) {
      showError("Selecione ao menos um item de cada lado.");
      return;
    }
    setIsProcessing(true);
    try {
      const groupId = window.crypto.randomUUID();
      const payload: any[] = [];
      selectedBankIds.forEach(bId => {
        selectedFinIds.forEach(fId => {
          payload.push({
            user_id: user.id,
            bank_statement_id: bId,
            financial_entry_id: fId,
            match_type: "manual",
            group_id: groupId
          });
        });
      });
      const { error } = await supabase.from("reconciliation_matches").insert(payload);
      if (error) throw error;
      showSuccess("Itens conciliados manualmente!");
      setSelectedBankIds([]);
      setSelectedFinIds([]);
      fetchData();
    } catch (error: any) {
      showError("Erro: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoReconcile = async () => {
    if (!user) return;
    setIsProcessing(true);
    const unBank = filteredBank;
    const unFin = filteredFin;
    const newMatches: any[] = [];
    const usedFin = new Set<string>();
    const valTol = Number(rules.value_tolerance || 0);
    const dateTol = Number(rules.date_tolerance_days || 0);

    unBank.forEach(b => {
      const bDate = new Date(b.date);
      const match = unFin.find(f => {
        if (usedFin.has(f.id)) return false;
        const fDate = new Date(f.date);
        const diffDays = Math.abs((bDate.getTime() - fDate.getTime()) / (1000 * 3600 * 24));
        const diffAmount = Math.abs(Number(b.amount) - Number(f.amount));
        return diffDays <= dateTol && diffAmount <= valTol;
      });
      if (match) {
        newMatches.push({
          user_id: user.id,
          bank_statement_id: b.id,
          financial_entry_id: match.id,
          match_type: "exact",
          group_id: window.crypto.randomUUID()
        });
        usedFin.add(match.id);
      }
    });

    if (newMatches.length === 0) showError("Nenhuma correspondência exata encontrada.");
    else {
      const { error } = await supabase.from("reconciliation_matches").insert(newMatches);
      if (error) showError(error.message);
      else showSuccess(`${newMatches.length} pares encontrados!`);
      fetchData();
    }
    setIsProcessing(false);
  };

  const extractPlate = (text: string) => {
    // Regex para placa Mercosul ou Antiga: 3 letras, 1 número, 1 letra/número, 2 números
    const match = text.match(/[A-Z]{3}-?\d[A-Z\d]\d{2}/i);
    return match ? match[0].toUpperCase().replace('-', '') : null;
  };

  const handleAutoNtoOneReconcile = async () => {
    if (!user) return;
    setIsProcessing(true);

    const unBank = filteredBank;
    const unFin = filteredFin;
    const newMatches: any[] = [];
    const usedFinIds = new Set<string>();

    // 1. Agrupar itens do banco por placa
    const bankByPlate: Record<string, Entry[]> = {};
    unBank.forEach(b => {
      const plate = extractPlate(b.description);
      if (plate) {
        if (!bankByPlate[plate]) bankByPlate[plate] = [];
        bankByPlate[plate].push(b);
      }
    });

    // 2. Para cada placa, somar e buscar no sistema
    for (const plate in bankByPlate) {
      const entries = bankByPlate[plate];
      const totalBankCents = entries.reduce((acc, curr) => acc + Math.round(curr.amount * 100), 0);

      const match = unFin.find(f => {
        if (usedFinIds.has(f.id)) return false;
        const fPlate = f.sub_group ? extractPlate(f.sub_group) : null;
        if (!fPlate || fPlate !== plate) return false;
        return Math.round(f.amount * 100) === totalBankCents;
      });

      if (match) {
        const groupId = window.crypto.randomUUID();
        entries.forEach(b => {
          newMatches.push({
            user_id: user.id,
            bank_statement_id: b.id,
            financial_entry_id: match.id,
            match_type: "n_to_one",
            group_id: groupId
          });
        });
        usedFinIds.add(match.id);
      }
    }

    if (newMatches.length === 0) showError("Nenhum agrupamento por placa encontrado.");
    else {
      const { error } = await supabase.from("reconciliation_matches").insert(newMatches);
      if (error) showError(error.message);
      else showSuccess("Conciliação N:1 (Placas) concluída!");
      fetchData();
    }
    setIsProcessing(false);
  };

  const handleAutoGroupReconcile = async () => {
    if (!user) return;
    setIsProcessing(true);
    const unBank = filteredBank;
    const unFin = filteredFin;
    const newMatches: any[] = [];
    const usedFinIds = new Set<string>();
    const finByDate: Record<string, Entry[]> = {};
    unFin.forEach(f => {
      if (!finByDate[f.date]) finByDate[f.date] = [];
      finByDate[f.date].push(f);
    });

    for (const b of unBank) {
      const targetAbs = Math.round(Math.abs(b.amount) * 100);
      const isBankDebit = b.amount < 0;
      const candidates = (finByDate[b.date] || [])
        .filter(f => !usedFinIds.has(f.id))
        .filter(f => (isBankDebit ? f.amount < 0 : f.amount > 0));
      
      if (candidates.length < 2) continue;
      const findCombination = (remaining: Entry[], target: number, partial: Entry[] = []): Entry[] | null => {
        const currentSum = partial.reduce((acc, curr) => acc + Math.round(Math.abs(curr.amount) * 100), 0);
        if (currentSum === target && partial.length >= 2) return partial;
        if (currentSum > target) return null;
        for (let i = 0; i < remaining.length; i++) {
          const result = findCombination(remaining.slice(i + 1), target, [...partial, remaining[i]]);
          if (result) return result;
        }
        return null;
      };
      const combination = findCombination(candidates.slice(0, 20), targetAbs);
      if (combination) {
        const groupId = window.crypto.randomUUID();
        combination.forEach(f => {
          newMatches.push({
            user_id: user.id,
            bank_statement_id: b.id,
            financial_entry_id: f.id,
            match_type: "group_sum",
            group_id: groupId
          });
          usedFinIds.add(f.id);
        });
      }
    }
    if (newMatches.length === 0) showError("Nenhum agrupamento por soma encontrado.");
    else {
      const { error } = await supabase.from("reconciliation_matches").insert(newMatches);
      if (error) showError(error.message);
      else showSuccess("Agrupamentos inteligentes realizados!");
      fetchData();
    }
    setIsProcessing(false);
  };

  const handleUnmatch = async (id: string) => {
    const { error } = await supabase.from("reconciliation_matches").delete().eq("id", id);
    if (error) showError("Erro ao desfazer.");
    else {
      showSuccess("Desfeito.");
      fetchData();
    }
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const formatDateBR = (d: string) => {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  const bankTotal = selectedBankIds.reduce((acc, id) => acc + (bankEntries.find(e => e.id === id)?.amount || 0), 0);
  const finTotal = selectedFinIds.reduce((acc, id) => acc + (finEntries.find(e => e.id === id)?.amount || 0), 0);
  const difference = Math.abs(bankTotal - finTotal);

  if (loading) return <Layout><div className="flex h-full items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div></Layout>;

  if (isAllClear) {
    return (
      <Layout>
        <div className="h-[70vh] flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="relative">
            <div className="absolute -inset-4 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
            <div className="h-32 w-32 bg-emerald-500 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl relative">
              <PartyPopper size={64} />
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-5xl font-black text-primary tracking-tight">Tudo em ordem!</h1>
            <p className="text-xl text-muted-foreground max-w-md mx-auto">Você não possui nenhuma pendência de conciliação no momento.</p>
          </div>
          <Button size="lg" onClick={() => navigate("/")} className="h-16 px-10 text-xl font-black rounded-2xl shadow-xl hover:scale-105 transition-all bg-primary"><LayoutDashboard className="mr-3 h-6 w-6" /> Ir para o Dashboard</Button>
          <Button variant="ghost" onClick={fetchData} className="text-muted-foreground"><RefreshCw className="mr-2 h-4 w-4" /> Recarregar dados</Button>
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
            <p className="text-muted-foreground italic">Agrupe múltiplos itens ou use as automações inteligentes.</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Button onClick={fetchData} variant="outline" className="rounded-xl"><RefreshCw className="h-4 w-4 mr-2" /> Atualizar</Button>
            <Button onClick={handleAutoNtoOneReconcile} disabled={isProcessing} variant="outline" className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 rounded-xl">
              {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : <Car className="h-4 w-4 mr-2" />} N:1 (Placas)
            </Button>
            <Button onClick={handleAutoGroupReconcile} disabled={isProcessing} variant="outline" className="border-indigo-600 text-indigo-600 hover:bg-indigo-50 rounded-xl">
              {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : <Layers className="h-4 w-4 mr-2" />} Auto (1:N)
            </Button>
            <Button onClick={handleAutoReconcile} disabled={isProcessing} className="bg-indigo-600 rounded-xl">
              {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : <Zap className="h-4 w-4 mr-2" />} Auto (1:1)
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
            <div className="bg-blue-600 p-6 text-white">
              <div className="flex justify-between items-center mb-4">
                <CardTitle className="text-xl">Banco</CardTitle>
                <Badge variant="secondary" className="bg-white/20 text-white">{selectedBankIds.length} selecionados</Badge>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
                <Input placeholder="Filtrar descrição..." className="bg-white/10 border-none text-white placeholder:text-white/50 pl-10 h-10" value={searchTermBank} onChange={e => setSearchTermBank(e.target.value)} />
              </div>
            </div>
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredBank.filter(e => e.description.toLowerCase().includes(searchTermBank.toLowerCase())).map(e => (
                    <TableRow key={e.id} className={cn("cursor-pointer", selectedBankIds.includes(e.id) && "bg-blue-50")} onClick={() => toggleBank(e.id)}>
                      <TableCell onClick={ev => ev.stopPropagation()}><Checkbox checked={selectedBankIds.includes(e.id)} onCheckedChange={() => toggleBank(e.id)} /></TableCell>
                      <TableCell className="text-xs">{formatDateBR(e.date)}</TableCell>
                      <TableCell className="font-medium text-slate-700 max-w-[200px] truncate">{e.description}</TableCell>
                      <TableCell className="text-right font-bold text-blue-600">{formatCurrency(e.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
            <div className="bg-emerald-600 p-6 text-white">
              <div className="flex justify-between items-center mb-4">
                <CardTitle className="text-xl">Sistema</CardTitle>
                <Badge variant="secondary" className="bg-white/20 text-white">{selectedFinIds.length} selecionados</Badge>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
                <Input placeholder="Filtrar histórico..." className="bg-white/10 border-none text-white placeholder:text-white/50 pl-10 h-10" value={searchTermFin} onChange={e => setSearchTermFin(e.target.value)} />
              </div>
            </div>
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Data</TableHead><TableHead>Histórico</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredFin.filter(e => e.description.toLowerCase().includes(searchTermFin.toLowerCase())).map(e => (
                    <TableRow key={e.id} className={cn("cursor-pointer", selectedFinIds.includes(e.id) && "bg-emerald-50")} onClick={() => toggleFin(e.id)}>
                      <TableCell onClick={ev => ev.stopPropagation()}><Checkbox checked={selectedFinIds.includes(e.id)} onCheckedChange={() => toggleFin(e.id)} /></TableCell>
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
            <div><p className="text-xs font-bold text-muted-foreground uppercase">Soma Banco</p><p className="text-xl font-black text-blue-600">{formatCurrency(bankTotal)}</p></div>
            <div><p className="text-xs font-bold text-muted-foreground uppercase">Soma Sistema</p><p className="text-xl font-black text-emerald-600">{formatCurrency(finTotal)}</p></div>
            <div><p className="text-xs font-bold text-muted-foreground uppercase">Diferença</p><p className={cn("text-xl font-black", difference < 0.01 ? "text-emerald-500" : "text-destructive")}>{formatCurrency(bankTotal - finTotal)}</p></div>
          </div>
          <Button size="lg" className="rounded-2xl px-12 h-16 text-lg font-black shadow-xl bg-primary hover:scale-105 transition-all" disabled={selectedBankIds.length === 0 || selectedFinIds.length === 0 || isProcessing} onClick={handleManualMatch}>
            <ArrowRightLeft className="mr-3 h-6 w-6" /> Conciliar Lote Manual
          </Button>
        </div>

        <Tabs defaultValue="conciliados" className="w-full">
          <TabsList className="bg-slate-100 rounded-xl p-1">
            <TabsTrigger value="conciliados" className="rounded-lg px-6 font-bold">Conciliados ({matches.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="conciliados">
            <Card className="border-none shadow-md rounded-2xl overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-slate-50"><TableRow><TableHead>Banco</TableHead><TableHead>Sistema</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
                <TableBody>
                  {matches.map(m => {
                    const b = bankEntries.find(x => x.id === m.bank_statement_id);
                    const f = finEntries.find(x => x.id === m.financial_entry_id);
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="font-bold text-xs">{b?.description}</div>
                          <div className="text-[10px] text-blue-600">{b ? formatDateBR(b.date) : ''} | {formatCurrency(b?.amount || 0)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-xs">{f?.description}</div>
                          <div className="text-[10px] text-emerald-600">{f ? formatDateBR(f.date) : ''} | {formatCurrency(f?.amount || 0)}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px] uppercase", m.match_type === "n_to_one" ? "border-emerald-500 text-emerald-600 bg-emerald-50" : m.match_type === "group_sum" ? "border-indigo-500 text-indigo-600 bg-indigo-50" : "")}>
                            {m.match_type === "n_to_one" ? "N:1 Placas" : m.match_type === "group_sum" ? "Agrupamento" : m.match_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleUnmatch(m.id)}><Trash2 size={14} /></Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Reconciliation;