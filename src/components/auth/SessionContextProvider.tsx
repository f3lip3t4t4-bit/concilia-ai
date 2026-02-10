"use client";

import React, { useState, useEffect, createContext, useContext, useCallback } from "react";
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

  const fetchSubscription = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from("subscriptions")
        .select("status, paid_until")
        .eq("user_id", userId)
        .maybeSingle();
      setSubscription(data);
    } catch (err) {
      console.error("Erro ao buscar assinatura:", err);
    }
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, role")
        .eq("id", userId)
        .maybeSingle();
      setProfile(data);
    } catch (err) {
      console.error("Erro ao buscar perfil:", err);
    }
  }, []);

  const loadUserData = useCallback(async (currentUser: User) => {
    await Promise.all([
      fetchSubscription(currentUser.id),
      fetchProfile(currentUser.id)
    ]);
  }, [fetchSubscription, fetchProfile]);

  useEffect(() => {
    // 1. Verificar sessão inicial
    const init = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          await loadUserData(initialSession.user);
        }
      } catch (error) {
        console.error("Erro ao inicializar sessão:", error);
      } finally {
        setIsLoading(false);
      }
    };

    init();

    // 2. Ouvir mudanças de autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user || null);

        if (event === "SIGNED_IN" && currentSession?.user) {
          await loadUserData(currentSession.user);
          setIsLoading(false);
        } else if (event === "SIGNED_OUT") {
          setSubscription(null);
          setProfile(null);
          setIsLoading(false);
          navigate("/login");
        } else {
          setIsLoading(false);
        }
      }
    );

    return () => authListener.subscription.unsubscribe();
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