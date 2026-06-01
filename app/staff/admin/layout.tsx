
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

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

  // Layout avec sidebar (100% dynamique)
  // NOTE: Le composant AdminSidebar sera ajouté dans le prochain fichier
  return (
    <div className="flex h-screen bg-black overflow-hidden">
      {/* Sidebar fixe à gauche - SERA AJOUTÉE */}
      <div className="w-64 bg-zinc-950 border-r border-zinc-800 shrink-0">
        {/* Placeholder pour AdminSidebar - À remplacer quand le composant sera créé */}
        <div className="p-4 text-zinc-500 text-[10px] uppercase tracking-widest">
          Menu Admin (bientôt disponible)
        </div>
      </div>
      
      {/* Contenu principal avec scroll */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
