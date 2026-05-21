"use client";

import React from 'react';
import {  
  Target, 
  TrendingUp, 
  ShieldAlert, 
  Zap,
  Home,
  ArrowLeft,
  BarChart3,
  Crosshair,
  Layers,
  Scale
} from "lucide-react";
import Link from "next/link";
import Image from 'next/image';

export default function BaremePage() {
  
  // --- DONNÉES TECHNIQUES ---
  const peripheralTargets = [
    { zone: "Zone 0 (Bull : 2 cm)", sb: "50", pb: "5 PB", color: "Rouge" },
    { zone: "Zone 1", sb: "25", pb: "4 PB", color: "Bleu" },
    { zone: "Zone 2", sb: "15", pb: "3 PB", color: "Rouge" },
    { zone: "Zone 3", sb: "10", pb: "2 PB", color: "Bleu" },
    { zone: "Zone 4", sb: "5", pb: "1 PB", color: "Rouge" },
    { zone: "Tir Loupé (Zone 5)", sb: "0", pb: "0 PB", color: "Noir" },
    { zone: "Timeout (Zone 6)", sb: "0", pb: "0 PB", color: "Gris foncé" },
  ];

  const bonusTargetData = [
    { zone: "Zone 0 (Bull : 2 cm)", sb: "250", color: "Rouge" },
    { zone: "Zone 1", sb: "200", color: "Bleu" },
    { zone: "Zone 2", sb: "150", color: "Bleu" },
    { zone: "Zone 3", sb: "100", color: "Bleu" },
    { zone: "Zone 4 (Périphérique)", sb: "0", color: "Noir" },
    { zone: "Zone 5 (Timeout)", sb: "0", color: "Gris foncé" },
  ];

  const sequenceExample = [
    { tir: "Tir 1", sb: "50", pb: "5", bc: "+ 0", totalTir: "50", cumul: "50", expl: "Premier tir zone 50. 5 PB mis en attente." },
    { tir: "Tir 2", sb: "50", pb: "5", border: "+ 5", totalTir: "55", cumul: "105", expl: "Zone identique : SB(50) + BC(5). Nouveau BC en attente : 10." },
    { tir: "Tir 3", sb: "0", pb: "0", bc: "+ 0", totalTir: "0", cumul: "105", expl: "RÉINITIALISATION : Le loupé annule le BC en attente." },
    { tir: "Tir 4", sb: "25", pb: "4", bc: "+ 0", totalTir: "25", cumul: "130", expl: "Début nouvelle séquence. 4 PB mis en attente." },
    { tir: "Tir 5", sb: "25", pb: "4", bc: "+ 4", totalTir: "29", cumul: "159", expl: "SB(25) + BC(4). Nouveau BC en attente : 8." },
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
    <main className="min-h-screen bg-black text-white px-4 md:px-8 py-12 font-sans selection:bg-red-600 flex flex-col items-center">
      
      {/* NAVIGATION UP - Stabilisée en hauteur */}
      <nav className="w-full max-w-7xl flex flex-col sm:flex-row items-center gap-6 z-50 mb-12 self-start">
        <Link href="/" className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.3em] h-4">
          <Home className="w-4 h-4 text-red-600" /> VAGONDYS
        </Link>
        <div className="hidden sm:block w-px h-4 bg-zinc-900" />
        <Link href="/la-ligue" className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.3em] h-4">
          <ArrowLeft className="w-4 h-4" /> LA-LIGUE
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

      <div className="w-full max-w-7xl">
        <header className="mb-16">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic">
            BARÈME <span className="text-red-600">TECHNIQUE</span>
          </h1>
          <p className="text-zinc-500 text-xs mt-4 uppercase tracking-[0.3em] font-bold">
            ALGORITHMES DE POINTS ET FACTEURS DE PRÉCISION
          </p>
        </header>

        {/* I. BARÈME DES POINTS ET POINTS BONUS */}
        <section className="mb-24">
          <div className="flex items-center gap-4 mb-8 text-red-600">
             <Crosshair className="w-6 h-6" />
             <h2 className="text-xl font-black uppercase italic text-white">I. Barème des Points et Points Bonus (PB)</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="border border-zinc-800 bg-zinc-950 p-6 flex flex-col">
              <h3 className="text-xs font-black uppercase text-red-600 mb-6 tracking-widest border-l-2 border-red-600 pl-4">
                Référence Visuelle : Cartographie des Zones
              </h3>
              <div className="flex-1 flex items-center justify-center p-4">
                <Image
                  src="/cible.png" 
                  alt="Cartographie Cible"
                  width={600}
                  height={450}
                  className="w-full h-auto object-contain"
                  priority
                />
              </div>
            </div>

            <div className="border border-zinc-800 bg-zinc-950 p-6">
              <h3 className="text-xs font-black uppercase text-red-600 mb-6 tracking-widest border-l-2 border-red-600 pl-4">Les 12 Cibles Périphériques (Consistance)</h3>
              <table className="w-full text-[10px] uppercase font-bold italic">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-900">
                    <th className="pb-4 text-left font-black">Zone</th>
                    <th className="pb-4 text-center">Score Base</th>
                    <th className="pb-4 text-center">Points Bonus</th>
                    <th className="pb-4 text-right">Couleur</th>
                  </tr>
                </thead>
                <tbody>
                  {peripheralTargets.map((row, i) => (
                    <tr key={i} className="border-b border-zinc-900/50 hover:bg-white/5 transition-colors">
                      <td className="py-3 text-white">{row.zone}</td>
                      <td className="py-3 text-center text-zinc-400">{row.sb}</td>
                      <td className="py-3 text-center text-red-500">{row.pb}</td>
                      <td className="py-3 text-right text-zinc-600">{row.color}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-zinc-800 bg-zinc-950 p-6">
            <h3 className="text-xs font-black uppercase text-red-600 mb-6 tracking-widest border-l-2 border-red-600 pl-4">La Cible Bonus (Exécution Maximale)</h3>
            <table className="w-full text-[10px] uppercase font-bold italic">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-900">
                  <th className="pb-4 text-left font-black">Zone</th>
                  <th className="pb-4 text-center">Score Base</th>
                  <th className="pb-4 text-right">Identifiant</th>
                </tr>
              </thead>
              <tbody>
                {bonusTargetData.map((row, i) => (
                  <tr key={i} className="border-b border-zinc-900/50 hover:bg-white/5 transition-colors">
                    <td className="py-3 text-white">{row.zone}</td>
                    <td className="py-3 text-center text-red-500 font-black">{row.sb} pts</td>
                    <td className="py-3 text-right text-zinc-600">{row.color}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* II. MÉCANISME DU BONUS CUMULATIF */}
        <section className="mb-24">
          <div className="flex items-center gap-4 mb-8 text-red-600">
             <Layers className="w-6 h-6" />
             <h2 className="text-xl font-black uppercase italic text-white">II. Le Mécanisme Complexe du Bonus Cumulatif</h2>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 overflow-hidden">
            <div className="p-6 border-b border-zinc-900 bg-zinc-900/20">
              <p className="text-[10px] font-bold uppercase italic text-zinc-400 leading-relaxed">
                Le Bonus s&apos;active dès le deuxième tir consécutif dans la <span className="text-white">même zone</span>. Sa valeur est accumulée et mise en attente.
                <br/><span className="text-red-600 font-black tracking-widest">Règle d&apos;Activation :</span> Uniquement si le tir actuel atteint la même couleur que le tir précédent.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-zinc-900 text-[9px] font-black uppercase text-zinc-500">
                    <th className="p-4 border-r border-zinc-800 italic">Séquence</th>
                    <th className="p-4 border-r border-zinc-800">Tir (SB)</th>
                    <th className="p-4 border-r border-zinc-800">PB Zone</th>
                    <th className="p-4 border-r border-zinc-800 text-red-500">BC Actuel</th>
                    <th className="p-4 border-r border-zinc-800 text-white font-black">Score Tir</th>
                    <th className="p-4 border-r border-zinc-800 text-white font-black">Cumul</th>
                    <th className="p-4">Explication</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] font-bold uppercase italic">
                  {sequenceExample.map((row, i) => (
                    <tr key={i} className="border-b border-zinc-900 hover:bg-white/5">
                      <td className="p-4 border-r border-zinc-800 text-zinc-500">{row.tir}</td>
                      <td className="p-4 border-r border-zinc-800">{row.sb}</td>
                      <td className="p-4 border-r border-zinc-800">{row.pb}</td>
                      <td className="p-4 border-r border-zinc-800 text-red-600 font-black">{row.bc || "+ 0"}</td>
                      <td className="p-4 border-r border-zinc-800 text-white">{row.totalTir}</td>
                      <td className="p-4 border-r border-zinc-800 text-white font-black">{row.cumul}</td>
                      <td className="p-4 text-zinc-600 text-[9px] leading-tight">{row.expl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* III. RÉPARTITION % */}
        <section className="mb-24">
          <div className="flex items-center gap-4 mb-8 text-red-600">
             <TrendingUp className="w-6 h-6" />
             <h2 className="text-xl font-black uppercase italic text-white">III. Tableau de répartition des points en fonction du Pourcentage</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-px bg-zinc-800 border border-zinc-800">
            {distributionPercent.map((item, i) => (
              <div key={i} className="bg-black p-6 text-center">
                <p className="text-[9px] text-zinc-500 font-black uppercase mb-2 tracking-widest">{item.tour}</p>
                <p className="text-xl font-black italic text-white mb-1">{item.gain}</p>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-zinc-700 font-bold uppercase">Ratio {item.ratio}</span>
                  <span className="text-[9px] text-red-900 font-black uppercase tracking-widest">{item.diff}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* IV. STM */}
        <section className="mb-24">
          <div className="flex items-center gap-4 mb-8 text-red-600">
             <Target className="w-6 h-6" />
             <h2 className="text-xl font-black uppercase italic text-white">IV. Calcul du Score Moyen Théorique d&apos;un Match (STM)</h2>
          </div>
          <div className="bg-zinc-950 border border-zinc-900 p-8">
            <h3 className="text-xs font-black uppercase italic text-red-600 mb-6 flex items-center gap-2">
              <span className="w-4 h-4 flex items-center justify-center border border-red-600 rounded-full text-[8px] not-italic">i</span> Points des Zones des cibles :
            </h3>
            <ul className="space-y-4 text-xs font-bold text-zinc-400 uppercase italic leading-relaxed">
              <li className="flex gap-2">
                <span className="text-red-600">•</span>
                <span>12 cibles ont ces points dont la moyenne est de <span className="text-white">&quot;50 + 25 + 15 + 10 + 5 + 0 = 105 pts / 6 = 17,5 pts par Tir&quot;</span>.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-600">•</span>
                <span>Quand tu as la cible <span className="text-white font-black italic">&quot;BONUS&quot;</span> elle a la moyenne de <span className="text-white">&quot;(250 + 200 + 150 + 100) / 4 = 175 pts par Tir&quot;</span>.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-600">•</span>
                <span>Pistolet & Fusil (20 tirs) : <span className="text-white italic">(19 x 17.5 pts) + (1 x 175 pts) = 332.5 + 175 = 507.5 pts.</span></span>
              </li>
              <li className="ml-4 text-red-600 font-black">Soit 507.5 / 20 = 25.37 pts/tir.</li>
            </ul>
          </div>
        </section>

        {/* V. FMP */}
        <section className="mb-24">
          <div className="flex items-center gap-4 mb-8 text-red-600">
             <Zap className="w-6 h-6" />
             <h2 className="text-xl font-black uppercase italic text-white">V. Tableau : Facteur Multiplicateur de Précision (FMP)</h2>
          </div>
          <div className="p-4 bg-zinc-950 border-y border-r border-zinc-900 border-l-4 border-l-red-600 mb-6 text-[10px] font-bold uppercase italic text-zinc-400">
              Ce facteur est le plus important. Il est calculé comme un pourcentage de la Performance Maximale Possible pour l&apos;arme utilisée. 
              <br/>• Pistolet & Fusil (20 Tirs) : <span className="text-white font-black italic">Score Max = (19 x 50) + 250 = 1200 pts</span>
          </div>
          <div className="border border-zinc-800 bg-zinc-950 overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-zinc-900 text-[9px] font-black uppercase text-zinc-500 italic">
                    <th className="p-4 border-r border-zinc-800 w-1/3">Condition (Score total atteint sur 1 match)</th>
                    <th className="p-4 border-r border-zinc-800 w-1/4 text-white italic text-center">Calcul du PMF</th>
                    <th className="p-4">Conséquence</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] font-bold uppercase italic">
                  <tr className="border-b border-zinc-900">
                    <td className="p-4 border-r border-zinc-800 text-white italic">Précision Exceptionnelle (≥ 90% du Score Max)</td>
                    <td className="p-4 border-r border-zinc-800 text-red-600 text-center font-black">Multiplicateur x 1.15 (+15%)</td>
                    <td className="p-4 text-zinc-500 italic">Récompense l&apos;Exécution dans le Chaos (Précision quasi-parfaite).</td>
                  </tr>
                  <tr className="border-b border-zinc-900">
                    <td className="p-4 border-r border-zinc-800 text-white italic">Précision Elite (≥ 80% du Score Max)</td>
                    <td className="p-4 border-r border-zinc-800 text-red-500 text-center font-black">Multiplicateur x 1.10 (+10%)</td>
                    <td className="p-4 text-zinc-500 italic">Performance de haut vol, maîtrise technique confirmée.</td>
                  </tr>
                  <tr className="border-b border-zinc-900">
                    <td className="p-4 border-r border-zinc-800 text-zinc-300">Précision Avancée (≥ 75% du Score Max)</td>
                    <td className="p-4 border-r border-zinc-800 text-red-400 text-center font-black">Multiplicateur x 1.05 (+5%)</td>
                    <td className="p-4 text-zinc-500 italic">Récompense une performance de haut niveau.</td>
                  </tr>
                  <tr>
                    <td className="p-4 border-r border-zinc-800 text-zinc-600">Performance Standard (&lt; 75% du Score Max)</td>
                    <td className="p-4 border-r border-zinc-800 text-zinc-700 text-center">Multiplicateur x 1.00 (Aucun changement)</td>
                    <td className="p-4 text-zinc-700 italic">Le score du match est validé, mais sans bonus d&apos;exécution.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* VI. AS-EG */}
        <section className="mb-24">
          <div className="flex items-center gap-4 mb-8 text-red-600">
             <ShieldAlert className="w-6 h-6" />
             <h2 className="text-xl font-black uppercase italic text-white">VI. LE SYSTÈME UNIQUE DE NOTORIÉTÉ – AS-ELITE GRIND (AS-EG)</h2>
          </div>
          <div className="bg-zinc-950 border-l-4 border-red-600 p-6 mb-12">
             <p className="text-[11px] font-bold uppercase italic text-zinc-400 leading-relaxed">
               Le Tournoi de Notoriété, appelé <span className="text-white italic">AS-Elite Grind</span>, est un système inédit qui impose aux <span className="text-red-600 font-black italic">Huit Têtes de Série (TS)</span> de défendre leur statut 2 fois par mois face à <span className="text-white italic">3 Challengers du Niveau AS-MCS</span>. Leur classement est directement affecté par leurs performances de quinzaine.
             </p>
          </div>

          <h3 className="text-[10px] font-black text-zinc-600 uppercase mb-4 tracking-widest italic">Tableau E : Système de Bonus/Malus PCH (Impact sur le Seeding)</h3>
          <div className="border border-zinc-800 bg-zinc-950 mb-12 overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-zinc-900 text-[9px] font-black uppercase text-zinc-500 italic">
                    <th className="p-4 border-r border-zinc-800">Résultat du TS</th>
                    <th className="p-4 border-r border-zinc-800 text-white italic">Mouvement de Notoriété</th>
                    <th className="p-4 border-r border-zinc-800 text-center">Impact sur les PCH</th>
                    <th className="p-4">Conséquence sur le Classement</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] font-bold uppercase italic">
                  <tr className="border-b border-zinc-900">
                    <td className="p-4 border-r border-zinc-800 text-white italic">1ère Place</td>
                    <td className="p-4 border-r border-zinc-800 text-white">Gain fort de notoriété</td>
                    <td className="p-4 border-r border-zinc-800 text-green-500 text-center font-black">+100 PCH (Bonus)</td>
                    <td className="p-4 text-zinc-500">Gagne des places et consolide son statut.</td>
                  </tr>
                  <tr className="border-b border-zinc-900">
                    <td className="p-4 border-r border-zinc-800 text-zinc-300">2ème Place</td>
                    <td className="p-4 border-r border-zinc-800 text-white">Gain modéré de notoriété</td>
                    <td className="p-4 border-r border-zinc-800 text-green-600 text-center">+50 PCH (Bonus léger)</td>
                    <td className="p-4 text-zinc-500">Maintient son rang et son statut.</td>
                  </tr>
                  <tr className="border-b border-zinc-900">
                    <td className="p-4 border-r border-zinc-800 text-zinc-400">3ème Place</td>
                    <td className="p-4 border-r border-zinc-800 text-red-500">Perte légère de notoriété</td>
                    <td className="p-4 border-r border-zinc-800 text-red-500 text-center font-black">−50 PCH (Malus léger)</td>
                    <td className="p-4 text-zinc-600">Risque de perdre un avantage de tête de série.</td>
                  </tr>
                  <tr>
                    <td className="p-4 border-r border-zinc-800 text-zinc-500">4ème Place</td>
                    <td className="p-4 border-r border-zinc-800 text-red-600">Perte forte de notoriété</td>
                    <td className="p-4 border-r border-zinc-800 text-red-700 text-center font-black">−100 PCH (Malus sévère)</td>
                    <td className="p-4 text-zinc-700">Chute significative au classement.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <h3 className="text-[10px] font-black text-zinc-600 uppercase mb-4 tracking-widest italic">Tableau F : Règles de Sélection des 3 Challengers (Équité Maximale)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="border border-zinc-800 bg-zinc-950 overflow-hidden">
                <table className="w-full text-left border-collapse h-full">
                  <thead>
                    <tr className="bg-zinc-900 text-[9px] font-black uppercase text-zinc-500 italic">
                        <th className="p-4 border-r border-zinc-800">Rôle du Joueur</th>
                        <th className="p-4">Critères / Justification</th>
                    </tr>
                  </thead>
                  <tbody className="text-[10px] font-bold uppercase italic">
                    <tr className="border-b border-zinc-900">
                        <td className="p-4 border-r border-zinc-800 text-white italic">Tête de Série (TS)</td>
                        <td className="p-4 text-zinc-400 leading-relaxed">Les 8 TS participent en même temps, leurs classements sont directement mis en jeu.</td>
                    </tr>
                    <tr>
                        <td className="p-4 border-r border-zinc-800 text-white italic">Challengers (AS-MCS)</td>
                        <td className="p-4 text-zinc-400 leading-relaxed">3 joueurs— Tirés au sort parmi un pool de challengers qualifiés. Garantit que la TS affronte les meilleurs du moment.</td>
                    </tr>
                  </tbody>
                </table>
            </div>
            <div className="bg-zinc-900/40 p-6 border border-zinc-800 flex flex-col justify-center">
                <h4 className="text-[10px] font-black uppercase text-red-600 mb-6 flex items-center gap-2"><Scale className="w-3 h-3"/> Critères d’Éligibilité du Pool :</h4>
                <ul className="space-y-4 text-[10px] font-bold uppercase italic text-zinc-500">
                  <li>1. Être parmi les 32 meilleurs joueurs du classement hebdomadaire, hors TS.</li>
                  <li>2. Avoir participé à au moins 4 sessions au cours des 4 semaines précédentes.</li>
                  <li className="pt-4 border-t border-zinc-800 text-white font-black italic">
                    <span className="text-red-600">3. ATTENTION :</span> Cela s’attaque directement au SCORE du CLASSEMENT GÉNÉRAL DU JOUEUR (TS).
                  </li>
                </ul>
            </div>
          </div>
        </section>

        <footer className="pt-16 border-t border-zinc-900 text-center pb-12">
          <p className="text-[10px] text-zinc-800 uppercase font-black tracking-[1em] italic">Vagondys Official System — Documentation Référence 2025/2026</p>
        </footer>
      </div>
    </main>
  );
}
