
"use client";

import React, { useState } from 'react';
import {
  Home,
  Trophy,
  Medal,
  Award,
  TrendingUp,
  Search,
  Star,
  User,
  Activity,
  ChevronLeft,
  ChevronRight,
  MapPin
} from "lucide-react";
import Link from "next/link";

// ============================================================
// TYPES
// ============================================================
interface Leader {
  id: number;
  slug: string;
  name: string;
  pseudo: string;
  rank: string;
  rankLevel: number;      // 1-24 (grade)
  score: number;
  matchesPlayed: number;
  winRate: number;
  country: string;
  city: string;
  avatarInitial: string;
}

// ============================================================
// DONNÉES DE DÉMONSTRATION
// ============================================================
const LEADERS: Leader[] = [
  { id: 1, slug: "raptor-x", name: "Raptor X", pseudo: "RAPTOR-X", rank: "Immortel Mythique1", rankLevel: 24, score: 12500, matchesPlayed: 156, winRate: 87, country: "FR", city: "NANTES", avatarInitial: "R" },
  { id: 2, slug: "zero-n", name: "Zero N", pseudo: "ZERO-N", rank: "Immortel Mythique10", rankLevel: 23, score: 11800, matchesPlayed: 142, winRate: 84, country: "FR", city: "LYON", avatarInitial: "Z" },
  { id: 3, slug: "kobra-1", name: "Kobra 1", pseudo: "KOBRA-1", rank: "Immortel Mythique100", rankLevel: 22, score: 11200, matchesPlayed: 138, winRate: 82, country: "FR", city: "PARIS", avatarInitial: "K" },
  { id: 4, slug: "atlas-d", name: "Atlas D", pseudo: "ATLAS-D", rank: "Légende III", rankLevel: 20, score: 9800, matchesPlayed: 125, winRate: 78, country: "FR", city: "NANTES", avatarInitial: "A" },
  { id: 5, slug: "blade-m", name: "Blade M", pseudo: "BLADE-M", rank: "Légende II", rankLevel: 19, score: 9200, matchesPlayed: 118, winRate: 75, country: "FR", city: "MARSEILLE", avatarInitial: "B" },
  { id: 6, slug: "phantom-v", name: "Phantom V", pseudo: "PHANTOM-V", rank: "Légende I", rankLevel: 18, score: 8700, matchesPlayed: 112, winRate: 72, country: "FR", city: "BORDEAUX", avatarInitial: "P" },
  { id: 7, slug: "zenith-p", name: "Zenith P", pseudo: "ZENITH-P", rank: "Épique V", rankLevel: 17, score: 8200, matchesPlayed: 105, winRate: 68, country: "FR", city: "LILLE", avatarInitial: "Z" },
  { id: 8, slug: "reaper-j", name: "Reaper J", pseudo: "REAPER-J", rank: "Épique IV", rankLevel: 16, score: 7800, matchesPlayed: 98, winRate: 65, country: "FR", city: "TOULOUSE", avatarInitial: "R" },
  { id: 9, slug: "shadow-s", name: "Shadow S", pseudo: "SHADOW-S", rank: "Grand Maître III", rankLevel: 12, score: 6500, matchesPlayed: 85, winRate: 58, country: "ES", city: "MADRID", avatarInitial: "S" },
  { id: 10, slug: "cible-alpha", name: "Cible Alpha", pseudo: "CIBLE-ALPHA", rank: "Grand Maître II", rankLevel: 11, score: 6200, matchesPlayed: 80, winRate: 55, country: "FR", city: "NANTES", avatarInitial: "C" },
];

// ============================================================
// UTILS
// ============================================================
const getRankIcon = (rankLevel: number) => {
  if (rankLevel >= 21) return <Trophy className="w-4 h-4 text-red-600" />;
  if (rankLevel >= 18) return <Medal className="w-4 h-4 text-yellow-500" />;
  if (rankLevel >= 13) return <Award className="w-4 h-4 text-red-500" />;
  if (rankLevel >= 10) return <Star className="w-4 h-4 text-orange-500" />;
  if (rankLevel >= 7) return <TrendingUp className="w-4 h-4 text-purple-500" />;
  return <User className="w-4 h-4 text-zinc-500" />;
};

const getRankColor = (rankLevel: number): string => {
  if (rankLevel >= 21) return "text-red-600";
  if (rankLevel >= 18) return "text-yellow-500";
  if (rankLevel >= 13) return "text-red-500";
  if (rankLevel >= 10) return "text-orange-500";
  if (rankLevel >= 7) return "text-purple-500";
  if (rankLevel >= 4) return "text-blue-500";
  return "text-zinc-500";
};

const getRankBorderColor = (rankLevel: number): string => {
  if (rankLevel >= 21) return "border-red-600/50";
  if (rankLevel >= 18) return "border-yellow-500/50";
  if (rankLevel >= 13) return "border-red-500/50";
  if (rankLevel >= 10) return "border-orange-500/50";
  if (rankLevel >= 7) return "border-purple-500/50";
  if (rankLevel >= 4) return "border-blue-500/50";
  return "border-zinc-700";
};

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export default function LeadersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const filteredLeaders = LEADERS.filter(leader =>
    leader.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    leader.pseudo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredLeaders.length / itemsPerPage);
  const paginatedLeaders = filteredLeaders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const top3 = LEADERS.slice(0, 3);

  return (
    <main className="min-h-screen bg-black text-white px-6 py-24 selection:bg-red-600 font-sans relative">

      {/* ===== NAVIGATION HAUTE GAUCHE ===== */}
      <div className="absolute top-8 left-8 z-50">
        <Link
          href="/"
          className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest group"
        >
          <Home className="w-4 h-4 text-red-600" /> VAGONDYS
        </Link>
      </div>

      <div className="max-w-7xl mx-auto">

        {/* ===== HEADER ===== */}
        <header className="mb-20 text-center pt-10">
          <div className="inline-block px-4 py-1 border border-red-600 text-red-600 text-[10px] font-black uppercase tracking-[0.5em] mb-10 animate-pulse">
            LEADERBOARD
          </div>
          <h1 className="text-7xl md:text-8xl font-black tracking-tighter uppercase mb-6 italic leading-none">
            LES <span className="text-red-600">LEADERS</span>
          </h1>
          <p className="text-zinc-500 font-bold tracking-[0.2em] uppercase max-w-2xl mx-auto text-sm leading-relaxed">
            Classement officiel des meilleurs athlètes de la Maison VAGONDYS
          </p>
        </header>

        {/* ===== PODIUM TOP 3 ===== */}
        <div className="mb-20">
          <h2 className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-10">
            ⭐ LE TRIUMVIRAT ⭐
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 2ème place */}
            {top3[1] && (
              <div className="order-2 md:order-1 bg-zinc-950 border border-zinc-800 rounded-2xl p-8 text-center group hover:border-red-600/50 transition-all">
                <div className="relative inline-block mb-4">
                  <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mx-auto border-2 border-zinc-700 group-hover:border-red-600 transition-all">
                    <span className="text-3xl font-black italic text-zinc-500">{top3[1].avatarInitial}</span>
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center text-sm font-black text-white">
                    2
                  </div>
                </div>
                <p className="text-lg font-black uppercase tracking-tighter text-white">{top3[1].pseudo}</p>
                <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${getRankColor(top3[1].rankLevel)}`}>
                  {top3[1].rank}
                </p>
                <p className="text-2xl font-black text-red-600 mt-3">{top3[1].score} pts</p>
                <div className="flex items-center justify-center gap-4 mt-4 text-[8px] text-zinc-500">
                  <span className="flex items-center gap-1"><Activity size={10} /> {top3[1].matchesPlayed}</span>
                  <span className="flex items-center gap-1"><TrendingUp size={10} /> {top3[1].winRate}%</span>
                </div>
              </div>
            )}

            {/* 1ère place */}
            {top3[0] && (
              <div className="order-1 md:order-2 bg-linear-to-b from-red-950/30 to-black border-2 border-red-600 rounded-2xl p-8 text-center transform scale-105 shadow-[0_0_30px_rgba(220,38,38,0.2)]">
                <div className="relative inline-block mb-4">
                  <div className="w-28 h-28 bg-zinc-900 rounded-full flex items-center justify-center mx-auto border-2 border-red-600">
                    <span className="text-4xl font-black italic text-red-600">{top3[0].avatarInitial}</span>
                  </div>
                  <div className="absolute -top-2 -right-2 w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-base font-black text-white shadow-lg">
                    1
                  </div>
                </div>
                <p className="text-xl font-black uppercase tracking-tighter text-white">{top3[0].pseudo}</p>
                <p className="text-[10px] font-black uppercase tracking-widest mt-1 text-red-600">{top3[0].rank}</p>
                <p className="text-3xl font-black text-yellow-500 mt-3">{top3[0].score} pts</p>
                <div className="flex items-center justify-center gap-4 mt-4 text-[9px] text-zinc-500">
                  <span className="flex items-center gap-1"><Activity size={10} /> {top3[0].matchesPlayed}</span>
                  <span className="flex items-center gap-1"><TrendingUp size={10} /> {top3[0].winRate}%</span>
                </div>
              </div>
            )}

            {/* 3ème place */}
            {top3[2] && (
              <div className="order-3 bg-zinc-950 border border-zinc-800 rounded-2xl p-8 text-center group hover:border-red-600/50 transition-all">
                <div className="relative inline-block mb-4">
                  <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mx-auto border-2 border-zinc-700 group-hover:border-red-600 transition-all">
                    <span className="text-3xl font-black italic text-zinc-500">{top3[2].avatarInitial}</span>
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-700 rounded-full flex items-center justify-center text-sm font-black text-white">
                    3
                  </div>
                </div>
                <p className="text-lg font-black uppercase tracking-tighter text-white">{top3[2].pseudo}</p>
                <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${getRankColor(top3[2].rankLevel)}`}>
                  {top3[2].rank}
                </p>
                <p className="text-2xl font-black text-red-600 mt-3">{top3[2].score} pts</p>
                <div className="flex items-center justify-center gap-4 mt-4 text-[8px] text-zinc-500">
                  <span className="flex items-center gap-1"><Activity size={10} /> {top3[2].matchesPlayed}</span>
                  <span className="flex items-center gap-1"><TrendingUp size={10} /> {top3[2].winRate}%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===== BARRE DE RECHERCHE ===== */}
        <div className="mb-12">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input
              type="text"
              placeholder="RECHERCHER UN LEADER..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-xs text-white placeholder:text-zinc-600 focus:border-red-600 outline-none transition-all uppercase tracking-widest font-black"
            />
          </div>
        </div>

        {/* ===== TABLEAU DES LEADERS ===== */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-[9px] font-black uppercase tracking-widest text-zinc-500">
                <th className="pb-4 w-16">RANG</th>
                <th className="pb-4">JOUEUR</th>
                <th className="pb-4">GRADE</th>
                <th className="pb-4 text-right">SCORE</th>
                <th className="pb-4 text-right">MATCHS</th>
                <th className="pb-4 text-right">WIN %</th>
                <th className="pb-4 text-right">LOCALISATION</th>
                <th className="pb-4 w-10"></th>
               </tr>
            </thead>
            <tbody>
              {paginatedLeaders.map((leader, idx) => {
                const globalRank = (currentPage - 1) * itemsPerPage + idx + 1;
                return (
                  <tr
                    key={leader.id}
                    className="border-b border-zinc-900 hover:bg-zinc-900/20 transition-colors group"
                  >
                    <td className="py-4">
                      <div className={`flex items-center gap-2 font-black text-sm ${getRankColor(leader.rankLevel)}`}>
                        {globalRank <= 3 ? (
                          globalRank === 1 ? "🥇" : globalRank === 2 ? "🥈" : "🥉"
                        ) : (
                          `#${globalRank}`
                        )}
                      </div>
                     </td>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center border ${getRankBorderColor(leader.rankLevel)} group-hover:border-red-600 transition-all`}>
                          <span className={`text-xs font-black italic ${getRankColor(leader.rankLevel)}`}>
                            {leader.avatarInitial}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-black uppercase tracking-tighter text-white">{leader.pseudo}</p>
                          <p className="text-[8px] text-zinc-600 font-mono">{leader.name}</p>
                        </div>
                      </div>
                     </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        {getRankIcon(leader.rankLevel)}
                        <span className={`text-[9px] font-black uppercase tracking-widest ${getRankColor(leader.rankLevel)}`}>
                          {leader.rank.split(' ')[0]}
                        </span>
                      </div>
                     </td>
                    <td className="py-4 text-right font-black text-red-500">
                      {leader.score.toLocaleString()}
                     </td>
                    <td className="py-4 text-right text-zinc-400">
                      {leader.matchesPlayed}
                     </td>
                    <td className="py-4 text-right text-green-500">
                      {leader.winRate}%
                     </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-1 text-[8px] text-zinc-500">
                        <MapPin size={10} />
                        <span>{leader.city}</span>
                      </div>
                     </td>
                    <td className="py-4 text-right">
                      <Link
                        href={`/joueurs/${leader.slug}`}
                        className="text-zinc-600 hover:text-red-600 transition-colors text-[9px] font-black uppercase tracking-wider"
                      >
                        Profil
                      </Link>
                     </td>
                   </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ===== AUCUN RÉSULTAT ===== */}
        {filteredLeaders.length === 0 && (
          <div className="text-center py-20 border border-zinc-800 rounded-2xl bg-zinc-900/20">
            <Trophy className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500">Aucun leader trouvé</p>
            <p className="text-zinc-600 text-sm mt-1">Essayez un autre nom ou pseudo</p>
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
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ===== FOOTER DÉCORATIF ===== */}
        <footer className="mt-20 flex flex-col items-center gap-6 pb-12">
          <div className="w-12 h-px bg-zinc-900" />
          <div className="flex flex-col items-center gap-2">
            <p className="text-[9px] text-zinc-700 uppercase tracking-[0.6em] font-black">Vagondys Ranking System</p>
            <p className="text-[8px] text-zinc-800 uppercase tracking-[0.4em]">Classement Officiel — Mis à jour en temps réel</p>
          </div>
        </footer>

      </div>
    </main>
  );
}
