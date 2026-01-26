"use client";

import React from "react";
import { Link } from "react-router-dom";
import { Home, Upload, Settings, CheckCircle, FileText, BarChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const navItems = [
  { name: "Dashboard", icon: Home, path: "/" },
  { name: "Importar Dados", icon: Upload, path: "/import" },
  { name: "Painel de Regras", icon: Settings, path: "/rules" },
  { name: "Conciliação", icon: CheckCircle, path: "/reconciliation" },
  { name: "Relatórios", icon: FileText, path: "/reports" }, // Adicionado o item de Relatórios
];

const Sidebar = () => {
  return (
    <aside className="h-full w-64 bg-sidebar-background text-sidebar-foreground p-4 flex flex-col rounded-r-xl shadow-lg">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-sidebar-primary-foreground">Conciliação Bancária</h2>
      </div>
      <ScrollArea className="flex-grow">
        <nav className="space-y-2">
          {navItems.map((item) => (
            <Link key={item.name} to={item.path}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start text-lg py-6 px-4 rounded-lg transition-all duration-200",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  "focus:bg-sidebar-accent focus:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="mr-3 h-6 w-6" />
                {item.name}
              </Button>
            </Link>
          ))}
        </nav>
      </ScrollArea>
      <div className="mt-auto p-4 text-center text-sm text-gray-500">
        © 2024 Dyad
      </div>
    </aside>
  );
};

export default Sidebar;