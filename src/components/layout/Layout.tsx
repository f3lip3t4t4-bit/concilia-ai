"use client";

import React, { useState } from "react";
import Sidebar from "./Sidebar";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground flex-col md:flex-row">
      {/* Sidebar para Desktop */}
      {!isMobile && <Sidebar />}

      {/* Header para Mobile */}
      {isMobile && (
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-sidebar px-6 text-white shadow-sm">
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
            <div className="h-6 w-6 bg-white rounded flex items-center justify-center">
              <div className="h-3 w-3 bg-sidebar rounded-sm" />
            </div>
            CONCILIA
          </h2>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 border-none w-72 bg-sidebar overflow-hidden">
              <div className="h-full flex flex-col">
                <div className="p-6 flex justify-between items-center border-b border-white/10">
                  <h2 className="text-xl font-black tracking-tight text-white">CONCILIA</h2>
                  <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="text-white hover:bg-white/10">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <Sidebar isMobile onAction={() => setOpen(false)} />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </header>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 p-4 sm:p-6 lg:p-10 overflow-x-hidden">
          {children}
        </div>
        <MadeWithDyad />
      </main>
    </div>
  );
};

export default Layout;