"use client";

import Link from "next/link";
import { ChevronLeft, Search } from "lucide-react";

interface InterfaceHeaderProps {
  userEmail: string | null;
  searchRef: string;
  setSearchRef: (val: string) => void;
  isSearchingExternal: boolean;
  onExternalSearch: () => void;
  view: "pending" | "archived";
  setView: (view: "pending" | "archived") => void;
}

/**
 * COMPOSANT : InterfaceHeader
 * Isole la partie supérieure : Titre, Identité Agent, Recherche et Onglets.
 * Source : Lignes 260-303 du fichier page.tsx original.
 */
export default function InterfaceHeader({
  userEmail,
  searchRef,
  setSearchRef,
  isSearchingExternal,
  onExternalSearch,
  view,
  setView
}: InterfaceHeaderProps) {
  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-900 pb-8">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Link href="/staff" className="text-zinc-500 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-black uppercase tracking-[0.2em] italic text-white">
            Unité <span className="text-red-600">Communication</span>
          </h1>
        </div>
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
          Agent : {userEmail || "Identification..."}
        </p>
      </div>

      <div className="flex items-center gap-4">
        {/* RECHERCHE COFFRE-FORT */}
        <div className="hidden lg:flex items-center bg-black border border-white/5 rounded-lg px-3 py-1 gap-2 focus-within:border-red-600/50 transition-all">
          <Search className="w-3 h-3 text-zinc-600" />
          <input 
            type="text" 
            placeholder="RECHERCHE COFFRE-FORT..." 
            value={searchRef}
            onChange={(e) => setSearchRef(e.target.value)}
            className="bg-transparent text-[9px] font-black uppercase tracking-widest outline-none text-white w-40 placeholder:text-zinc-800"
          />
          <button 
            onClick={onExternalSearch}
            disabled={isSearchingExternal}
            className="text-[9px] font-black text-red-600 hover:text-white transition-colors"
          >
            {isSearchingExternal ? "..." : "OK"}
          </button>
        </div>

        {/* NAVIGATION ONGLETS */}
        <div className="flex bg-neutral-900/50 p-1 rounded-lg border border-white/5">
          <button 
            onClick={() => setView("pending")}
            className={`px-6 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
              view === "pending" 
                ? "bg-red-600 text-white shadow-lg shadow-red-900/20" 
                : "text-zinc-500 hover:text-white"
            }`}
          >
            En attente
          </button>
          <button 
            onClick={() => setView("archived")}
            className={`px-6 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
              view === "archived" 
                ? "bg-zinc-800 text-white" 
                : "text-zinc-500 hover:text-white"
            }`}
          >
            Archives
          </button>
        </div>
      </div>
    </header>
  );
}
