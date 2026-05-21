"use client";

import React, { useState } from 'react';
import { User, Target, Star, Search, Home, BarChart3, Trophy, Lock as LockIcon } from "lucide-react";
import Link from "next/link";
import "@/app/Maison.css"; 

export default function PlayersLibraryPage() {
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<number[]>([]);

  // Logique VAGONDYS : 1 Joueur = 1 Rang unique au monde.
  // Les grades suivent la hiérarchie officielle (EUS > UMS > MCS > PS > C > SC)
  const players = [
    { id: 1, slug: "raptor-x", name: "RAPTOR-X", level: 98, rank: "ELITE ULTIMATE (EUS)", worldRank: 1 },
    { id: 2, slug: "zero-n", name: "ZERO-N", level: 96, rank: "ULTIMATE MASTER (UMS)", worldRank: 2 },
    { id: 3, slug: "kobra-1", name: "KOBRA-1", level: 92, rank: "ULTIMATE MASTER (UMS)", worldRank: 3 },
    { id: 4, slug: "atlas-d", name: "ATLAS-D", level: 91, rank: "MASTER CORE (MCS)", worldRank: 4 },
    { id: 5, slug: "blade-m", name: "BLADE-M", level: 89, rank: "MASTER CORE (MCS)", worldRank: 5 },
    { id: 6, slug: "phantom-v", name: "PHANTOM-V", level: 88, rank: "PRO SERIES (PS)", worldRank: 6 },
    { id: 7, slug: "zenith-p", name: "ZENITH-P", level: 84, rank: "PRO SERIES (PS)", worldRank: 7 },
    { id: 8, slug: "reaper-j", name: "REAPER-J", level: 82, rank: "CHALLENGE (C)", worldRank: 8 },
    { id: 9, slug: "shadow-s", name: "SHADOW-S", level: 78, rank: "CHALLENGE (C)", worldRank: 9 },
    { id: 10, slug: "cible-alpha", name: "CIBLE-ALPHA", level: 75, rank: "CHALLENGE (C)", worldRank: 10 },
    { id: 11, slug: "viper-q", name: "VIPER-Q", level: 74, rank: "STARTER CUP (SC)", worldRank: 11 },
    { id: 12, slug: "nova-x", name: "NOVA-X", level: 71, rank: "STARTER CUP (SC)", worldRank: 12 },
    { id: 13, slug: "glitch-y", name: "GLITCH-Y", level: 67, rank: "STARTER CUP (SC)", worldRank: 13 },
    { id: 14, slug: "titan-k", name: "TITAN-K", level: 62, rank: "STARTER CUP (SC)", worldRank: 14 },
    { id: 15, slug: "pulse-w", name: "PULSE-W", level: 59, rank: "AMATEUR", worldRank: 15 },
    { id: 16, slug: "omega-z", name: "OMEGA-Z", level: 55, rank: "AMATEUR", worldRank: 16 },
    { id: 17, slug: "lynx-e", name: "LYNX-E", level: 50, rank: "AMATEUR", worldRank: 17 },
    { id: 18, slug: "hunter-f", name: "HUNTER-F", level: 48, rank: "LOISIR", worldRank: 18 },
    { id: 19, slug: "vortex-9", name: "VORTEX-9", level: 45, rank: "LOISIR", worldRank: 19 },
    { id: 20, slug: "echo-b", name: "ECHO-B", level: 38, rank: "LOISIR", worldRank: 20 },
    { id: 21, slug: "ghost-r", name: "GHOST-R", level: 33, rank: "RECRUE", worldRank: 21 },
    { id: 22, slug: "spectre-01", name: "SPECTRE-01", level: 25, rank: "RECRUE", worldRank: 22 },
    { id: 23, slug: "storm-h", name: "STORM-H", level: 21, rank: "RECRUE", worldRank: 23 },
    { id: 24, slug: "apex-0", name: "APEX-0", level: 15, rank: "RECRUE", worldRank: 24 }
  ];

  const toggleFavorite = (e: React.MouseEvent, id: number) => {
    e.preventDefault(); 
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(favId => favId !== id) : [...prev, id]
    );
  };

  const getWidthClass = (lvl: number) => {
    if (lvl >= 100) return "w-100";
    if (lvl >= 75) return "w-75";
    if (lvl >= 50) return "w-50";
    if (lvl >= 25) return "w-25";
    return "w-0";
  };

  const filtered = players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-black text-white px-6 py-16 font-sans selection:bg-red-600 flex flex-col items-center">

      {/* NAVIGATION */}
      <nav className="w-full max-w-7xl flex flex-col sm:flex-row items-center gap-6 z-50 mb-12 self-start">
        <Link href="/" className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.3em] h-4">
          <Home className="w-4 h-4 text-red-600" /> VAGONDYS
        </Link>
        {/* LE BOUTON ACCÈS PRIVÉ REVISITÉ */}
        <div className="absolute top-8 right-8 z-50">
          <Link 
              href="/connexion" 
              className="group relative block overflow-hidden border border-red-600/30 bg-red-600/5 px-6 py-4 transition-all hover:border-red-600 hover:bg-red-600/10">
            <div className="flex items-center gap-6"> {/* 'gap' pour espacer texte et icône */}
                <div className="flex flex-col items-end text-right"> {/* Texte aligné à droite */}
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600">
                    Zone Restreinte
                  </span>
                  <span className="text-sm font-bold uppercase tracking-widest text-white">
                    Accès Athlète
                  </span>
                </div>
              <LockIcon className="w-4 h-4 text-red-600 group-hover:rotate-12 transition-transform" />
            </div>

            {/* Effet Shimmer Tailwind v4 */}
            <div className="absolute inset-0 bg-linear-to-r from-transparent via-red-600/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          </Link>
        </div>   
      </nav>

      <header className="max-w-7xl mx-auto mb-12 mt-6 flex flex-col md:flex-row justify-between items-center gap-29">
        <h1 className="text-4xl font-black italic tracking-tighter uppercase">
          Bibliothèque Athlètes
        </h1>
        
        <div className="relative w-full md:w-80 h-10">
          <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="RECHERCHER UN OPÉRATEUR..." 
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2.5 pl-12 pr-4 text-xs outline-none focus:border-red-600 uppercase tracking-widest transition-all h-full"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-4">
          <Link href="/classements" className="px-6 py-2 bg-zinc-900 border border-zinc-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all flex items-center gap-2 h-10">
            <BarChart3 className="w-3 h-3 text-red-600" /> Classement Global
          </Link>
        </div>
      </header>

      {/* GRILLE DES JOUEURS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {filtered.map((player) => {
          const isFav = favorites.includes(player.id);
          return (
            <article key={player.id} className="bg-zinc-950 border border-zinc-900 p-16 rounded-xl relative group hover:border-red-600 transition-all shadow-2xl min-h-[280px]">
              
              {/* Badge World Rank */}
              <div className="absolute top-4 left-4 flex items-center gap-1 bg-red-600 text-white px-2 py-0.5 rounded text-[9px] font-black italic">
                <Trophy className="w-2 h-2" /> TOP {player.worldRank}
              </div>

              <button 
                onClick={(e) => toggleFavorite(e, player.id)}
                aria-label={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
                className={`absolute top-4 right-4 z-10 transition-all hover:scale-110 h-5 w-5 ${isFav ? "text-yellow-500" : "text-zinc-800"}`}
              >
                <Star className="w-5 h-5" fill={isFav ? "currentColor" : "none"} />
              </button>

              <Link href={`/joueurs/${player.slug}`} className="block">
                <div className="flex flex-col items-center mb-6">
                  <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 group-hover:border-red-600 transition-all mb-4 overflow-hidden relative">
                    <User className="w-10 h-10 text-zinc-700 group-hover:text-white" />
                  </div>
                  <h2 className="text-lg font-black italic uppercase tracking-tighter h-7">{player.name}</h2>
                  <span className="text-[9px] text-red-600 font-bold tracking-[0.2em] uppercase h-3 text-center">{player.rank}</span>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-500">
                    <span className="flex items-center gap-1"><Target className="w-3 h-3"/> Performance Globale</span>
                    <span className="w-8 text-right">{player.level}%</span>
                  </div>
                  <div className="barre-niveau-container h-1 bg-zinc-900 rounded-full overflow-hidden">
                    <div 
                        className={`barre-remplissage h-full bg-red-600 transition-all duration-700 ${getWidthClass(player.level)}`} 
                    />
                  </div>
                </div>
              </Link>
            </article>
          );
        })}
      </section>

      <footer className="mt-24 flex flex-col items-center gap-2 pb-8">
        <div className="w-8 h-px bg-zinc-900" />
        <p className="text-[8px] text-zinc-800 uppercase tracking-[0.5em] text-center">
          Vagondys Data Systems — Ranking Officiel Mis à jour en Temps Réel
        </p>
      </footer>
    </div>
  );
}
