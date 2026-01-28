import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import ImportData from "./pages/ImportData";
import RulesPanel from "./pages/RulesPanel";
import Reconciliation from "./pages/Reconciliation";
import Reports from "./pages/Reports";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import Checkout from "./pages/Checkout";
import { SessionContextProvider, useSession } from "./components/auth/SessionContextProvider";
import { SubscriptionGuard } from "./components/auth/SubscriptionGuard";
import { Loader2 } from "lucide-react";
import React from "react";

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, isLoading } = useSession();

  // Log de diagnóstico para ajudar a entender por que não abre no localhost
  React.useEffect(() => {
    console.log("[ProtectedRoute] Estado:", { isLoading, hasSession: !!session, path: window.location.pathname });
  }, [isLoading, session]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <SubscriptionGuard>{children}</SubscriptionGuard>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      {/* Habilitando flags do v7 para remover avisos e melhorar performance */}
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SessionContextProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/import" element={<ProtectedRoute><ImportData /></ProtectedRoute>} />
            <Route path="/rules" element={<ProtectedRoute><RulesPanel /></ProtectedRoute>} />
            <Route path="/reconciliation" element={<ProtectedRoute><Reconciliation /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;