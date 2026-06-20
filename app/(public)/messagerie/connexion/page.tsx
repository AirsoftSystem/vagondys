
"use client";

import React, { useState, Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCcw,
  ChevronRight,
  MessageSquare
} from "lucide-react";
import { createVagondysClient } from "@/lib/supabase/client";

/**
 * Composant de connexion (isolé pour useSearchParams)
 */
function MessagerieLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  
  // ✅ Récupération de l'email depuis l'URL (pré-remplissage)
  const prefilledEmail = searchParams.get("email") || "";
  
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // ✅ Référence pour le champ mot de passe (focus automatique)
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const supabase = createVagondysClient();

  // ✅ Si un email est pré-rempli, focus automatique sur le champ mot de passe
  useEffect(() => {
    if (prefilledEmail && passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [prefilledEmail]);

  /**
   * Récupère le dossier_ref associé à un email via GitHub
   */
  const findDossierRefByEmail = async (userEmail: string): Promise<string | null> => {
    try {
      const response = await fetch("/api/archive-external/find-by-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });
      
      if (!response.ok) return null;
      const data = await response.json();
      return data.dossier_ref || null;
    } catch (err) {
      console.error("Erreur recherche dossier_ref:", err);
      return null;
    }
  };

  /**
   * Restaure un compte depuis GitHub
   */
  const restoreAccount = async (dossierRef: string, city: string = "NANTES", country: string = "FR"): Promise<boolean> => {
    try {
      const response = await fetch("/api/archive-external/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dossier_ref: dossierRef,
          city_code: city,
          country_code: country,
        }),
      });
      return response.ok;
    } catch (err) {
      console.error("Erreur restauration:", err);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError("Veuillez renseigner votre email et mot de passe.");
      setLoading(false);
      return;
    }

    try {
      // 1. Connexion Supabase
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password: password,
      });

      if (signInError) {
        throw new Error("Email ou mot de passe incorrect");
      }

      if (!data.user) {
        throw new Error("Erreur de connexion");
      }

      const userId = data.user.id;
      const userEmail = data.user.email || email.toLowerCase().trim();

      // 2. Vérifier si le compte messagerie est actif (en utilisant l'email prioritairement)
      const checkResponse = await fetch("/api/messagerie/check-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: userId,
          email: userEmail  // ✅ AJOUT : l'email pour permettre la recherche même si user_id est null
        }),
      });
      
      const checkResult = await checkResponse.json();
      
      // 3. Si compte inactif, tenter une restauration depuis GitHub
      if (!checkResponse.ok || !checkResult.isActive) {
        console.log("🔍 Compte inactif, tentative de restauration depuis GitHub...");
        
        const dossierRef = await findDossierRefByEmail(userEmail);
        
        if (dossierRef) {
          const restored = await restoreAccount(dossierRef);
          
          if (restored) {
            console.log("✅ Compte restauré avec succès");
            // Re-vérifier après restauration
            const retryCheck = await fetch("/api/messagerie/check-account", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                userId: userId,
                email: userEmail 
              }),
            });
            const retryResult = await retryCheck.json();
            
            if (retryCheck.ok && retryResult.isActive) {
              // Succès après restauration
              router.refresh();
              router.push("/messagerie");
              return;
            }
          }
        }
        
        // Si restauration impossible ou échouée
        await supabase.auth.signOut();
        throw new Error("Accès non autorisé. Compte messagerie non actif.");
      }

      // 4. Compte actif → redirection
      router.refresh();
      router.push("/messagerie");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full">
      <form onSubmit={handleSubmit} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 space-y-6 shadow-2xl">
        
        {/* Message de succès (ex: compte activé) */}
        {message === "compte_active" && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center">
            <p className="text-[9px] text-green-500 font-black uppercase tracking-widest">
              ✓ Compte activé. Vous pouvez maintenant vous connecter.
            </p>
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div className="bg-red-600/10 border border-red-600/30 rounded-xl p-3 flex items-center gap-2 text-red-500">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p className="text-[9px] font-black uppercase tracking-widest">{error}</p>
          </div>
        )}

        {/* Email */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Adresse email
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-3.5 w-4 h-4 text-zinc-700" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="contact@entreprise.com"
              className="w-full bg-black border border-zinc-800 rounded-xl p-3 pl-11 text-sm focus:border-red-600 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Mot de passe */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Mot de passe
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-3.5 w-4 h-4 text-zinc-700" />
            <input
              ref={passwordInputRef}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full bg-black border border-zinc-800 rounded-xl p-3 pl-11 pr-11 text-sm focus:border-red-600 outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-3 text-zinc-600 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Bouton */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl uppercase tracking-[0.3em] text-[11px] transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <RefreshCcw className="w-4 h-4 animate-spin" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          {loading ? "Connexion..." : "Accéder à ma messagerie"}
        </button>

        {/* Lien vers demande d’inscription */}
        <p className="text-center text-[8px] text-zinc-600 uppercase tracking-widest">
          Pas encore de compte ?{" "}
          <Link href="/messagerie/inscription" className="text-red-600 hover:text-red-500">
            Faire une demande
          </Link>
        </p>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/connexion"
          className="text-[7px] text-zinc-700 hover:text-zinc-500 uppercase tracking-widest transition-colors"
        >
          ← Retour à l&apos;accès joueur
        </Link>
      </div>
    </div>
  );
}

/**
 * Page principale avec Suspense
 */
export default function MessagerieLoginPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
      
      {/* Effet de fond */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        
        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600/10 rounded-full border border-red-600/20 mb-4">
            <MessageSquare className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">
            Messagerie <span className="text-red-600">Privée</span>
          </h1>
          <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-2">
            Espace sécurisé — Accès réservé
          </p>
        </div>

        {/* Formulaire de connexion */}
        <Suspense fallback={
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-12 text-center">
            <RefreshCcw className="w-6 h-6 text-red-600 animate-spin mx-auto" />
          </div>
        }>
          <MessagerieLoginContent />
        </Suspense>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-[6px] text-zinc-800 uppercase tracking-[0.3em]">
            VAGONDYS — Messagerie sécurisée — 2026
          </p>
        </div>
      </div>
    </div>
  );
}
