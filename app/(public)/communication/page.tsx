"use client";

import React from 'react';
import { Home, Megaphone, Share2, ShieldCheck, Send } from "lucide-react";
import Link from "next/link";

// ==========================================
// PAGE COMMUNICATION
// ==========================================
export default function CommunicationPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-24 selection:bg-red-600 font-sans relative">
      
      {/* NAVIGATION HAUTE GAUCHE */}
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
            Neural Network & Media
          </div>
          <h1 className="text-7xl md:text-9xl font-black tracking-tighter uppercase mb-6 italic leading-none">
            COMMUNICATION
          </h1>
          <p className="text-red-600 font-bold tracking-[0.4em] uppercase mb-12 text-sm">
            L&apos;interface officielle entre l&apos;élite et le chaos
          </p>
        </section>

        {/* --- GRILLE DES PROTOCOLES --- */}
        <section className="grid md:grid-cols-3 gap-px bg-zinc-800 border border-zinc-800 mb-40 overflow-hidden">
          <div className="bg-black p-10 group hover:bg-zinc-900 transition-colors">
            <Megaphone className="w-8 h-8 text-red-600 mb-6" />
            <h3 className="text-xl font-black italic mb-4 uppercase tracking-tighter">Presse & Médias</h3>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest leading-relaxed">
              Accréditations pour les finales UMS et dossiers de presse haute performance. 
              Contactez notre cellule de diffusion.
            </p>
          </div>
          <div className="bg-black p-10 group hover:bg-zinc-900 transition-colors">
            <Share2 className="w-8 h-8 text-red-600 mb-6" />
            <h3 className="text-xl font-black italic mb-4 uppercase tracking-tighter">Réseaux Sociaux</h3>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest leading-relaxed">
              Suivez le flux en temps réel. Analyse des performances, replays 4DX et 
              annonces des Top 8 mondiaux.
            </p>
          </div>
          <div className="bg-black p-10 group hover:bg-zinc-900 transition-colors">
            <ShieldCheck className="w-8 h-8 text-red-600 mb-6" />
            <h3 className="text-xl font-black italic mb-4 uppercase tracking-tighter">Partenariats</h3>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest leading-relaxed">
              Intégrez l&apos;écosystème Vagondys. Solutions technologiques pour 
              les marques d&apos;élite et sponsors sportifs.
            </p>
          </div>
        </section>

        {/* --- SECTION CONTACT (REMPLACÉE PAR REDIRECTION) --- */}
        <section className="grid md:grid-cols-2 gap-20 mb-40 items-start">
          <div className="space-y-8">
            <h2 className="text-5xl font-black uppercase tracking-tighter italic leading-[0.9]">
              CANAUX DE <br/><span className="text-red-600 text-6xl">TRANSMISSION</span>
            </h2>
            <div className="space-y-6 text-zinc-400 text-lg leading-relaxed font-light">
              <p>
                La communication chez VAGONDYS est régie par une rigueur absolue. Chaque échange est traité comme une donnée critique de notre réseau via notre interface sécurisée.
              </p>
              <div className="p-6 bg-zinc-950 border-l-4 border-red-600 italic text-sm">
                &quot;La clarté de l&apos;information est le premier vecteur de la précision sur le terrain.&quot;
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-red-600/10 blur-3xl rounded-full"></div>
            <div className="relative bg-zinc-950 border border-zinc-800 p-10 shadow-2xl flex flex-col items-center text-center space-y-8">
              <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center border border-red-600/20">
                <Send className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h3 className="text-white font-black uppercase text-xl mb-2 tracking-tighter italic">
                  Prêt pour la transmission ?
                </h3>
                <p className="text-zinc-500 text-xs uppercase tracking-widest leading-relaxed">
                  Cliquez ci-dessous pour accéder au terminal de contact sécurisé et soumettre votre signal.
                </p>
              </div>
              
              <Link 
                href="/contact" 
                className="w-full bg-red-600 text-white py-6 font-black uppercase tracking-[0.3em] hover:bg-white hover:text-black transition-all flex items-center justify-center gap-3 group"
              >
                Ouvrir le terminal <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </Link>

              <p className="text-[9px] text-zinc-600 uppercase tracking-widest">
                Redirection vers le protocole sécurisé VAGONDYS/CONTACT
              </p>
            </div>
          </div>
        </section>

        {/* --- FOOTER DE SECTION --- */}
        <section className="text-center py-32 bg-zinc-950 border border-zinc-900 rounded-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 text-[15rem] font-black text-white/2 italic -mr-20 -mt-10 select-none pointer-events-none uppercase">
            COM
          </div>
          <h2 className="text-5xl font-black uppercase mb-8 italic tracking-tighter relative z-10">RESTEZ CONNECTÉ</h2>
          <p className="text-zinc-500 mb-16 max-w-2xl mx-auto text-[11px] tracking-[0.3em] leading-loose uppercase font-bold px-4 relative z-10">
            Inscrivez-vous au flux de données pour recevoir les rapports de saison, les dates des tournois et les analyses techniques exclusives.
          </p>
          <div className="flex flex-col md:flex-row gap-6 justify-center px-6 relative z-10">
            <button className="bg-white text-black px-12 py-4 font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all transform hover:scale-105">
              Newsletter Officielle
            </button>
          </div>
        </section>

      </div>

      <footer className="mt-20 flex flex-col items-center gap-6 pb-12">
        <div className="w-12 h-px bg-zinc-900" />
        <div className="flex flex-col items-center gap-2">
          <p className="text-[9px] text-zinc-700 uppercase tracking-[0.6em] font-black">Vagondys Com-Cell</p>
          <p className="text-[8px] text-zinc-800 uppercase tracking-[0.4em]">Signal Secured — 2026</p>
        </div>
      </footer>

    </main>
  );
}
