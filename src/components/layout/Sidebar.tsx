"use client";

import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Home, Upload, Settings, CheckCircle, FileText, LogOut, User, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";

const navItems = [
  { name: "Dashboard", icon: Home, path: "/" },
  { name: "Importar Dados", icon: Upload, path: "/import" },
  { name: "Painel de Regras", icon: Settings, path: "/rules" },
  { name: "Conciliação", icon: CheckCircle, path: "/reconciliation" },
  { name: "Relatórios", icon: FileText, path: "/reports" },
];

interface SidebarProps {
  isMobile?: boolean;
  onAction?: () => void;
}

const Sidebar = ({ isMobile, onAction }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSession();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showError("Erro ao fazer logout.");
    } else {
      if (onAction) onAction();
      navigate("/login");
    }
  };

  const content = (
    <div className={cn(
      "flex flex-col h-full",
      isMobile ? "p-4" : "p-6"
    )}>
      {!isMobile && (
        <div className="mb-10 px-2">
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center">
              <div className="h-4 w-4 bg-sidebar rounded-sm" />
            </div>
            CONCILIA
          </h2>
        </div>
      )}

      <ScrollArea className="flex-grow -mx-2 px-2">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.name} to={item.path} onClick={onAction}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-base font-medium py-6 px-4 rounded-xl transition-all duration-200 group mb-1",
                    isActive 
                      ? "bg-white/15 text-white shadow-sm" 
                      : "text-sidebar-foreground/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <item.icon className={cn(
                    "mr-3 h-5 w-5 transition-transform group-hover:scale-110",
                    isActive ? "text-white" : "text-sidebar-foreground/50 group-hover:text-white"
                  )} />
                  {item.name}
                </Button>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="mt-auto pt-6 border-t border-white/10">
        <Link to="/profile" onClick={onAction} className="block mb-4">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors group">
            <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-white ring-2 ring-white/5 group-hover:bg-white/20">
              <UserCircle size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">Meu Perfil</p>
              <p className="text-xs text-white/50 truncate">Configurações</p>
            </div>
          </div>
        </Link>

        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start text-sm font-semibold py-5 px-4 rounded-xl text-white/70 hover:bg-destructive/20 hover:text-white transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sair da Conta
        </Button>
      </div>
    </div>
  );

  if (isMobile) return content;

  return (
    <aside className="h-screen sticky top-0 w-72 bg-sidebar text-sidebar-foreground flex flex-col rounded-r-3xl shadow-2xl border-r border-sidebar-border/30 flex-shrink-0">
      {content}
    </aside>
  );
};

export default Sidebar;