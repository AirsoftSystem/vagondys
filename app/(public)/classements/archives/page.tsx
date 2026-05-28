
"use client";

import React, { useState } from 'react';
import {
  Home,
  ArrowLeft,
  Archive,
  Search,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Users,
  Target
} from "lucide-react";
import Link from "next/link";

// ============================================================
// TYPES
// ============================================================
interface ArchivedSeason {
  year: number;
  champion: string;
  championScore: number;
  totalMatches: number;
  totalPlayers: number;
  topScore: number;
  championRank: string;
  championAvatar?: string;
}

interface SeasonStats {
  year: number;
  averageScore: number;
  winRate: number;
  totalParticipants: number;
}

// ============================================================
// DONNÉES DE DÉMONSTRATION
// ============================================================
const ARCHIVED_SEASONS: ArchivedSeason[] = [
  {
    year: 2024,
    champion: "RAPTOR-X",
    championScore: 12450,
    totalMatches: 1240,
    totalPlayers: 128,
    topScore: 98.5,
    championRank: "Immortel Mythique1"
  },
  {
    year: 2023,
    champion: "ZERO-N",
    championScore: 11800,
    totalMatches: 1080,
    totalPlayers: 96,
    topScore: 95.2,
    championRank: "Immortel Mythique10"
  },
  {
    year: 2022,
    champion: "KOBRA-1",
    championScore: 11200,
    totalMatches: 950,
    totalPlayers: 84,
    topScore: 92.8,
    championRank: "Immortel Mythique100"
  },
  {
    year: 2021,
    champion: "PHANTOM-V",
    championScore: 10500,
    totalMatches: 820,
    totalPlayers: 72,
    topScore: 89.5,
    championRank: "Légende I"
  }
];

const SEASON_STATS: SeasonStats[] = [
  { year: 2024, averageScore: 2450, winRate: 68, totalParticipants: 128 },
  { year: 2023, averageScore: 2280, winRate: 65, totalParticipants: 96 },
  { year: 2022, averageScore: 2150, winRate: 62, totalParticipants: 84 },
  { year: 2021, averageScore: 1980, winRate: 58, totalParticipants: 72 }
];

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export default function ArchivesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const filteredSeasons = ARCHIVED_SEASONS.filter(season =>
    season.year.toString().includes(searchTerm) ||
    season.champion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredSeasons.length / itemsPerPage);
  const paginatedSeasons = filteredSeasons.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <main className="min-h-screen bg-black text-white px-6 py-24 selection:bg-red-600 font-sans relative">

      {/* ===== NAVIGATION HAUTE GAUCHE ===== */}
      <div className="absolute top-8 left-8 z-50">
        <div className="flex flex-col sm:flex-row gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest group"
          >
            <Home className="w-4 h-4 text-red-600" /> VAGONDYS
          </Link>
          <div className="hidden sm:block w-px h-4 bg-zinc-900" />
          <Link
            href="/classements"
            className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            RETOUR CLASSEMENTS
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">

        {/* ===== HEADER ===== */}
        <header className="mb-16 text-center pt-10">
          <div className="inline-block px-4 py-1 border border-red-600 text-red-600 text-[10px] font-black uppercase tracking-[0.5em] mb-10 animate-pulse">
            ARCHIVES OFFICIELLES
          </div>
          <h1 className="text-7xl md:text-8xl font-black tracking-tighter uppercase mb-6 italic leading-none">
            SAISONS <span className="text-red-600">PASSÉES</span>
          </h1>
          <p className="text-zinc-500 font-bold tracking-[0.2em] uppercase max-w-2xl mx-auto text-sm leading-relaxed">
            Consultez l&apos;historique complet des classements VAGONDYS
          </p>
        </header>

        {/* ===== STATISTIQUES GLOBALES ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-center">
            <Archive className="w-6 h-6 text-red-600 mx-auto mb-3" />
            <p className="text-2xl font-black text-white">{ARCHIVED_SEASONS.length}</p>
            <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Saisons archivées</p>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-center">
            <Trophy className="w-6 h-6 text-red-600 mx-auto mb-3" />
            <p className="text-2xl font-black text-white">4</p>
            <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Champions différents</p>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-center">
            <Users className="w-6 h-6 text-red-600 mx-auto mb-3" />
            <p className="text-2xl font-black text-white">380+</p>
            <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Athlètes participés</p>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-center">
            <Target className="w-6 h-6 text-red-600 mx-auto mb-3" />
            <p className="text-2xl font-black text-white">4090</p>
            <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Matchs enregistrés</p>
          </div>
        </div>

        {/* ===== BARRE DE RECHERCHE ===== */}
        <div className="mb-12">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input
              type="text"
              placeholder="RECHERCHER UNE SAISON OU UN CHAMPION..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-xs text-white placeholder:text-zinc-600 focus:border-red-600 outline-none transition-all uppercase tracking-widest font-black"
            />
          </div>
        </div>

        {/* ===== GRILLE DES SAISONS ===== */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {paginatedSeasons.map((season) => (
            <Link
              key={season.year}
              href={`/classements/saison/${season.year}`}
              className="group bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden hover:border-red-600 transition-all hover:scale-[1.02] duration-300"
            >
              <div className="p-6">
                {/* Année */}
                <div className="flex items-center justify-between mb-4">
                  <div className="text-3xl font-black italic text-red-600 group-hover:text-white transition-colors">
                    {season.year}
                  </div>
                  <Trophy className="w-5 h-5 text-yellow-500" />
                </div>

                {/* Champion */}
                <div className="mb-4">
                  <p className="text-[8px] text-zinc-500 uppercase tracking-widest mb-1">CHAMPION</p>
                  <p className="text-lg font-black uppercase tracking-tighter text-white group-hover:text-red-600 transition-colors">
                    {season.champion}
                  </p>
                  <p className="text-[7px] text-zinc-600 font-mono mt-1">{season.championRank}</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-800">
                  <div>
                    <p className="text-[6px] text-zinc-500 uppercase tracking-widest">SCORE</p>
                    <p className="text-sm font-black text-red-500">{season.championScore.toLocaleString()} pts</p>
                  </div>
                  <div>
                    <p className="text-[6px] text-zinc-500 uppercase tracking-widest">JOUEURS</p>
                    <p className="text-sm font-black text-white">{season.totalPlayers}</p>
                  </div>
                </div>

                {/* Bouton */}
                <div className="mt-4 pt-3 border-t border-zinc-800">
                  <span className="text-[7px] font-black uppercase tracking-wider text-zinc-500 group-hover:text-red-600 transition-colors flex items-center gap-1">
                    Voir le détail
                    <ChevronRight size={10} className="group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ===== AUCUN RÉSULTAT ===== */}
        {filteredSeasons.length === 0 && (
          <div className="text-center py-20 border border-zinc-800 rounded-2xl bg-zinc-900/20">
            <Archive className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500">Aucune archive trouvée</p>
            <p className="text-zinc-600 text-sm mt-1">Essayez une autre recherche</p>
          </div>
        )}

        {/* ===== PAGINATION ===== */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-12">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors"
              aria-label="Page précédente"
              title="Page précédente"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[10px] text-zinc-500 font-black uppercase tracking-wider">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors"
              aria-label="Page suivante"
              title="Page suivante"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ===== ÉVOLUTION DES STATISTIQUES ===== */}
        <section className="mt-24 bg-zinc-950 border border-zinc-800 rounded-2xl p-8">
          <h2 className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-8">
            📊 ÉVOLUTION ANNUELLE
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-[8px] font-black uppercase tracking-widest text-zinc-500">
                  <th className="pb-4">Saison</th>
                  <th className="pb-4 text-right">Score moyen</th>
                  <th className="pb-4 text-right">Win rate</th>
                  <th className="pb-4 text-right">Participants</th>
                </tr>
              </thead>
              <tbody>
                {SEASON_STATS.map((stat) => (
                  <tr key={stat.year} className="border-b border-zinc-900 hover:bg-zinc-900/20 transition-colors">
                    <td className="py-4 font-black text-white">{stat.year}</td>
                    <td className="py-4 text-right font-mono text-red-500">{stat.averageScore.toLocaleString()} pts</td>
                    <td className="py-4 text-right font-mono text-green-500">{stat.winRate}%</td>
                    <td className="py-4 text-right font-mono text-zinc-400">{stat.totalParticipants}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer className="mt-20 flex flex-col items-center gap-6 pb-12">
          <div className="w-12 h-px bg-zinc-900" />
          <div className="flex flex-col items-center gap-2">
            <p className="text-[9px] text-zinc-700 uppercase tracking-[0.6em] font-black">Vagondys Historical Archives</p>
            <p className="text-[8px] text-zinc-800 uppercase tracking-[0.4em]">Archives officielles — Depuis 2021</p>
          </div>
        </footer>

      </div>
    </main>
  );
}
