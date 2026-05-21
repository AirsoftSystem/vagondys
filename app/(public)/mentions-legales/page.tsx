"use client";

import React from 'react';
import { 
  Home, 
  ShieldCheck, 
  Scale, 
  Landmark, 
  Globe, 
  CreditCard, 
  Info, 
  Fingerprint, 
  Mail, 
  Phone 
} from "lucide-react";
import Link from "next/link";

export default function MentionsLegalesPage() {
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

      <div className="max-w-4xl mx-auto">
        
        {/* --- HEADER IDENTITY --- */}
        <header className="mb-24 text-center pt-10">
          <div className="inline-block px-4 py-1 border border-red-600 text-red-600 text-[10px] font-black uppercase tracking-[0.5em] mb-10 animate-pulse">
            Legal Information & Protocols
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter uppercase mb-6 italic leading-none">
            MENTIONS LÉGALES
          </h1>
          <p className="text-zinc-500 font-bold tracking-[0.3em] uppercase text-sm">
            Cadre réglementaire de la Maison VAGONDYS
          </p>
        </header>

        {/* --- GRILLE DE CONTENU LÉGAL --- */}
        <div className="space-y-16 relative">
          {/* Effet de lueur subtile en arrière-plan */}
          <div className="absolute -inset-10 bg-red-600/5 blur-3xl rounded-full pointer-events-none"></div>

          {/* 1. Éditeur du site */}
          <section className="relative bg-zinc-950/50 border-l-2 border-red-600 p-8 md:p-12 transition-colors hover:bg-zinc-900/50 group">
            <div className="flex items-center gap-4 mb-6">
              <Landmark className="w-6 h-6 text-red-600" />
              <h2 className="text-2xl font-black uppercase italic tracking-tighter group-hover:text-red-600 transition-colors">Éditeur du site</h2>
            </div>
            <div className="space-y-4 text-zinc-400 font-medium leading-relaxed">
              <p className="text-white font-bold tracking-widest uppercase">VAGONDYS — Maison d&apos;élite d&apos;airsoft</p>
              <div className="grid md:grid-cols-2 gap-6 text-sm uppercase font-mono tracking-tight">
                <p><span className="text-zinc-600 block mb-1">Statut juridique :</span> SASU</p>
                <p><span className="text-zinc-600 block mb-1">Directeur publication :</span> Thierry Policarpe</p>
                <p className="md:col-span-2"><span className="text-zinc-600 block mb-1">Siège social :</span> 44000 Nantes, France</p>
                
                {/* Bloc Contact & Téléphone mis à jour */}
                <div className="space-y-3">
                  <p className="flex items-center gap-2">
                    <Mail className="w-3 h-3 text-red-600" />
                    <Link href="/contact" className="hover:text-red-600 transition-colors"> 
                      https://www.vagondys.com/contact
                    </Link>
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="w-3 h-3 text-red-600" />
                    <a href="tel:0975260971" className="hover:text-red-600 transition-colors"> 
                      0975260971
                    </a>                  
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="grid md:grid-cols-2 gap-8">
            {/* 2. Hébergement */}
            <section className="bg-zinc-950 border border-zinc-900 p-8 group hover:border-zinc-700 transition-all">
              <div className="flex items-center gap-3 mb-6">
                <Globe className="w-5 h-5 text-red-600" />
                <h2 className="text-lg font-black uppercase italic tracking-tighter">Hébergement</h2>
              </div>
              <p className="text-zinc-500 text-sm leading-relaxed uppercase font-mono">
                Vercel Inc.<br />
                340 S Lemon Ave #4133<br />
                Walnut, CA 91789 – États-Unis<br />
                <a 
                  href="https://vercel.com" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-zinc-700 hover:text-red-600 transition-colors"
                  >
                  https://vercel.com
                </a>
              </p>
            </section>

            {/* 3. Nom de domaine */}
            <section className="bg-zinc-950 border border-zinc-900 p-8 group hover:border-zinc-700 transition-all">
              <div className="flex items-center gap-3 mb-6">
                <Fingerprint className="w-5 h-5 text-red-600" />
                <h2 className="text-lg font-black uppercase italic tracking-tighter">Domaine</h2>
              </div>
              <p className="text-zinc-500 text-sm leading-relaxed uppercase font-mono">
                vagondys.com<br />
                Gestion DNS : Cloudflare, Inc.<br />
                <span className="text-zinc-700 italic">Secure Protocol Active</span><br />
                <a 
                  href="https://www.cloudflare.com" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-zinc-700 hover:text-red-600 transition-colors"
                  >
                  https://www.cloudflare.com
                </a>
              </p>
            </section>
          </div>

          {/* 4. Activité & Responsabilité */}
          <section className="grid md:grid-cols-2 gap-12 py-10 border-y border-zinc-900">
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <Info className="w-5 h-5 text-red-600" />
                <h2 className="text-xl font-black uppercase italic tracking-tighter">Activité du site</h2>
              </div>
              <p className="text-zinc-500 text-[13px] leading-relaxed uppercase tracking-wider font-medium">
                Le site présente les activités de la Maison VAGONDYS, incluant l&apos;organisation d&apos;événements, de compétitions et la réservation de créneaux. Aucune vente directe n&apos;est réalisée sur le site.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <Scale className="w-5 h-5 text-red-600" />
                <h2 className="text-xl font-black uppercase italic tracking-tighter">Responsabilité</h2>
              </div>
              <p className="text-zinc-500 text-[13px] leading-relaxed uppercase tracking-wider font-medium">
                VAGONDYS s&apos;efforce de fournir des informations fiables. Toutefois, aucune garantie n&apos;est donnée quant à l&apos;exactitude ou l&apos;exhaustivité des contenus mis en ligne.
              </p>
            </div>
          </section>

          {/* 5. Paiements & Propriété */}
          <section className="grid md:grid-cols-2 gap-12">
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <CreditCard className="w-5 h-5 text-red-600" />
                <h2 className="text-xl font-black uppercase italic tracking-tighter">Paiements</h2>
              </div>
              <p className="text-zinc-500 text-[13px] leading-relaxed uppercase tracking-wider font-medium">
                Les paiements sont effectués exclusivement via un prestataire externe (SumUp). Aucune donnée bancaire n&apos;est collectée ou stockée par VAGONDYS.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="w-5 h-5 text-red-600" />
                <h2 className="text-xl font-black uppercase italic tracking-tighter">Données personnelles</h2>
              </div>
              <p className="text-zinc-500 text-[13px] leading-relaxed uppercase tracking-wider font-medium">
                Les données collectées sont utilisées uniquement pour répondre aux demandes et gérer les réservations. Elles ne sont ni cédées ni vendues à des tiers.
              </p>
            </div>
          </section>

          {/* Propriété intellectuelle - Final */}
          <section className="text-center py-20 border-t border-zinc-900">
            <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-red-600 mb-6 italic">Copyright & Intellectual Property</h2>
            <p className="text-zinc-700 max-w-2xl mx-auto text-xs uppercase tracking-widest leading-loose font-black">
              L&apos;ensemble du contenu du site est la propriété exclusive de VAGONDYS. Toute reproduction sans autorisation est formellement interdite sous peine de poursuites.
            </p>
          </section>
        </div>
      </div>

      {/* FOOTER DÉCORATIF */}
      <footer className="mt-20 flex flex-col items-center gap-6 pb-12">
        <div className="w-12 h-px bg-zinc-900" />
        <div className="flex flex-col items-center gap-2">
          <p className="text-[9px] text-zinc-700 uppercase tracking-[0.6em] font-black italic">Vagondys Compliance Office</p>
          <p className="text-[8px] text-zinc-800 uppercase tracking-[0.4em]">Signal Secured — 2026</p>
        </div>
      </footer>

    </main>
  );
}
