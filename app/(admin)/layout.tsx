
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Settings,
  LogOut,
  ShieldCheck,
  MessageSquare,
  Database
} from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout spécifique pour l’administration (admin.vagondys.com)
 * Inspiré du layout staff mais adapté pour l’admin global
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();

  const menuItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/cities", label: "Villes", icon: Building2 },
    { href: "/admin/staff", label: "Staff", icon: Users },
    { href: "/admin/messagerie-requests", label: "Demandes Messagerie", icon: MessageSquare },
    { href: "/admin/logs", label: "Logs système", icon: Database },
    { href: "/admin/settings", label: "Configuration", icon: Settings },
  ];

  const handleLogout = async () => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      await supabase.auth.signOut();
      window.location.href = "/admin/login";
    } catch (err) {
      console.error("Erreur déconnexion:", err);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Navigation latérale fixe */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-zinc-950 border-r border-zinc-900 overflow-y-auto z-40">
        <div className="p-6 border-b border-zinc-900">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-red-600" />
            <div>
              <h1 className="text-sm font-black uppercase tracking-tighter">
                VAGONDYS
              </h1>
              <p className="text-[8px] text-red-600 uppercase tracking-widest">
                Administration
              </p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                  isActive
                    ? "bg-red-600/10 text-red-600 border-l-2 border-red-600"
                    : "text-zinc-500 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-900">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-[11px] font-black uppercase tracking-wider text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Contenu principal */}
      <main className="ml-64 min-h-screen">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
