
"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { 
  Home, 
  Mail, 
  User, 
  Building2, 
  MessageSquare, 
  Send, 
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FileText
} from "lucide-react";
import { Turnstile } from '@marsidev/react-turnstile';
import FileUploader from "@/components/FileUploader";
import { submitMessagerieRequest } from "./actions";

/**
 * COMPOSANT INTERNE : MessagerieInscriptionContent
 * Contient toute la logique du formulaire et utilise useSearchParams()
 * Isolé dans un composant séparé pour permettre l'encapsulation dans <Suspense>
 * (Requis par Next.js 15+ pour le prerendering)
 */
function MessagerieInscriptionContent() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const statusParam = searchParams.get("status");
  
  // Dérivation directe de l'état success à partir du paramètre d'URL
  const success = statusParam === "pending_validation";
  
  // Dérivation directe du message d'erreur à partir du paramètre d'URL
  let error: string | null = null;
  if (errorParam) {
    switch (errorParam) {
      case "security_error":
        error = "Erreur de sécurité. Veuillez rafraîchir la page.";
        break;
      case "missing_name":
        error = "Veuillez saisir votre nom complet.";
        break;
      case "invalid_email":
        error = "Adresse email invalide.";
        break;
      case "missing_reason":
        error = "Veuillez indiquer le motif de votre demande.";
        break;
      case "missing_kbis":
        error = "L'extrait KBis est obligatoire. Veuillez joindre votre document.";
        break;
      case "virus_detected":
        error = "Le fichier joint contient un virus. Demande rejetée.";
        break;
      case "invalid_document":
        error = "Le document fourni n'a pas pu être validé. Veuillez joindre un KBis officiel.";
        break;
      case "already_pending":
        error = "Une demande est déjà en attente de validation pour cet email.";
        break;
      case "already_approved":
        error = "Un compte existe déjà pour cet email. Veuillez vous connecter.";
        break;
      case "db_error":
        error = "Erreur technique. Veuillez réessayer ultérieurement.";
        break;
      case "config_error":
        error = "Configuration serveur temporairement indisponible.";
        break;
      default:
        error = "Une erreur est survenue. Veuillez réessayer.";
    }
  }
  
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    company: "",
    phone: "",
    reason: "",
  });
  
  // ✅ État pour le fichier KBis
  const [kbisUrl, setKbisUrl] = useState<string>("");
  const [kbisKey, setKbisKey] = useState<string>("");
  const [kbisUploaded, setKbisUploaded] = useState(false);
  const [kbisError, setKbisError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ✅ Gestionnaire pour l'upload du fichier KBis
  const handleKbisUpload = (data: { url: string; key: string }) => {
    setKbisUrl(data.url);
    setKbisKey(data.key);
    setKbisUploaded(true);
    setKbisError(null);
    console.log("✅ KBis uploadé:", data.url);
  };

  const handleKbisError = (err: string) => {
    setKbisError(err);
    setKbisUploaded(false);
    setKbisUrl("");
    setKbisKey("");
  };

  if (success) {
    return (
      <main className="min-h-screen bg-black text-white px-6 py-24 font-sans">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-12 space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">Demande envoyée</h1>
            <p className="text-zinc-400 text-sm">
              Votre demande d&apos;accès à la messagerie privée a bien été transmise.
            </p>
            <p className="text-zinc-500 text-xs">
              Un email de confirmation vous a été envoyé. Notre équipe examinera votre demande sous 48h.
            </p>
            <Link
              href="/communication"
              className="inline-block mt-4 text-red-600 hover:text-white text-xs uppercase tracking-wider transition-colors"
            >
              ← Retour à la page Communication
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-6 py-24 font-sans relative">
      
      {/* Navigation */}
      <div className="absolute top-8 left-8 z-50">
        <Link 
          href="/communication" 
          className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
        >
          <Home className="w-4 h-4 text-red-600" /> Retour
        </Link>
      </div>

      <div className="max-w-3xl mx-auto">
        
        {/* En-tête */}
        <div className="text-center mb-12">
          <div className="inline-block px-4 py-1 border border-red-600 text-red-600 text-[10px] font-black uppercase tracking-[0.5em] mb-6">
            Accès sécurisé
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase mb-4">
            MESSAGERIE <span className="text-red-600">PRIVÉE</span>
          </h1>
          <p className="text-zinc-500 text-sm max-w-xl mx-auto">
            Formulaire de demande d&apos;accès à la messagerie sécurisée VAGONDYS.
            <br />
            Réservé aux partenaires, fournisseurs et prestataires officiels.
          </p>
        </div>

        {/* Formulaire - Utilisation de Server Action */}
        <form action={submitMessagerieRequest} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 md:p-12 space-y-6">
          
          {error && (
            <div className="bg-red-600/10 border border-red-600/30 rounded-xl p-4 flex items-center gap-3 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              <p className="text-[11px] font-black uppercase tracking-widest">{error}</p>
            </div>
          )}

          {kbisError && (
            <div className="bg-orange-600/10 border border-orange-600/30 rounded-xl p-4 flex items-center gap-3 text-orange-500">
              <AlertTriangle className="w-5 h-5" />
              <p className="text-[10px] font-black uppercase tracking-widest">{kbisError}</p>
            </div>
          )}

          {/* Nom complet */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <User className="w-3 h-3 text-red-600" /> Nom complet *
            </label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              required
              placeholder="Jean Dupont"
              className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-sm focus:border-red-600 outline-none transition-colors"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Mail className="w-3 h-3 text-red-600" /> Adresse email *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="contact@entreprise.com"
              className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-sm focus:border-red-600 outline-none transition-colors"
            />
          </div>

          {/* Société / Organisation */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Building2 className="w-3 h-3 text-red-600" /> Société / Organisation
            </label>
            <input
              type="text"
              name="company"
              value={formData.company}
              onChange={handleChange}
              placeholder="VAGONDYS Partenaires"
              className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-sm focus:border-red-600 outline-none transition-colors"
            />
          </div>

          {/* Téléphone */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <MessageSquare className="w-3 h-3 text-red-600" /> Téléphone
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+33 6 12 34 56 78"
              className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-sm focus:border-red-600 outline-none transition-colors"
            />
          </div>

          {/* Motif de la demande */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <MessageSquare className="w-3 h-3 text-red-600" /> Motif de la demande *
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              required
              rows={4}
              placeholder="Décrivez brièvement votre activité et pourquoi vous avez besoin d&apos;un accès à la messagerie privée..."
              className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-sm focus:border-red-600 outline-none transition-colors resize-none"
            />
          </div>

          {/* ✅ SECTION KBis (obligatoire) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-600" />
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Extrait KBis (obligatoire) *
              </label>
            </div>
            
            <div className="bg-black/50 border border-zinc-800 rounded-xl p-4">
              <FileUploader
                context="contact"
                dossierRef="temp"
                onUpload={handleKbisUpload}
                onError={handleKbisError}
                buttonText="Joindre mon extrait KBis"
                disabled={false}
              />
              
              <div className="mt-3 text-[8px] text-zinc-600 uppercase tracking-wider">
                <p>Formats acceptés : PDF, JPEG, PNG, WEBP (max 10 Mo)</p>
                <p className="mt-1">Document officiel obligatoire pour validation du partenariat.</p>
              </div>
              
              {kbisUploaded && (
                <div className="mt-3 flex items-center gap-2 text-green-500">
                  <CheckCircle2 className="w-3 h-3" />
                  <span className="text-[8px] font-black uppercase">KBis téléchargé ✓</span>
                </div>
              )}
            </div>
          </div>

          {/* Champs hidden pour la Server Action */}
          <input type="hidden" name="kbisUrl" value={kbisUrl} />
          <input type="hidden" name="kbisKey" value={kbisKey} />

          {/* Turnstile - comme dans Contact, sans onSuccess ni état */}
          <div className="flex justify-center py-2">
            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
              options={{ theme: "dark", language: "fr" }}
            />
          </div>

          {/* Bouton d’envoi */}
          <button
            type="submit"
            disabled={!kbisUploaded}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-5 rounded-xl uppercase tracking-[0.3em] text-[11px] transition-all flex items-center justify-center gap-3"
          >
            <Send className="w-4 h-4" />
            Soumettre ma demande
          </button>

          {/* Lien vers la connexion */}
          <p className="text-center text-[9px] text-zinc-600 uppercase tracking-widest">
            Déjà un compte ?{" "}
            <Link href="/messagerie/connexion" className="text-red-600 hover:text-red-500 transition-colors">
              Se connecter
            </Link>
          </p>

          <p className="text-[8px] text-zinc-600 text-center uppercase tracking-widest">
            Votre demande sera traitée manuellement par notre administration.
          </p>
        </form>

        {/* Footer */}
        <div className="mt-12 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-zinc-700">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[8px] uppercase tracking-widest">Transmission sécurisée</span>
          </div>
          <p className="text-[7px] text-zinc-800 uppercase tracking-[0.3em]">
            VAGONDYS — Messagerie privée — 2026
          </p>
        </div>
      </div>
    </main>
  );
}

/**
 * PAGE PRINCIPALE : MessagerieInscriptionPage
 * Encapsule le composant interne dans un <Suspense> pour résoudre l'erreur Next.js
 * "useSearchParams() should be wrapped in a suspense boundary"
 */
export default function MessagerieInscriptionPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Chargement...</p>
        </div>
      </main>
    }>
      <MessagerieInscriptionContent />
    </Suspense>
  );
}
