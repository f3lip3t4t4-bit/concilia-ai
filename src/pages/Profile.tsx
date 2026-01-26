"use client";

import React, { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User, Mail, Save, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";

const Profile = () => {
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", user.id)
          .single();

        if (error && error.code !== "PGRST116") throw error;
        if (data) {
          setProfile({
            first_name: data.first_name || "",
            last_name: data.last_name || "",
          });
        }
      } catch (error: any) {
        showError("Erro ao carregar perfil: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      showSuccess("Perfil atualizado com sucesso!");
    } catch (error: any) {
      showError("Erro ao salvar perfil: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
      <div className="max-w-2xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-primary">Meu Perfil</h1>
          <p className="text-muted-foreground">Gerencie suas informações de conta.</p>
        </header>

        <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="bg-slate-50 border-b border-slate-100 p-8">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg">
                <User size={40} />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">{user?.email}</CardTitle>
                <CardDescription className="flex items-center gap-1 mt-1">
                  <Mail size={14} /> Membro desde {new Date(user?.created_at || "").toLocaleDateString()}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="first_name">Nome</Label>
                <Input
                  id="first_name"
                  value={profile.first_name}
                  onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                  placeholder="Seu nome"
                  className="rounded-xl h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Sobrenome</Label>
                <Input
                  id="last_name"
                  value={profile.last_name}
                  onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                  placeholder="Seu sobrenome"
                  className="rounded-xl h-12"
                />
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full md:w-auto px-8 py-6 rounded-xl text-lg font-bold shadow-lg transition-all"
            >
              {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              Salvar Alterações
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Profile;