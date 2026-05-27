
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
  MapPin,
  Calendar,
  Clock,
  Filter,
  X
} from "lucide-react";
import Link from "next/link";

// ============================================================
// TYPES
// ============================================================
interface HistoricalLeader {
  id: number;
  slug: string;
  name: string;
  pseudo: string;
  rank: string;
  rankLevel: number;
  score: number;
  matchesPlayed: number;
  winRate: number;
  country: string;
  city: string;
  avatarInitial: string;
  weekStart: string;
  weekEnd: string;
  position: number;
}

interface HistoricalWeek {
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

// ============================================================
// DONNÉES DE DÉMONSTRATION - HISTORIQUE
// ============================================================
const HISTORICAL_WEEKS: HistoricalWeek[] = [
  { weekNumber: 1, year: 2025, startDate: "2025-01-06", endDate: "2025-01-12", isActive: false },
  { weekNumber: 2, year: 2025, startDate: "2025-01-13", endDate: "2025-01-19", isActive: false },
  { weekNumber: 3, year: 2025, startDate: "2025-01-20", endDate: "2025-01-26", isActive: false },
  { weekNumber: 4, year: 2025, startDate: "2025-01-27", endDate: "2025-02-02", isActive: false },
  { weekNumber: 5, year: 2025, startDate: "2025-02-03", endDate: "2025-02-09", isActive: false },
  { weekNumber: 6, year: 2025, startDate: "2025-02-10", endDate: "2025-02-16", isActive: false },
  { weekNumber: 7, year: 2025, startDate: "2025-02-17", endDate: "2025-02-23", isActive: false },
  { weekNumber: 8, year: 2025, startDate: "2025-02-24", endDate: "2025-03-02", isActive: false }
];

// Données historiques par semaine
const HISTORICAL_DATA: Record<string, HistoricalLeader[]> = {
  "2025-1": [
    { id: 1, slug: "raptor-x", name: "Raptor X", pseudo: "RAPTOR-X", rank: "Immortel Mythique1", rankLevel: 24, score: 11800, matchesPlayed: 142, winRate: 84, country: "FR", city: "NANTES", avatarInitial: "R", weekStart: "2025-01-06", weekEnd: "2025-01-12", position: 1 },
    { id: 2, slug: "zero-n", name: "Zero N", pseudo: "ZERO-N", rank: "Immortel Mythique10", rankLevel: 23, score: 11200, matchesPlayed: 138, winRate: 82, country: "FR", city: "LYON", avatarInitial: "Z", weekStart: "2025-01-06", weekEnd: "2025-01-12", position: 2 },
    { id: 3, slug: "kobra-1", name: "Kobra 1", pseudo: "KOBRA-1", rank: "Immortel Mythique100", rankLevel: 22, score: 10800, matchesPlayed: 135, winRate: 80, country: "FR", city: "PARIS", avatarInitial: "K", weekStart: "2025-01-06", weekEnd: "2025-01-12", position: 3 },
    { id: 4, slug: "atlas-d", name: "Atlas D", pseudo: "ATLAS-D", rank: "Légende III", rankLevel: 20, score: 9500, matchesPlayed: 120, winRate: 76, country: "FR", city: "NANTES", avatarInitial: "A", weekStart: "2025-01-06", weekEnd: "2025-01-12", position: 4 },
    { id: 5, slug: "blade-m", name: "Blade M", pseudo: "BLADE-M", rank: "Légende II", rankLevel: 19, score: 8900, matchesPlayed: 115, winRate: 73, country: "FR", city: "MARSEILLE", avatarInitial: "B", weekStart: "2025-01-06", weekEnd: "2025-01-12", position: 5 }
  ],
  "2025-2": [
    { id: 1, slug: "raptor-x", name: "Raptor X", pseudo: "RAPTOR-X", rank: "Immortel Mythique1", rankLevel: 24, score: 12100, matchesPlayed: 148, winRate: 86, country: "FR", city: "NANTES", avatarInitial: "R", weekStart: "2025-01-13", weekEnd: "2025-01-19", position: 1 },
    { id: 2, slug: "kobra-1", name: "Kobra 1", pseudo: "KOBRA-1", rank: "Immortel Mythique100", rankLevel: 22, score: 11500, matchesPlayed: 140, winRate: 83, country: "FR", city: "PARIS", avatarInitial: "K", weekStart: "2025-01-13", weekEnd: "2025-01-19", position: 2 },
    { id: 3, slug: "zero-n", name: "Zero N", pseudo: "ZERO-N", rank: "Immortel Mythique10", rankLevel: 23, score: 11000, matchesPlayed: 136, winRate: 81, country: "FR", city: "LYON", avatarInitial: "Z", weekStart: "2025-01-13", weekEnd: "2025-01-19", position: 3 }
  ],
  "2025-3": [
    { id: 1, slug: "zero-n", name: "Zero N", pseudo: "ZERO-N", rank: "Immortel Mythique10", rankLevel: 23, score: 12500, matchesPlayed: 150, winRate: 88, country: "FR", city: "LYON", avatarInitial: "Z", weekStart: "2025-01-20", weekEnd: "2025-01-26", position: 1 },
    { id: 2, slug: "raptor-x", name: "Raptor X", pseudo: "RAPTOR-X", rank: "Immortel Mythique1", rankLevel: 24, score: 11900, matchesPlayed: 145, winRate: 85, country: "FR", city: "NANTES", avatarInitial: "R", weekStart: "2025-01-20", weekEnd: "2025-01-26", position: 2 },
    { id: 3, slug: "kobra-1", name: "Kobra 1", pseudo: "KOBRA-1", rank: "Immortel Mythique100", rankLevel: 22, score: 11300, matchesPlayed: 138, winRate: 82, country: "FR", city: "PARIS", avatarInitial: "K", weekStart: "2025-01-20", weekEnd: "2025-01-26", position: 3 },
    { id: 4, slug: "shadow-s", name: "Shadow S", pseudo: "SHADOW-S", rank: "Grand Maître III", rankLevel: 12, score: 6800, matchesPlayed: 90, winRate: 60, country: "ES", city: "MADRID", avatarInitial: "S", weekStart: "2025-01-20", weekEnd: "2025-01-26", position: 4 }
  ]
};

// ============================================================
// UTILS
// ============================================================
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit'
  });
};

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
export default function HistoricalLeadersPage() {
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [selectedWeek, setSelectedWeek] = useState<HistoricalWeek | null>(HISTORICAL_WEEKS[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const currentData = selectedWeek
    ? HISTORICAL_DATA[`${selectedYear}-${selectedWeek.weekNumber}`] || []
    : [];

  const filteredLeaders = currentData.filter(leader =>
    leader.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    leader.pseudo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const years = [2024, 2025];

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
        <header className="mb-16 text-center pt-10">
          <div className="inline-block px-4 py-1 border border-red-600 text-red-600 text-[10px] font-black uppercase tracking-[0.5em] mb-10 animate-pulse">
            ARCHIVES HISTORIQUES
          </div>
          <h1 className="text-7xl md:text-8xl font-black tracking-tighter uppercase mb-6 italic leading-none">
            HISTORIQUE <span className="text-red-600">DES LEADERS</span>
          </h1>
          <p className="text-zinc-500 font-bold tracking-[0.2em] uppercase max-w-2xl mx-auto text-sm leading-relaxed">
            Consultez les classements des semaines précédentes
          </p>
        </header>

        {/* ===== SÉLECTEURS ===== */}
        <div className="flex flex-wrap gap-4 mb-8 justify-center">
          {/* Sélecteur année */}
          <div className="flex bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
            {years.map((year) => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-6 py-3 text-[10px] font-black uppercase tracking-wider transition-all ${
                  selectedYear === year
                    ? 'bg-red-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title={`Afficher les archives de ${year}`}
                aria-label={`Afficher les archives de ${year}`}
              >
                {year}
              </button>
            ))}
          </div>

          {/* Sélecteur semaine */}
          <select
            value={selectedWeek?.weekNumber || ""}
            onChange={(e) => {
              const week = HISTORICAL_WEEKS.find(w => w.weekNumber === parseInt(e.target.value));
              setSelectedWeek(week || null);
            }}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-wider text-white focus:border-red-600 outline-none"
            aria-label="Sélectionner une semaine"
            title="Sélectionner une semaine"
          >
            {HISTORICAL_WEEKS.map((week) => (
              <option key={week.weekNumber} value={week.weekNumber}>
                Semaine {week.weekNumber} ({formatDate(week.startDate)} - {formatDate(week.endDate)})
              </option>
            ))}
          </select>

          {/* Bouton filtres */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-wider hover:border-red-600 transition-all"
            title="Afficher les filtres de recherche"
            aria-label="Afficher les filtres de recherche"
          >
            <Filter size={12} />
            Filtres
          </button>
        </div>

        {/* ===== FILTRES DÉROULANTS ===== */}
        {showFilters && (
          <div className="mb-8 p-6 bg-zinc-950 border border-zinc-800 rounded-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Recherche avancée</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="text-zinc-500 hover:text-red-600"
                title="Fermer les filtres"
                aria-label="Fermer les filtres"
              >
                <X size={14} />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
              <input
                type="text"
                placeholder="Rechercher un leader..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:border-red-600 outline-none"
                aria-label="Rechercher un leader"
              />
            </div>
          </div>
        )}

        {/* ===== INFOS SEMAINE ===== */}
        {selectedWeek && (
          <div className="mb-8 p-4 bg-red-600/10 border border-red-600/20 rounded-xl text-center">
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <span className="flex items-center gap-2 text-[10px] text-zinc-400">
                <Calendar size={12} className="text-red-600" />
                Semaine {selectedWeek.weekNumber} - {selectedWeek.year}
              </span>
              <span className="flex items-center gap-2 text-[10px] text-zinc-400">
                <Clock size={12} className="text-red-600" />
                {formatDate(selectedWeek.startDate)} → {formatDate(selectedWeek.endDate)}
              </span>
            </div>
          </div>
        )}

        {/* ===== TABLEAU DES LEADERS HISTORIQUES ===== */}
        {filteredLeaders.length === 0 ? (
          <div className="text-center py-20 border border-zinc-800 rounded-2xl bg-zinc-900/20">
            <Trophy className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500">Aucun leader trouvé pour cette période</p>
          </div>
        ) : (
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
                  <th className="pb-4 w-10"> </th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaders.map((leader) => (
                  <tr
                    key={`${leader.id}-${selectedWeek?.weekNumber}`}
                    className="border-b border-zinc-900 hover:bg-zinc-900/20 transition-colors group"
                  >
                    <td className="py-4">
                      <div className={`flex items-center gap-2 font-black text-sm ${getRankColor(leader.rankLevel)}`}>
                        {leader.position === 1 ? "🥇" : leader.position === 2 ? "🥈" : leader.position === 3 ? "🥉" : `#${leader.position}`}
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
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== SECTION ÉVOLUTION ===== */}
        <section className="mt-20 bg-zinc-950 border border-zinc-800 rounded-2xl p-8">
          <h2 className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-6">
            📈 ÉVOLUTION DES LEADERS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="p-4 bg-black/30 rounded-xl">
              <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Semaine 1 → Semaine 3</p>
              <div className="flex items-center justify-center gap-4 mt-2">
                <div>
                  <p className="text-[9px] text-zinc-400">🥇 RAPTOR-X</p>
                  <p className="text-[9px] text-zinc-400">🥈 ZERO-N</p>
                </div>
                <span className="text-red-600">→</span>
                <div>
                  <p className="text-[9px] text-red-500">🥇 ZERO-N</p>
                  <p className="text-[9px] text-zinc-400">🥈 RAPTOR-X</p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-black/30 rounded-xl">
              <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Meilleure progression</p>
              <div className="mt-2">
                <p className="text-sm font-black text-green-500">+12.5%</p>
                <p className="text-[9px] text-zinc-400">ZERO-N (score)</p>
              </div>
            </div>
            <div className="p-4 bg-black/30 rounded-xl">
              <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Nouveaux entrants</p>
              <div className="mt-2">
                <p className="text-sm font-black text-yellow-500">SHADOW-S</p>
                <p className="text-[9px] text-zinc-400">Top 4 Semaine 3</p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer className="mt-20 flex flex-col items-center gap-6 pb-12">
          <div className="w-12 h-px bg-zinc-900" />
          <div className="flex flex-col items-center gap-2">
            <p className="text-[9px] text-zinc-700 uppercase tracking-[0.6em] font-black">Vagondys Historical Archive</p>
            <p className="text-[8px] text-zinc-800 uppercase tracking-[0.4em]">Archives officielles — Classements hebdomadaires depuis 2024</p>
          </div>
        </footer>

      </div>
    </main>
  );
}
