"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
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

  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedFinId, setSelectedFinId] = useState<string | null>(null);
  
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
      showSuccess("Conciliação realizada!");
      setSelectedBankId(null);
      setSelectedFinId(null);
      fetchData();
    } catch (error: any) {
      showError("Erro ao conciliar: " + error.message);
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

    // 1. Tentar conciliação 1:1 exata primeiro
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
          match_type: "exact"
        });
        usedFinIds.add(match.id);
      }
    });

    // 2. Lógica de Agrupamento: Soma de NFs para o mesmo lançamento bancário
    // Só tentamos nos itens bancários que ainda não foram casados no passo 1
    const stillUnmatchedBank = unmatchedBank.filter(b => !newMatches.some(m => m.bank_statement_id === b.id));
    
    stillUnmatchedBank.forEach(b => {
      const bDate = new Date(b.date);
      const bDesc = b.description.toLowerCase();

      // Encontrar todos os lançamentos internos da mesma data que não foram usados
      const candidates = unmatchedFin.filter(f => {
        if (usedFinIds.has(f.id)) return false;
        const fDate = new Date(f.date);
        return fDate.getTime() === bDate.getTime();
      });

      // Agrupar candidatos pelo fornecedor (antes do '|')
      const groups: Record<string, Entry[]> = {};
      candidates.forEach(f => {
        const vendor = f.description.split('|')[0].trim().toLowerCase();
        if (!groups[vendor]) groups[vendor] = [];
        groups[vendor].push(f);
      });

      // Verificar se a soma de algum grupo bate com o valor do extrato
      for (const vendor in groups) {
        const groupItems = groups[vendor];
        const sumAmount = groupItems.reduce((acc, curr) => acc + Number(curr.amount), 0);
        
        // Se o nome do fornecedor aparece na descrição do banco e o valor bate
        if (bDesc.includes(vendor) || vendor.includes(bDesc)) {
          if (Math.abs(sumAmount - Number(b.amount)) <= valTol) {
            // Conciliar cada item do grupo com este lançamento bancário
            groupItems.forEach(item => {
              newMatches.push({
                user_id: user.id,
                bank_statement_id: b.id,
                financial_entry_id: item.id,
                match_type: "group_sum"
              });
              usedFinIds.add(item.id);
            });
            break; // Já casamos este item bancário
          }
        }
      }
    });

    if (newMatches.length === 0) {
      showError("Nenhum novo batimento encontrado.");
      setIsProcessing(false);
      return;
    }

    try {
      const { error } = await supabase.from("reconciliation_matches").insert(newMatches);
      if (error) throw error;
      showSuccess(`${newMatches.length} conciliações realizadas!`);
      fetchData();
    } catch (error: any) {
      showError("Erro na conciliação automática: " + error.message);
    } finally {
      setIsProcessing(false);
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

  const totalUnmatchedBank = filteredUnmatchedBank.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalUnmatchedFin = filteredUnmatchedFin.reduce((acc, curr) => acc + Number(curr.amount), 0);

  return (
    <Layout>
      <div className="space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary tracking-tight">Conciliação Ativa</h1>
            <p className="text-muted-foreground">Motor inteligente com suporte a agrupamento de NFs por fornecedor.</p>
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
              disabled={isProcessing || (filteredUnmatchedBank.length === 0 || filteredUnmatchedFin.length === 0)}
            >
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
              Executar Auto-Conciliação
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-none shadow-xl overflow-hidden rounded-[2rem] bg-white">
            <CardHeader className="bg-blue-600 text-white p-6">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <div className="h-2 w-2 bg-white rounded-full animate-pulse" />
                  Extrato Bancário
                </CardTitle>
                <Badge variant="secondary" className="bg-white/20 text-white border-none rounded-lg px-3 py-1">
                  {filteredUnmatchedBank.length} pendentes
                </Badge>
              </div>
              <p className="text-blue-100 text-sm font-medium">Total pendente: {formatCurrency(totalUnmatchedBank)}</p>
              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                <Input 
                  placeholder="Buscar na descrição..." 
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 pl-10 rounded-xl"
                  value={searchTermBank}
                  onChange={(e) => setSearchTermBank(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[450px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-24 pl-6">Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right pr-6">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnmatchedBank.map((entry) => (
                      <TableRow 
                        key={entry.id} 
                        className={`cursor-pointer transition-all border-none ${selectedBankId === entry.id ? 'bg-blue-50 ring-2 ring-inset ring-blue-600' : 'hover:bg-slate-50'}`}
                        onClick={() => setSelectedBankId(selectedBankId === entry.id ? null : entry.id)}
                      >
                        <TableCell className="text-sm pl-6">{new Date(entry.date).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="font-semibold text-slate-700">{entry.description}</TableCell>
                        <TableCell className="text-right font-black text-blue-600 pr-6">{formatCurrency(entry.amount)}</TableCell>
                      </TableRow>
                    ))}
                    {filteredUnmatchedBank.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center py-12 text-muted-foreground italic">Nenhuma transação pendente encontrada.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl overflow-hidden rounded-[2rem] bg-white">
            <CardHeader className="bg-emerald-600 text-white p-6">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <div className="h-2 w-2 bg-white rounded-full animate-pulse" />
                  Lançamentos Internos
                </CardTitle>
                <Badge variant="secondary" className="bg-white/20 text-white border-none rounded-lg px-3 py-1">
                  {filteredUnmatchedFin.length} pendentes
                </Badge>
              </div>
              <p className="text-emerald-100 text-sm font-medium">Total pendente: {formatCurrency(totalUnmatchedFin)}</p>
              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                <Input 
                  placeholder="Buscar na descrição..." 
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 pl-10 rounded-xl"
                  value={searchTermFin}
                  onChange={(e) => setSearchTermFin(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[450px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-24 pl-6">Data</TableHead>
                      <TableHead>Descrição (Fornecedor | Detalhe)</TableHead>
                      <TableHead className="text-right pr-6">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnmatchedFin.map((entry) => (
                      <TableRow 
                        key={entry.id} 
                        className={`cursor-pointer transition-all border-none ${selectedFinId === entry.id ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-600' : 'hover:bg-slate-50'}`}
                        onClick={() => setSelectedFinId(selectedFinId === entry.id ? null : entry.id)}
                      >
                        <TableCell className="text-sm pl-6">{new Date(entry.date).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="font-semibold text-slate-700">
                          {entry.description}
                        </TableCell>
                        <TableCell className="text-right font-black text-emerald-600 pr-6">{formatCurrency(entry.amount)}</TableCell>
                      </TableRow>
                    ))}
                    {filteredUnmatchedFin.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center py-12 text-muted-foreground italic">Tudo limpo por aqui.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center py-6">
          <Button 
            size="lg" 
            className="px-12 py-8 text-xl font-black rounded-3xl shadow-2xl transition-all active:scale-95 bg-primary hover:scale-105 disabled:opacity-50"
            disabled={!selectedBankId || !selectedFinId}
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
                            <div className="text-xs font-black text-blue-600 mt-1">{formatCurrency(b?.amount || 0)} • {new Date(b?.date || "").toLocaleDateString('pt-BR')}</div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="font-bold text-slate-800">{f?.description || "N/A"}</div>
                            <div className="text-xs font-black text-emerald-600 mt-1">{formatCurrency(f?.amount || 0)} • {new Date(f?.date || "").toLocaleDateString('pt-BR')}</div>
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge variant={m.match_type === 'manual' ? 'outline' : 'secondary'} className="rounded-lg font-bold">
                              {m.match_type === 'manual' ? 'Manual' : (m.match_type === 'group_sum' ? 'Agrupado' : 'Automático')}
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