"use client";

import React, { useState, useEffect, createContext, useContext } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useNavigate, useLocation } from "react-router-dom";
import { showSuccess, showError } from "@/utils/toast";

interface Subscription {
  status: string;
  paid_until: string;
}

interface SessionContextType {
  session: Session | null;
  user: User | null;
  subscription: Subscription | null;
  isLoading: boolean;
  refreshSubscription: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchSubscription = async (userId: string) => {
    const { data } = await supabase
      .from("subscriptions")
      .select("status, paid_until")
      .eq("user_id", userId)
      .maybeSingle();
    setSubscription(data);
  };

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user || null);
        
        if (currentSession?.user) {
          await fetchSubscription(currentSession.user.id);
        } else {
          setSubscription(null);
        }
        
        setIsLoading(false);

        if (event === "SIGNED_IN") {
          showSuccess("Login realizado com sucesso!");
          // Só redireciona se estiver na tela de login
          if (location.pathname === "/login") {
            navigate("/", { replace: true });
          }
        } else if (event === "SIGNED_OUT") {
          navigate("/login", { replace: true });
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user || null);
      if (session?.user) fetchSubscription(session.user.id);
      setIsLoading(false);
    });

    return () => authListener.subscription.unsubscribe();
  }, [navigate, location.pathname]);

  return (
    <SessionContext.Provider value={{ 
      session, user, subscription, isLoading, 
      refreshSubscription: async () => user && await fetchSubscription(user.id) 
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