// Este arquivo é automaticamente gerado. Não o edite diretamente.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://klokjxcaeamgbfowmbqf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtsb2tqeGNhZWFtZ2Jmb3dtYnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzI0MjQsImV4cCI6MjA4NTAwODQyNH0.AVH8p7qzLFnuSDIQN7VS8LKxsr2_af5AhiUZzNd0lZg";

// Importe o cliente supabase assim:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);