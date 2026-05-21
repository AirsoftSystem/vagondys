"use client";

import React from 'react';
import { Home, Trophy, Target, Zap, ShieldAlert, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function CompetitionsPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-24 selection:bg-red-600 font-sans relative">
      
      {/* ========================================== */}
      {/* NAVIGATION HAUTE GAUCHE                    */}
      {/* ========================================== */}
      <div className="absolute top-8 left-8 z-50">
        <Link 
          href="/" 
          className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest group"
        >
          <Home className="w-4 h-4 text-red-600" /> VAGONDYS
        </Link>
      </div>

      <div className="max-w-6xl mx-auto">
        
        {/* --- HEADER IDENTITY --- */}
        <section className="mb-32 text-center pt-10">
          <div className="inline-block px-4 py-1 border border-red-600 text-red-600 text-[10px] font-black uppercase tracking-[0.5em] mb-10 animate-pulse">
            Elite Circuit & Tournament
          </div>
          <h1 className="text-7xl md:text-9xl font-black tracking-tighter uppercase mb-6 italic leading-none">
            COMPÉTITIONS
          </h1>
          <p className="text-red-600 font-bold tracking-[0.4em] uppercase mb-12 text-sm">
            L&apos;arène où les légendes se forgent dans le chaos
          </p>
        </section>

        {/* --- GRILLE DES ÉVÉNEMENTS --- */}
        <section className="grid md:grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 mb-40 overflow-hidden">
          <div className="bg-black p-12 group hover:bg-zinc-900 transition-colors relative">
            <div className="flex justify-between items-start mb-8">
              <Trophy className="w-10 h-10 text-red-600" />
              <span className="text-[10px] font-black text-red-600 border border-red-600 px-2 py-1 uppercase italic">Major Actif</span>
            </div>
            <h3 className="text-3xl font-black italic mb-4 uppercase tracking-tighter">UMS FINALS 2026</h3>
            <p className="text-[11px] text-zinc-500 uppercase tracking-widest leading-loose mb-8">
              Le point culminant de la saison. Les 16 meilleurs athlètes s&apos;affrontent pour le titre de Maître Suprême.
            </p>
            <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white group-hover:text-red-600 transition-colors">
              Détails du tournoi <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-black p-12 group hover:bg-zinc-900 transition-colors relative">
            <div className="flex justify-between items-start mb-8">
              <Zap className="w-10 h-10 text-zinc-700 group-hover:text-red-600 transition-colors" />
              <span className="text-[10px] font-black text-zinc-700 border border-zinc-700 px-2 py-1 uppercase italic">Upcoming</span>
            </div>
            <h3 className="text-3xl font-black italic mb-4 uppercase tracking-tighter">CHALLENGE ÉLITE</h3>
            <p className="text-[11px] text-zinc-500 uppercase tracking-widest leading-loose mb-8">
              Open de sélection pour le circuit EUS. Ouvert aux porteurs de licences Pro uniquement.
            </p>
            <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white group-hover:text-red-600 transition-colors">
              S&apos;inscrire au flux <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* --- SECTION STATISTIQUES GLOBALES --- */}
        <section className="grid md:grid-cols-3 gap-12 mb-40">
          <div className="text-center md:text-left space-y-4">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <Target className="w-5 h-5 text-red-600" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">Précision Globale</span>
            </div>
            <div className="text-5xl font-black italic">84.2%</div>
            <div className="w-full h-1 bg-zinc-900"><div className="w-[84%] h-full bg-red-600" /></div>
          </div>
          
          <div className="text-center md:text-left space-y-4">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">Matches Disputés</span>
            </div>
            <div className="text-5xl font-black italic">1,248</div>
            <p className="text-zinc-600 text-[9px] uppercase font-bold tracking-widest">Saison 2025-2026</p>
          </div>

          <div className="text-center md:text-left space-y-4">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <Trophy className="w-5 h-5 text-red-600" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">Cash Prize Total</span>
            </div>
            <div className="text-5xl font-black italic">15K €</div>
            <p className="text-zinc-600 text-[9px] uppercase font-bold tracking-widest">Distribué cette année</p>
          </div>
        </section>

        {/* --- SECTION INSCRIPTION --- */}
        <section className="text-center py-32 bg-zinc-950 border border-zinc-900 rounded-2xl relative overflow-hidden">
          <div className="absolute left-0 bottom-0 text-[15rem] font-black text-white/2 italic -ml-20 -mb-10 select-none pointer-events-none uppercase">
            COMP
          </div>
          <h2 className="text-5xl font-black uppercase mb-8 italic tracking-tighter relative z-10">REJOIGNEZ L&apos;ÉLITE</h2>
          <p className="text-zinc-500 mb-16 max-w-2xl mx-auto text-[11px] tracking-[0.3em] leading-loose uppercase font-bold px-4 relative z-10">
            Toutes les inscriptions nécessitent une validation manuelle de la cellule Vagondys. Assurez-vous d&apos;avoir vos accréditations à jour.
          </p>
          <div className="flex flex-col md:flex-row gap-6 justify-center px-6 relative z-10">
            <button className="bg-red-600 text-white px-12 py-4 font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all transform hover:scale-105 shadow-xl shadow-red-600/10">
              Soumettre une Candidature
            </button>
          </div>
        </section>

      </div>

      {/* FOOTER DÉCORATIF */}
      <footer className="mt-20 flex flex-col items-center gap-6 pb-12">
        <div className="w-12 h-px bg-zinc-900" />
        <div className="flex flex-col items-center gap-2">
          <p className="text-[9px] text-zinc-700 uppercase tracking-[0.6em] font-black">Vagondys Competition Cell</p>
          <p className="text-[8px] text-zinc-800 uppercase tracking-[0.4em]">Signal Secured — 2026</p>
        </div>
      </footer>

    </main>
  );
}
