"use client";

import React from 'react';
import { Home, Shield, Lock, Eye, Database, UserCheck, Cookie } from "lucide-react";
import Link from "next/link";

export default function PolitiqueConfidentialite() {
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
        <header className="mb-20 text-center pt-10">
          <div className="inline-block px-4 py-1 border border-red-600 text-red-600 text-[10px] font-black uppercase tracking-[0.5em] mb-10 animate-pulse">
            Data Protection Protocol
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase mb-6 italic leading-none">
            POLITIQUE DE CONFIDENTIALITÉ
          </h1>
          <p className="text-zinc-500 font-bold tracking-[0.2em] uppercase max-w-2xl mx-auto text-sm leading-relaxed">
            Le site <span className="text-white">VAGONDYS</span> attache une importance particulière à la protection des données personnelles et au respect de la vie privée.
          </p>
        </header>

        {/* --- CONTENU DE LA POLITIQUE --- */}
        <div className="space-y-12 relative">
          <div className="absolute -inset-4 bg-red-600/5 blur-3xl rounded-full pointer-events-none"></div>

          {/* 1. Données collectées */}
          <section className="relative bg-zinc-950 border border-zinc-900 p-8 md:p-10 transition-all hover:border-zinc-700">
            <div className="flex items-center gap-4 mb-6">
              <Eye className="w-6 h-6 text-red-600" />
              <h2 className="text-xl font-black uppercase italic tracking-tight">1. Données collectées</h2>
            </div>
            <p className="text-zinc-400 mb-6 text-sm leading-relaxed uppercase tracking-wide">
              Dans le cadre des réservations et de la gestion des événements, les données suivantes peuvent être collectées :
            </p>
            <ul className="grid md:grid-cols-3 gap-4">
              {["Nom ou pseudonyme", "Adresse e-mail", "Données de réservation"].map((item, idx) => (
                <li key={idx} className="bg-black border border-zinc-800 p-4 text-[10px] font-black uppercase tracking-widest text-center text-zinc-500">
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* 2. Utilisation des données */}
          <section className="relative bg-zinc-950 border border-zinc-900 p-8 md:p-10 transition-all hover:border-zinc-700">
            <div className="flex items-center gap-4 mb-6">
              <Database className="w-6 h-6 text-red-600" />
              <h2 className="text-xl font-black uppercase italic tracking-tight">2. Utilisation des données</h2>
            </div>
            <p className="text-zinc-400 mb-6 text-sm leading-relaxed uppercase tracking-wide">
              Les données collectées sont utilisées exclusivement pour :
            </p>
            <ul className="space-y-3">
              {[
                "La gestion des réservations et des créneaux événementiels",
                "La communication liée aux événements VAGONDYS",
                "Le bon fonctionnement du service technique"
              ].map((text, idx) => (
                <li key={idx} className="flex items-center gap-3 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 bg-red-600 rotate-45"></div>
                  {text}
                </li>
              ))}
            </ul>
          </section>

          {/* 3. Paiements */}
          <section className="relative bg-zinc-950 border border-zinc-900 p-8 md:p-10 transition-all hover:border-zinc-700">
            <div className="flex items-center gap-4 mb-6">
              <Lock className="w-6 h-6 text-red-600" />
              <h2 className="text-xl font-black uppercase italic tracking-tight">3. Paiements</h2>
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed uppercase tracking-wide">
              Les paiements ne sont jamais traités directement sur le site VAGONDYS. Ils sont effectués via une redirection sécurisée vers la plateforme 
              <strong className="text-white ml-1">SumUp</strong>, seule responsable du traitement des données de paiement.
            </p>
          </section>

          <div className="grid md:grid-cols-2 gap-8">
            {/* 4. Conservation */}
            <section className="bg-zinc-950 border border-zinc-900 p-8">
              <h3 className="text-sm font-black uppercase italic tracking-widest mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-red-600" /> 4. Conservation
              </h3>
              <p className="text-zinc-500 text-[11px] leading-relaxed uppercase font-mono">
                Les données sont conservées uniquement pendant la durée nécessaire à l&apos;organisation des événements et au respect des obligations légales.
              </p>
            </section>

            {/* 5. Droits */}
            <section className="bg-zinc-950 border border-zinc-900 p-8">
              <h3 className="text-sm font-black uppercase italic tracking-widest mb-4 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-red-600" /> 5. Vos Droits
              </h3>
              <p className="text-zinc-500 text-[11px] leading-relaxed uppercase font-mono">
                Vous disposez d&apos;un droit d&apos;accès, de rectification et de suppression. Toute demande peut être adressée via la page Contact.
              </p>
            </section>
          </div>

          {/* 6. Cookies */}
          <section className="relative bg-zinc-950 border border-zinc-900 p-8 md:p-10 transition-all hover:border-zinc-700">
            <div className="flex items-center gap-4 mb-6">
              <Cookie className="w-6 h-6 text-red-600" />
              <h2 className="text-xl font-black uppercase italic tracking-tight">6. Cookies</h2>
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed uppercase tracking-wide">
              Le site VAGONDYS utilise uniquement des cookies techniques nécessaires à son bon fonctionnement. Aucun cookie publicitaire ou de tracking tiers n&apos;est utilisé au sein de notre infrastructure.
            </p>
          </section>

        </div>

        {/* --- INFO SECONDAIRE --- */}
        <section className="mt-24 text-center border-t border-zinc-900 pt-12">
          <p className="text-[10px] text-zinc-700 uppercase tracking-[0.4em] font-black italic">
            Dernière mise à jour des protocoles : 01.2026
          </p>
        </section>
      </div>

      <footer className="mt-20 flex flex-col items-center gap-4 pb-12">
        <p className="text-[8px] text-zinc-800 uppercase tracking-[0.6em] font-black">Vagondys Intelligence Cell — Secure Connection</p>
      </footer>

    </main>
  );
}
