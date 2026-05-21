
"use client";

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from "next/navigation";
import { Home, Mail, Phone, User, MessageSquare, Hash, RefreshCcw, ShieldCheck, MapPin, Globe } from "lucide-react";
import Link from "next/link";
import { Turnstile } from '@marsidev/react-turnstile';

// IMPORTS LOCAUX
import { submitContact } from "./actions";
import SubmitButton from "./SubmitButton"; 

/**
 * COMPOSANT INTERNE : ContactFormContent
 * Isolé pour utiliser useSearchParams() à l'intérieur d'un <Suspense>
 */
function ContactFormContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  
  // États pour la gestion dynamique du dossier
  const [email, setEmail] = useState("");
  const [dossierRef, setDossierRef] = useState("0");
  const [isChecking, setIsChecking] = useState(false);
  
  // ✅ AJOUT : États pour pré-remplir pays et ville si athlète existant
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);

  // ✅ MODIFIÉ : Effet pour rechercher la référence via la nouvelle API check-athlete
  useEffect(() => {
    const checkExistingAthlete = async () => {
      // On ne déclenche la recherche que si l'email a une structure minimale valide
      if (email.includes('@') && email.includes('.')) {
        setIsChecking(true);
        try {
          // ✅ ÉTAPE 1 : Recherche dans le MASTER (athletes_registry)
          const checkRes = await fetch(`/api/check-athlete?email=${encodeURIComponent(email)}`);
          
          if (checkRes.ok) {
            const data = await checkRes.json();
            
            if (data.found && data.athlete) {
              // Athlète trouvé dans MASTER
              if (data.athlete.dossier_ref) {
                setDossierRef(data.athlete.dossier_ref);
              }
              
              // ✅ Pré-remplir le pays et la ville détectés
              if (data.athlete.country) {
                setDetectedCountry(data.athlete.country);
              }
              if (data.athlete.city) {
                setDetectedCity(data.athlete.city);
              }
              
              console.log(`✅ Athlète trouvé: ${data.athlete.city}/${data.athlete.country} - Dossier: ${data.athlete.dossier_ref}`);
              return;
            }
          }
          
          // ✅ ÉTAPE 2 : Si non trouvé dans MASTER, rechercher dans GitHub (fallback)
          const emailSlug = email.toLowerCase().replace(/[@.]/g, '_');
          const archiveRes = await fetch(`/api/archive-external?search=${emailSlug}`);
          
          if (archiveRes.ok) {
            const archiveData = await archiveRes.json();
            if (archiveData.dossier_ref) {
              setDossierRef(archiveData.dossier_ref);
              console.log(`📦 Athlète trouvé dans GitHub: ${archiveData.dossier_ref}`);
            } else {
              setDossierRef("0");
            }
          } else {
            setDossierRef("0");
          }
          
        } catch (error) {
          console.error("Erreur check athlète:", error);
          setDossierRef("0");
        } finally {
          setIsChecking(false);
        }
      } else {
        // Reset si l'email est effacé ou invalide
        if (dossierRef !== "0") setDossierRef("0");
        if (detectedCountry) setDetectedCountry(null);
        if (detectedCity) setDetectedCity(null);
      }
    };

    const timer = setTimeout(checkExistingAthlete, 1000); // Debounce de 1s
    return () => clearTimeout(timer);
  }, [email, dossierRef, detectedCountry, detectedCity]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* HEADER IDENTITY */}
      <header className="mb-20 text-center pt-10 min-h-[200px]">
        <div className="inline-block px-4 py-1 border border-red-600 text-red-600 text-[10px] font-black uppercase tracking-[0.5em] mb-10 animate-pulse">
          Direct Transmission Line
        </div>
        <h1 className="text-7xl md:text-8xl font-black tracking-tighter uppercase mb-6 italic leading-none">
          CONTACT
        </h1>
        <p className="text-zinc-500 font-bold tracking-[0.2em] uppercase max-w-xl mx-auto text-sm leading-relaxed">
          Toutes les demandes sont traitées manuellement par la cellule de commandement de la Maison VAGONDYS.
        </p>
      </header>

      {/* AFFICHAGE DU STATUT */}
      {status === 'pending_validation' && (
        <div className="mb-10 bg-zinc-950 border border-red-600/50 p-6 flex flex-col items-center text-center space-y-2 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="text-red-600 text-xs font-black uppercase tracking-[0.3em]">
            SIGNAL INITIALISÉ AVEC SUCCÈS
          </div>
          <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold">
            Vérifiez votre boîte mail pour confirmer la transmission et activer le protocole.
          </p>
        </div>
      )}

      {status === 'confirmed' && (
        <div className="mb-10 bg-zinc-950 border border-green-500/50 p-6 flex flex-col items-center text-center space-y-2 animate-in fade-in slide-in-from-top-4 duration-500">
          <ShieldCheck className="w-6 h-6 text-green-500" />
          <div className="text-green-500 text-xs font-black uppercase tracking-[0.3em]">
            TRANSMISSION CONFIRMÉE
          </div>
          <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold">
            Votre signal a été injecté dans nos systèmes de traitement.
          </p>
        </div>
      )}

      {/* FORMULAIRE DE CONTACT */}
      <section className="relative">
        <div className="absolute -inset-4 bg-red-600/5 blur-3xl rounded-full pointer-events-none"></div>
        
        <form 
          action={submitContact} 
          className="relative bg-zinc-950 border border-zinc-900 p-8 md:p-12 shadow-2xl space-y-8"
        >
          {/* LIGNE 1 : NOM ET EMAIL */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label htmlFor="name" className="flex items-center gap-2 text-[10px] uppercase text-zinc-500 font-black tracking-widest">
                <User className="w-3 h-3 text-red-600" /> Nom / Prénom
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="Martin Jean"
                className="w-full bg-black border border-zinc-800 p-4 text-white focus:border-red-600 outline-none transition-colors font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="flex items-center gap-2 text-[10px] uppercase text-zinc-500 font-black tracking-widest">
                <Mail className="w-3 h-3 text-red-600" /> Adresse Email
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="reseau@vagondys.net"
                  className="w-full bg-black border border-zinc-800 p-4 text-white focus:border-red-600 outline-none transition-colors font-mono text-sm lowercase"
                />
                {isChecking && (
                  <RefreshCcw className="absolute right-4 top-4 w-4 h-4 text-red-600 animate-spin" />
                )}
              </div>
            </div>
          </div>

          {/* LIGNE 2 : DOSSIER_REF ET TÉLÉPHONE */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label htmlFor="dossier_ref" className="flex items-center gap-2 text-[10px] uppercase text-zinc-500 font-black tracking-widest">
                <Hash className="w-3 h-3 text-red-600" /> Référence Dossier
              </label>
              <input
                id="dossier_ref"
                name="dossier_ref"
                type="text"
                value={dossierRef}
                readOnly
                className={`w-full bg-black border p-4 text-white outline-none transition-colors font-mono text-sm uppercase ${dossierRef !== "0" ? "border-green-600/50 text-green-500" : "border-zinc-800 text-zinc-500"}`}
              />
              <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-tighter">
                {dossierRef !== "0" ? "RECONNAISSANCE TERMINÉE : DOSSIER EXISTANT" : "SYSTÈME : RECHERCHE DOSSIER EXISTANT"}
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="phone" className="flex items-center gap-2 text-[10px] uppercase text-zinc-500 font-black tracking-widest">
                <Phone className="w-3 h-3 text-red-600" /> Téléphone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                placeholder="+33 X XX XX XX XX"
                className="w-full bg-black border border-zinc-800 p-4 text-white focus:border-red-600 outline-none transition-colors font-mono text-sm"
              />
            </div>
          </div>

          {/* LIGNE 3 : PAYS ET VILLE (comme dans inscription) */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label htmlFor="country" className="flex items-center gap-2 text-[10px] uppercase text-zinc-500 font-black tracking-widest">
                <Globe className="w-3 h-3 text-red-600" /> Pays
              </label>
              <div className="relative">
                <select
                  id="country"
                  name="country"
                  required
                  defaultValue={detectedCountry || "FR"}
                  className="w-full bg-black border border-zinc-800 p-4 text-white focus:border-red-600 outline-none transition-colors font-mono text-sm appearance-none cursor-pointer uppercase"
                >
                  <option value="FR">FRANCE</option>
                  <option value="ES">ESPAGNE</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-red-600 font-black text-[10px]">
                  ▼
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="city" className="flex items-center gap-2 text-[10px] uppercase text-zinc-500 font-black tracking-widest">
                <MapPin className="w-3 h-3 text-red-600" /> Ville
              </label>
              <div className="relative">
                <select
                  id="city"
                  name="city"
                  required
                  defaultValue={detectedCity || "NANTES"}
                  className="w-full bg-black border border-zinc-800 p-4 text-white focus:border-red-600 outline-none transition-colors font-mono text-sm appearance-none cursor-pointer uppercase"
                >
                  <option value="NANTES">NANTES</option>
                  <option value="LYON">LYON</option>
                  <option value="PARIS">PARIS</option>
                  <option value="MARSEILLE">MARSEILLE</option>
                  <option value="BORDEAUX">BORDEAUX</option>
                  <option value="LILLE">LILLE</option>
                  <option value="TOULOUSE">TOULOUSE</option>
                  <option value="MADRID">MADRID</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-red-600 font-black text-[10px]">
                  ▼
                </div>
              </div>
            </div>
          </div>

          {/* LIGNE 4 : OBJET DU SIGNAL */}
          <div className="space-y-2">
            <label htmlFor="subject" className="flex items-center gap-2 text-[10px] uppercase text-zinc-500 font-black tracking-widest">
              <MessageSquare className="w-3 h-3 text-red-600" /> Objet du signal
            </label>
            <div className="relative">
              <select
                id="subject"
                name="subject"
                required
                className="w-full bg-black border border-zinc-800 p-4 text-white focus:border-red-600 outline-none transition-colors font-mono text-sm appearance-none cursor-pointer uppercase"
              >
                <option value="">— SELECTION_PROTOCOLE —</option>
                <option value="COMMUNICATION">COMMUNICATION</option>
                <option value="SPONSORS">SPONSORS</option>
                <option value="LIGUE">LIGUE</option>
                <option value="COMPETITION">COMPETITION</option>
                <option value="TOURNOIS">TOURNOIS</option>
                <option value="PLAYER">PLAYER</option>
                <option value="INSCRIPTION">INSCRIPTION</option>
                <option value="LICENCE">LICENCE</option>
                <option value="RESERVATIONS">RESERVATIONS</option>
                <option value="NANTES">NANTES</option>
                <option value="AUTRE">AUTRE</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-red-600 font-black text-[10px]">
                ▼
              </div>
            </div>
          </div>

          {/* MESSAGE */}
          <div className="space-y-2">
            <label htmlFor="message" className="block text-[10px] uppercase text-zinc-500 font-black tracking-widest">Message (Crypté)</label>
            <textarea
              id="message"
              name="message"
              required
              rows={6}
              placeholder="SAISISSEZ VOTRE TRANSMISSION ICI..."
              className="w-full bg-black border border-zinc-800 p-4 text-white focus:border-red-600 outline-none transition-colors font-mono text-sm h-48 resize-none"
            />
          </div>

          {/* SÉCURITÉ TURNSTILE */}
          <div className="flex justify-center py-4">
            <Turnstile 
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} 
              options={{ 
                theme: 'dark',
                language: 'fr',
              }}
            />
          </div>

          {/* BOUTON DE SOUMISSION EXTERNE */}
          <SubmitButton />
          
        </form>
      </section>

      <section className="mt-16 text-center space-y-6">
        <p className="text-[10px] text-zinc-700 uppercase tracking-[0.4em] font-black italic">
          En cas de rupture de flux : 
          <a
            href="mailto:contact@vagondys.com"
            className="ml-2 text-zinc-500 hover:text-red-600 underline decoration-red-600/30 transition-all"
          >
            CONTACT@VAGONDYS.COM
          </a>
        </p>
      </section>
    </div>
  );
}

/**
 * PAGE PRINCIPALE : ContactPage
 */
export default function ContactPage() {
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

      <Suspense fallback={<div className="text-center py-20 animate-pulse text-[10px] tracking-widest">LOADING SECURE LINE...</div>}>
        <ContactFormContent />
      </Suspense>

          <div className="flex flex-col items-center gap-2 pt-8 opacity-30">
            <div className="w-8 h-px bg-zinc-800" />
            <p className="text-[8px] text-zinc-500 uppercase tracking-[0.5em] text-center font-bold">
              Vagondys Security Protocol v.16.1.1
            </p>
          </div>

    </main>
  );
}
