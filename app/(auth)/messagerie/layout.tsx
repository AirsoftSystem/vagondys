
"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { 
  Home, 
  MessageSquare, 
  ShieldCheck
} from "lucide-react";

interface MessagerieLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout spécifique pour la section Messagerie
 * Ajoute une navigation contextuelle et un en-tête commun
 * 
 * ✅ CORRECTION : Lien Accueil redirige vers la page d'accueil publique (/)
 * plutôt que vers l'espace joueur (réservé aux athlètes)
 */
export default function MessagerieLayout({ children }: MessagerieLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      
      {/* Navigation contextuelle (fil d’Ariane) */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-black/90 backdrop-blur-md border-b border-zinc-900">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Fil d’Ariane */}
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
              <Link 
                href="/" 
                className="flex items-center gap-1 text-zinc-500 hover:text-white transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                Accueil
              </Link>
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
