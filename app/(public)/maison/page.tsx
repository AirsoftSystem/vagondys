"use client";

import React from 'react';
import { Home, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function MaisonPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-24 selection:bg-red-600 font-sans relative">
      
      {/* ========================================== */}
      {/* NAVIGATION HAUTE GAUCHE                    */}
      {/* ========================================== */}
      <div className="absolute top-8 left-8 flex flex-col sm:flex-row gap-6 z-50">
        {/* Bouton Home Vagondys */}
        <Link 
          href="/" 
          className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest group"
        >
          <Home className="w-4 h-4 text-red-600" /> VAGONDYS
        </Link>
        
        {/* Séparateur vertical optimisé */}
        <div className="hidden sm:block w-px h-4 bg-zinc-900" />

        {/* Bouton Retour Bibliothèque */}
        <Link 
          href="/joueurs" 
          className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Bibliothèque
        </Link>
      </div>

      <div className="max-w-6xl mx-auto">
        
        {/* --- HEADER IDENTITY --- */}
        <section className="mb-32 text-center pt-10">
          <div className="inline-block px-4 py-1 border border-red-600 text-red-600 text-[10px] font-black uppercase tracking-[0.5em] mb-10 animate-pulse">
            High Performance Sport Tech
          </div>
          <h1 className="text-7xl md:text-9xl font-black tracking-tighter uppercase mb-6 italic leading-none">
            VAGONDYS
          </h1>
          <p className="text-red-600 font-bold tracking-[0.4em] uppercase mb-12 text-sm">
            {`L'Airsoft d'Élite — Vigueur, Compétition, Chaos Maîtrisé`}
          </p>
          
          {/* L'ADN DU NOM : VIS + AGON + DYS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-zinc-800 border border-zinc-800 max-w-5xl mx-auto mb-16 overflow-hidden">
            <div className="bg-black p-10 group hover:bg-zinc-900 transition-colors">
              <span className="block text-4xl font-black italic text-white mb-3 uppercase">VIS</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] leading-relaxed block">
                La Vigueur (Latin : Force) <br/> L&apos;ancrage physique de l&apos;athlète.
              </span>
            </div>
            <div className="bg-black p-10 group hover:bg-zinc-900 transition-colors">
              <span className="block text-4xl font-black italic text-white mb-3 uppercase">AGON</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] leading-relaxed block">
                La Compétition (Grec) <br/> L&apos;esprit de lutte et de dépassement.
              </span>
            </div>
            <div className="bg-black p-10 group hover:bg-zinc-900 transition-colors">
              <span className="block text-4xl font-black italic text-white mb-3 uppercase">DYS</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] leading-relaxed block">
                L&apos;Anomalie (Grec : Désordre) <br/> Maîtriser le chaos sensoriel 4DX.
              </span>
            </div>
          </div>
        </section>

        {/* --- LE CONCEPT : L'ÉCOSYSTÈME MAISON VAS --- */}
        <section className="grid md:grid-cols-2 gap-20 mb-40 items-start">
          <div className="space-y-8">
            <h2 className="text-5xl font-black uppercase tracking-tighter italic leading-[0.9]">
              L&apos;ANATOMIE <br/><span className="text-red-600 text-6xl">DE L&apos;EXÉCUTION</span>
            </h2>
            <div className="space-y-6 text-zinc-400 text-lg leading-relaxed font-light">
              <p>
                {`VAGONDYS n'est pas un jeu, c'est une Maison Sportive de 400 à 600m² où chaque seconde est une épreuve de vérité. Inspiré du Tennis pour sa structure et du Biathlon pour sa rigueur, notre sport fusionne le tir de précision avec l'e-sport physique.`}
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <li className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-white">
                  <span className="h-2 w-2 bg-red-600"></span> 8 Zones Intelligent-Targets
                </li>
                <li className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-white">
                  <span className="h-2 w-2 bg-red-600"></span> Environnement 4DX (Vent ADX)
                </li>
                <li className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-white">
                  <span className="h-2 w-2 bg-red-600"></span> Monitoring IA en Temps Réel
                </li>
                <li className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-white">
                  <span className="h-2 w-2 bg-red-600"></span> Streaming Finales UMS
                </li>
              </ul>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-red-600/10 blur-3xl rounded-full"></div>
            <div className="relative bg-zinc-950 border border-zinc-800 p-8 shadow-2xl">
              <h3 className="text-white font-black uppercase text-sm mb-8 tracking-[0.2em] border-b border-zinc-900 pb-4 italic">
                {`Standard Armement : La Dualité Technique`}
              </h3>
              <div className="space-y-10">
                <div className="relative pl-6 border-l-2 border-zinc-800 group hover:border-white transition-colors">
                  <h4 className="text-white font-black uppercase italic mb-2 tracking-tighter">Discipline AEG — Correction Cognitive</h4>
                  <p className="text-[10px] text-zinc-500 leading-relaxed uppercase tracking-wider">
                    {`Propulsion Électrique. Zéro Recul. Focus sur la vitesse d'analyse, la balistique de dérive induite et une cadence de 800 RPM. C'est le test de vos connexions neuronales.`}
                  </p>
                </div>
                <div className="relative pl-6 border-l-2 border-red-600 group hover:border-red-400 transition-colors">
                  <h4 className="text-red-600 font-black uppercase italic mb-2 tracking-tighter">Discipline GBB — Contrôle Musculaire</h4>
                  <p className="text-[10px] text-zinc-500 leading-relaxed uppercase tracking-wider">
                    {`Gas BlowBack. Recul violent. Chaque tir désaxe l'arme. Exige un ancrage (VIS) total pour neutraliser l'instabilité mécanique et rester dans la tolérance de 1cm.`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- LE SYSTÈME DE SCORE : LA SCIENCE VAS --- */}
        <section className="mb-40">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black uppercase italic tracking-tighter">LA SCIENCE DU SCORE</h2>
            <p className="text-zinc-500 text-xs uppercase tracking-[0.3em] mt-2">Précision Millimétrée & Algorithme de Notoriété</p>
          </div>
          <div className="grid md:grid-cols-2 gap-px bg-zinc-800 border border-zinc-800">
            <div className="bg-black p-10">
              <h4 className="text-red-600 font-black uppercase text-xs mb-8 tracking-widest italic">STM & FMP : Le Calcul de l&apos;Élite</h4>
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
                  <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Score Max / Match</span>
                  <span className="text-xl font-black italic">1200 Pts</span>
                </div>
                <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
                  <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">STM (Moyenne Théorique)</span>
                  <span className="text-xl font-black italic text-white">507.5</span>
                </div>
                <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
                  <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest italic">FMP (Facteur Précision)</span>
                  <span className="text-xl font-black italic text-red-600">x1.15</span>
                </div>
                <p className="text-[9px] text-zinc-600 uppercase tracking-widest leading-relaxed italic pt-4">
                  {`Le Multiplicateur FMP booste vos performances si votre précision dépasse 90%. Un système calqué sur le MMR de Valorant/R6.`}
                </p>
              </div>
            </div>
            <div className="bg-black p-10">
              <h4 className="text-white font-black uppercase text-xs mb-8 tracking-widest italic">PCH : La Notoriété en Mouvement</h4>
              <div className="space-y-4">
                <div className="p-4 bg-zinc-950 border border-zinc-900 flex justify-between items-center group hover:border-green-500/50 transition-colors">
                  <span className="text-[10px] uppercase font-black tracking-widest">Vainqueur AS-Elite Grind</span>
                  <span className="text-green-500 font-black">+100 PCH</span>
                </div>
                <div className="p-4 bg-zinc-950 border border-zinc-900 flex justify-between items-center group hover:border-blue-500/50 transition-colors">
                  <span className="text-[10px] uppercase font-black tracking-widest">Finaliste (2ème)</span>
                  <span className="text-blue-500 font-black">+50 PCH</span>
                </div>
                <div className="p-4 bg-zinc-950 border border-zinc-900 flex justify-between items-center opacity-40 group hover:border-red-600/50 transition-colors">
                  <span className="text-[10px] uppercase font-black tracking-widest">Chute (4ème Place)</span>
                  <span className="text-red-600 font-black">-100 PCH</span>
                </div>
                <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-6 italic leading-relaxed">
                  {`La notoriété (PCH) définit votre SEEDING. En ELITE GRIND, vous défendez votre statut 2 fois par mois.`}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* --- PROGRESSION : DU LOISIR AU TOP 8 MONDIAL --- */}
        <section className="mb-40">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-black uppercase italic tracking-tighter">L&apos;ASCENSION PYRAMIDALE</h2>
            <p className="text-zinc-500 text-[10px] uppercase tracking-[0.4em] mt-4 italic font-bold">{`9 Niveaux. Une Seule Issue : Le EUS.`}</p>
          </div>

          <div className="relative">
             {/* LIGNE DE PROGRESSION CENTRALE */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-zinc-900 hidden md:block"></div>
            
            <div className="space-y-24 relative">
              {/* NIVEAU ELITE */}
              <div className="relative flex flex-col md:flex-row items-center gap-12">
                <div className="flex-1 md:text-right">
                  <h3 className="text-4xl font-black italic text-red-600 mb-3 uppercase tracking-tighter">EUS - ELITE ULTIMATE SUPREME</h3>
                  <p className="text-[11px] text-zinc-500 uppercase tracking-widest leading-relaxed italic font-bold">Le Sommet Mondial. Réservé au Top 8 mondial. Clôture annuelle le 30 Juin.</p>
                </div>
                <div className="w-16 h-16 bg-red-600 flex items-center justify-center font-black z-10 italic shadow-[0_0_30px_rgba(220,38,38,0.3)]">1</div>
                <div className="flex-1">
                  <span className="text-[10px] bg-zinc-950 px-4 py-2 border border-zinc-800 text-zinc-400 font-mono font-black tracking-tighter italic">12 500 PTS</span>
                </div>
              </div>

              {/* NIVEAU PRO */}
              <div className="relative flex flex-col md:flex-row-reverse items-center gap-12">
                <div className="flex-1 md:text-left">
                  <h3 className="text-4xl font-black italic text-white mb-3 uppercase tracking-tighter">UMS & MCS</h3>
                  <p className="text-[11px] text-zinc-500 uppercase tracking-widest leading-relaxed italic font-bold">Circuit PRO Majeur. UMS (Trimestriel) & MCS (8/an). Accès aux Cash Prizes mondiaux.</p>
                </div>
                <div className="w-16 h-16 bg-zinc-800 flex items-center justify-center font-black z-10 italic border border-zinc-700">2</div>
                <div className="flex-1 md:text-right">
                  <span className="text-[10px] bg-zinc-950 px-4 py-2 border border-zinc-800 text-zinc-400 font-mono font-black tracking-tighter italic">15 000 / 10 000 PTS</span>
                </div>
              </div>

              {/* NIVEAU LOISIR / STARTER */}
              <div className="relative flex flex-col md:flex-row items-center gap-12">
                <div className="flex-1 md:text-right">
                  <h3 className="text-4xl font-black italic text-zinc-700 mb-3 uppercase tracking-tighter">LOISIR & STARTER CUP</h3>
                  <p className="text-[11px] text-zinc-600 uppercase tracking-widest leading-relaxed italic font-bold">L&apos;École VAS. Pour les 7-15 ans et néophytes. Apprentissage de la balistique et de la rigueur.</p>
                </div>
                <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 flex items-center justify-center font-black z-10 italic text-zinc-600">3</div>
                <div className="flex-1">
                  <span className="text-[10px] bg-zinc-950 px-4 py-2 border border-zinc-900 text-zinc-600 font-mono font-black tracking-tighter italic">STATUT AMATEUR</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- AS-ELITE GRIND : LE MONUMENT --- */}
        <section className="bg-zinc-950 border border-zinc-900 py-24 px-10 md:px-20 mb-40 relative overflow-hidden">
           <div className="absolute right-0 top-0 text-[20rem] font-black text-white/2 italic -mr-40 -mt-20 select-none pointer-events-none uppercase">AS</div>
           <div className="max-w-4xl relative z-10">
              <h2 className="text-6xl md:text-7xl font-black uppercase italic tracking-tighter mb-10 leading-none">
                AS-ELITE <br/><span className="text-red-600">GRIND.</span>
              </h2>
              <div className="space-y-8 text-zinc-400 text-lg leading-relaxed mb-12 max-w-2xl font-light">
                <p>
                  {`C'est le monument du storytelling VAGONDYS. Un spectacle bi-mensuel impitoyable où les 8 Têtes de Série mondiales sont défiées par 3 Challengers issus du circuit MCS (tirés au sort).`}
                </p>
                <p>
                  {`L'enjeu ? La survie au classement. Dans l'Elite Grind, un champion ne reste jamais assis : il doit prouver sa supériorité sous la pression des caméras et du système VAS.`}
                </p>
              </div>
              <div className="flex flex-wrap gap-12 border-t border-zinc-900 pt-10">
                <div>
                  <span className="block text-[10px] text-zinc-600 uppercase font-black tracking-[0.3em] mb-2">Fréquence Match</span>
                  <span className="text-2xl font-black uppercase italic">2 / Mois</span>
                </div>
                <div>
                  <span className="block text-[10px] text-zinc-600 uppercase font-black tracking-[0.3em] mb-2">Accès Éligibilité</span>
                  <span className="text-2xl font-black uppercase italic text-red-600">Top 16 MCS</span>
                </div>
              </div>
           </div>
        </section>

        {/* --- FOOTER : REJOINDRE LA MAISON --- */}
        <section className="text-center py-32 bg-zinc-950 border border-zinc-900 rounded-2xl">
          <h2 className="text-5xl md:text-6xl font-black uppercase mb-8 italic tracking-tighter">PRENEZ LE CONTRÔLE</h2>
          <p className="text-zinc-500 mb-16 max-w-2xl mx-auto text-[11px] tracking-[0.3em] leading-loose uppercase font-bold px-4">
            {`Obtenez votre Licence PRO ou le AS-POLYMASTER PASS. Accédez aux Cash Prizes, défendez votre Notoriété, et inscrivez votre nom au sommet du EUS.`}
          </p>
          <div className="flex flex-col md:flex-row gap-6 justify-center px-6">
            <button className="bg-red-600 text-white px-12 py-6 font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all transform hover:scale-105 active:scale-95 shadow-xl shadow-red-600/10">
              {`Choisir ma Licence`}
            </button>
            <button className="bg-transparent border border-zinc-800 text-white px-12 py-6 font-black uppercase tracking-widest hover:border-red-600 transition-all transform hover:scale-105">
              {`Calendrier Saison 2026`}
            </button>
          </div>
        </section>

      </div>

      {/* FOOTER DÉCORATIF DE BAS DE PAGE */}
      <footer className="mt-20 flex flex-col items-center gap-6 pb-12">
        <div className="w-12 h-px bg-zinc-900" />
        <div className="flex flex-col items-center gap-2">
          <p className="text-[9px] text-zinc-700 uppercase tracking-[0.6em] font-black">Vagondys Institution</p>
          <p className="text-[8px] text-zinc-800 uppercase tracking-[0.4em]">Propriété de l&apos;Élite — All Rights Reserved</p>
        </div>
      </footer>

    </main>
  );
}
