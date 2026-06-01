
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  MessageSquare,
  FileText,
  Settings,
  LogOut,
  ShieldCheck,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  {
    title: "DASHBOARD",
    href: "/staff/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "VILLES",
    href: "/staff/admin/villes",
    icon: Building2,
  },
  {
    title: "STAFF",
    href: "/staff/admin/staff",
    icon: Users,
  },
  {
    title: "DEMANDES MESSAGERIE",
    href: "/staff/admin/messagerie",
    icon: MessageSquare,
  },
  {
    title: "LOGS SYSTÈME",
    href: "/staff/admin/logs",
    icon: FileText,
  },
  {
    title: "CONFIGURATION",
    href: "/staff/admin/configuration",
    icon: Settings,
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Vérification de l'authentification admin (temps réel)
  useEffect(() => {
    const checkAuth = () => {
      const auth = sessionStorage.getItem("admin_authenticated") === "true";
      setIsAuthenticated(auth);

      if (!auth && pathname !== "/staff/admin/verification") {
        router.push("/staff/admin/verification");
      }
    };

    checkAuth();

    // Écouteur pour détecter les changements de sessionStorage (multi-onglets)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "admin_authenticated") {
        const newAuth = e.newValue === "true";
        setIsAuthenticated(newAuth);
        if (!newAuth && pathname !== "/staff/admin/verification") {
          router.push("/staff/admin/verification");
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [router, pathname]);

  const handleLogout = () => {
    sessionStorage.removeItem("admin_authenticated");
    router.push("/staff/admin/verification");
  };

  // Page de vérification : pas de sidebar
  if (pathname === "/staff/admin/verification") {
    return <>{children}</>;
  }

  // En attente de vérification
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Non authentifié : redirection déjà en cours
  if (!isAuthenticated) {
    return null;
  }

  // Layout avec sidebar intégrée (plus d'import externe)
  return (
    <div className="flex h-screen bg-black overflow-hidden">
      
      {/* Sidebar fixe à gauche */}
      <aside className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col h-full shrink-0">
        
        {/* Logo / En-tête */}
        <div className="p-5 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xs font-black uppercase tracking-wider text-white">
                VAGONDYS
              </h1>
              <p className="text-[7px] text-red-600 uppercase tracking-widest">
                SUPER ADMIN
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                  ${isActive 
                    ? "bg-red-600/10 border border-red-600/20 text-red-500" 
                    : "text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent"
                  }
                `}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="text-[9px] font-black uppercase tracking-widest">
                  {item.title}
                </span>
                {isActive && (
                  <div className="ml-auto w-1 h-6 bg-red-600 rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Déconnexion */}
        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-zinc-600 hover:text-red-500 hover:bg-red-600/10 transition-all duration-200"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="text-[9px] font-black uppercase tracking-widest">
              DÉCONNEXION
            </span>
          </button>
          <p className="text-[6px] text-zinc-700 uppercase tracking-widest text-center mt-4">
            Session super admin
          </p>
        </div>
      </aside>
      
      {/* Contenu principal avec scroll */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
