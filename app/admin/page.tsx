
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";

/**
 * Page d'accueil Admin (Master)
 * URL : /admin
 * 
 * ✅ Redirection automatique vers /admin/login
 * Cette page sert de point d'entrée pour l'espace Admin.
 * Les utilisateurs non authentifiés sont redirigés vers la page de connexion.
 */
export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirection automatique vers la page de connexion
    router.push("/admin/login");
  }, [router]);

  // Affichage d'un écran de chargement pendant la redirection
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <RefreshCcw className="w-6 h-6 text-red-600 animate-spin" />
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
          Chargement...
        </p>
      </div>
    </div>
  );
}
