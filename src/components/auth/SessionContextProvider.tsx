"use client";

import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

interface Subscription {
  status: string;
  paid_until: string;
}

interface Profile {
  first_name: string | null;
  last_name: string | null;
  role: string | null;
}

interface SessionContextType {
  session: Session | null;
  user: User | null;
  subscription: Subscription | null;
  profile: Profile | null;
  isLoading: boolean;
  refreshSubscription: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const mounted = useRef(true);

  const fetchSubscription = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status, paid_until")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (error) console.warn("Aviso ao buscar assinatura:", error.message);
      if (mounted.current) setSubscription(data);
    } catch (err) {
      console.error("Erro crítico ao buscar assinatura:", err);
    }
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, role")
        .eq("id", userId)
        .maybeSingle();
      
      if (error) console.warn("Aviso ao buscar perfil:", error.message);
      if (mounted.current) setProfile(data);
    } catch (err) {
      console.error("Erro crítico ao buscar perfil:", err);
    }
  }, []);

  const loadUserData = useCallback(async (currentUser: User) => {
    // Usamos Promise.allSettled para garantir que o fluxo continue mesmo se uma falhar
    await Promise.allSettled([
      fetchSubscription(currentUser.id),
      fetchProfile(currentUser.id)
    ]);
  }, [fetchSubscription, fetchProfile]);

  useEffect(() => {
    mounted.current = true;
    
    // Timeout de segurança: se em 5 segundos não carregar, forçamos o fim do loading
    const safetyTimeout = setTimeout(() => {
      if (mounted.current && isLoading) {
        console.warn("SessionContextProvider: Timeout de segurança atingido. Forçando fim do carregamento.");
        setIsLoading(false);
      }
    }, 5000);

    const init = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (initialSession && mounted.current) {
          setSession(initialSession);
          setUser(initialSession.user);
          await loadUserData(initialSession.user);
        }
      } catch (error) {
        console.error("Erro ao inicializar sessão:", error);
      } finally {
        if (mounted.current) {
          setIsLoading(false);
          clearTimeout(safetyTimeout);
        }
      }
    };

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted.current) return;

        setSession(currentSession);
        setUser(currentSession?.user || null);

        if (event === "SIGNED_IN" && currentSession?.user) {
          setIsLoading(true);
          await loadUserData(currentSession.user);
          setIsLoading(false);
        } else if (event === "SIGNED_OUT") {
          setSubscription(null);
          setProfile(null);
          setIsLoading(false);
          navigate("/login");
        } else if (event === "INITIAL_SESSION" && !currentSession) {
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted.current = false;
      authListener.subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, [loadUserData, navigate]);

  const refreshSubscription = async () => {
    if (user) await fetchSubscription(user.id);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <SessionContext.Provider value={{ 
      session, user, subscription, profile, isLoading, 
      refreshSubscription,
      refreshProfile
    }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) throw new Error("useSession must be used within a SessionContextProvider");
  return context;
};