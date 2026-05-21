"use client";

import React, { Suspense } from 'react';
import { 
  CheckCircle2, 
  ShieldCheck, 
  Mail, 
  ArrowRight 
} from "lucide-react";
import { useSearchParams } from "next/navigation";

/**
 * Composant de contenu pour extraire la ville des paramètres d'URL
 */
function ActivationContent() {
  const searchParams = useSearchParams();
  
  // Récupération de la ville brute
  const rawCity = searchParams.get('city') || "CORE";
  
  /**
   * NETTOYAGE RADICAL : 
   * Si la variable contient déjà "VAGONDYS", on le supprime pour éviter les doublons 
   * car "VAGONDYS" est déjà écrit en dur en rouge juste avant.
   */
  const city = rawCity.replace(/VAGONDYS/gi, "").trim();

  return (
    <div className="w-full max-w-[450px] z-10">
      
      {/* HEADER : LOGO SUPPRIMÉ - TITRE HARMONISÉ */}
      <header className="flex flex-col items-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        
        {/* TITRE UNIQUE : VAGONDYS (Rouge) VILLE (Blanc) - Taille ajustée (3xl) */}
        <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter uppercase leading-none whitespace-nowrap">
          <span className="text-red-600">VAGONDYS</span> <span className="text-white">{city}</span>
        </h1>
        
        <p className="text-zinc-500 text-[10px] tracking-[0.3em] uppercase mt-4 h-3 font-bold">
          Protocole d&apos;activation terminé
        </p>
      </header>

      {/* PANNEAU CENTRAL */}
      <div className="bg-zinc-950/50 border border-zinc-900 p-8 rounded-[2rem] backdrop-blur-xl space-y-8 animate-in fade-in zoom-in duration-700 delay-200">
        
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-red-600/20 blur-2xl rounded-full animate-pulse" />
            <CheckCircle2 className="w-20 h-20 text-green-600 relative z-10" />
          </div>
        </div>

        <div className="text-center space-y-4">
          <h2 className="text-2xl font-black uppercase italic tracking-tight">
            Compte <span className="text-red-600">Activé</span>
          </h2>
          <div className="h-px w-12 bg-red-600 mx-auto" />
          <p className="text-zinc-400 text-[11px] uppercase tracking-[0.1em] leading-relaxed font-medium">
            Votre accès au réseau est désormais validé. <br />
            Votre <strong className="text-red-600">Matricule Unique</strong> <strong className="text-white"> (N° Dossier)</strong> <br />
            vient de vous être transmis par voie électronique.
          </p>
        </div>

        {/* BOUTON REDIRECTION MAIL */}
        <div className="space-y-4">
          <a 
            href="https://mail.google.com/" 
            target="_blank"
            rel="noopener noreferrer"
            className="group w-full bg-red-600 hover:bg-white text-white hover:text-black font-black py-5 rounded-2xl uppercase tracking-[0.3em] text-[12px] transition-all flex items-center justify-center gap-3 active:scale-95 shadow-[0_0_30px_rgba(220,38,38,0.2)]"
          >
            <Mail className="w-5 h-5" />
            Consulter ma boîte mail
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </a>
          
          <p className="text-center text-[8px] text-zinc-600 uppercase tracking-widest font-bold">
            Vérifiez vos courriers indésirables si besoin
          </p>
        </div>
      </div>

      {/* FOOTER DE SÉCURITÉ */}
      <div className="mt-12 flex flex-col items-center gap-4 opacity-40 animate-in fade-in duration-1000 delay-500">
        <div className="flex items-center gap-3 text-zinc-500">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-[9px] uppercase tracking-[0.2em] font-bold">
            Transmission chiffrée de bout en bout
          </span>
        </div>
        <p className="text-[8px] text-zinc-700 uppercase tracking-widest text-center leading-loose">
          Station de Contrôle Vagondys <br />
          © 2026 Système d&apos;Enrôlement
        </p>
      </div>
    </div>
  );
}

export default function ActivationReussiePage() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* EFFET DE FOND (Aura Rouge Vagondys) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Suspense obligatoire pour useSearchParams dans Next.js app directory */}
      <Suspense fallback={<div className="text-white text-[10px] uppercase tracking-widest animate-pulse">Chargement du protocole...</div>}>
        <ActivationContent />
      </Suspense>

    </main>
  );
}
