
"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Home, 
  MessageSquare, 
  ShieldCheck,
  RefreshCcw
} from "lucide-react";
import { createVagondysClient } from "@/lib/supabase/client";

interface MessagerieLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout spécifique pour la section Messagerie
 * Ajoute une navigation contextuelle et un en-tête commun
 * 
 * ✅ CORRECTION : Lien Accueil redirige vers la page d'accueil publique (/)
 * plutôt que vers l'espace joueur (réservé aux athlètes)
 * 
 * ✅ AJOUT : Déconnexion lors du clic sur "Accueil" avant redirection
 */
export default function MessagerieLayout({ children }: MessagerieLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogoutAndGoHome = async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    try {
      const supabase = createVagondysClient();
      await supabase.auth.signOut();
      router.push("/");
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
      // En cas d'erreur, on redirige quand même vers l'accueil
      router.push("/");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      
      {/* Navigation contextuelle (fil d’Ariane) */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-black/90 backdrop-blur-md border-b border-zinc-900">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Fil d’Ariane */}
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
              {/* ✅ REMPLACEMENT : Link par un bouton avec déconnexion */}
              <button
                onClick={handleLogoutAndGoHome}
                disabled={isLoggingOut}
                className="flex items-center gap-1 text-zinc-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Se déconnecter et retourner à l'accueil"
              >
                {isLoggingOut ? (
                  <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Home className="w-3.5 h-3.5" />
                )}
                {isLoggingOut ? "Déconnexion..." : "Accueil"}
              </button>
              <span className="text-zinc-700">/</span>
              <Link 
                href="/messagerie" 
                className="flex items-center gap-1 text-red-600 hover:text-red-500 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Messagerie
              </Link>
              {pathname !== "/messagerie" && (
                <>
                  <span className="text-zinc-700">/</span>
                  <span className="text-zinc-400">Conversation</span>
                </>
              )}
            </div>

            {/* Indicateur de sécurité */}
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
              <span className="text-[7px] text-green-500 uppercase tracking-wider">
                Chiffré
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="relative z-30">
        {children}
      </div>

      {/* Footer minimal */}
      <footer className="border-t border-zinc-900 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-[7px] text-zinc-700 uppercase tracking-wider">
            VAGONDYS — Messagerie sécurisée — Tous les échanges sont archivés
          </p>
        </div>
      </footer>
    </div>
  );
}
