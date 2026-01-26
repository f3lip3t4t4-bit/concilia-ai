"use client";

import { createClient } from "@supabase/supabase-js";

// Substitua estes valores pelas suas credenciais Supabase
// Você pode encontrá-los no seu painel Supabase:
// Configurações do Projeto -> API
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("As variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem ser definidas.");
  // Em um ambiente de produção, você pode querer lançar um erro ou lidar com isso de forma mais robusta.
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);