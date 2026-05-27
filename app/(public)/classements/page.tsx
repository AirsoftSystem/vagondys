"use client";

import React from 'react';
import { Home, ArrowLeft, BarChart3, User } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import "@/app/Ranking.css";

export default function ClassementPage() {
  // Liste complète du Top 16 (2 réels + 14 simulés pour le visuel)
  const athletes = [
    { id: "spectre-01", name: "SPECTRE-01", score: "95", status: "EUS", avatar: null },
    { id: "cible-alpha", name: "CIBLE-ALPHA", score: "88", status: "EUS", avatar: null },
    { id: "vacant-3", name: "VACANT", score: "82", status: "EUS", avatar: null },
    { id: "vacant-4", name: "VACANT", score: "78", status: "EUS", avatar: null },
    { id: "vacant-5", name: "VACANT", score: "70", status: "EUS", avatar: null },
    { id: "vacant-6", name: "VACANT", score: "68", status: "EUS", avatar: null },
    { id: "vacant-7", name: "VACANT", score: "65", status: "EUS", avatar: null },
    { id: "vacant-8", name: "VACANT", score: "62", status: "EUS", avatar: null },
    // PARTIE GRISÉE (UMS)
    { id: "vacant-9", name: "VACANT", score: "58", status: "UMS", avatar: null },
    { id: "vacant-10", name: "VACANT", score: "55", status: "UMS", avatar: null },
    { id: "vacant-11", name: "VACANT", score: "52", status: "UMS", avatar: null },
    { id: "vacant-12", name: "VACANT", score: "48", status: "UMS", avatar: null },
    { id: "vacant-13", name: "VACANT", score: "45", status: "UMS", avatar: null },
    { id: "vacant-14", name: "VACANT", score: "40", status: "UMS", avatar: null },
    { id: "vacant-15", name: "VACANT", score: "35", status: "UMS", avatar: null },
    { id: "vacant-16", name: "VACANT", score: "20", status: "UMS", avatar: null },
  ];

  return (
    // Utilisation d'une div car le <main> est déjà géré par PublicLayout pour éviter la redondance
    <div className="min-h-screen bg-black text-white px-6 py-24 relative font-sans selection:bg-red-600">
      
      {/* NAVIGATION UP - Stabilisée en hauteur */}
      <nav className="absolute top-8 left-8 flex flex-col sm:flex-row gap-6 z-50 h-4">
        <Link href="/" className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.3em] h-4">
          <Home className="w-4 h-4 text-red-600" /> VAGONDYS
        </Link>
        <div className="hidden sm:block w-px h-4 bg-zinc-900" />
        <Link href="/joueurs" className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.3em] h-4">
          <ArrowLeft className="w-4 h-4" /> BIBLIOTHÈQUE
        </Link>
      </nav>

      <div className="max-w-6xl mx-auto">
        {/* HEADER - Min-height pour éviter le saut au rendu du texte outline */}
        <header className="mb-20 min-h-[180px]">
          <div className="flex items-center gap-4 mb-4 h-4">
            <div className="h-0.5 w-12 bg-red-600" />
            <span className="text-red-600 text-[10px] font-black uppercase tracking-[0.4em]">Global Unified Ranking</span>
          </div>
          <h1 className="text-7xl md:text-8xl font-black italic tracking-tighter leading-none uppercase">
            CLASSEMENT<br/>
            <span className="text-outline text-zinc-900 block mt-2">OFFICIEL</span>
          </h1>
        </header>

        {/* SECTION GRAPHIQUE TOP 16 COMPLET - Stabilisation du conteneur de graphique */}
        <section className="mb-24">
          <div className="flex justify-between items-end mb-8 border-b border-zinc-900 pb-4 h-10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-red-600" /> Analyse Dynamique Top 16 (EUS & UMS)
            </h3>
          </div>

          {/* Conteneur de graphique avec hauteur fixe pour éviter le CLS massif */}
          <div className="ranking-chart-container min-h-[400px]">
             {athletes.map((player, i) => (
               <Link 
                 key={i} 
                 href={player.id.startsWith("vacant") ? "#" : `/joueurs/${player.id}`}
                 className={`chart-bar group pb-2 ${player.id.startsWith("vacant") ? "cursor-default" : "cursor-pointer"}`}
                 data-height={player.score}
                 data-status={player.status}
               >
                 {/* AVATAR AU SURVOL - Espace réservé pour éviter le décalage */}
                 <div className="h-10 w-full flex justify-center items-end">
                    {!player.id.startsWith("vacant") && (
                      <div className="mb-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 duration-300">
                          <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/20 flex items-center justify-center overflow-hidden">
                            {player.avatar ? (
                              <Image src={player.avatar} alt={player.name} width={32} height={32} className="object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-white" />
                            )}
                          </div>
                      </div>
                    )}
                 </div>

                 {/* NOM VERTICAL */}
                 <div className="h-24 relative w-full flex justify-center">
                    <span className="vertical-text text-[8px] font-black uppercase tracking-tighter text-white/30 group-hover:text-white transition-colors rotate-180 absolute bottom-2">
                      {player.name}
                    </span>
                 </div>

                 {/* TOOLTIP SCORE SKEW */}
                 <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[9px] font-black px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none -skew-x-12">
                   {player.score}%
                 </div>
               </Link>
             ))}
          </div>
          
          {/* LÉGENDE STATIQUE */}
          <div className="flex flex-col sm:flex-row justify-between mt-6 text-[8px] font-black text-zinc-700 uppercase tracking-[0.3em] gap-4 min-h-[20px]">
            <span className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-red-600" /> ÉLITE ULTIMATE SUPREME (TOP 8 EUS)
            </span>
            <span className="flex items-center gap-2">
              ULTIMATE MASTER SUPREME (TOP 16 UMS) <div className="w-3 h-0.5 bg-zinc-800" />
            </span>
          </div>
        </section>

        {/* LIENS SAISONNIERS - Grille stable */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-px bg-zinc-900 border border-zinc-900 min-h-[200px]">
          <Link href="/classements/saison2025" className="bg-black p-12 hover:bg-zinc-900 transition-all group overflow-hidden relative block h-full">
            <span className="block text-[10px] font-black text-red-600 mb-2 italic tracking-widest uppercase h-3">Cycle Actif</span>
            <h4 className="text-4xl font-black italic uppercase text-white group-hover:translate-x-2 transition-transform">Saison 2025</h4>
          </Link>
          <Link href="/classements" className="bg-black p-12 hover:bg-zinc-900 transition-all group border-l border-zinc-900 overflow-hidden relative block h-full">
            <span className="block text-[10px] font-black text-zinc-600 mb-2 italic tracking-widest uppercase h-3">Consultation</span>
            <h4 className="text-4xl font-black italic uppercase text-zinc-500 group-hover:translate-x-2 transition-transform">Archives</h4>
          </Link>
        </section>
      </div>
    </div>
  );
}
