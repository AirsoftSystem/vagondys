"use client";

import React, { useState } from 'react';
import { 
  Home, 
  ChevronRight,
  ArrowLeft,
  BarChart3,
  Trophy,
  Award,
  TrendingUp,
  Calendar,
  Zap,
  Star,
  Target,
  X,
  ShieldCheck,
  MapPin,
  TrophyIcon
} from "lucide-react";
import Link from "next/link";

// ==========================================
// CONFIGURATION DU CALENDRIER (MODIFIABLE)
// ==========================================
const CALENDRIER_CONFIG = {
  // Liste des semaines pour chaque type de tournoi
  EUS: [50],
  UMS: [11, 26, 37, 48],
  MCS: [7, 16, 20, 24, 29, 33, 42, 46],
  
  // Pour MENSUEL et BIMENSUEL, on peut lister les semaines ou garder une logique
  // Ici, on liste les semaines types pour une flexibilité totale
  MENSUEL: [3, 5, 9, 14, 18, 22, 27, 31, 35, 40, 44, 52],
  BIMENSUEL: [2, 4, 6, 8, 10, 12, 15, 17, 19, 21, 23, 25, 28, 30, 32, 34, 36, 38, 41, 43, 45, 47, 49, 51]
};

interface WeekDetail {
  semaineGlobale: number;
  mois: string;
  isUMS: boolean;
  isEUS: boolean;
  isMCS: boolean;
  isMensuel: boolean;
  isBiMensuel: boolean;
  numSemaineMois: number;
}

export default function LaLiguePage() {
  const [activeWeek, setActiveWeek] = useState<WeekDetail | null>(null);

  const mois = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  const prestigeLevels = [
    { rank: "FINAL", circuit: "ELITE Ultimate Supreme (EUS)", status: "PRO -> SUMMUM", points: "12500", freq: "1 par an (Clôture annuelle)", logic: "MAXIMUM PRESTIGE. Réservé au Top 8 mondial." },
    { rank: "SOMMET FINAL", circuit: "Ultimate Master Supreme (UMS)", status: "PRO -> ÉLITE", points: "15000", freq: "4 par an (Trimestriel)", logic: "MAXIMUM PRESTIGE." },
    { rank: "CIRCUIT MAJEUR", circuit: "Master Core Series (MCS)", status: "PRO", points: "10000", freq: "8 par an", logic: "HAUT PRESTIGE." },
    { rank: "CIRCUIT PRO", circuit: "Pro Series (PS)", status: "PRO", points: "5000", freq: "12 par an (Mensuel)", logic: "CONSTANCE PRO." },
    { rank: "CIRCUIT RÉGIONAL", circuit: "Challenge (C)", status: "PRO", points: "2500", freq: "24 par an (Bi-Mensuel)", logic: "GRINDING PRO." },
    { rank: "SEMI-PRO (1er CP)", circuit: "Starter Cup (SC)", status: "SEMI-PRO", points: "1000", freq: "12 par an (Mensuel Local)", logic: "TREMPLIN FINANCIER (Premier CashPrize)." },
    { rank: "AMATEUR (3è Sél.)", circuit: "Final Qualifier Cup (FQC)", status: "SÉLECTION FINALE", points: "500", detail: "Accès SC", freq: "12 par an (Mensuel)", logic: "GOULOT D'ÉTRANGLEMENT." },
    { rank: "AMATEUR (2è Sél.)", circuit: "Qualification Series 2 (QS2)", status: "SÉLECTION INTER-RÉG.", points: "250", detail: "Accès FQC", freq: "24 par an (Bi-Mensuel)", logic: "ENTONNOIR ÉTROIT." },
    { rank: "AMATEUR (1è Sél.)", circuit: "Qualification Series 1 (QS1)", status: "SÉLECTION RÉGIONALE", points: "125", detail: "Accès QS2", freq: "Hebdomadaire (~52 par an)", logic: "FILTRE RÉGIONAL." },
    { rank: "AMATEUR (Tournois)", circuit: "Club Challenge (CC)", status: "TOURNOIS LOCAUX", points: "100", detail: "Accès QS1", freq: "Hebdomadaire (~52 par an)", logic: "MASSE D'ENTRÉE." },
    { rank: "AMATEUR (Loisirs)", circuit: "Initiation Series (IS)", status: "LOISIRS / ENTRAÎNEMENT", points: "0", detail: "Accès Permanent", freq: "Illimité", logic: "ACCÈS PERMANENT." }
  ];

  const pointsData = [
    { tour: "Vainqueur", eus: "12500", ums: "15000", mcs: "10000", ps: "5000", c: "2500", sc: "100", fqc: "500", qs2: "250", qs1: "125", cc: "100" },
    { tour: "Finaliste", eus: "8125", ums: "9750", mcs: "6500", ps: "3250", c: "1625", sc: "65", fqc: "325", qs2: "162,5", qs1: "81,25", cc: "65" },
    { tour: "1/2 Finales", eus: "5000", ums: "6000", mcs: "4000", ps: "2000", c: "1000", sc: "40", fqc: "200", qs2: "100", qs1: "50", cc: "40" },
    { tour: "1/4 Finales", eus: "2500", ums: "3000", mcs: "2000", ps: "1000", c: "500", sc: "20", fqc: "100", qs2: "50", qs1: "25", cc: "20" },
    { tour: "Huitièmes", eus: "—", ums: "1500", mcs: "1000", ps: "500", c: "250", sc: "10", fqc: "50", qs2: "25", qs1: "12,5", cc: "10" },
    { tour: "3e Tour (R32)", eus: "—", ums: "750", mcs: "500", ps: "250", c: "125", sc: "—", fqc: "25", qs2: "12,5", qs1: "6,25", cc: "5" },
    { tour: "2e Tour (R64)", eus: "—", ums: "375", mcs: "250", ps: "125", c: "—", sc: "—", fqc: "12,5", qs2: "6,25", qs1: "3,125", cc: "2,5" },
    { tour: "1er Tour (R128)", eus: "—", ums: "150", mcs: "—", ps: "—", c: "—", sc: "—", fqc: "5", qs2: "2,5", qs1: "1,25", cc: "1" },
  ];

  const distributionPercent = [
    { tour: "Vainqueur", ratio: "1", gain: "100%", diff: "100%" },
    { tour: "Finaliste", ratio: "1/2", gain: "65%", diff: "-35%" },
    { tour: "Demi-finales", ratio: "2/4", gain: "40%", diff: "-60%" },
    { tour: "Quarts de finale", ratio: "4/8", gain: "20%", diff: "-80%" },
    { tour: "Huitièmes", ratio: "8/16", gain: "10%", diff: "-90%" },
    { tour: "3e Tour", ratio: "16/32", gain: "5%", diff: "-95%" },
    { tour: "2e Tour", ratio: "32/64", gain: "2.5%", diff: "-97,5%" },
    { tour: "1er Tour", ratio: "64/128", gain: "1%", diff: "-99%" },
  ];

  return (
    <main className="min-h-screen bg-black text-white px-6 py-12 font-sans selection:bg-red-600 flex flex-col items-center">
      
      {/* NAVIGATION */}
      <nav className="w-full max-w-7xl flex flex-col sm:flex-row items-center gap-6 z-50 mb-12 self-start">
        <Link href="/" className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.3em] h-4">
          <Home className="w-4 h-4 text-red-600" /> VAGONDYS
        </Link>
        <div className="hidden sm:block w-px h-4 bg-zinc-900" />
        <Link href="/joueurs" className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.3em] h-4">
          <ArrowLeft className="w-4 h-4" /> BIBLIOTHÈQUE
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/classements" className="px-6 py-2 bg-zinc-900 border border-zinc-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all flex items-center gap-2 h-10">
            <BarChart3 className="w-3 h-3 text-red-600" /> Classement Global
          </Link>
        </div>
      </nav>

      <article className="w-full max-w-7xl">
        <header className="mb-24 border-l-4 border-red-600 pl-8 min-h-[120px]">
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-4 italic leading-none">
            La <span className="text-red-600">Ligue</span>
          </h1>
          <p className="text-zinc-500 text-[10px] md:text-xs uppercase tracking-[0.4em] font-bold">
            STRUCTURE OFFICIELLE DES 11 CIRCUITS ET DES RANGS DE PRESTIGE
          </p>
        </header>

        {/* SECTION 1 : PRESTIGE */}
        <section className="mb-24">
          <div className="flex items-center gap-4 mb-10 text-red-600 h-10">
            <Trophy className="w-8 h-8" />
            <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white italic">Structure des Niveaux de Prestige</h2>
          </div>
          
          <div className="overflow-hidden border border-zinc-900 bg-neutral-950 rounded-sm overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b-2 border-zinc-800 bg-zinc-900/50">
                  <th className="p-5 text-[10px] uppercase tracking-widest text-zinc-400 font-black">Niveau</th>
                  <th className="p-5 text-[10px] uppercase tracking-widest text-zinc-400 font-black">Circuit</th>
                  <th className="p-5 text-[10px] uppercase tracking-widest text-zinc-400 font-black">Statut</th>
                  <th className="p-5 text-[10px] uppercase tracking-widest text-zinc-400 font-black">Points</th>
                  <th className="p-5 text-[10px] uppercase tracking-widest text-zinc-400 font-black">Fréquence</th>
                  <th className="p-5 text-[10px] uppercase tracking-widest text-red-600 font-black italic">Logique</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {prestigeLevels.map((lvl, i) => (
                  <tr key={i} className="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors h-16">
                    <td className="p-5 text-[9px] font-black text-zinc-500 uppercase tracking-tighter">{lvl.rank}</td>
                    <td className="p-5 font-black tracking-tight text-white uppercase italic text-xs">{lvl.circuit}</td>
                    <td className={`p-5 font-bold text-[9px] uppercase ${lvl.status.includes('PRO') ? 'text-red-500' : 'text-zinc-500'}`}>{lvl.status}</td>
                    <td className="p-5 font-mono">
                      <div className="flex flex-col">
                        <span className="text-lg font-bold text-white/90 leading-none">{lvl.points}</span>
                        {lvl.detail && <span className="text-[9px] text-zinc-600 font-black uppercase mt-1 tracking-tighter">({lvl.detail})</span>}
                      </div>
                    </td>
                    <td className="p-5 text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">{lvl.freq}</td>
                    <td className="p-5 text-zinc-400 text-[10px] uppercase leading-tight max-w-xs font-semibold italic">{lvl.logic}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 2 : POINTS DE BASE */}
        <section className="mb-24">
          <div className="flex items-center gap-4 mb-10 text-red-600 h-10">
             <Award className="w-8 h-8" />
             <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white italic">Points de Base par Circuit</h2>
          </div>
          <div className="border border-zinc-800 bg-zinc-950 overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-zinc-900 text-[9px] font-black uppercase text-zinc-400 italic">
                  <th className="p-4 border-r border-zinc-800 w-[150px]">Résultat / Circuit</th>
                  <th className="p-4 text-white text-center">EUS</th>
                  <th className="p-4 text-red-600 italic text-center">UMS</th>
                  <th className="p-4 text-center text-zinc-400">MCS</th>
                  <th className="p-4 text-center text-zinc-400">PS</th>
                  <th className="p-4 text-center text-zinc-400">C</th>
                  <th className="p-4 text-center text-zinc-400">SC</th>
                  <th className="p-4 text-center text-zinc-400">FQC</th>
                  <th className="p-4 text-center text-zinc-500">QS2</th>
                  <th className="p-4 text-center text-zinc-500">QS1</th>
                  <th className="p-4 text-center text-zinc-500">CC</th>
                </tr>
              </thead>
              <tbody className="text-[10px] font-bold uppercase italic whitespace-nowrap">
                {pointsData.map((row, i) => (
                  <tr key={i} className="border-b border-zinc-900 hover:bg-white/5 transition-colors">
                    <td className="p-4 border-r border-zinc-800 text-zinc-500 font-black leading-tight">{row.tour}</td>
                    <td className="p-4 text-white text-center font-mono">{row.eus}</td>
                    <td className="p-4 text-red-500 font-black text-center font-mono">{row.ums}</td>
                    <td className="p-4 text-zinc-300 text-center font-mono">{row.mcs}</td>
                    <td className="p-4 text-zinc-400 text-center font-mono">{row.ps}</td>
                    <td className="p-4 text-zinc-500 text-center font-mono">{row.c}</td>
                    <td className="p-4 text-zinc-500 text-center font-mono">{row.sc}</td>
                    <td className="p-4 text-zinc-600 text-center font-mono">{row.fqc}</td>
                    <td className="p-4 text-zinc-700 text-center font-mono">{row.qs2}</td>
                    <td className="p-4 text-zinc-800 text-center font-mono">{row.qs1}</td>
                    <td className="p-4 text-zinc-900 text-center font-mono">{row.cc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 3 : RATIOS */}
        <section className="mb-24">
          <div className="flex items-center gap-4 mb-10 text-red-600 h-10">
             <TrendingUp className="w-8 h-8" />
             <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white italic">Répartition des points</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-px bg-zinc-800 border border-zinc-800 mb-12">
            {distributionPercent.map((item, i) => (
              <div key={i} className="bg-black p-6 text-center">
                <p className="text-[9px] text-zinc-500 font-black uppercase mb-2 tracking-widest">{item.tour}</p>
                <p className="text-xl font-black italic text-white mb-1 font-mono">{item.gain}</p>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-zinc-700 font-bold uppercase">Ratio {item.ratio}</span>
                  <span className="text-[9px] text-red-900 font-black uppercase tracking-widest">{item.diff}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Link href="/bareme" className="group flex items-center gap-4 bg-transparent border border-red-600 px-6 py-4 hover:bg-red-600 transition-all">
              <div className="text-right">
                <p className="text-[10px] font-black uppercase text-red-600 group-hover:text-white transition-colors tracking-[0.2em]">Calcul des points</p>
                <p className="text-xs font-bold uppercase text-white italic">Voir le barème complet</p>
              </div>
              <ChevronRight className="w-5 h-5 text-red-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </Link>
          </div>
        </section>

        {/* SECTION CALENDRIER CENTRALISÉE */}
        <section className="mb-24" id="calendrier">
          <div className="flex flex-col mb-10">
            <div className="flex items-center gap-4 text-red-600 h-10">
              <Calendar className="w-8 h-8" />
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white italic">Calendrier Sportif Annuel (52 Semaines)</h2>
            </div>
            <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mt-2 ml-12 italic">
                (Option Loupe disponible : Cliquez sur une semaine pour agrandir)
            </p>
          </div>

          <div className="mt-8 mb-12 bg-zinc-900/20 border border-zinc-800 p-6 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <Zap className="w-6 h-6 text-red-600" />
              <div>
                <p className="text-[10px] font-black text-white uppercase tracking-widest">Saison Standard 12 Mois</p>
                <p className="text-[9px] text-zinc-500 font-bold uppercase italic">Démarrage 5 Janvier — Clôture 15 Décembre</p>
              </div>
            </div>
            <div className="text-[9px] text-zinc-500 font-bold uppercase max-w-md text-right leading-relaxed">
              Les tournois <span className="text-white underline">IS, CC et QS1</span> sont <span className="text-red-600">HEBDO/PERMANENT</span>. 
              Circuits <span className="text-white">PS, SC, FQC</span> : <span className="text-red-600 font-black">MENSUEL</span>. 
              Circuits <span className="text-white">MCS, C, QS2</span> : <span className="text-red-600 font-black">BI-MENSUEL/SELECT</span>.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {mois.map((m, mIndex) => {
              const weeksInMonth = (mIndex + 1) % 3 === 0 ? 5 : 4;
              let startWeek = 1;
              for(let i=0; i < mIndex; i++) {
                startWeek += (i + 1) % 3 === 0 ? 5 : 4;
              }

              return (
                <div key={m} className="bg-zinc-900/30 border border-zinc-800 p-4 relative">
                  <h3 className="text-red-600 font-black uppercase text-xs mb-4 tracking-widest border-b border-zinc-800 pb-2 flex justify-between">
                    {m} <span className="text-zinc-700 text-[8px]">MOIS {mIndex + 1}</span>
                  </h3>
                  <div className="space-y-2">
                    {Array.from({ length: weeksInMonth }).map((_, i) => {
                      const semaineGlobale = startWeek + i;
                      const numSemaineMois = i + 1;

                      // Utilisation de la CONFIG centralisée
                      const isEUS = CALENDRIER_CONFIG.EUS.includes(semaineGlobale);
                      const isUMS = CALENDRIER_CONFIG.UMS.includes(semaineGlobale);
                      const isMCS = CALENDRIER_CONFIG.MCS.includes(semaineGlobale);
                      
                      // Hiérarchie : Un majeur (EUS/UMS) remplace le mensuel/bimensuel visuellement
                      const isMensuel = CALENDRIER_CONFIG.MENSUEL.includes(semaineGlobale) && !isEUS && !isUMS;
                      const isBiMensuel = CALENDRIER_CONFIG.BIMENSUEL.includes(semaineGlobale) && !isEUS && !isUMS;

                      return (
                        <div 
                          key={semaineGlobale} 
                          onClick={() => setActiveWeek({ 
                            semaineGlobale, mois: m, isUMS, isEUS, isMCS, isMensuel, isBiMensuel, numSemaineMois 
                          })}
                          className="bg-black/40 p-3 border border-zinc-800 hover:border-red-600 transition-all cursor-zoom-in group"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-tighter group-hover:text-white transition-colors">S{semaineGlobale}</span>
                            <div className="flex gap-1">
                                {isEUS && <Star className="w-3 h-3 text-red-600 fill-red-600 animate-pulse" />}
                                {isUMS && <Zap className="w-3 h-3 text-amber-400 fill-orange-400 animate-pulse" />}
                                {isMCS && <Trophy className="w-3 h-3 text-gray-500 fill-gray-500 animate-pulse" />}
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            {isEUS ? (
                              <div className="text-[9px] font-black text-red-600 uppercase italic">🏆 AS-EUS (FINAL)</div>
                            ) : isUMS ? (
                              <div className="text-[9px] font-black text-amber-400 uppercase italic">⚡ AS-UMS (MAJEUR)</div>
                            ) : isMCS ? (
                              <div className="text-[9px] font-black text-gray-500 uppercase italic">🎖️ MCS (MAJEUR)</div>
                            ) : null}

                            <div className="flex flex-wrap gap-1">
                              <span className="text-[7px] px-1 bg-zinc-800 text-zinc-400 font-bold uppercase">IS/CC/QS1</span>
                              {isBiMensuel && <span className="text-[7px] px-1 bg-blue-900/20 text-blue-400 font-bold uppercase italic">⚔️ C / QS2</span>}
                              {isMensuel && <span className="text-[7px] px-1 bg-red-900/20 text-red-400 font-bold uppercase italic">🔥 PS / SC / FQC</span>}
                            </div>

                            <div className="mt-2 pt-2 border-t border-zinc-900 flex flex-col gap-0.5 opacity-60">
                              <p className="text-[6px] text-zinc-500 uppercase font-black tracking-tighter">
                                {isEUS || isUMS || isMCS ? "💎 HAUT PRESTIGE" : isMensuel ? "🔥 CIRCUIT PRO/SEMI" : "⚙️ GRINDING"}
                              </p>
                              <p className="text-[6px] text-red-900 uppercase font-black tracking-widest italic">• CASH PRIZE DISPO</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* OVERLAY LOUPE */}
          {activeWeek && (
            <div 
              className="fixed inset-0 z-100 flex items-center justify-center p-4 md:p-6 bg-black/95 backdrop-blur-md" 
              onClick={() => setActiveWeek(null)}
            >
              <div 
                className="bg-neutral-950 border border-zinc-800 w-full max-w-2xl relative shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-zinc-900/50 p-6 md:p-8 border-b border-zinc-800 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <Calendar className="w-5 h-5 text-red-600" />
                      <span className="text-red-600 font-black uppercase tracking-[0.3em] text-[10px]">Détails des Compétitions</span>
                    </div>
                    <h4 className="text-4xl md:text-5xl font-black italic uppercase text-white leading-none">Semaine {activeWeek.semaineGlobale}</h4>
                    <p className="text-zinc-500 font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                      {activeWeek.mois} <span className="w-1 h-1 bg-zinc-700 rounded-full"/> Cycle Mensuel S{activeWeek.numSemaineMois}
                    </p>
                  </div>
                  <button onClick={() => setActiveWeek(null)} className="p-2 bg-zinc-800 hover:bg-red-600 text-white transition-all rounded-sm"
                    aria-label="Fermer la fenêtre"
                    title="Fermer"
                    >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-6 md:p-8 space-y-6">
                  <div className={`p-6 border-l-4 ${activeWeek.isEUS ? 'border-red-600 bg-red-950/10' : activeWeek.isUMS ? 'border-white bg-white/5' : activeWeek.isMCS ? 'border-amber-500 bg-amber-950/10' : 'border-zinc-700 bg-zinc-900/20'}`}>
                    <div className="flex items-center gap-4">
                      {activeWeek.isEUS ? (
                        <>
                          <Star className="w-10 h-10 text-red-600 fill-red-600 animate-pulse" />
                          <div>
                            <p className="text-2xl font-black italic text-white uppercase tracking-tighter">🏆 ELITE SUPREME (EUS)</p>
                            <p className="text-xs text-zinc-400 font-bold uppercase mt-1">Goulot d&apos;étranglement final. Top 8 Mondial uniquement.</p>
                          </div>
                        </>
                      ) : activeWeek.isUMS ? (
                        <>
                          <Zap className="w-10 h-10 text-white fill-white" />
                          <div>
                            <p className="text-2xl font-black italic text-white uppercase tracking-tighter">⚡ MASTER SUPREME (UMS)</p>
                            <p className="text-xs text-zinc-400 font-bold uppercase mt-1">Sommet du circuit professionnel (Points 15K+).</p>
                          </div>
                        </>
                      ) : activeWeek.isMCS ? (
                        <>
                          <Trophy className="w-10 h-10 text-amber-500" />
                          <div>
                            <p className="text-2xl font-black italic text-white uppercase tracking-tighter">🎖️ MASTER CORE SERIES (MCS)</p>
                            <p className="text-xs text-zinc-400 font-bold uppercase mt-1">Circuit Majeur. Haute intensité de points.</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-10 h-10 text-zinc-600" />
                          <div>
                            <p className="text-2xl font-black italic text-white uppercase tracking-tighter">🛡️ PHASE DE SÉLECTION</p>
                            <p className="text-xs text-zinc-400 font-bold uppercase mt-1">Grind régulier, progression et qualifications ouvertes.</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-zinc-900/40 p-5 border border-zinc-800">
                      <p className="text-[9px] font-black text-zinc-500 uppercase mb-3 flex items-center gap-2">
                        <MapPin className="w-3 h-3" /> Grille des Tournois Actifs
                      </p>
                      <ul className="space-y-2">
                        <li className="flex justify-between text-[10px] font-bold uppercase border-b border-zinc-800/50 pb-1">
                          <span className="text-zinc-400 italic">🎮 IS / CC / QS1</span>
                          <span className="text-white">NON-STOP</span>
                        </li>
                        {activeWeek.isMensuel && (
                          <li className="flex flex-col gap-1 py-1">
                            <span className="text-red-500 font-black text-[10px]">🔥 CIRCUIT PRO (PS) / SEMI (SC)</span>
                            <span className="text-orange-500 font-black text-[10px]">🎯 QUALIFIER CUP (FQC)</span>
                          </li>
                        )}
                        {activeWeek.isBiMensuel && (
                          <li className="flex flex-col gap-1 py-1">
                            <span className="text-blue-400 font-black text-[10px]">⚔️ CHALLENGE PRO (C)</span>
                            <span className="text-blue-600 font-black text-[10px]">🧬 QUALIF. SERIES 2 (QS2)</span>
                          </li>
                        )}
                      </ul>
                    </div>

                    <div className="bg-zinc-900/40 p-5 border border-zinc-800">
                      <p className="text-[9px] font-black text-zinc-500 uppercase mb-3 flex items-center gap-2">
                        <TrophyIcon className="w-3 h-3" /> Rentabilité & Points
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-black text-white italic">
                            {activeWeek.isUMS ? '15 000' : activeWeek.isEUS ? '12 500' : activeWeek.isMCS ? '10 000' : '2 500'}
                          </span>
                          <span className="text-[8px] text-zinc-600 font-black uppercase">Points Max</span>
                        </div>
                        <div className="p-2 bg-red-950/20 border border-red-900/30">
                           <p className="text-[9px] text-red-500 leading-relaxed uppercase font-black italic">
                            💰 CashPrize : {activeWeek.isMensuel || activeWeek.isUMS || activeWeek.isEUS ? "Paliers PRO débloqués" : "Grille Standard"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-black border-t border-zinc-900">
                  <button 
                    onClick={() => setActiveWeek(null)}
                    className="w-full bg-red-600 text-white py-4 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-white hover:text-black transition-all flex items-center justify-center gap-3"
                  >
                    QUITTER LE MODE LOUPE S{activeWeek.semaineGlobale}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* SECTION 5 : SYNTHÈSE TECHNIQUE */}
        <section className="mb-24">
          <div className="flex items-center gap-4 mb-10 text-red-600 h-10">
            <Target className="w-8 h-8" />
            <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white italic">Synthèse Technique Officielle</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-[10px] font-bold uppercase tracking-widest">
            {["Exigence Technique", "Exigence Physique", "Exigence Cognitive"].map((title, i) => (
              <div key={i} className="p-8 border border-zinc-900 bg-neutral-950 group min-h-[160px]">
                <p className="text-red-600 mb-4 font-black transition-colors group-hover:text-white">{title}</p>
                <p className="leading-relaxed text-zinc-400 group-hover:text-zinc-200">
                  {i === 0 && "Cible 2cm à 15m / Cadence 1.5s / Précision Absolue."}
                  {i === 1 && "Gestion recul GBB / Endurance Musculaire / Stabilité ADX."}
                  {i === 2 && "Correction Balistique / ∆h Minimale / Gestion du Stress."}
                </p>
              </div>
            ))}
          </div>
        </section>

        <footer className="pt-20 border-t border-zinc-900 text-center pb-20">
          <p className="text-[9px] text-zinc-700 uppercase font-black tracking-[1.5em] italic">
            Vagondys Official System — Document de Référence 2025/2026
          </p>
        </footer>
      </article>
    </main>
  );
}
