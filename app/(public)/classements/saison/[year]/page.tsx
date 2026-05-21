"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Target, ShieldAlert, Award, Zap } from "lucide-react";
import Link from "next/link";
import "@/app/Ranking.css";

export default function SeasonalRankingPage() {
  const params = useParams();
  const rawYear = params?.year?.toString() || "";
  const displayYear = rawYear.replace('saison', '') || "2025";

  const rankingData = [
    { rank: "01", name: "SPECTRE-01", points: 14850, as_eg: "+100", fmp: "x1.15", fmpLevel: "100", status: "TOP SEED" },
    { rank: "02", name: "CIBLE-ALPHA", points: 12100, as_eg: "+50", fmp: "x1.05", fmpLevel: "90", status: "TOP SEED" },
    { rank: "03", name: "PHANTOM-8", points: 10800, as_eg: "-50", fmp: "x1.00", fmpLevel: "75", status: "TOP SEED" },
    { rank: "04", name: "NORDIC-V", points: 9450, as_eg: "-100", fmp: "x1.00", fmpLevel: "50", status: "TOP SEED" },
  ];

  return (
    <div className="min-h-screen bg-black text-white px-6 py-24 relative font-sans selection:bg-red-600">
      <nav className="absolute top-8 left-8 z-50 h-4">
        <Link href="/classements" className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.3em] group h-4">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> 
          RETOUR ARCHIVES
        </Link>
      </nav>

      <div className="max-w-6xl mx-auto">
        <header className="mb-16 border-l-4 border-red-600 pl-8 min-h-[100px]">
          <div className="flex items-center gap-2 mb-2 h-4">
            <Zap className="w-3 h-3 text-red-600" />
            <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">Data Monitoring</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter leading-none">
            CYCLE <span className="text-red-600">{displayYear}</span>
          </h1>
        </header>

        <section className="grid md:grid-cols-2 gap-px bg-zinc-900 border border-zinc-900 mb-16">
          <div className="bg-black p-8 min-h-[140px]">
            <div className="flex items-center gap-3 mb-4 h-5">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <h3 className="text-[10px] font-black uppercase tracking-widest italic">Protocole AS-EG</h3>
            </div>
            <p className="text-[9px] text-zinc-500 uppercase leading-relaxed font-bold">Défense obligatoire du statut.</p>
          </div>
          <div className="bg-black p-8 min-h-[140px]">
            <div className="flex items-center gap-3 mb-4 h-5">
              <Award className="w-5 h-5 text-zinc-600" />
              <h3 className="text-[10px] font-black uppercase tracking-widest italic">Seuil UMS</h3>
            </div>
            <p className="text-[9px] text-zinc-500 uppercase leading-relaxed font-bold">15 000 PTS pour le circuit Master.</p>
          </div>
        </section>

        <div className="border border-zinc-900 overflow-hidden bg-zinc-950/20">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="text-[9px] text-zinc-500 uppercase font-black tracking-widest border-b border-zinc-900">
                  <th className="p-8">Rang</th>
                  <th className="p-8">Athlète</th>
                  <th className="p-8 text-center">Points</th>
                  <th className="p-8 text-center">PCH</th>
                  <th className="p-8 text-right text-red-600">FMP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {rankingData.map((player) => (
                  <tr key={player.rank} className="group hover:bg-zinc-900/40 transition-colors h-[100px]">
                    <td className="p-8">
                      <span className="text-4xl font-black italic text-zinc-800 group-hover:text-white leading-none">{player.rank}</span>
                    </td>
                    <td className="p-8">
                      <div className="text-xl font-black italic uppercase text-white leading-tight">{player.name}</div>
                      <span className="text-[8px] text-zinc-500 font-black tracking-widest block h-3">{player.status}</span>
                    </td>
                    <td className="p-8 text-center font-black italic text-white text-2xl">{player.points.toLocaleString()}</td>
                    <td className={`p-8 text-center font-mono text-xs font-black ${player.as_eg.includes('+') ? 'text-green-500' : 'text-red-600'}`}>{player.as_eg}</td>
                    <td className="p-8 text-right min-w-40">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black italic mb-1 flex items-center gap-2 h-4">
                           <Target className="w-3 h-3 text-red-600" /> {player.fmp}
                        </span>
                        <div className="performance-bar-bg w-24 h-1.5 bg-zinc-900 relative overflow-hidden">
                          {/* SOLUTION FINALE : On utilise un attribut data au lieu de style */}
                          <div 
                            className="performance-bar-fill h-full bg-red-600 transition-all duration-700 ease-out" 
                            data-level={player.fmpLevel} 
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
